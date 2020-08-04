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
    using FloatUtil            for uint;
    using MathUint             for uint;
    using ExchangeSignatures   for ExchangeData.State;

    bytes32 constant public TRANSFER_TYPEHASH = keccak256(
        "Transfer(address from,address to,uint16 tokenID,uint256 amount,uint16 feeTokenID,uint256 fee,uint256 data,uint32 validUntil,uint32 storageID)"
    );

    struct Transfer
    {
        address from;
        address to;
        uint16  tokenID;
        uint    amount;
        uint16  feeTokenID;
        uint    fee;
        uint    data;
        uint32  validUntil;
        uint32  storageID;
    }

    /*event ConditionalTransferProcessed(
        address from,
        address to,
        uint16  token,
        uint    amount
    );*/

    function process(
        ExchangeData.State        storage S,
        ExchangeData.BlockContext memory  ctx,
        bytes                     memory  data,
        uint                              offset,
        bytes                     memory  auxiliaryData
        )
        internal
        returns (uint /*feeETH*/)
    {
        // Read the transfer
        Transfer memory transfer = readTransfer(data, offset);

        // Calculate the tx hash
        bytes32 txHash = hash(ctx.DOMAIN_SEPARATOR, transfer);

        // Check the on-chain authorization
        S.requireAuthorizedTx(transfer.from, auxiliaryData, txHash);

        //emit ConditionalTransferProcessed(from, to, tokenID, amount);
    }

    function readTransfer(
        bytes memory data,
        uint         offset
        )
        internal
        pure
        returns (Transfer memory transfer)
    {
        // Check that this is a conditional transfer
        require(data.toUint8(offset) == 1, "INVALID_AUXILIARYDATA_DATA");
        offset += 1;

        // Extract the transfer data
        // We don't use abi.decode for this because of the large amount of zero-padding
        // bytes the circuit would also have to hash.
        //transfer.fromAccountID = data.toUint32(offset);
        offset += 4;
        //transfer.toAccountID = data.toUint32(offset);
        offset += 4;
        transfer.tokenID = data.toUint16(offset) >> 4;
        transfer.feeTokenID = uint16(data.toUint16(offset + 1) & 0xFFF);
        offset += 3;
        transfer.amount = uint(data.toUint24(offset)).decodeFloat(24);
        offset += 3;
        transfer.fee = uint(data.toUint16(offset)).decodeFloat(16);
        offset += 2;
        //uint16 shortStorageID = data.toUint16(offset);
        offset += 2;
        transfer.to = data.toAddress(offset);
        offset += 20;
        transfer.validUntil = data.toUint32(offset);
        offset += 4;
        transfer.storageID = data.toUint32(offset);
        offset += 4;
        transfer.from = data.toAddress(offset);
        offset += 20;
        transfer.data = data.toUint(offset);
        offset += 32;
    }

    function hash(
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
                    transfer.fee,
                    transfer.data,
                    transfer.validUntil,
                    transfer.storageID
                )
            )
        );
    }
}
