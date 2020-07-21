// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../iface/ExchangeData.sol";
import "../../thirdparty/BytesUtil.sol";
import "../../lib/EIP712.sol";
import "../../lib/FloatUtil.sol";
import "../../lib/SignatureUtil.sol";


/// @title AccountUpdateTransaction
/// @author Brecht Devos - <brecht@loopring.org>
library AccountUpdateTransaction
{
    using BytesUtil            for bytes;
    using FloatUtil            for uint;
    using SignatureUtil        for bytes32;

    bytes32 constant public ACCOUNTUPDATE_TYPEHASH = keccak256(
        "AccountUpdate(address owner,uint24 accountID,uint32 nonce,uint256 publicKey,uint256 walletHash,uint16 feeTokenID,uint256 fee)"
    );

    /*event AccountUpdated(
        uint24 owner,
        uint   publicKey
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

        // Check that this is a conditional update
        uint updateType = data.toUint8(offset);
        offset += 1;
        require(updateType == 1, "INVALID_AUXILIARYDATA_DATA");

        // Extract the data from the tx data
        address owner = data.toAddress(offset);
        offset += 20;
        uint24 accountID = data.toUint24(offset);
        offset += 3;
        uint32 nonce = data.toUint32(offset);
        offset += 4;
        uint publicKey = data.toUint(offset);
        offset += 32;
        uint walletHash = data.toUint(offset);
        offset += 32;
        uint16 feeTokenID = data.toUint16(offset);
        offset += 2;
        uint fee = uint(data.toUint16(offset)).decodeFloat(16);
        offset += 2;

        // Calculate the tx hash
        bytes32 txHash = EIP712.hashPacked(
            ctx.DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    ACCOUNTUPDATE_TYPEHASH,
                    owner,
                    accountID,
                    nonce,
                    publicKey,
                    walletHash,
                    feeTokenID,
                    fee
                )
            )
        );

        // Verify the signature if one is provided, otherwise fall back to an approved tx
        if (auxiliaryData.length > 0) {
            require(txHash.verifySignature(owner, auxiliaryData), "INVALID_SIGNATURE");
        } else {
            require(S.approvedTx[owner][txHash], "TX_NOT_APPROVED");
            S.approvedTx[owner][txHash] = false;
        }

        //emit AccountUpdated(accountID, publicKey);
    }
}
