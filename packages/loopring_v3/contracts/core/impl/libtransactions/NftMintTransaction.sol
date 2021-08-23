// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../lib/EIP712.sol";
import "../../../lib/FloatUtil.sol";
import "../../../lib/MathUint.sol";
import "../../../lib/MathUint96.sol";
import "../../../thirdparty/BytesUtil.sol";
import "../../iface/ExchangeData.sol";
import "../libexchange/ExchangeSignatures.sol";
import "./NftDataTransaction.sol";


/// @title NftMintTransaction
/// @author Brecht Devos - <brecht@loopring.org>
library NftMintTransaction
{
    using BytesUtil            for bytes;
    using ExchangeSignatures   for ExchangeData.State;
    using FloatUtil            for uint16;
    using MathUint96           for uint96;
    using MathUint             for uint;

    bytes32 constant public NFTMINT_TYPEHASH = keccak256(
        "NftMint(address minter,address to,uint8 nftType,address token,uint256 nftID,uint8 creatorFeeBips,uint96 amount,uint16 feeTokenID,uint96 maxFee,uint32 validUntil,uint32 storageID)"
    );

    // This structure represents either a L2 NFT mint or a L1-to-L2 NFT deposit.
    struct NftMint
    {
        uint                 mintType;
        uint32               minterAccountID;
        uint32               toAccountID;
        uint16               toTokenID;   // slot
        uint96               amount;
        uint16               feeTokenID;
        uint96               maxFee;
        uint96               fee;
        uint32               validUntil;
        uint32               storageID;
        address              to;
        ExchangeData.Nft     nft;
    }

    // Auxiliary data for each NFT mint
    struct NftMintAuxiliaryData
    {
        bytes  signature;
        uint96 maxFee;
        uint32 validUntil;
    }

    function process(
        ExchangeData.State        storage S,
        ExchangeData.BlockContext memory  ctx,
        bytes                     memory  data,
        uint                              offset,
        bytes                     memory  auxiliaryData
        )
        internal
    {
        // Read in the mint
        NftMint memory mint;
        readTx(data, offset, mint);

        // Read the NFT data if we're minting or depositing an NFT
        //
        // Note that with EdDSA-based minting it's only possible
        // to mint to the minter's own account.
        //
        // ECDSA and onchain approval hash-based minting do not have the above restrictions.
        {
            // Read the NFT data
            NftDataTransaction.NftData memory nftData;
            NftDataTransaction.readDualNftData(
                ctx,
                mint.toAccountID,
                mint.toTokenID,
                ctx.txIndex.add(1),
                nftData
            );
            // Copy the data to the mint struct
            mint.nft = nftData.nft;
        }

        if (mint.mintType == 2) {
            // No fee allowed for deposits
            require(mint.fee == 0, "DEPOSIT_FEE_DISALLOWED");
            require(mint.nft.creatorFeeBips == 0, "CREATORFEEBIPS_NONZERO");

            // The minter should be the NFT token contract for deposits
            require(mint.nft.minter == mint.nft.token, "MINTER_NOT_TOKEN_CONTRACT");

            // Process the deposit
            ExchangeData.Deposit memory pendingDeposit = S.pendingNFTDeposits[mint.to][mint.nft.nftType][mint.nft.token][mint.nft.nftID];

            // Make sure the deposit was actually done
            require(pendingDeposit.timestamp > 0, "DEPOSIT_NOT_EXIST");

            // Processing partial amounts of the deposited amount is allowed.
            // This is done to ensure the user can do multiple deposits after each other
            // without invalidating work done by the exchange owner for previous deposit amounts.

            require(pendingDeposit.amount >= mint.amount, "INVALID_AMOUNT");
            pendingDeposit.amount = pendingDeposit.amount.sub(mint.amount);

            // If the deposit was fully consumed, reset it so the storage is freed up
            // and the owner receives a gas refund.
            if (pendingDeposit.amount == 0) {
                delete S.pendingNFTDeposits[mint.to][mint.nft.nftType][mint.nft.token][mint.nft.nftID];
            } else {
                S.pendingNFTDeposits[mint.to][mint.nft.nftType][mint.nft.token][mint.nft.nftID] = pendingDeposit;
            }
        } else {
            // The minter should NOT be the NFT token contract for L2 mints
            require(mint.nft.minter != mint.nft.token, "MINTER_EQUALS_TOKEN_CONTRACT");

            NftMintAuxiliaryData memory auxData = abi.decode(auxiliaryData, (NftMintAuxiliaryData));

            // Fill in mint data missing from DA
            mint.validUntil = auxData.validUntil;
            mint.maxFee = auxData.maxFee == 0 ? mint.fee : auxData.maxFee;
            // Validate
            require(ctx.timestamp < mint.validUntil, "NFTMINT_EXPIRED");
            require(mint.fee <= mint.maxFee, "NFTMINT_FEE_TOO_HIGH");

            // Calculate the tx hash
            bytes32 txHash = hashTx(ctx.DOMAIN_SEPARATOR, mint);

            // Check the on-chain authorization
            S.requireAuthorizedTx(mint.nft.minter, auxData.signature, txHash);
        }
    }

    function readTx(
        bytes   memory data,
        uint           offset,
        NftMint memory mint
        )
        internal
        pure
    {
        uint _offset = offset;

        require(
            data.toUint8Unsafe(_offset) == uint8(ExchangeData.TransactionType.NFT_MINT),
            "INVALID_TX_TYPE"
        );
        _offset += 1;

        mint.mintType = data.toUint8Unsafe(_offset);
        _offset += 1;
        // Check that this is a conditional mint
        require(mint.mintType > 0, "INVALID_AUXILIARY_DATA");

        // We don't use abi.decode for this because of the large amount of zero-padding
        // bytes the circuit would also have to hash.
        mint.minterAccountID = data.toUint32Unsafe(_offset);
        _offset += 4;
        mint.toTokenID = data.toUint16Unsafe(_offset);
        _offset += 2;
        mint.feeTokenID = data.toUint16Unsafe(_offset);
        _offset += 2;
        mint.fee = data.toUint16Unsafe(_offset).decodeFloat16();
        _offset += 2;
        mint.amount = data.toUint96Unsafe(_offset);
        _offset += 12;
        mint.storageID = data.toUint32Unsafe(_offset);
        _offset += 4;
        mint.toAccountID = data.toUint32Unsafe(_offset);
        _offset += 4;
        mint.to = data.toAddressUnsafe(_offset);
        _offset += 20;
    }

    function hashTx(
        bytes32        DOMAIN_SEPARATOR,
        NftMint memory mint
        )
        internal
        pure
        returns (bytes32)
    {
        return EIP712.hashPacked(
            DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    NFTMINT_TYPEHASH,
                    mint.nft.minter,
                    mint.to,
                    mint.nft.nftType,
                    mint.nft.token,
                    mint.nft.nftID,
                    mint.nft.creatorFeeBips,
                    mint.amount,
                    mint.feeTokenID,
                    mint.maxFee,
                    mint.validUntil,
                    mint.storageID
                )
            )
        );
    }
}
