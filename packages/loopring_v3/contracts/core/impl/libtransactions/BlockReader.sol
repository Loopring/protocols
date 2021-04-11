// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../thirdparty/BytesUtil.sol";
import "../../iface/ExchangeData.sol";

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
        uint32  timestamp;
        uint8   protocolTakerFeeBips;
        uint8   protocolMakerFeeBips;
        uint32  numConditionalTransactions;
        uint32  operatorAccountID;
    }

    function readHeader(
        bytes memory _blockData
        )
        internal
        pure
        returns (BlockHeader memory header)
    {
        uint offset = 0;
        header.exchange = _blockData.toAddress(offset);
        offset += 20;
        header.merkleRootBefore = _blockData.toBytes32(offset);
        offset += 32;
        header.merkleRootAfter = _blockData.toBytes32(offset);
        offset += 32;
        header.timestamp = _blockData.toUint32(offset);
        offset += 4;
        header.protocolTakerFeeBips = _blockData.toUint8(offset);
        offset += 1;
        header.protocolMakerFeeBips = _blockData.toUint8(offset);
        offset += 1;
        header.numConditionalTransactions = _blockData.toUint32(offset);
        offset += 4;
        header.operatorAccountID = _blockData.toUint32(offset);
        offset += 4;
        assert(offset == OFFSET_TO_TRANSACTIONS);
    }

    function readTransactionData(
        bytes memory data,
        uint txIdx,
        uint blockSize,
        bytes memory txData
        )
        internal
        pure
    {
        require(txIdx < blockSize, "INVALID_TX_IDX");

        // The transaction was transformed to make it easier to compress.
        // Transform it back here.
        // Part 1
        uint txDataOffset = OFFSET_TO_TRANSACTIONS +
            txIdx * ExchangeData.TX_DATA_AVAILABILITY_SIZE_PART_1;
        assembly {
            mstore(add(txData, 32), mload(add(data, add(txDataOffset, 32))))
        }
        // Part 2
        txDataOffset = OFFSET_TO_TRANSACTIONS +
            blockSize * ExchangeData.TX_DATA_AVAILABILITY_SIZE_PART_1 +
            txIdx * ExchangeData.TX_DATA_AVAILABILITY_SIZE_PART_2;
        assembly {
            mstore(add(txData, 61 /*32 + 29*/), mload(add(data, add(txDataOffset, 32))))
            mstore(add(txData, 68            ), mload(add(data, add(txDataOffset, 39))))
        }
    }

    function readTransactionType(
        bytes memory data,
        uint txIdx
        )
        internal
        pure
        returns (ExchangeData.TransactionType txType)
    {
        uint txDataOffset = OFFSET_TO_TRANSACTIONS +
            txIdx * ExchangeData.TX_DATA_AVAILABILITY_SIZE_PART_1;
        assembly {
            txType := and(mload(add(data, add(txDataOffset, 1))), 0xff)
        }
    }
}
