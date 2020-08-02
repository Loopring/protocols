// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
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
        "AccountUpdate(address owner,uint32 accountID,uint16 feeTokenID,uint256 fee,uint256 publicKey,uint32 validUntil,uint32 nonce)"
    );

    /*event AccountUpdated(
        uint32 owner,
        uint   publicKey
    );*/

    struct AccountUpdate
    {
        address owner;
        uint32  accountID;
        uint16  feeTokenID;
        uint    fee;
        uint    publicKey;
        uint32  validUntil;
        uint32  nonce;
    }

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
        // Check that this is a conditional update
        uint updateType = data.toUint8(offset);
        offset += 1;
        require(updateType == 1, "INVALID_AUXILIARYDATA_DATA");

        // Extract the data from the tx data
        // We don't use abi.decode for this because of the large amount of zero-padding
        // bytes the circuit would also have to hash.
        AccountUpdate memory accountUpdate;
        accountUpdate.owner = data.toAddress(offset);
        offset += 20;
        accountUpdate.accountID = data.toUint32(offset);
        offset += 4;
        accountUpdate.feeTokenID = data.toUint16(offset);
        offset += 2;
        accountUpdate.fee = uint(data.toUint16(offset)).decodeFloat(16);
        offset += 2;
        accountUpdate.publicKey = data.toUint(offset);
        offset += 32;
        accountUpdate.validUntil = data.toUint32(offset);
        offset += 4;
        accountUpdate.nonce = data.toUint32(offset);
        offset += 4;

        // Calculate the tx hash
        bytes32 txHash = EIP712.hashPacked(
            ctx.DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    ACCOUNTUPDATE_TYPEHASH,
                    accountUpdate.owner,
                    accountUpdate.accountID,
                    accountUpdate.feeTokenID,
                    accountUpdate.fee,
                    accountUpdate.publicKey,
                    accountUpdate.validUntil,
                    accountUpdate.nonce
                )
            )
        );

        // Verify the signature if one is provided, otherwise fall back to an approved tx
        if (auxiliaryData.length > 0) {
            require(txHash.verifySignature(accountUpdate.owner, auxiliaryData), "INVALID_SIGNATURE");
        } else {
            require(S.approvedTx[accountUpdate.owner][txHash], "TX_NOT_APPROVED");
            S.approvedTx[accountUpdate.owner][txHash] = false;
        }

        //emit AccountUpdated(accountID, publicKey);
    }
}
