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
        header.timestamp = _block.data.toUint32(offset);
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

    function readTransactionData(
        ExchangeData.Block memory _block,
        uint txIdx
        )
        internal
        pure
        returns (bytes memory)
    {
        require(txIdx < _block.blockSize, "INVALID_TX_IDX");

        bytes memory data = _block.data;

        // The transaction was transformed to make it easier to compress.
        // Transform it back here.
        bytes memory txData = new bytes(ExchangeData.TX_DATA_AVAILABILITY_SIZE());
        // Part 1
        uint txDataOffset = OFFSET_TO_TRANSACTIONS +
            txIdx * ExchangeData.TX_DATA_AVAILABILITY_SIZE_PART_1();
        assembly {
            mstore(add(txData, 32), mload(add(data, add(txDataOffset, 32))))
        }
        // Part 2
        txDataOffset = OFFSET_TO_TRANSACTIONS +
            _block.blockSize * ExchangeData.TX_DATA_AVAILABILITY_SIZE_PART_1() +
            txIdx * ExchangeData.TX_DATA_AVAILABILITY_SIZE_PART_2();
        assembly {
            mstore(add(txData, 61 /*32 + 29*/), mload(add(data, add(txDataOffset, 32))))
            mstore(add(txData, 68            ), mload(add(data, add(txDataOffset, 39))))
        }
        return txData;
    }
}
