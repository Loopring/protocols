// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../aux/compression/ZeroDecompressor.sol";
import "../../core/iface/IExchangeV3.sol";
import "../../thirdparty/BytesUtil.sol";
import "../../lib/AddressUtil.sol";
import "../../lib/MathUint.sol";
import "./SelectorBasedAccessManager.sol";
import "./IBlockReceiver.sol";


contract LoopringIOExchangeOwner is SelectorBasedAccessManager
{
    using AddressUtil for address;
    using BytesUtil   for bytes;
    using MathUint    for uint;

    bytes4 private constant SUBMITBLOCKS_SELECTOR  = IExchangeV3.submitBlocks.selector;
    bool   public  open;

    event SubmitBlocksAccessOpened(bool open);

    struct BlockCallback {
        IBlockReceiver target;
        uint           blockIdx;
        uint           txIdx;
        bytes          auxiliaryData;
    }

    constructor(address _exchange)
        SelectorBasedAccessManager(_exchange)
    {
    }

    function submitBlocksWithCallbacks(
        bool              isDataCompressed,
        bytes             calldata data,
        BlockCallback[]   calldata callbacks
        )
        external
    {
        require(
            hasAccessTo(msg.sender, SUBMITBLOCKS_SELECTOR) || open,
            "PERMISSION_DENIED"
        );
        bytes memory decompressed = isDataCompressed ?
            ZeroDecompressor.decompress(data, 0):
            data;

        require(
            decompressed.toBytes4(0) == SUBMITBLOCKS_SELECTOR,
            "INVALID_DATA"
        );

        // Process the callback logic.
        if (callbacks.length > 0) {
            bytes memory blockData;
            assembly {
                blockData := add(decompressed, 4)
            }
            ExchangeData.Block[] memory blocks = abi.decode(blockData, (ExchangeData.Block[]));
            processCallbacks(blocks, callbacks);
        }

        target.fastCallAndVerify(gasleft(), 0, decompressed);
    }

    function openAccessToSubmitBlocks(bool _open)
        external
        onlyOwner
    {
        open = _open;
        emit SubmitBlocksAccessOpened(_open);
    }

    function processCallbacks(
        ExchangeData.Block[] memory   blocks,
        BlockCallback[]      calldata callbacks
        )
        internal
    {
        // Make sure all txs can only be used once
        uint txIdxLowerBound = 0;
        uint previousBlockIdx = 0;
        for (uint i = 0; i < callbacks.length; i++) {
            if (callbacks[i].blockIdx > previousBlockIdx) {
                txIdxLowerBound = 0;
            }
            require(callbacks[i].blockIdx >= previousBlockIdx, "INVALID_DATA");
            require(callbacks[i].txIdx >= txIdxLowerBound, "INVALID_DATA");
            uint numTransactionsConsumed = callbacks[i].target.beforeBlockSubmitted(
                blocks[callbacks[i].blockIdx],
                callbacks[i].txIdx,
                callbacks[i].auxiliaryData
            );
            previousBlockIdx = callbacks[i].blockIdx;
            txIdxLowerBound = callbacks[i].txIdx.add(numTransactionsConsumed);
        }
    }
}
