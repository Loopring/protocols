// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../lib/EIP712.sol";
import "../../../lib/FloatUtil.sol";
import "../../../thirdparty/BytesUtil.sol";
import "../../iface/ExchangeData.sol";
import "../libexchange/ExchangeSignatures.sol";


/// @title AccountUpdateTransaction
/// @author Brecht Devos - <brecht@loopring.org>
library AccountUpdateTransaction
{
    using BytesUtil            for bytes;
    using FloatUtil            for uint;
    using ExchangeSignatures   for ExchangeData.State;

    bytes32 constant public ACCOUNTUPDATE_TYPEHASH = keccak256(
        "AccountUpdate(address owner,uint32 accountID,uint16 feeTokenID,uint256 maxFee,uint256 publicKey,uint32 validUntil,uint32 nonce)"
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
        uint96  maxFee;
        uint96  fee;
        uint    publicKey;
        uint32  validUntil;
        uint32  nonce;
    }

    // Auxiliary data for each account update
    struct AccountUpdateAuxiliaryData
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
        // Read the account update
        AccountUpdate memory accountUpdate = readTx(data, offset);
        AccountUpdateAuxiliaryData memory auxData = abi.decode(auxiliaryData, (AccountUpdateAuxiliaryData));

        // Fill in withdrawal data missing from DA
        accountUpdate.validUntil = auxData.validUntil;
        accountUpdate.maxFee = auxData.maxFee == 0 ? accountUpdate.fee : auxData.maxFee;
        // Validate
        require(ctx.timestamp < accountUpdate.validUntil, "ACCOUNT_UPDATE_EXPIRED");
        require(accountUpdate.fee <= accountUpdate.maxFee, "ACCOUNT_UPDATE_FEE_TOO_HIGH");

        // Calculate the tx hash
        bytes32 txHash = hashTx(ctx.DOMAIN_SEPARATOR, accountUpdate);

        // Check onchain authorization
        S.requireAuthorizedTx(accountUpdate.owner, auxData.signature, txHash);

        //emit AccountUpdated(accountID, publicKey);
    }

    function readTx(
        bytes memory data,
        uint         offset
        )
        internal
        pure
        returns (AccountUpdate memory accountUpdate)
    {
        uint _offset = offset;
        // Check that this is a conditional offset
        require(data.toUint8(_offset) == 1, "INVALID_AUXILIARYDATA_DATA");
        _offset += 1;

        // Extract the data from the tx data
        // We don't use abi.decode for this because of the large amount of zero-padding
        // bytes the circuit would also have to hash.
        accountUpdate.owner = data.toAddress(_offset);
        _offset += 20;
        accountUpdate.accountID = data.toUint32(_offset);
        _offset += 4;
        accountUpdate.feeTokenID = data.toUint16(_offset);
        _offset += 2;
        accountUpdate.fee = uint(data.toUint16(_offset)).decodeFloat(16);
        _offset += 2;
        accountUpdate.publicKey = data.toUint(_offset);
        _offset += 32;
        accountUpdate.nonce = data.toUint32(_offset);
        _offset += 4;
    }

    function hashTx(
        bytes32 DOMAIN_SEPARATOR,
        AccountUpdate memory accountUpdate
        )
        internal
        pure
        returns (bytes32)
    {
        return EIP712.hashPacked(
            DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    ACCOUNTUPDATE_TYPEHASH,
                    accountUpdate.owner,
                    accountUpdate.accountID,
                    accountUpdate.feeTokenID,
                    accountUpdate.maxFee,
                    accountUpdate.publicKey,
                    accountUpdate.validUntil,
                    accountUpdate.nonce
                )
            )
        );
    }
}
