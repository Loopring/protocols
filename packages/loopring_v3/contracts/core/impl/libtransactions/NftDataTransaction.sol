// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../thirdparty/BytesUtil.sol";
import "../../iface/ExchangeData.sol";
import "./BlockReader.sol";


/// @title NftDataTransaction
/// @author Brecht Devos - <brecht@loopring.org>
library NftDataTransaction
{
    using BlockReader          for bytes;
    using BytesUtil            for bytes;

    // Read the data in two transactions, each containing partial data.
    // Each tx contains largely the same data (`nftID`, `nftType`, `creatorFeeBips`)
    // except when
    // type == SCHEME_WITH_TOKEN_ADDRESS -> bring `tokenAddress` to L1,
    // type == SCHEME_WITH_MINTER_ADDRESS -> bring `minter` to L1.
    enum NftDataScheme
    {
        SCHEME_WITH_MINTER_ADDRESS,
        SCHEME_WITH_TOKEN_ADDRESS
    }

    struct NftData
    {
        uint8                scheme;
        uint32               accountID;         // the `to` or `from` account's ID.
        uint16               tokenID;
        ExchangeData.Nft     nft;
    }

    function readTx(
        bytes   memory data,
        uint           offset,
        NftData memory nftData
        )
        internal
        pure
    {
        uint _offset = offset;

        require(
            data.toUint8Unsafe(_offset) == uint8(ExchangeData.TransactionType.NFT_DATA),
            "INVALID_TX_TYPE"
        );
        _offset += 1;

        nftData.scheme = data.toUint8Unsafe(_offset);
        _offset += 1;

        // Extract the transfer data
        // We don't use abi.decode for this because of the large amount of zero-padding
        // bytes the circuit would also have to hash.
        nftData.accountID = data.toUint32Unsafe(_offset);
        _offset += 4;
        nftData.tokenID = data.toUint16Unsafe(_offset);
        _offset += 2;
        nftData.nft.nftID = data.toUintUnsafe(_offset);
        _offset += 32;
        nftData.nft.creatorFeeBips = data.toUint8Unsafe(_offset);
        _offset += 1;
        nftData.nft.nftType = ExchangeData.NftType(data.toUint8Unsafe(_offset));
        _offset += 1;

        if (nftData.scheme == uint8(NftDataScheme.SCHEME_WITH_MINTER_ADDRESS)) {
            nftData.nft.minter = data.toAddressUnsafe(_offset);
        } else if (nftData.scheme == uint8(NftDataScheme.SCHEME_WITH_TOKEN_ADDRESS)) {
            nftData.nft.token = data.toAddressUnsafe(_offset);
        } else {
            revert("INVALID_NFT_DATA_SUBTYPE");
        }
        _offset += 20;
    }

    function readDualNftData(
        ExchangeData.BlockContext  memory ctx,
        uint32                            accountID,
        uint16                            tokenID,
        uint                              txIdx,
        NftDataTransaction.NftData memory nftData
        )
        internal
        pure
    {
        // There's 68 bytes we can use per transaction. The NFT data now contains
        // `hash(minter, nftType, tokenAddress, nftID, creatorFeeBips)`. So this data
        // needs txType + (1 byte) + minter (20 bytes) + nftType (1 byte) +
        // tokenAddress (20 bytes) + nftID (32 bytes) + creatorFeeBips (1 byte) = 76 bytes.
        // So 8 bytes too much to fit inside the available space in a single tx.
        readNftData(
            ctx,
            accountID,
            tokenID,
            txIdx,
            NftDataScheme.SCHEME_WITH_MINTER_ADDRESS,
            nftData
        );

        readNftData(
            ctx,
            accountID,
            tokenID,
            txIdx + 1,
            NftDataScheme.SCHEME_WITH_TOKEN_ADDRESS,
            nftData
        );
    }

    function readNftData(
        ExchangeData.BlockContext  memory ctx,
        uint32                            accountID,
        uint16                            tokenID,
        uint                              txOffset,
        NftDataScheme                     expectedScheme,
        NftDataTransaction.NftData memory nftData
        )
        private
        pure
    {
        // Read the NFT_DATA transaction
        bytes memory txData = new bytes(ExchangeData.TX_DATA_AVAILABILITY_SIZE);
        ctx.block.data.readTransactionData(txOffset, ctx.block.blockSize, txData);
        NftDataTransaction.readTx(txData, 0, nftData);

        // Make sure the NFT_DATA transaction pushes data on-chain
        // that matches the the tokens that are getting withdrawn
        require(
            nftData.scheme == uint8(expectedScheme) &&
            nftData.accountID == accountID &&
            nftData.tokenID == tokenID,
            "INVALID_NFT_DATA"
        );
    }
}
