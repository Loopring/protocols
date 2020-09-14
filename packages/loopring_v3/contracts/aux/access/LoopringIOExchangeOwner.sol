// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../aux/compression/ZeroDecompressor.sol";
import "../../core/iface/IExchangeV3.sol";
import "../../thirdparty/BytesUtil.sol";
import "../../lib/MathUint.sol";
import "../../lib/ReentrancyGuard.sol";
import "./SelectorBasedAccessManager.sol";
import "./IBlockReceiver.sol";


contract LoopringIOExchangeOwner is SelectorBasedAccessManager, ReentrancyGuard
{
    using BytesUtil for bytes;
    using MathUint  for uint;

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

    function compressCall(
        bytes calldata data
        )
        external
    {
        require(
            hasAccessTo(msg.sender, SUBMITBLOCKS_SELECTOR) || open,
            "PERMISSION_DENIED"
        );
        bytes memory decompressed = ZeroDecompressor.decompress(data);
        require(
            decompressed.toBytes4(0) == SUBMITBLOCKS_SELECTOR,
            "INVALID_DATA"
        );

        address addr = target;
        assembly {
            let success := call(gas(), addr, 0, add(decompressed, 32), mload(decompressed), decompressed, 0)
            if eq(success, 0) {
                let size := returndatasize()
                returndatacopy(decompressed, 0, returndatasize())
                revert(decompressed, size)
            }
        }
    }

    function submitBlocksWithCallbacks(
        uint    preconditionBlockNumber,
        bytes32 preconditionBlockHash,
        ExchangeData.Block[] memory blocks,
        BlockCallback[]      memory callbacks
        )
        external
        nonReentrant
    {
        require(
            hasAccessTo(msg.sender, SUBMITBLOCKS_SELECTOR) || open,
            "PERMISSION_DENIED"
        );

        if (preconditionBlockNumber == 0) {
            require(preconditionBlockHash == bytes32(0), "INVALID_PRECONDITION_BLOCK_HASH");
        } else if (block.number.sub(preconditionBlockNumber) <= 256) {
            require(
                blockhash(preconditionBlockNumber) == preconditionBlockHash,
                "INVALID_PRECONDITION"
            );
        }

        // Process the callback logic.
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

        // Finally submit the blocks
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
