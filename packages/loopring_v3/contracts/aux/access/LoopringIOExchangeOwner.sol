// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../aux/compression/ZeroDecompressor.sol";
import "../../aux/transactions/TransactionReader.sol";
import "../../core/iface/IExchangeV3.sol";
import "../../thirdparty/BytesUtil.sol";
import "../../lib/AddressUtil.sol";
import "../../lib/Drainable.sol";
import "../../lib/ERC1271.sol";
import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";
import "./SelectorBasedAccessManager.sol";
import "./IBlockReceiver.sol";


contract LoopringIOExchangeOwner is SelectorBasedAccessManager, ERC1271, Drainable
{
    using AddressUtil       for address;
    using AddressUtil       for address payable;
    using BytesUtil         for bytes;
    using MathUint          for uint;
    using SignatureUtil     for bytes32;
    using TransactionReader for ExchangeData.Block;

    bytes4 private constant SUBMITBLOCKS_SELECTOR  = IExchangeV3.submitBlocks.selector;
    bool   public  open;

    event SubmitBlocksAccessOpened(bool open);

    struct TxCallback
    {
        uint16 txIdx;
        uint16 numTxs;
        uint16 receiverIdx;
        bytes  data;
    }

    struct BlockCallback
    {
        uint16        blockIdx;
        TxCallback[]  txCallbacks;
    }

    struct CallbackConfig
    {
        BlockCallback[] blockCallbacks;
        address[]       receivers;
    }

    constructor(address _exchange)
        SelectorBasedAccessManager(_exchange)
    {
    }

    function openAccessToSubmitBlocks(bool _open)
        external
        onlyOwner
    {
        open = _open;
        emit SubmitBlocksAccessOpened(_open);
    }

    function isValidSignature(
        bytes32        signHash,
        bytes   memory signature
        )
        public
        view
        override
        returns (bytes4)
    {
        // Role system used a bit differently here.
        return hasAccessTo(
            signHash.recoverECDSASigner(signature),
            this.isValidSignature.selector
        ) ? ERC1271_MAGICVALUE : bytes4(0);
    }

    function canDrain(address drainer)
        public
        override
        view
        returns (bool)
    {
        return hasAccessTo(drainer, this.drain.selector);
    }

    function submitBlocksWithCallbacks(
        bool                     isDataCompressed,
        bytes           calldata data,
        CallbackConfig  calldata callbackConfig
        )
        external
    {
        bool performCallback;
        if (callbackConfig.blockCallbacks.length > 0) {
            require(callbackConfig.receivers.length > 0, "MISSING_RECEIVERS");
            performCallback = true;
        }

        require(
            hasAccessTo(msg.sender, SUBMITBLOCKS_SELECTOR) || open,
            "PERMISSION_DENIED"
        );
        bytes memory decompressed = isDataCompressed ?
            ZeroDecompressor.decompress(data, 1):
            data;

        require(
            decompressed.toBytes4(0) == SUBMITBLOCKS_SELECTOR,
            "INVALID_DATA"
        );

        // Process the callback logic.
        if (performCallback) {
            _beforeBlockSubmission(_decodeBlocks(decompressed), callbackConfig);
        }

        target.fastCallAndVerify(gasleft(), 0, decompressed);
    }

    function _beforeBlockSubmission(
        ExchangeData.Block[] memory   blocks,
        CallbackConfig       calldata callbackConfig
        )
        private
    {
        int lastBlockIdx = -1;
        for (uint i = 0; i < callbackConfig.blockCallbacks.length; i++) {
            BlockCallback calldata blockCallback = callbackConfig.blockCallbacks[i];

            uint16 blockIdx = blockCallback.blockIdx;
            require(blockIdx > lastBlockIdx, "BLOCK_INDEX_OUT_OF_ORDER");
            lastBlockIdx = int(blockIdx);

            require(blockIdx < blocks.length, "INVALID_BLOCKIDX");
            ExchangeData.Block memory _block = blocks[blockIdx];

            _processTxCallbacks(_block, blockCallback.txCallbacks, callbackConfig.receivers);
        }
    }

    function _processTxCallbacks(
        ExchangeData.Block memory _block,
        TxCallback[]       calldata txCallbacks,
        address[]          calldata receivers
        )
        private
    {
        uint cursor = 0;

        for (uint i = 0; i < txCallbacks.length; i++) {
            TxCallback calldata txCallback = txCallbacks[i];

            uint txIdx = uint(txCallback.txIdx);
            require(txIdx >= cursor, "TX_INDEX_OUT_OF_ORDER");

            uint16 receiverIdx = txCallback.receiverIdx;
            require(receiverIdx < receivers.length, "INVALID_RECEIVER_INDEX");

            ExchangeData.Block memory minimalBlock = _block.createMinimalBlock(txIdx, txCallback.numTxs);
            AmmData.TransactionBuffer memory ctx = IBlockReceiver(receivers[receiverIdx])
                .beforeBlockSubmission(minimalBlock, txCallback.data, 0);

            /*uint numTransactionsConsumed = IBlockReceiver(receivers[receiverIdx])
                .beforeBlockSubmission(_block, txCallback.data, txIdx);
            require(numTransactionsConsumed == txCallback.numTxs, "UNEXPECTED_NUM_TXS_CONSUMED");*/

            cursor = txIdx + txCallback.numTxs;
        }
    }

    function _decodeBlocks(bytes memory data)
        private
        pure
        returns (ExchangeData.Block[] memory)
    {
        // This copies the data (expensive) instead of just pointing to the correct address
        //bytes memory blockData;
        //assembly {
        //    blockData := add(data, 4)
        //}
        //ExchangeData.Block[] memory blocks = abi.decode(blockData, (ExchangeData.Block[]));

        // Points the block data to the aOnly sets the data necessary in the callbacks!
        // 36 := 4 (function selector) + 32 (offset to blocks)
        uint numBlocks = data.toUint(36);
        ExchangeData.Block[] memory blocks = new ExchangeData.Block[](numBlocks);
        for (uint i = 0; i < numBlocks; i++) {
            ExchangeData.Block memory _block = blocks[i];

            // 68 := 36 (see above) + 32 (blocks length)
            uint blockOffset = 68 + data.toUint(68 + i*32);

            uint offset = blockOffset;
            //_block.blockType = uint8(data.toUint(offset));
            offset += 32;
            _block.blockSize = uint16(data.toUint(offset));
            offset += 32;
            //_block.blockVersion = uint8(data.toUint(offset));
            offset += 32;
            uint blockDataOffset = data.toUint(offset);
            offset += 32;

            bytes memory blockData;
            assembly {
                blockData := add(data, add(32, add(blockOffset, blockDataOffset)))
            }
            _block.data = blockData;
        }
        return blocks;
    }
}
