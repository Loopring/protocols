// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../aux/compression/LzDecompressor.sol";
import "../../core/iface/IExchangeV3.sol";
import "../../thirdparty/BytesUtil.sol";
import "../../lib/MathUint.sol";
import "./SelectorBasedAccessManager.sol";
import "./ISubmitBlocksCallback.sol";


contract LoopringIOExchangeOwner is SelectorBasedAccessManager
{
    using BytesUtil for bytes;
    using MathUint  for uint;

    bytes4 private constant SUBMITBLOCKS_SELECTOR  = IExchangeV3.submitBlocks.selector;
    bool   public  open;

    event SubmitBlocksAccessOpened(bool open);

    constructor(address _exchange)
        SelectorBasedAccessManager(_exchange)
    {
    }

    function submitBlocksCompressed(
        bytes calldata data
        )
        external
    {
        require(
            hasAccessTo(msg.sender, SUBMITBLOCKS_SELECTOR) || open,
            "PERMISSION_DENIED"
        );
        bytes memory decompressed = LzDecompressor.decompress(data);
        require(
            decompressed.toBytes4(0) == SUBMITBLOCKS_SELECTOR,
            "INVALID_DATA"
        );

        (bool success, bytes memory returnData) = target.call(decompressed);
        if (!success) {
            assembly { revert(add(returnData, 32), mload(returnData)) }
        }
    }

    function submitBlocksWithCallbacks(
        ExchangeData.Block[] memory blocks,
        ISubmitBlocksCallback[] memory callbacks,
        uint[] memory blockIndices,
        uint[] memory txIndices,
        bytes[] memory auxiliaryData
        )
        external
    {
        require(
            hasAccessTo(msg.sender, SUBMITBLOCKS_SELECTOR) || open,
            "PERMISSION_DENIED"
        );

        require(callbacks.length == auxiliaryData.length, "INVALID_DATA");

        // Make sure all txs can only be used once
        uint txIdxLowerBound = 0;
        uint previousBlockIdx = 0;
        for (uint i = 0; i < callbacks.length; i++) {
            if (blockIndices[i] > previousBlockIdx) {
                txIdxLowerBound = 0;
            }
            require(blockIndices[i] >= previousBlockIdx, "INVALID_DATA");
            require(txIndices[i] >= txIdxLowerBound, "INVALID_DATA");
            uint numTransactionsConsumed = callbacks[i].onSubmitBlocks(
                blocks,
                blockIndices[i],
                txIndices[i],
                auxiliaryData[i]
            );
            previousBlockIdx = blockIndices[i];
            txIdxLowerBound = txIndices[i].add(numTransactionsConsumed);
        }

        IExchangeV3(target).submitBlocks(blocks);
    }

    function openAccessToSubmitBlocks(bool _open)
        external
        onlyOwner
    {
        open = _open;
        emit SubmitBlocksAccessOpened(_open);
    }
}
