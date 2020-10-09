// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/impl/libtransactions/BlockReader.sol";

import "../../core/impl/libtransactions/AmmUpdateTransaction.sol";
import "../../core/impl/libtransactions/DepositTransaction.sol";
import "../../core/impl/libtransactions/TransferTransaction.sol";
import "../../core/impl/libtransactions/WithdrawTransaction.sol";

/// @title TransactionReader
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev Utility library to read transactions.
library TransactionReader {
    using BlockReader       for ExchangeData.Block;
    using TransactionReader for ExchangeData.Block;
    using BytesUtil         for bytes;

    function readDeposit(
        ExchangeData.Block memory _block,
        uint txIdx
        )
        internal
        pure
        returns (DepositTransaction.Deposit memory)
    {
        bytes memory data = _block.readTx(txIdx, ExchangeData.TransactionType.DEPOSIT);
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
        bytes memory data = _block.readTx(txIdx, ExchangeData.TransactionType.WITHDRAWAL);
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
        bytes memory data = _block.readTx(txIdx, ExchangeData.TransactionType.AMM_UPDATE);
        return AmmUpdateTransaction.readTx(data, 1);
    }

    function readTransfer(
        ExchangeData.Block memory _block,
        uint txIdx
        )
        internal
        pure
        returns (TransferTransaction.Transfer memory)
    {
        bytes memory data = _block.readTx(txIdx, ExchangeData.TransactionType.TRANSFER);
        return TransferTransaction.readTx(data, 1);
    }

    function readTx(
        ExchangeData.Block memory _block,
        uint txIdx,
        ExchangeData.TransactionType txType
        )
        internal
        pure
        returns (bytes memory data)
    {
        data = _block.readTransactionData(txIdx);
        require(txType == ExchangeData.TransactionType(data.toUint8(0)), "UNEXPTECTED_TX_TYPE");
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
            proof: [uint(0), 0, 0, 0, 0, 0, 0, 0],
            storeBlockInfoOnchain: false,
            auxiliaryData: new ExchangeData.AuxiliaryData[](0),
            offchainData: new bytes(0)
        });

        bytes memory header = _block.data.slice(0, BlockReader.OFFSET_TO_TRANSACTIONS);

        // Part 1
        uint txDataOffset = BlockReader.OFFSET_TO_TRANSACTIONS +
            txIdx * ExchangeData.TX_DATA_AVAILABILITY_SIZE_PART_1();
        bytes memory dataPart1 = _block.data.slice(txDataOffset, numTransactions * ExchangeData.TX_DATA_AVAILABILITY_SIZE_PART_1());
        // Part 2
        txDataOffset = BlockReader.OFFSET_TO_TRANSACTIONS +
            _block.blockSize * ExchangeData.TX_DATA_AVAILABILITY_SIZE_PART_1() +
            txIdx * ExchangeData.TX_DATA_AVAILABILITY_SIZE_PART_2();
        bytes memory dataPart2 = _block.data.slice(txDataOffset, numTransactions * ExchangeData.TX_DATA_AVAILABILITY_SIZE_PART_2());

        minimalBlock.data = header.concat(dataPart1).concat(dataPart2);

        return minimalBlock;
    }
}
