// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/impl/libtransactions/BlockReader.sol";

import "../../core/impl/libtransactions/AmmUpdateTransaction.sol";
import "../../core/impl/libtransactions/DepositTransaction.sol";
import "../../core/impl/libtransactions/WithdrawTransaction.sol";

/// @title BlockReaderUtils
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev Utility library to read transactions.
library BlockReaderUtils {
    using BlockReader       for ExchangeData.Block;
    using BlockReaderUtils  for ExchangeData.Block;
    using BytesUtil         for bytes;

    function readDeposit(
        ExchangeData.Block memory _block,
        uint txIdx
        )
        internal
        pure
        returns (DepositTransaction.Deposit memory)
    {
        bytes memory data = _block.readTransactionData(txIdx);
        ExchangeData.TransactionType txType = ExchangeData.TransactionType(
            data.toUint8(0)
        );
        require(txType == ExchangeData.TransactionType.DEPOSIT, "UNEXPTECTED_TX_TYPE");
        return DepositTransaction.readTx(data, 1);
    }

    function readWithdrawal(
        ExchangeData.Block memory _block,
        uint txIdx
        )
        internal
        pure
        returns (WithdrawTransaction.Withdrawal memory)
    {
        bytes memory data = _block.readTransactionData(txIdx);
        ExchangeData.TransactionType txType = ExchangeData.TransactionType(
            data.toUint8(0)
        );
        require(txType == ExchangeData.TransactionType.WITHDRAWAL, "UNEXPTECTED_TX_TYPE");
        return WithdrawTransaction.readTx(data, 1);
    }

    function readAmmUpdate(
        ExchangeData.Block memory _block,
        uint txIdx
        )
        internal
        pure
        returns (AmmUpdateTransaction.AmmUpdate memory)
    {
        bytes memory data = _block.readTransactionData(txIdx);
        ExchangeData.TransactionType txType = ExchangeData.TransactionType(
            data.toUint8(0)
        );
        require(txType == ExchangeData.TransactionType.AMM_UPDATE, "UNEXPTECTED_TX_TYPE");
        return AmmUpdateTransaction.readTx(data, 1);
    }
}
