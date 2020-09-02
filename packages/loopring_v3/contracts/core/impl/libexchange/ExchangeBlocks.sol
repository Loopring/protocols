// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../lib/AddressUtil.sol";
import "../../../lib/MathUint.sol";
import "../../../thirdparty/BytesUtil.sol";
import "../../iface/ExchangeData.sol";
import "../../iface/IBlockVerifier.sol";
import "../libtransactions/BlockReader.sol";
import "../libtransactions/AccountUpdateTransaction.sol";
import "../libtransactions/AmmUpdateTransaction.sol";
import "../libtransactions/DepositTransaction.sol";
import "../libtransactions/TransferTransaction.sol";
import "../libtransactions/WithdrawTransaction.sol";
import "./ExchangeMode.sol";
import "./ExchangeWithdrawals.sol";


/// @title ExchangeBlocks.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
library ExchangeBlocks
{
    using AddressUtil          for address;
    using AddressUtil          for address payable;
    using BlockReader          for ExchangeData.Block;
    using BytesUtil            for bytes;
    using MathUint             for uint;
    using ExchangeMode         for ExchangeData.State;
    using ExchangeWithdrawals  for ExchangeData.State;
    using SignatureUtil        for bytes32;

    event BlockSubmitted(
        uint    indexed blockIdx,
        bytes32         merkleRoot,
        bytes32         publicDataHash
    );

    event ProtocolFeesUpdated(
        uint8 takerFeeBips,
        uint8 makerFeeBips,
        uint8 previousTakerFeeBips,
        uint8 previousMakerFeeBips
    );

    function getRequiredExchangeStake(
        ExchangeData.State   storage S
        )
        public
        view
        returns (uint)
    {
        uint numStakingUnit = S.numBlocks / 1000;

        // waive fee for the first 10K blocks.
        if (numStakingUnit <= 10) {
            return 0;
        }

        // Cap at 1 million blocks
        if (numStakingUnit > 1000) {
            numStakingUnit = 1000;
        }

        return numStakingUnit.mul(S.loopring.stakePerThousandBlocks());
    }

    function canSubmitBlocks(
        ExchangeData.State   storage S
        )
        public
        view
        returns (bool)
    {
        uint numStakingUnit = S.numBlocks / 1000;

        // waive fee for the first 10K blocks.
        if (numStakingUnit <= 10) {
            return true;
        }

        // Cap at 1 million blocks
        if (numStakingUnit > 1000) {
            numStakingUnit = 1000;
        }

        return S.loopring.getExchangeStake(S.id) >= getRequiredExchangeStake(S);
    }

    function submitBlocks(
        ExchangeData.State   storage S,
        ExchangeData.Block[] memory  blocks
        )
        public
    {
        // Exchange cannot be in withdrawal mode
        require(!S.isInWithdrawalMode(), "INVALID_MODE");

        require(canSubmitBlocks(S), "INSUFFICIENT_EXCHANGE_STAKE");

        // Commit the blocks
        bytes32[] memory publicDataHashes = new bytes32[](blocks.length);
        for (uint i = 0; i < blocks.length; i++) {
            // Hash all the public data to a single value which is used as the input for the circuit
            publicDataHashes[i] = blocks[i].data.fastSHA256();
            // Commit the block
            commitBlock(S, blocks[i], publicDataHashes[i]);
        }

        // Verify the blocks - blocks are verified in a batch to save gas.
        verifyBlocks(S, blocks, publicDataHashes);
    }

    // == Internal Functions ==

    function commitBlock(
        ExchangeData.State storage S,
        ExchangeData.Block memory  _block,
        bytes32                    _publicDataHash
        )
        private
    {
        // Read the block header
        BlockReader.BlockHeader memory header = _block.readHeader();

        // Validate the exchange
        require(header.exchange == address(this), "INVALID_EXCHANGE");
        // Validate the Merkle roots
        require(header.merkleRootBefore == S.merkleRoot, "INVALID_MERKLE_ROOT");
        require(header.merkleRootAfter != header.merkleRootBefore, "EMPTY_BLOCK_DISABLED");
        require(uint(header.merkleRootAfter) < ExchangeData.SNARK_SCALAR_FIELD(), "INVALID_MERKLE_ROOT");
        // Validate the timestamp
        require(
            header.timestamp > block.timestamp - ExchangeData.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS() &&
            header.timestamp < block.timestamp + ExchangeData.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS(),
            "INVALID_TIMESTAMP"
        );
        // Validate the protocol fee values
        require(
            validateAndSyncProtocolFees(S, header.protocolTakerFeeBips, header.protocolMakerFeeBips),
            "INVALID_PROTOCOL_FEES"
        );

        // Process conditional transactions
        processConditionalTransactions(
            S,
            _block,
            header
        );

        // Emit an event
        uint numBlocks = S.numBlocks;
        emit BlockSubmitted(numBlocks, header.merkleRootAfter, _publicDataHash);

        S.merkleRoot = header.merkleRootAfter;

        if (_block.storeBlockInfoOnchain) {
            S.blocks[numBlocks] = ExchangeData.BlockInfo(
                uint32(block.timestamp),
                bytes28(_publicDataHash)
            );
        }

        S.numBlocks = numBlocks + 1;
    }

    function verifyBlocks(
        ExchangeData.State   storage S,
        ExchangeData.Block[] memory  blocks,
        bytes32[]            memory  publicDataHashes
        )
        private
        view
    {
        IBlockVerifier blockVerifier = S.blockVerifier;
        uint numBlocksVerified = 0;
        bool[] memory blockVerified = new bool[](blocks.length);
        ExchangeData.Block memory firstBlock;
        uint[] memory batch = new uint[](blocks.length);

        while (numBlocksVerified < blocks.length) {
            // Find all blocks of the same type
            uint batchLength = 0;
            for (uint i = 0; i < blocks.length; i++) {
                if (blockVerified[i] == false) {
                    if (batchLength == 0) {
                        firstBlock = blocks[i];
                        batch[batchLength++] = i;
                    } else {
                        ExchangeData.Block memory _block = blocks[i];
                        if (_block.blockType == firstBlock.blockType &&
                            _block.blockSize == firstBlock.blockSize &&
                            _block.blockVersion == firstBlock.blockVersion) {
                            batch[batchLength++] = i;
                        }
                    }
                }
            }

            // Prepare the data for batch verification
            uint[] memory publicInputs = new uint[](batchLength);
            uint[] memory proofs = new uint[](batchLength * 8);

            for (uint i = 0; i < batchLength; i++) {
                uint blockIdx = batch[i];
                // Mark the block as verified
                blockVerified[blockIdx] = true;
                // Strip the 3 least significant bits of the public data hash
                // so we don't have any overflow in the snark field
                publicInputs[i] = uint(publicDataHashes[blockIdx]) >> 3;
                // Copy proof
                ExchangeData.Block memory _block = blocks[blockIdx];
                for (uint j = 0; j < 8; j++) {
                    proofs[i*8 + j] = _block.proof[j];
                }
            }

            // Verify the proofs
            require(
                blockVerifier.verifyProofs(
                    uint8(firstBlock.blockType),
                    firstBlock.blockSize,
                    firstBlock.blockVersion,
                    publicInputs,
                    proofs
                ),
                "INVALID_PROOF"
            );

            numBlocksVerified += batchLength;
        }
    }

    function processConditionalTransactions(
        ExchangeData.State      storage S,
        ExchangeData.Block      memory _block,
        BlockReader.BlockHeader memory header
        )
        private
    {
        if (header.numConditionalTransactions > 0) {
            // Cache the domain seperator to save on SLOADs each time it is accessed.
            ExchangeData.BlockContext memory ctx = ExchangeData.BlockContext({
                DOMAIN_SEPARATOR: S.DOMAIN_SEPARATOR,
                timestamp: header.timestamp
            });

            require(
                _block.auxiliaryData.length == header.numConditionalTransactions,
                "AUXILIARYDATA_INVALID_LENGTH"
            );

            // Run over all conditional transactions
            uint minTxIndex = 0;
            for (uint i = 0; i < _block.auxiliaryData.length; i++) {
                ExchangeData.AuxiliaryData memory auxiliaryData = _block.auxiliaryData[i];
                // Each conditional transaction needs to be processed from left to right
                require(auxiliaryData.txIndex >= minTxIndex, "AUXILIARYDATA_INVALID_ORDER");

                // Get the transaction data
                bytes memory txData = _block.readTransactionData(auxiliaryData.txIndex);

                // Process the transaction
                ExchangeData.TransactionType txType = ExchangeData.TransactionType(
                    txData.toUint8(0)
                );
                uint txDataOffset = 1;

                if (txType == ExchangeData.TransactionType.DEPOSIT) {
                    DepositTransaction.process(
                        S,
                        ctx,
                        txData,
                        txDataOffset,
                        auxiliaryData.data
                    );
                } else if (txType == ExchangeData.TransactionType.WITHDRAWAL) {
                    WithdrawTransaction.process(
                        S,
                        ctx,
                        txData,
                        txDataOffset,
                        auxiliaryData.data
                    );
                } else if (txType == ExchangeData.TransactionType.TRANSFER) {
                    TransferTransaction.process(
                        S,
                        ctx,
                        txData,
                        txDataOffset,
                        auxiliaryData.data
                    );
                } else if (txType == ExchangeData.TransactionType.ACCOUNT_UPDATE) {
                    AccountUpdateTransaction.process(
                        S,
                        ctx,
                        txData,
                        txDataOffset,
                        auxiliaryData.data
                    );
                } else if (txType == ExchangeData.TransactionType.AMM_UPDATE) {
                    AmmUpdateTransaction.process(
                        S,
                        ctx,
                        txData,
                        txDataOffset,
                        auxiliaryData.data
                    );
                } else {
                    // ExchangeData.TransactionType.NOOP and
                    // ExchangeData.TransactionType.SPOT_TRADE
                    // are not supported
                    revert("UNSUPPORTED_TX_TYPE");
                }

                minTxIndex = auxiliaryData.txIndex + 1;
            }
        }
    }

    function validateAndSyncProtocolFees(
        ExchangeData.State storage S,
        uint8 takerFeeBips,
        uint8 makerFeeBips
        )
        private
        returns (bool)
    {
        ExchangeData.ProtocolFeeData memory data = S.protocolFeeData;
        if (block.timestamp > data.syncedAt + ExchangeData.MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED()) {
            // Store the current protocol fees in the previous protocol fees
            data.previousTakerFeeBips = data.takerFeeBips;
            data.previousMakerFeeBips = data.makerFeeBips;
            // Get the latest protocol fees for this exchange
            (data.takerFeeBips, data.makerFeeBips) = S.loopring.getProtocolFeeValues(
                S.id
            );
            data.syncedAt = uint32(block.timestamp);

            if (data.takerFeeBips != data.previousTakerFeeBips ||
                data.makerFeeBips != data.previousMakerFeeBips) {
                emit ProtocolFeesUpdated(
                    data.takerFeeBips,
                    data.makerFeeBips,
                    data.previousTakerFeeBips,
                    data.previousMakerFeeBips
                );
            }

            // Update the data in storage
            S.protocolFeeData = data;
        }
        // The given fee values are valid if they are the current or previous protocol fee values
        return (takerFeeBips == data.takerFeeBips && makerFeeBips == data.makerFeeBips) ||
            (takerFeeBips == data.previousTakerFeeBips && makerFeeBips == data.previousMakerFeeBips);
    }
}
