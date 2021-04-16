// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../lib/EIP712.sol";
import "../../../lib/FloatUtil.sol";
import "../../../lib/MathUint.sol";
import "../../../thirdparty/BytesUtil.sol";
import "../../iface/ExchangeData.sol";
import "../libexchange/ExchangeSignatures.sol";


/// @title TransferTransaction
/// @author Brecht Devos - <brecht@loopring.org>
library TransferTransaction
{
    using BytesUtil            for bytes;
    using FloatUtil            for uint24;
    using FloatUtil            for uint16;
    using MathUint             for uint;
    using ExchangeSignatures   for ExchangeData.State;

    bytes32 constant public TRANSFER_TYPEHASH = keccak256(
        "Transfer(address from,address to,uint16 tokenID,uint96 amount,uint16 feeTokenID,uint96 maxFee,uint32 validUntil,uint32 storageID)"
    );

    struct Transfer
    {
        uint32  fromAccountID;
        uint32  toAccountID;
        address from;
        address to;
        uint16  tokenID;
        uint96  amount;
        uint16  feeTokenID;
        uint96  maxFee;
        uint96  fee;
        uint32  validUntil;
        uint32  storageID;
    }

    // Auxiliary data for each transfer
    struct TransferAuxiliaryData
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
        // Read the transfer
        Transfer memory transfer;
        readTx(data, offset, transfer);
        TransferAuxiliaryData memory auxData = abi.decode(auxiliaryData, (TransferAuxiliaryData));

        // Fill in withdrawal data missing from DA
        transfer.validUntil = auxData.validUntil;
        transfer.maxFee = auxData.maxFee == 0 ? transfer.fee : auxData.maxFee;
        // Validate
        require(ctx.timestamp < transfer.validUntil, "TRANSFER_EXPIRED");
        require(transfer.fee <= transfer.maxFee, "TRANSFER_FEE_TOO_HIGH");

        // Calculate the tx hash
        bytes32 txHash = hashTx(ctx.DOMAIN_SEPARATOR, transfer);

        // Check the on-chain authorization
        S.requireAuthorizedTx(transfer.from, auxData.signature, txHash);
    }

    function readTx(
        bytes memory data,
        uint         offset,
        Transfer memory transfer
        )
        internal
        pure
    {
        uint _offset = offset;

        require(data.toUint8Unsafe(_offset) == uint8(ExchangeData.TransactionType.TRANSFER), "INVALID_TX_TYPE");
        _offset += 1;

        // Check that this is a conditional transfer
        require(data.toUint8Unsafe(_offset) == 1, "INVALID_AUXILIARYDATA_DATA");
        _offset += 1;

        // Extract the transfer data
        // We don't use abi.decode for this because of the large amount of zero-padding
        // bytes the circuit would also have to hash.
        transfer.fromAccountID = data.toUint32Unsafe(_offset);
        _offset += 4;
        transfer.toAccountID = data.toUint32Unsafe(_offset);
        _offset += 4;
        transfer.tokenID = data.toUint16Unsafe(_offset);
        _offset += 2;
        transfer.amount = data.toUint24Unsafe(_offset).decodeFloat24();
        _offset += 3;
        transfer.feeTokenID = data.toUint16Unsafe(_offset);
        _offset += 2;
        transfer.fee = data.toUint16Unsafe(_offset).decodeFloat16();
        _offset += 2;
        transfer.storageID = data.toUint32Unsafe(_offset);
        _offset += 4;
        transfer.to = data.toAddressUnsafe(_offset);
        _offset += 20;
        transfer.from = data.toAddressUnsafe(_offset);
        _offset += 20;
    }

    function hashTx(
        bytes32 DOMAIN_SEPARATOR,
        Transfer memory transfer
        )
        internal
        pure
        returns (bytes32)
    {
        return EIP712.hashPacked(
            DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    TRANSFER_TYPEHASH,
                    transfer.from,
                    transfer.to,
                    transfer.tokenID,
                    transfer.amount,
                    transfer.feeTokenID,
                    transfer.maxFee,
                    transfer.validUntil,
                    transfer.storageID
                )
            )
        );
    }
}
