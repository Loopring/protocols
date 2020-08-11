// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../lib/AddressUtil.sol";
import "../../../lib/MathUint.sol";
import "../../../thirdparty/BytesUtil.sol";
import "../../iface/ExchangeData.sol";
import "../../iface/IBlockVerifier.sol";
import "../libtransactions/AccountUpdateTransaction.sol";
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
    using BytesUtil            for bytes;
    using MathUint             for uint;
    using ExchangeMode         for ExchangeData.State;
    using ExchangeWithdrawals  for ExchangeData.State;
    using SignatureUtil        for bytes32;

    event BlockSubmitted(
        uint    indexed blockIdx,
        bytes32         merkleRoot,
        bytes32         publicDataHash,
        uint            blockFee
    );

    event ProtocolFeesUpdated(
        uint8 takerFeeBips,
        uint8 makerFeeBips,
        uint8 previousTakerFeeBips,
        uint8 previousMakerFeeBips
    );

    function submitBlocks(
        ExchangeData.State   storage S,
        ExchangeData.Block[] memory  blocks,
        address              payable feeRecipient
        )
        public
    {
        // Exchange cannot be in withdrawal mode
        require(!S.isInWithdrawalMode(), "INVALID_MODE");

        // Check if this exchange has a minimal amount of LRC staked
        require(
            S.loopring.canExchangeSubmitBlocks(S.id),
            "INSUFFICIENT_EXCHANGE_STAKE"
        );

        // Commit the blocks
        bytes32[] memory publicDataHashes = new bytes32[](blocks.length);
        for (uint i = 0; i < blocks.length; i++) {
            // Hash all the public data to a single value which is used as the input for the circuit
            publicDataHashes[i] = blocks[i].data.fastSHA256();
            // Commit the block
            commitBlock(
                S,
                blocks[i],
                feeRecipient,
                publicDataHashes[i]
            );
        }

        // Verify the blocks - blocks are verified in a batch to save gas.
        verifyBlocks(
            S,
            blocks,
            publicDataHashes
        );
    }

    // == Internal Functions ==

    function commitBlock(
        ExchangeData.State storage S,
        ExchangeData.Block memory  _block,
        address            payable _feeRecipient,
        bytes32                    _publicDataHash
        )
        private
    {
        uint offset = 0;

        // Extract the exchange address from the data
        address exchange = _block.data.toAddress(offset);
        offset += 20;
        require(exchange == address(this), "INVALID_EXCHANGE");

        // Get the old and new Merkle roots
        bytes32 merkleRootBefore = _block.data.toBytes32(offset);
        offset += 32;
        require(merkleRootBefore == S.merkleRoot, "INVALID_MERKLE_ROOT");

        bytes32 merkleRootAfter = _block.data.toBytes32(offset);
        offset += 32;
        require(merkleRootAfter != merkleRootBefore, "EMPTY_BLOCK_DISABLED");
        require(uint(merkleRootAfter) < ExchangeData.SNARK_SCALAR_FIELD(), "INVALID_MERKLE_ROOT");

        // Validate timestamp
        uint32 inputTimestamp = _block.data.toUint32(offset);
        offset += 4;
        require(
            inputTimestamp > block.timestamp - ExchangeData.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS() &&
            inputTimestamp < block.timestamp + ExchangeData.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS(),
            "INVALID_TIMESTAMP"
        );

        // Validate protocol fee values
        uint8 protocolTakerFeeBips = _block.data.toUint8(offset);
        offset += 1;
        uint8 protocolMakerFeeBips = _block.data.toUint8(offset);
        offset += 1;
        require(
            validateAndSyncProtocolFees(S, protocolTakerFeeBips, protocolMakerFeeBips),
            "INVALID_PROTOCOL_FEES"
        );

        // Process conditional transactions
        uint blockFeeETH = processConditionalTransactions(
            S,
            offset,
            _block.data,
            _block.auxiliaryData,
            inputTimestamp
        );

        // Transfer the onchain block fee to the operator
        _feeRecipient.sendETHAndVerify(blockFeeETH, gasleft());

        // Emit an event
        uint numBlocks = S.numBlocks;
        emit BlockSubmitted(numBlocks, merkleRootAfter, _publicDataHash, blockFeeETH);

        S.merkleRoot = merkleRootAfter;
        if (_block.storeBlockInfoOnchain) {
            S.blocks[numBlocks] = ExchangeData.BlockInfo(uint32(block.timestamp), bytes28(_publicDataHash));
            S.numBlocks = numBlocks + 1;
        }
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
        ExchangeData.State          storage S,
        uint                                offset,
        bytes                        memory data,
        ExchangeData.AuxiliaryData[] memory txAuxiliaryData,
        uint32                              timestamp
        )
        private
        returns (uint blockFeeETH)
    {
        // The length of the auxiliary data needs to match the number of conditional transactions
        uint numConditionalTransactions = data.toUint32(offset);
        offset += 4;

        if (numConditionalTransactions > 0) {
            // Cache the domain seperator to save on SLOADs each time it is accessed.
            ExchangeData.BlockContext memory ctx = ExchangeData.BlockContext({
                DOMAIN_SEPARATOR: S.DOMAIN_SEPARATOR,
                timestamp: timestamp
            });

            require(
                txAuxiliaryData.length == numConditionalTransactions,
                "AUXILIARYDATA_INVALID_LENGTH"
            );

            // uint32 operatorAccountID = data.toUint32(offset);
            offset += 4;

            // Run over all conditional transactions
            uint prevTxDataOffset = 0;
            for (uint i = 0; i < txAuxiliaryData.length; i++) {
                // Each conditional transaction needs to be processed from left to right
                uint txDataOffset = offset +
                    txAuxiliaryData[i].txIndex * ExchangeData.TX_DATA_AVAILABILITY_SIZE();

                require(txDataOffset > prevTxDataOffset, "AUXILIARYDATA_INVALID_ORDER");

                // Process the transaction
                ExchangeData.TransactionType txType = ExchangeData.TransactionType(
                    data.toUint8(txDataOffset)
                );
                txDataOffset += 1;

                uint txFeeETH = 0;
                if (txType == ExchangeData.TransactionType.DEPOSIT) {
                    txFeeETH = DepositTransaction.process(
                        S,
                        ctx,
                        data,
                        txDataOffset,
                        txAuxiliaryData[i].data
                    );
                } else if (txType == ExchangeData.TransactionType.WITHDRAWAL) {
                    txFeeETH = WithdrawTransaction.process(
                        S,
                        ctx,
                        data,
                        txDataOffset,
                        txAuxiliaryData[i].data
                    );
                } else if (txType == ExchangeData.TransactionType.TRANSFER) {
                    txFeeETH = TransferTransaction.process(
                        S,
                        ctx,
                        data,
                        txDataOffset,
                        txAuxiliaryData[i].data
                    );
                } else if (txType == ExchangeData.TransactionType.ACCOUNT_UPDATE) {
                    txFeeETH = AccountUpdateTransaction.process(
                        S,
                        ctx,
                        data,
                        txDataOffset,
                        txAuxiliaryData[i].data
                    );
                } else {
                    // ExchangeData.TransactionType.NOOP and
                    // ExchangeData.TransactionType.SPOT_TRADE
                    // are not supported
                    revert("UNSUPPORTED_TX_TYPE");
                }

                blockFeeETH = blockFeeETH.add(txFeeETH);
                prevTxDataOffset = txDataOffset;
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
