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
        returns (DepositTransaction.Deposit memory deposit)
    {
        _block.readTx(txIdx, ExchangeData.TransactionType.DEPOSIT, txData);
        DepositTransaction.readTx(txData, 1, deposit);
    }

    function readWithdrawal(
        ExchangeData.Block memory _block,
        uint txIdx,
        bytes memory txData
        )
        internal
        pure
        returns (WithdrawTransaction.Withdrawal memory withdrawal)
    {
        _block.readTx(txIdx, ExchangeData.TransactionType.WITHDRAWAL, txData);
        WithdrawTransaction.readTx(txData, 1, withdrawal);
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
        bytes memory txData
        )
        internal
        pure
        returns (TransferTransaction.Transfer memory transfer)
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
        returns (SignatureVerificationTransaction.SignatureVerification memory verification)
    {
         _block.readTx(txIdx, ExchangeData.TransactionType.SIGNATURE_VERIFICATION, txData);
        SignatureVerificationTransaction.readTx(txData, 1, verification);
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
