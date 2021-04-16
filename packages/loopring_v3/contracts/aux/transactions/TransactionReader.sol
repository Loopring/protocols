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
        _block.readTx(txIdx, txData);
        DepositTransaction.readTx(txData, 0, deposit);
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
        _block.readTx(txIdx, txData);
        WithdrawTransaction.readTx(txData, 0, withdrawal);
    }

    function readAmmUpdate(
        ExchangeData.Block memory _block,
        uint txIdx,
        bytes memory txData
        )
        internal
        pure
        returns (AmmUpdateTransaction.AmmUpdate memory ammUpdate)
    {
        _block.readTx(txIdx, txData);
        AmmUpdateTransaction.readTx(txData, 0, ammUpdate);
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
        _block.readTx(txIdx, txData);
        TransferTransaction.readTx(txData, 0, transfer);
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
        _block.readTx(txIdx, txData);
        SignatureVerificationTransaction.readTx(txData, 0, verification);
    }

    function readTx(
        ExchangeData.Block memory _block,
        uint txIdx,
        bytes memory txData
        )
        internal
        pure
    {
        _block.data.readTransactionData(txIdx, _block.blockSize, txData);
    }

    function readTxs(
        ExchangeData.Block memory _block,
        uint                      txIdx,
        uint16                    numTransactions,
        bytes              memory txsData
        )
        internal
        pure
    {
        require(txIdx + numTransactions <= _block.blockSize, "INVALID_TX_RANGE");

        uint TX_DATA_AVAILABILITY_SIZE = ExchangeData.TX_DATA_AVAILABILITY_SIZE;
        uint TX_DATA_AVAILABILITY_SIZE_PART_1 = ExchangeData.TX_DATA_AVAILABILITY_SIZE_PART_1;
        uint TX_DATA_AVAILABILITY_SIZE_PART_2 = ExchangeData.TX_DATA_AVAILABILITY_SIZE_PART_2;

        // Part 1
        uint offset = BlockReader.OFFSET_TO_TRANSACTIONS +
            txIdx * TX_DATA_AVAILABILITY_SIZE_PART_1;
        bytes memory data1 = _block.data;
        assembly {
            data1 := add(data1, add(offset, 32))
        }

        // Part 2
        offset = BlockReader.OFFSET_TO_TRANSACTIONS +
            _block.blockSize * TX_DATA_AVAILABILITY_SIZE_PART_1 +
            txIdx * TX_DATA_AVAILABILITY_SIZE_PART_2;
        bytes memory data2 = _block.data;
        assembly {
            data2 := add(data2, add(offset, 32))
        }

        // Add fixed offset once
        assembly {
            txsData := add(txsData, 32)
        }

        // Read the transactions
        for (uint i = 0; i < numTransactions; i++) {
            assembly {
                mstore(    txsData     , mload(    data1    ))
                mstore(add(txsData, 29), mload(    data2    ))
                mstore(add(txsData, 36), mload(add(data2, 7)))

                txsData := add(txsData, TX_DATA_AVAILABILITY_SIZE)
                data1   := add(data1  , TX_DATA_AVAILABILITY_SIZE_PART_1)
                data2   := add(data2  , TX_DATA_AVAILABILITY_SIZE_PART_2)
            }
        }
    }
}
