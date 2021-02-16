// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../lib/EIP712.sol";
import "../../../lib/MathUint.sol";
import "../../../lib/SignatureUtil.sol";
import "../../../thirdparty/BytesUtil.sol";
import "../../iface/ExchangeData.sol";
import "../libexchange/ExchangeSignatures.sol";


/// @title AmmUpdateTransaction
/// @author Brecht Devos - <brecht@loopring.org>
library AmmUpdateTransaction
{
    using BytesUtil            for bytes;
    using MathUint             for uint;
    using ExchangeSignatures   for ExchangeData.State;

    bytes32 constant public AMMUPDATE_TYPEHASH = keccak256(
        "AmmUpdate(address owner,uint32 accountID,uint16 tokenID,uint8 feeBips,uint96 tokenWeight,uint32 validUntil,uint32 nonce)"
    );

    struct AmmUpdate
    {
        address owner;
        uint32  accountID;
        uint16  tokenID;
        uint8   feeBips;
        uint96  tokenWeight;
        uint32  validUntil;
        uint32  nonce;
        uint96  balance;
    }

    // Auxiliary data for each AMM update
    struct AmmUpdateAuxiliaryData
    {
        bytes  signature;
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
        // Read in the AMM update
        AmmUpdate memory update;
        readTx(data, offset, update);
        AmmUpdateAuxiliaryData memory auxData = abi.decode(auxiliaryData, (AmmUpdateAuxiliaryData));

        // Check validUntil
        require(ctx.timestamp < auxData.validUntil, "AMM_UPDATE_EXPIRED");
        update.validUntil = auxData.validUntil;

        // Calculate the tx hash
        bytes32 txHash = hashTx(ctx.DOMAIN_SEPARATOR, update);

        // Check the on-chain authorization
        S.requireAuthorizedTx(update.owner, auxData.signature, txHash);
    }

    function readTx(
        bytes memory data,
        uint         offset,
        AmmUpdate memory update
        )
        internal
        pure
    {
        uint _offset = offset;

        require(data.toUint8Unsafe(_offset) == uint8(ExchangeData.TransactionType.AMM_UPDATE), "INVALID_TX_TYPE");
        _offset += 1;

        // We don't use abi.decode for this because of the large amount of zero-padding
        // bytes the circuit would also have to hash.
        update.owner = data.toAddressUnsafe(_offset);
        _offset += 20;
        update.accountID = data.toUint32Unsafe(_offset);
        _offset += 4;
        update.tokenID = data.toUint16Unsafe(_offset);
        _offset += 2;
        update.feeBips = data.toUint8Unsafe(_offset);
        _offset += 1;
        update.tokenWeight = data.toUint96Unsafe(_offset);
        _offset += 12;
        update.nonce = data.toUint32Unsafe(_offset);
        _offset += 4;
        update.balance = data.toUint96Unsafe(_offset);
        _offset += 12;
    }

    function hashTx(
        bytes32 DOMAIN_SEPARATOR,
        AmmUpdate memory update
        )
        internal
        pure
        returns (bytes32)
    {
        return EIP712.hashPacked(
            DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    AMMUPDATE_TYPEHASH,
                    update.owner,
                    update.accountID,
                    update.tokenID,
                    update.feeBips,
                    update.tokenWeight,
                    update.validUntil,
                    update.nonce
                )
            )
        );
    }
}
