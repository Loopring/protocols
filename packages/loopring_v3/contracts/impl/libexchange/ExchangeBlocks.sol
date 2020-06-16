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
import "../../lib/EIP712.sol";
import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";

import "../../iface/IBlockVerifier.sol";
import "../../iface/IDecompressor.sol";
import "../../iface/ExchangeData.sol";

import "./ExchangeMode.sol";
import "./ExchangeWithdrawals.sol";

import "../libtransactions/TransferTransaction.sol";
import "../libtransactions/PublicKeyUpdateTransaction.sol";
import "../libtransactions/DepositTransaction.sol";


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
        bytes32 indexed publicDataHash,
        uint    indexed blockFee
    );

    event ConditionalTransferConsumed(
        uint24  indexed from,
        uint24  indexed to,
        uint16          token,
        uint            amount
    );

    event OnchainWithdrawalConsumed(
        uint24  indexed owner,
        uint16          token,
        uint            amount
    );

    event ProtocolFeesUpdated(
        uint8 takerFeeBips,
        uint8 makerFeeBips,
        uint8 previousTakerFeeBips,
        uint8 previousMakerFeeBips
    );

    function submitBlocks(
        ExchangeData.State storage S,
        ExchangeData.Block[] memory blocks,
        address payable feeRecipient
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
                areUserRequestsEnabled
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
        bool areUserRequestsEnabled
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

        // Validate inputs
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

        // Process conditional transactions
        uint blockFeeETH = processConditionalTransactions(
            S,
            _block.data,
            _block.auxiliaryData
        );

        // Transfer the onchain block fee to the operator
        feeRecipient.sendETHAndVerify(blockFeeETH, gasleft());

        // Emit an event
        emit BlockSubmitted(S.numBlocksSubmitted, publicDataHash, blockFeeETH);

        // Update the onchain state
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

    event LogBytes(bytes data);
    event LogUint(uint data);

    function processConditionalTransactions(
        ExchangeData.State storage S,
        bytes  memory data,
        bytes  memory auxiliaryData
        )
        private
        returns (uint blockFeeETH)
    {
        uint offset = 4 + 32 + 32 + 4 + 1 + 1;
        // The length of the auxiliary data needs to match the number of conditional transfers
        uint numConditionalTransactions = data.bytesToUint32(offset);
        offset += 4;

        emit LogUint(numConditionalTransactions);
        if (numConditionalTransactions > 0) {
            require(S.onchainDataAvailability, "CONDITIONAL_TRANSACTIONS_REQUIRE_OCDA");

            ExchangeData.AuxiliaryData[] memory txAuxiliaryData = abi.decode(auxiliaryData, (ExchangeData.AuxiliaryData[]));
            require(txAuxiliaryData.length == numConditionalTransactions, "INVALID_AUXILIARYDATA_LENGTH");

            uint24 operatorAccountID = data.bytesToUint24(offset);
            offset += 3;

            // Run over all conditional transfers
            uint previousTransferOffset = 0;
            uint txFeeETH = 0;
            for (uint i = 0; i < txAuxiliaryData.length; i++) {
                // Each conditional transaction needs to be processed from left to right
                uint transferOffset = offset + txAuxiliaryData[i].txIndex * ExchangeData.TX_DATA_AVAILABILITY_SIZE();
                require(transferOffset > previousTransferOffset, "AUXILIARYDATA_INVALID_ORDER");

                // Get the transfer data
                bytes memory txData = data.slice(transferOffset, ExchangeData.TX_DATA_AVAILABILITY_SIZE());

                ExchangeData.TransactionType txType = ExchangeData.TransactionType(txData.bytesToUint8(0));
                emit LogUint(uint(txType));
                emit LogBytes(txData);
                emit LogBytes(txAuxiliaryData[i].data);

                if (txType == ExchangeData.TransactionType.TRANSFER) {
                    txFeeETH = TransferTransaction.process(
                        S,
                        txData,
                        txAuxiliaryData[i].data
                    );
                } else if (txType == ExchangeData.TransactionType.OFFCHAIN_WITHDRAWAL) {
                    txFeeETH = consumeWithdrawal(
                        S,
                        txData,
                        txAuxiliaryData[i].data
                    );
                } else if (txType == ExchangeData.TransactionType.DEPOSIT) {
                    txFeeETH = DepositTransaction.process(
                        S,
                        txData,
                        txAuxiliaryData[i].data
                    );
                }  else if (txType == ExchangeData.TransactionType.PUBLICKEY_UPDATE) {
                    txFeeETH = PublicKeyUpdateTransaction.process(
                        S,
                        txData,
                        txAuxiliaryData[i].data
                    );
                } else {
                    revert("UNKNOWN_TX_TYPE");
                }

                blockFeeETH = blockFeeETH.add(txFeeETH);
                previousTransferOffset = transferOffset;
            }
        }
    }

    function consumeWithdrawal(
        ExchangeData.State storage S,
        bytes memory data,
        bytes memory auxiliaryData
        )
        private
        returns (uint feeETH)
    {
        uint offset = 1;

        uint withdrawalType = data.bytesToUint8(offset);
        offset += 1;

        address owner = data.bytesToAddress(offset);
        offset += 20;
        uint24 accountID = data.bytesToUint24(offset);
        offset += 3;
        //uint32 nonce = data.bytesToUint32(offset);
        offset += 4;
        uint16 tokenID = data.bytesToUint16(offset) >> 4;
        //uint16 feeTokenID = uint16(data.bytesToUint16(offset + 1) & 0xFFF);
        offset += 3;
        uint amountWithdrawn = data.bytesToUint96(offset);
        offset += 12;
        uint fee = uint(data.bytesToUint16(offset)).decodeFloat(16);
        offset += 2;
        uint amountRequested = data.bytesToUint96(offset);
        offset += 12;

        // Check if this was an onchain withdrawal
        // When we're in shutdown mode the operator can do withdrawals without any authorization
        if(withdrawalType > 0 && !S.isInWithdrawalMode()) {
            require(fee == 0, "FEE_NOT_ZERO");
            require(withdrawalType <= 2, "INVALID_WITHDRAWAL_TYPE");

            ExchangeData.Withdrawal storage withdrawal = S.pendingWithdrawals[accountID][tokenID];
            require(withdrawal.amount == amountRequested, "INVALID_WITHDRAW_AMOUNT");

            emit OnchainWithdrawalConsumed(accountID, tokenID, amountRequested);

            // Type == 1: valid onchain withdrawal started by the owner
            // Type == 2: invalid onchain withdrawal started by someone else
            require((withdrawalType == 1) == (owner == withdrawal.owner), "INVALID_WITHDRAW_TYPE");
            // TODO: check against DA

            // Get the fee
            feeETH = withdrawal.fee;

            // Reset the approval
            S.pendingWithdrawals[accountID][tokenID] = ExchangeData.Withdrawal(address(0), 0, 0, 0);

            // Open up a slot
            S.numPendingForcedTransactions--;
        }

        emit LogUint(uint(amountWithdrawn));

        S.distributeWithdrawal(
            owner,
            tokenID,
            amountWithdrawn
        );
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
}
