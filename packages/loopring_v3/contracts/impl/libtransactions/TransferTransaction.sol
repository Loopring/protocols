// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../iface/ExchangeData.sol";
import "../../thirdparty/BytesUtil.sol";
import "../../lib/EIP712.sol";
import "../../lib/FloatUtil.sol";
import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";


/// @title TransferTransaction
/// @author Brecht Devos - <brecht@loopring.org>
library TransferTransaction
{
    using BytesUtil            for bytes;
    using FloatUtil            for uint;
    using MathUint             for uint;
    using SignatureUtil        for bytes32;

    bytes32 constant public TRANSFER_TYPEHASH = keccak256(
        "Transfer(address from,address to,uint16 tokenID,uint256 amount,uint16 feeTokenID,uint256 fee,uint256 data,uint32 nonce)"
    );

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
        bytes                     memory  auxiliaryData
        )
        internal
        returns (uint /*feeETH*/)
    {
        uint offset = 1;

        // Check that this is a conditional transfer
        require(data.toUint8(offset) == 1, "INVALID_AUXILIARYDATA_DATA");
        offset += 1;

        // Extract the transfer data
        //uint24 fromAccountID = data.toUint24(offset);
        offset += 3;
        //uint24 toAccountID = data.toUint24(offset);
        offset += 3;

        uint16 tokenID = data.toUint16(offset) >> 4;
        uint16 feeTokenID = uint16(data.toUint16(offset + 1) & 0xFFF);
        offset += 3;
        uint amount = uint(data.toUint24(offset)).decodeFloat(24);
        offset += 3;
        uint fee = uint(data.toUint16(offset)).decodeFloat(16);
        offset += 2;
        address to = data.toAddress(offset);
        offset += 20;
        uint32 nonce = data.toUint32(offset);
        offset += 4;
        address from = data.toAddress(offset);
        offset += 20;
        uint customData = data.toUint(offset);
        offset += 32;

        // Calculate the tx hash
        bytes32 txHash = hash(
            ctx.DOMAIN_SEPARATOR,
            from,
            to,
            tokenID,
            amount,
            feeTokenID,
            fee,
            customData,
            nonce
        );

        // Verify the signature if one is provided, otherwise fall back to an approved tx
        if (auxiliaryData.length > 0) {
            require(txHash.verifySignature(from, auxiliaryData), "INVALID_SIGNATURE");
        } else {
            require(S.approvedTx[from][txHash], "TX_NOT_APPROVED");
            delete S.approvedTx[from][txHash];
        }

        //emit ConditionalTransferProcessed(from, to, tokenID, amount);
    }

    function hash(
        bytes32 DOMAIN_SEPARATOR,
        address from,
        address to,
        uint16  tokenID,
        uint    amount,
        uint16  feeTokenID,
        uint    fee,
        uint    data,
        uint32  nonce
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
                    from,
                    to,
                    tokenID,
                    amount,
                    feeTokenID,
                    fee,
                    data,
                    nonce
                )
            )
        );
    }
}
