// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../thirdparty/BytesUtil.sol";
import "../../core/iface/ExchangeData.sol";

import "../../core/impl/libtransactions/AmmUpdateTransaction.sol";
import "../../core/impl/libtransactions/DepositTransaction.sol";
import "../../core/impl/libtransactions/WithdrawTransaction.sol";

/// @title BlockReader
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev Utility library to read block data.
library BlockReader {
    using BlockReader       for ExchangeData.Block;
    using BytesUtil         for bytes;

    uint public constant OFFSET_TO_TRANSACTIONS = 20 + 32 + 32 + 4 + 1 + 1 + 4 + 4;

    struct BlockHeader
    {
        address exchange;
        bytes32 merkleRootBefore;
        bytes32 merkleRootAfter;
        uint32 inputTimestamp;
        uint8 protocolTakerFeeBips;
        uint8 protocolMakerFeeBips;
        uint numConditionalTransactions;
        uint32 operatorAccountID;
    }

    function readHeader(
        ExchangeData.Block memory _block
        )
        internal
        pure
        returns (BlockHeader memory header)
    {
        uint offset = 0;
        header.exchange = _block.data.toAddress(offset);
        offset += 20;
        header.merkleRootBefore = _block.data.toBytes32(offset);
        offset += 32;
        header.merkleRootAfter = _block.data.toBytes32(offset);
        offset += 32;
        header.inputTimestamp = _block.data.toUint32(offset);
        offset += 4;
        header.protocolTakerFeeBips = _block.data.toUint8(offset);
        offset += 1;
        header.protocolMakerFeeBips = _block.data.toUint8(offset);
        offset += 1;
        header.numConditionalTransactions = _block.data.toUint32(offset);
        offset += 4;
        header.operatorAccountID = _block.data.toUint32(offset);
        offset += 4;
        assert(offset == OFFSET_TO_TRANSACTIONS);
    }

    function readDeposit(
        ExchangeData.Block memory _block,
        uint         txIdx
        )
        internal
        pure
        returns (DepositTransaction.Deposit memory)
    {
        uint offset = _block.getOffsetToTransaction(txIdx);
        ExchangeData.TransactionType txType = ExchangeData.TransactionType(
            _block.data.toUint8(offset)
        );
        offset += 1;
        require(txType == ExchangeData.TransactionType.DEPOSIT, "UNEXPTECTED_TX_TYPE");
        return DepositTransaction.readTx(_block.data, offset);
    }

    function readWithdrawal(
        ExchangeData.Block memory _block,
        uint         txIdx
        )
        internal
        pure
        returns (WithdrawTransaction.Withdrawal memory)
    {
        uint offset = _block.getOffsetToTransaction(txIdx);
        ExchangeData.TransactionType txType = ExchangeData.TransactionType(
            _block.data.toUint8(offset)
        );
        offset += 1;
        require(txType == ExchangeData.TransactionType.WITHDRAWAL, "UNEXPTECTED_TX_TYPE");
        return WithdrawTransaction.readTx(_block.data, offset);
    }

    function readAmmUpdate(
        ExchangeData.Block memory _block,
        uint         txIdx
        )
        internal
        pure
        returns (AmmUpdateTransaction.AmmUpdate memory)
    {
        uint offset = _block.getOffsetToTransaction(txIdx);
        ExchangeData.TransactionType txType = ExchangeData.TransactionType(
            _block.data.toUint8(offset)
        );
        offset += 1;
        require(txType == ExchangeData.TransactionType.AMM_UPDATE, "UNEXPTECTED_TX_TYPE");
        return AmmUpdateTransaction.readTx(_block.data, offset);
    }

    function getOffsetToTransaction(
        ExchangeData.Block memory _block,
        uint txIdx
        )
        internal
        pure
        returns (uint)
    {
        require(txIdx < _block.blockSize, "INVALID_TX_IDX");
        return OFFSET_TO_TRANSACTIONS + txIdx * ExchangeData.TX_DATA_AVAILABILITY_SIZE();
    }
}
