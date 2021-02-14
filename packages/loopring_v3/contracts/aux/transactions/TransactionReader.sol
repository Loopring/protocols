// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/impl/libtransactions/BlockReader.sol";

import "../../core/impl/libtransactions/AmmUpdateTransaction.sol";
import "../../core/impl/libtransactions/DepositTransaction.sol";
import "../../core/impl/libtransactions/SignatureVerificationTransaction.sol";
import "../../core/impl/libtransactions/TransferTransaction.sol";
import "../../core/impl/libtransactions/WithdrawTransaction.sol";

/// @title TransactionReader
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev Utility library to read transactions.
library TransactionReader {
    using BlockReader       for bytes;
    using TransactionReader for ExchangeData.Block;
    using BytesUtil         for bytes;

    function readDeposit(
        ExchangeData.Block memory _block,
        uint txIdx,
        bytes memory txData
        )
        internal
        pure
        returns (DepositTransaction.Deposit memory)
    {
        _block.readTx(txIdx, ExchangeData.TransactionType.DEPOSIT, txData);
        return DepositTransaction.readTx(txData, 1);
    }

    function readWithdrawal(
        ExchangeData.Block memory _block,
        uint txIdx,
        bytes memory txData
        )
        internal
        pure
        returns (WithdrawTransaction.Withdrawal memory)
    {
        _block.readTx(txIdx, ExchangeData.TransactionType.WITHDRAWAL, txData);
        return WithdrawTransaction.readTx(txData, 1);
    }

    function readAmmUpdate(
        ExchangeData.Block memory _block,
        uint txIdx,
        bytes memory txData,
        AmmUpdateTransaction.AmmUpdate memory ammUpdate
        )
        internal
        pure
        returns (AmmUpdateTransaction.AmmUpdate memory)
    {
        _block.readTx(txIdx, ExchangeData.TransactionType.AMM_UPDATE, txData);
        AmmUpdateTransaction.readTx(txData, 1, ammUpdate);
    }

    function readTransfer(
        ExchangeData.Block memory _block,
        uint txIdx,
        bytes memory txData,
        TransferTransaction.Transfer memory transfer
        )
        internal
        pure
    {
        _block.readTx(txIdx, ExchangeData.TransactionType.TRANSFER, txData);
        TransferTransaction.readTx(txData, 1, transfer);
    }

    function readSignatureVerification(
        ExchangeData.Block memory _block,
        uint txIdx,
        bytes memory txData
        )
        internal
        pure
        returns (SignatureVerificationTransaction.SignatureVerification memory)
    {
         _block.readTx(txIdx, ExchangeData.TransactionType.SIGNATURE_VERIFICATION, txData);
        return SignatureVerificationTransaction.readTx(txData, 1);
    }

    function readTx(
        ExchangeData.Block memory _block,
        uint txIdx,
        ExchangeData.TransactionType txType,
        bytes memory txData
        )
        internal
        pure
    {
        _block.data.readTransactionData(txIdx, _block.blockSize, txData);
        require(txType == ExchangeData.TransactionType(txData.toUint8Unsafe(0)), "UNEXPTECTED_TX_TYPE");
    }

    function createMinimalBlock(
        ExchangeData.Block memory _block,
        uint txIdx,
        uint16 numTransactions
        )
        internal
        pure
        returns (ExchangeData.Block memory)
    {
        ExchangeData.Block memory minimalBlock = ExchangeData.Block({
            blockType: _block.blockType,
            blockSize: numTransactions,
            blockVersion: _block.blockVersion,
            data: new bytes(0),
            proof: _block.proof,
            storeBlockInfoOnchain: _block.storeBlockInfoOnchain,
            auxiliaryData: /*new ExchangeData.AuxiliaryData[](0)*/new bytes(0),
            offchainData: new bytes(0)
        });

        bytes memory header = _block.data.slice(0, BlockReader.OFFSET_TO_TRANSACTIONS);

        // Extract the data of the transactions we want
        // Part 1
        uint txDataOffset = BlockReader.OFFSET_TO_TRANSACTIONS +
            txIdx * ExchangeData.TX_DATA_AVAILABILITY_SIZE_PART_1;
        bytes memory dataPart1 = _block.data.slice(txDataOffset, numTransactions * ExchangeData.TX_DATA_AVAILABILITY_SIZE_PART_1);
        // Part 2
        txDataOffset = BlockReader.OFFSET_TO_TRANSACTIONS +
            _block.blockSize * ExchangeData.TX_DATA_AVAILABILITY_SIZE_PART_1 +
            txIdx * ExchangeData.TX_DATA_AVAILABILITY_SIZE_PART_2;
        bytes memory dataPart2 = _block.data.slice(txDataOffset, numTransactions * ExchangeData.TX_DATA_AVAILABILITY_SIZE_PART_2);

        // Set the data on the block in the standard format
        minimalBlock.data = header.concat(dataPart1).concat(dataPart2);

        return minimalBlock;
    }

    function extractTransactions(
        ExchangeData.Block memory _block,
        uint txIdx,
        uint16 numTransactions
        )
        internal
        pure
        returns (bytes memory)
    {
        bytes memory txsData = new bytes(68*numTransactions);
        bytes memory txData = txsData;
        for (uint i = 0; i < numTransactions; i++) {
            _block.data.readTransactionData(txIdx + i, _block.blockSize, txData);
            assembly {
                txData := add(txData, 68)
            }
        }
        return txsData;
    }
}
