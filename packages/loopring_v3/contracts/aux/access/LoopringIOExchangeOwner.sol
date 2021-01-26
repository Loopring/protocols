// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../aux/compression/ZeroDecompressor.sol";
import "../../aux/transactions/TransactionReader.sol";
import "../../core/iface/IExchangeV3.sol";
import "../../thirdparty/BytesUtil.sol";
import "../../thirdparty/Chi/IChiToken.sol";
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

    bytes4    private constant SUBMITBLOCKS_SELECTOR = IExchangeV3.submitBlocks.selector;
    bool      public  open;
    IChiToken public  immutable chi;

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

    // See:
    // - https://github.com/1inch-exchange/1inchProtocol/blob/a7781cf9aa1cc2aaa5ccab0d54ecbae1327ca08f/contracts/OneSplitAudit.sol#L343
    // - https://github.com/curvefi/curve-ren-adapter/blob/8c1fbc3fec41ebd79b06984d72ff6ace3198e62d/truffle/contracts/CurveExchangeAdapter.sol#L104
    modifier discountCHI(uint maxToBurn)
    {
        uint gasStart = gasleft();
        _;
        uint gasSpent = 21000 + gasStart - gasleft() + 16 * msg.data.length;
        uint fullAmountToBurn = (gasSpent + 14154) / 41947;
        uint amountToBurn = fullAmountToBurn > maxToBurn ? maxToBurn : fullAmountToBurn;
        if (amountToBurn > 0) {
            chi.free(amountToBurn);
        }
    }

    constructor(
        address _exchange,
        address _chi       // Mainnet: 0x0000000000004946c0e9F43F4Dee607b0eF1fA1c
        )
        SelectorBasedAccessManager(_exchange)
    {
        chi = IChiToken(_chi);
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

    function canDrain(address drainer, address /* token */)
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
        CallbackConfig  calldata config,
        uint                     maxGasTokensToBurn
        )
        external
        discountCHI(maxGasTokensToBurn)
    {
        if (config.blockCallbacks.length > 0) {
            require(config.receivers.length > 0, "MISSING_RECEIVERS");

            // Make sure the receiver is authorized to approve transactions
            IAgentRegistry agentRegistry = IExchangeV3(target).getAgentRegistry();
            for (uint i = 0; i < config.receivers.length; i++) {
                require(agentRegistry.isUniversalAgent(config.receivers[i]), "UNAUTHORIZED_RECEIVER");
            }
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

        // Decode the blocks
        ExchangeData.Block[] memory blocks = _decodeBlocks(decompressed);

        // Process the callback logic.
        _beforeBlockSubmission(blocks, config);

        target.fastCallAndVerify(gasleft(), 0, decompressed);
    }

    function _beforeBlockSubmission(
        ExchangeData.Block[] memory   blocks,
        CallbackConfig       calldata config
        )
        private
    {
        // Allocate memory to verify transactions that are approved
        bool[][] memory preApprovedTxs = new bool[][](blocks.length);
        for (uint i = 0; i < blocks.length; i++) {
            preApprovedTxs[i] = new bool[](blocks[i].blockSize);
        }

        // Process transactions
        int lastBlockIdx = -1;
        for (uint i = 0; i < config.blockCallbacks.length; i++) {
            BlockCallback calldata blockCallback = config.blockCallbacks[i];

            uint16 blockIdx = blockCallback.blockIdx;
            require(blockIdx > lastBlockIdx, "BLOCK_INDEX_OUT_OF_ORDER");
            lastBlockIdx = int(blockIdx);

            require(blockIdx < blocks.length, "INVALID_BLOCKIDX");
            ExchangeData.Block memory _block = blocks[blockIdx];

            _processTxCallbacks(
                _block,
                blockCallback.txCallbacks,
                config.receivers,
                preApprovedTxs[blockIdx]
            );
        }

        // Verify the approved transactions data against the auxiliary data in the block
        for (uint i = 0; i < blocks.length; i++) {
            bool[] memory _preApprovedTxs = preApprovedTxs[i];
            ExchangeData.AuxiliaryData[] memory auxiliaryData = blocks[i].auxiliaryData;
            for(uint j = 0; j < auxiliaryData.length; j++) {
                // Load the data from auxiliaryData, which is still encoded as calldata
                uint txIdx;
                bool approved;
                assembly {
                    // Offset to auxiliaryData[j]
                    let auxOffset := mload(add(auxiliaryData, add(32, mul(32, j))))
                    // Load `txIdx` (pos 0) and `approved` (pos 1) in auxiliaryData[j]
                    txIdx := mload(add(add(32, auxiliaryData), auxOffset))
                    approved := mload(add(add(64, auxiliaryData), auxOffset))
                }
                // Check that the provided data matches the expected value
                require(_preApprovedTxs[txIdx] == approved, "PRE_APPROVED_TX_MISMATCH");
            }
        }
    }

    function _processTxCallbacks(
        ExchangeData.Block memory _block,
        TxCallback[]       calldata txCallbacks,
        address[]          calldata receivers,
        bool[]             memory   preApprovedTxs
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
            IBlockReceiver(receivers[receiverIdx]).beforeBlockSubmission(
                minimalBlock,
                txCallback.data,
                0,
                txCallback.numTxs
            );

            // Now that the transactions have been verified, mark them as approved
            for (uint j = txIdx; j < txIdx + txCallback.numTxs; j++) {
                preApprovedTxs[j] = true;
            }

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

        // Points the block data to the data in the abi encoded data.
        // Only sets the data necessary in the callbacks!
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
            // Skip over proof
            offset += 32 * 8;
            // Skip over storeBlockInfoOnchain
            offset += 32;
            uint auxiliaryDataOffset = data.toUint(offset);
            offset += 32;

            bytes memory blockData;
            assembly {
                blockData := add(data, add(32, add(blockOffset, blockDataOffset)))
            }
            _block.data = blockData;

            ExchangeData.AuxiliaryData[] memory auxiliaryData;
            assembly {
                auxiliaryData := add(data, add(32, add(blockOffset, auxiliaryDataOffset)))
            }
            // Still encoded as calldata!
            _block.auxiliaryData = auxiliaryData;
        }
        return blocks;
    }
}
