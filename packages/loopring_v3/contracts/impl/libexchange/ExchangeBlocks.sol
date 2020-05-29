/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "../../lib/AddressUtil.sol";
import "../../lib/BytesUtil.sol";
import "../../lib/MathUint.sol";

import "../../iface/IBlockVerifier.sol";
import "../../iface/IDecompressor.sol";
import "../../iface/ExchangeData.sol";

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

    event BlockSubmitted(
        uint    indexed blockIdx,
        bytes32 indexed publicDataHash
    );

    event ConditionalTransferConsumed(
        uint24  indexed from,
        uint24  indexed to,
        uint16          token,
        uint            amount
    );

    event ProtocolFeesUpdated(
        uint8 takerFeeBips,
        uint8 makerFeeBips,
        uint8 previousTakerFeeBips,
        uint8 previousMakerFeeBips
    );

    event BlockFeeWithdrawn(
        uint    indexed blockIdx,
        uint            amountRewarded,
        uint            amountFined
    );

    function submitBlocks(
        ExchangeData.State storage S,
        ExchangeData.Block[] memory blocks,
        address payable feeRecipient,
        uint            gasLimitSendToken
        )
        public
    {
        // Exchange cannot be in withdrawal mode
        require(!S.isInWithdrawalMode(), "INVALID_MODE");

        // Check if this exchange has a minimal amount of LRC staked
        require(
            S.loopring.canExchangeCommitBlocks(S.id, S.onchainDataAvailability),
            "INSUFFICIENT_EXCHANGE_STAKE"
        );

        // Cache if user requests are enabled for efficiency
        bool areUserRequestsEnabled = S.areUserRequestsEnabled();

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
                publicDataHashes[i],
                areUserRequestsEnabled,
                gasLimitSendToken
            );
        }

        // Verify the blocks
        verifyBlocks(
            S,
            blocks,
            publicDataHashes
        );
    }

    // == Internal Functions ==

    function commitBlock(
        ExchangeData.State storage S,
        ExchangeData.Block memory _block,
        address payable feeRecipient,
        bytes32 publicDataHash,
        bool areUserRequestsEnabled,
        uint gasLimitSendToken
        )
        private
    {
        bytes memory data = _block.data;

        // Extract the exchange ID from the data
        uint32 exchangeIdInData = 0;
        assembly {
            exchangeIdInData := and(mload(add(data, 4)), 0xFFFFFFFF)
        }
        require(exchangeIdInData == S.id, "INVALID_EXCHANGE_ID");

        // Get the old and new Merkle roots
        bytes32 merkleRootBefore;
        bytes32 merkleRootAfter;
        assembly {
            merkleRootBefore := mload(add(data, 36))
            merkleRootAfter := mload(add(data, 68))
        }
        require(merkleRootBefore == S.merkleRoot, "INVALID_MERKLE_ROOT");
        require(uint256(merkleRootAfter) < ExchangeData.SNARK_SCALAR_FIELD(), "INVALID_MERKLE_ROOT");

        uint32 numDepositRequestsCommitted = S.numDepositRequestsCommitted;
        uint32 numWithdrawalRequestsCommitted = S.numWithdrawalRequestsCommitted;

        // When the exchange is shutdown:
        // - First force all outstanding deposits to be done
        // - Allow withdrawing using the special shutdown mode of ONCHAIN_WITHDRAWAL (with
        //   count == 0)
        if (S.isShutdown()) {
            if (numDepositRequestsCommitted < S.depositChain.length) {
                require(_block.blockType == ExchangeData.BlockType.DEPOSIT, "SHUTDOWN_DEPOSIT_BLOCK_FORCED");
            } else {
                require(_block.blockType == ExchangeData.BlockType.ONCHAIN_WITHDRAWAL, "SHUTDOWN_WITHDRAWAL_BLOCK_FORCED");
            }
        }

        // Check if the operator is forced to commit a deposit or withdraw block
        // We give priority to withdrawals. If a withdraw block is forced it needs to
        // be processed first, even if there is also a deposit block forced.
        if (isWithdrawalRequestForced(S, numWithdrawalRequestsCommitted)) {
            require(_block.blockType == ExchangeData.BlockType.ONCHAIN_WITHDRAWAL, "WITHDRAWAL_BLOCK_FORCED");
        } else if (isDepositRequestForced(S, numDepositRequestsCommitted)) {
            require(_block.blockType == ExchangeData.BlockType.DEPOSIT, "DEPOSIT_BLOCK_FORCED");
        }

        if (_block.blockType == ExchangeData.BlockType.SETTLEMENT) {
            require(areUserRequestsEnabled, "SETTLEMENT_SUSPENDED");
            uint32 inputTimestamp;
            uint8 protocolTakerFeeBips;
            uint8 protocolMakerFeeBips;
            assembly {
                inputTimestamp := and(mload(add(data, 72)), 0xFFFFFFFF)
                protocolTakerFeeBips := and(mload(add(data, 73)), 0xFF)
                protocolMakerFeeBips := and(mload(add(data, 74)), 0xFF)
            }
            require(
                inputTimestamp > now - ExchangeData.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS() &&
                inputTimestamp < now + ExchangeData.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS(),
                "INVALID_TIMESTAMP"
            );
            require(
                validateAndUpdateProtocolFeeValues(S, protocolTakerFeeBips, protocolMakerFeeBips),
                "INVALID_PROTOCOL_FEES"
            );
        } else if (_block.blockType == ExchangeData.BlockType.DEPOSIT) {
            uint startIdx = 0;
            uint count = 0;
            assembly {
                startIdx := and(mload(add(data, 136)), 0xFFFFFFFF)
                count := and(mload(add(data, 140)), 0xFFFFFFFF)
            }
            require (startIdx == numDepositRequestsCommitted, "INVALID_REQUEST_RANGE_1");
            require (count <= _block.blockSize, "INVALID_REQUEST_RANGE_2");
            require (startIdx + count <= S.depositChain.length, "INVALID_REQUEST_RANGE_3");

            bytes32 startingHash = S.depositChain[startIdx - 1].accumulatedHash;
            bytes32 endingHash = S.depositChain[startIdx + count - 1].accumulatedHash;
            // Pad the block so it's full
            for (uint i = count; i < _block.blockSize; i++) {
                endingHash = sha256(
                    abi.encodePacked(
                        endingHash,
                        uint24(0),
                        uint(0),
                        uint(0),
                        uint16(0),
                        uint96(0)
                    )
                );
            }
            bytes32 inputStartingHash = 0x0;
            bytes32 inputEndingHash = 0x0;
            assembly {
                inputStartingHash := mload(add(data, 100))
                inputEndingHash := mload(add(data, 132))
            }
            require(inputStartingHash == startingHash, "INVALID_STARTING_HASH");
            require(inputEndingHash == endingHash, "INVALID_ENDING_HASH");

            numDepositRequestsCommitted += uint32(count);
        } else if (_block.blockType == ExchangeData.BlockType.ONCHAIN_WITHDRAWAL) {
            uint startIdx = 0;
            uint count = 0;
            assembly {
                startIdx := and(mload(add(data, 136)), 0xFFFFFFFF)
                count := and(mload(add(data, 140)), 0xFFFFFFFF)
            }
            require (startIdx == numWithdrawalRequestsCommitted, "INVALID_REQUEST_RANGE_1");
            require (count <= _block.blockSize, "INVALID_REQUEST_RANGE_2");
            require (startIdx + count <= S.withdrawalChain.length, "INVALID_REQUEST_RANGE_3");

            if (S.isShutdown()) {
                require (count == 0, "INVALID_WITHDRAWAL_COUNT");
                // Don't check anything here, the operator can do all necessary withdrawals
                // in any order he wants (the circuit still ensures the withdrawals are valid)
            } else {
                require (count > 0, "INVALID_WITHDRAWAL_COUNT");
                bytes32 startingHash = S.withdrawalChain[startIdx - 1].accumulatedHash;
                bytes32 endingHash = S.withdrawalChain[startIdx + count - 1].accumulatedHash;
                // Pad the block so it's full
                for (uint i = count; i < _block.blockSize; i++) {
                    endingHash = sha256(
                        abi.encodePacked(
                            endingHash,
                            uint24(0),
                            uint16(0),
                            uint96(0)
                        )
                    );
                }
                bytes32 inputStartingHash = 0x0;
                bytes32 inputEndingHash = 0x0;
                assembly {
                    inputStartingHash := mload(add(data, 100))
                    inputEndingHash := mload(add(data, 132))
                }
                require(inputStartingHash == startingHash, "INVALID_STARTING_HASH");
                require(inputEndingHash == endingHash, "INVALID_ENDING_HASH");
                numWithdrawalRequestsCommitted += uint32(count);
            }
        } else if (_block.blockType == ExchangeData.BlockType.TRANSFER) {
            validateConditionalTransfers(
                S,
                _block.data,
                _block.auxiliaryData
            );
        } else if (_block.blockType != ExchangeData.BlockType.OFFCHAIN_WITHDRAWAL) {
            revert("UNSUPPORTED_BLOCK_TYPE");
        }

        // Process withdrawals
        if (_block.blockType == ExchangeData.BlockType.ONCHAIN_WITHDRAWAL ||
            _block.blockType == ExchangeData.BlockType.OFFCHAIN_WITHDRAWAL) {
            uint start = 4 + 32 + 32;
            if (_block.blockType == ExchangeData.BlockType.ONCHAIN_WITHDRAWAL) {
                start += 32 + 32 + 4 + 4;
            }
            uint length = 8 * _block.blockSize;
            bytes memory withdrawals = new bytes(0);
            assembly {
                withdrawals := add(data, start)
                mstore(withdrawals, length)
            }
            S.distributeWithdrawals(withdrawals, gasLimitSendToken);
        }

        // Emit an event
        emit BlockSubmitted(S.numBlocksSubmitted, publicDataHash);

        // Transfer the block fee to the fee recipient (for block types with fees paid onchain)
        withdrawBlockFee(
            S,
            S.numBlocksSubmitted,
            numDepositRequestsCommitted,
            numWithdrawalRequestsCommitted,
            feeRecipient
        );

        // Update the onchain state
        S.numDepositRequestsCommitted = numDepositRequestsCommitted;
        S.numWithdrawalRequestsCommitted = numWithdrawalRequestsCommitted;
        S.merkleRoot = merkleRootAfter;
        S.numBlocksSubmitted++;
    }

    function verifyBlocks(
        ExchangeData.State storage S,
        ExchangeData.Block[] memory blocks,
        bytes32[] memory publicDataHashes
        )
        private
        view
    {
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
                S.blockVerifier.verifyProofs(
                    uint8(firstBlock.blockType),
                    S.onchainDataAvailability,
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

    function validateConditionalTransfers(
        ExchangeData.State storage S,
        bytes  memory data,
        bytes  memory auxiliaryData
        )
        private
    {
        uint offset = 4 + 32 + 32;
        // The length of the auxiliary data needs to match the number of conditional transfers
        uint numConditionalTransfers = data.bytesToUint32(offset);
        if (numConditionalTransfers > 0) {
            require(S.onchainDataAvailability, "CONDITIONAL_TRANSFERS_REQUIRE_OCDA");

            require(auxiliaryData.length == numConditionalTransfers * 4, "INVALID_AUXILIARYDATA_LENGTH");
            offset += 4;

            uint24 operatorAccountID = data.bytesToUint24(offset);
            offset += 3;

            // Run over all conditional transfers
            uint previousTransferOffset = 0;
            for (uint i = 0; i < auxiliaryData.length; i += 4) {
                // auxiliaryData contains the transfer index (4 bytes) for each conditional transfer
                // in ascending order.
                uint transferOffset = offset + auxiliaryData.bytesToUint32(i) * 15 + 15;
                require(transferOffset > previousTransferOffset, "INVALID_AUXILIARYDATA_DATA");

                // Get the transfer data
                uint transferData;
                assembly {
                    transferData := and(mload(add(data, transferOffset)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                }

                // Check that this is a conditional transfer
                uint transferType = (transferData >> 112) & 0xFF;
                require(transferType == 1, "INVALID_AUXILIARYDATA_DATA");

                // Update the onchain state
                consumeConditionalTransfer(
                    S,
                    operatorAccountID,
                    transferData
                );

                previousTransferOffset = transferOffset;
            }
        }
    }

    function consumeConditionalTransfer(
        ExchangeData.State storage S,
        uint24 operatorAccountID,
        uint transferData
        )
        private
    {
        // Extract the transfer data
        uint24 fromAccountID = uint24((transferData >> 88) & 0xFFFFFF);
        uint24 toAccountID = uint24((transferData >> 64) & 0xFFFFFF);
        uint16 tokenID = uint16((transferData >> 52) & 0xFFF);
        uint16 feeTokenID = uint16((transferData >> 40) & 0xFFF);
        uint amount = ((transferData >> 16) & 0xFFFFFF).decodeFloat(24);
        uint feeAmount = ((transferData >> 0) & 0xFFFF).decodeFloat(16);

        // Update onchain approvals
        if (amount > 0) {
            S.approvedTransferAmounts[fromAccountID][toAccountID][tokenID] =
                S.approvedTransferAmounts[fromAccountID][toAccountID][tokenID].sub(amount);
            emit ConditionalTransferConsumed(fromAccountID, toAccountID, tokenID, amount);
        }
        if (feeAmount > 0) {
            S.approvedTransferAmounts[fromAccountID][operatorAccountID][feeTokenID] =
                S.approvedTransferAmounts[fromAccountID][operatorAccountID][feeTokenID].sub(feeAmount);
            emit ConditionalTransferConsumed(fromAccountID, operatorAccountID, feeTokenID, feeAmount);
        }
    }

    function withdrawBlockFee(
        ExchangeData.State storage S,
        uint blockIdx,
        uint numDepositRequestsCommittedAfter,
        uint numWithdrawalRequestsCommittedAfter,
        address payable feeRecipient
        )
        internal
    {
        uint feeAmount = 0;
        uint32 lastRequestTimestamp = 0;
        if(numDepositRequestsCommittedAfter > S.numDepositRequestsCommitted) {
            feeAmount = S.depositChain[numDepositRequestsCommittedAfter - 1].accumulatedFee.sub(
                S.depositChain[S.numDepositRequestsCommitted - 1].accumulatedFee
            );
            lastRequestTimestamp = S.depositChain[numDepositRequestsCommittedAfter - 1].timestamp;
        } else if(numWithdrawalRequestsCommittedAfter > S.numWithdrawalRequestsCommitted) {
            feeAmount = S.withdrawalChain[numWithdrawalRequestsCommittedAfter - 1].accumulatedFee.sub(
                S.withdrawalChain[S.numWithdrawalRequestsCommitted - 1].accumulatedFee
            );
            lastRequestTimestamp = S.withdrawalChain[numWithdrawalRequestsCommittedAfter - 1].timestamp;
        } else {
            return;
        }

        // Calculate how much of the fee the operator gets for the block
        // If there are many requests than lastRequestTimestamp ~= firstRequestTimestamp so
        // all requests will need to be done in FEE_BLOCK_FINE_START_TIME minutes to get the complete fee.
        // If there are very few requests than lastRequestTimestamp >> firstRequestTimestamp and we don't want
        // to fine the operator for waiting until he can fill a complete block.
        // This is why we use the timestamp of the last request included in the block.
        uint startTime = lastRequestTimestamp + ExchangeData.FEE_BLOCK_FINE_START_TIME();
        uint fine = 0;
        if (now > startTime) {
            fine = feeAmount.mul(now - startTime) / ExchangeData.FEE_BLOCK_FINE_MAX_DURATION();
        }
        uint feeAmountToBurn = (fine > feeAmount) ? feeAmount : fine;
        uint feeAmountToOperator = feeAmount - feeAmountToBurn;

        // Burn part of the fee by sending it to the protocol fee manager
        S.loopring.protocolFeeVault().sendETHAndVerify(feeAmountToBurn, gasleft());
        // Transfer the fee to the operator
        feeRecipient.sendETHAndVerify(feeAmountToOperator, gasleft());

        emit BlockFeeWithdrawn(blockIdx, feeAmountToOperator, feeAmountToBurn);
    }

    function validateAndUpdateProtocolFeeValues(
        ExchangeData.State storage S,
        uint8 takerFeeBips,
        uint8 makerFeeBips
        )
        private
        returns (bool)
    {
        ExchangeData.ProtocolFeeData storage data = S.protocolFeeData;
        if (now > data.timestamp + ExchangeData.MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED()) {
            // Store the current protocol fees in the previous protocol fees
            data.previousTakerFeeBips = data.takerFeeBips;
            data.previousMakerFeeBips = data.makerFeeBips;
            // Get the latest protocol fees for this exchange
            (data.takerFeeBips, data.makerFeeBips) = S.loopring.getProtocolFeeValues(
                S.id,
                S.onchainDataAvailability
            );
            data.timestamp = uint32(now);

            bool feeUpdated = (data.takerFeeBips != data.previousTakerFeeBips) ||
                (data.makerFeeBips != data.previousMakerFeeBips);

            if (feeUpdated) {
                emit ProtocolFeesUpdated(
                    data.takerFeeBips,
                    data.makerFeeBips,
                    data.previousTakerFeeBips,
                    data.previousMakerFeeBips
                );
            }
        }
        // The given fee values are valid if they are the current or previous protocol fee values
        return (takerFeeBips == data.takerFeeBips && makerFeeBips == data.makerFeeBips) ||
            (takerFeeBips == data.previousTakerFeeBips && makerFeeBips == data.previousMakerFeeBips);
    }

    function isDepositRequestForced(
        ExchangeData.State storage S,
        uint numRequestsCommitted
        )
        private
        view
        returns (bool)
    {
        if (numRequestsCommitted == S.depositChain.length) {
            return false;
        } else {
            return S.depositChain[numRequestsCommitted].timestamp < now.sub(
                ExchangeData.MAX_AGE_REQUEST_UNTIL_FORCED());
        }
    }

    function isWithdrawalRequestForced(
        ExchangeData.State storage S,
        uint numRequestsCommitted
        )
        private
        view
        returns (bool)
    {
        if (numRequestsCommitted == S.withdrawalChain.length) {
            return false;
        } else {
            return S.withdrawalChain[numRequestsCommitted].timestamp < now.sub(
                ExchangeData.MAX_AGE_REQUEST_UNTIL_FORCED());
        }
    }
}
