// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../iface/ExchangeData.sol";
import "../../thirdparty/BytesUtil.sol";
import "../../lib/EIP712.sol";
import "../../lib/SignatureUtil.sol";


/// @title NewAccountTransaction
/// @author Brecht Devos - <brecht@loopring.org>
library NewAccountTransaction
{
    using BytesUtil            for bytes;
    using SignatureUtil        for bytes32;

    bytes32 constant public NEWACCOUNT_TYPEHASH = keccak256(
        "NewAccount(uint24 accountID,address owner,uint256 publicKey,uint256 walletHash)"
    );

    /*event AccountCreated(
        address owner,
        uint    publicKey,
        uint    walletHash
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

        // Extract the data from the tx data
        //uint24 payerAccountID = data.toUint24(offset);
        offset += 3;
        //uint16 feeTokenID = data.toUint16(offset);
        offset += 2;
        //uint fee = uint(data.toUint16(offset)).decodeFloat(16);
        offset += 2;

        uint24 accountID = data.toUint24(offset);
        offset += 3;
        address owner = data.toAddress(offset);
        offset += 20;
        uint publicKey = data.toUint(offset);
        offset += 32;
        uint walletHash = data.toUint(offset);
        offset += 32;

        // Calculate the tx hash
        bytes32 txHash = EIP712.hashPacked(
            ctx.DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    NEWACCOUNT_TYPEHASH,
                    accountID,
                    owner,
                    publicKey,
                    walletHash
                )
            )
        );

        // The payer has already authorized the transaction offchain.
        // Here we check that the new account owner has authorized the account settings.
        // Verify the signature if one is provided, otherwise fall back to an approved tx
        if (auxiliaryData.length > 0) {
            require(txHash.verifySignature(owner, auxiliaryData), "INVALID_SIGNATURE");
        } else {
            require(S.approvedTx[owner][txHash], "TX_NOT_APPROVED");
            S.approvedTx[owner][txHash] = false;
        }

        //emit AccountCreated(owner, publicKey, walletHash);
    }
}
