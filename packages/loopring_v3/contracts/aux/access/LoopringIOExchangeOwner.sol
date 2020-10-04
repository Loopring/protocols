// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../amm/libamm/AmmData.sol";
import "../../amm/libamm/IAmmBlockReceiver.sol";
import "../../aux/compression/ZeroDecompressor.sol";
import "../../core/iface/IExchangeV3.sol";
import "../../thirdparty/BytesUtil.sol";
import "../../lib/AddressUtil.sol";
import "../../lib/Drainable.sol";
import "../../lib/ERC1271.sol";
import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";
import "./SelectorBasedAccessManager.sol";


contract LoopringIOExchangeOwner is SelectorBasedAccessManager, ERC1271, Drainable
{
    using AddressUtil     for address;
    using BytesUtil       for bytes;
    using MathUint        for uint;
    using SignatureUtil   for bytes32;

    bytes4 private constant SUBMITBLOCKS_SELECTOR  = IExchangeV3.submitBlocks.selector;
    bool   public  open;

    event SubmitBlocksAccessOpened(bool open);

    struct TxCallback
    {
        uint16 txIdx;
        uint16 receiverIdx;
        bytes  data;
    }

    struct BlockCallback
    {
        uint16        blockIdx;
        TxCallback[]  txs;
    }

    struct CallbackConfig
    {
        BlockCallback[]  blocks;
        IAmmBlockReceiver[] receivers;
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
        CallbackConfig  calldata config
        )
        external
    {
        bool performCallback;
        if (config.blocks.length > 0) {
            require(config.receivers.length > 0, "MISSING_RECEIVERS");
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
            bytes memory blockData;
            assembly {
                blockData := add(decompressed, 4)
            }
            ExchangeData.Block[] memory blocks = abi.decode(blockData, (ExchangeData.Block[]));
            _processReceivers(blocks, config);
        }

        target.fastCallAndVerify(gasleft(), 0, decompressed);
    }

    function _processReceivers(
        ExchangeData.Block[] memory   blocks,
        CallbackConfig       calldata config
        )
        private
    {

        AmmData.Context[] memory ctxs = new AmmData.Context[](config.receivers.length);
        for (uint j = 0; j < ctxs.length; j++) {
            ctxs[j] = config.receivers[j].beforeAllBlocks();
        }

        int lastBlockIdx = -1;
        for (uint i = 0; i < config.blocks.length; i++) {
            BlockCallback calldata blockCallback = config.blocks[i];

            uint16 blockIdx = blockCallback.blockIdx;
            require(blockIdx > lastBlockIdx, "BLOCK_INDEX_OUT_OF_ORDER");
            lastBlockIdx = int(blockIdx);

            require(blockIdx < blocks.length, "INVALID_BLOCKIDX");
            ExchangeData.Block memory _block = blocks[blockIdx];

            for (uint j = 0; j < ctxs.length; j++) {
               config.receivers[j].beforeEachBlock(_block, ctxs[j]);
            }

            _processTransactions(_block, ctxs, blockCallback.txs, config.receivers);

            // for (uint j = 0; j < ctxs.length; j++) {
            //     config.receivers[j].afterEachBlock(_block, ctxs[j]);
            // }
        }

        for (uint i = 0; i < config.receivers.length; i++) {
            config.receivers[i].afterAllBlocks(ctxs[i]);
        }
    }

    // Question(brecht): is `calldata` used correctly here?
    function _processTransactions(
        ExchangeData.Block  memory   _block,
        AmmData.Context[]   memory   ctxs,
        TxCallback[]        calldata txs,
        IAmmBlockReceiver[] calldata receivers
        )
        private
    {
        uint cursor = 0;

        for (uint i = 0; i < txs.length; i++) {
            TxCallback calldata _tx = txs[i];

            uint txIdx = uint(_tx.txIdx);
            require(txIdx >= cursor, "BLOCK_INDEX_OUT_OF_ORDER");

            uint16 idx = _tx.receiverIdx;
            require(idx < receivers.length, "INVALID_RECEIVER_INDEX");

            uint numTxConsumed = receivers[idx].onAmmTransaction(
                _block,
                ctxs[idx],
                _tx.data,
                txIdx
            );
            cursor = txIdx + numTxConsumed + 1;
        }
    }
}
