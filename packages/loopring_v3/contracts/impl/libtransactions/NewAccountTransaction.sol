// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../iface/ExchangeData.sol";
import "../../thirdparty/BytesUtil.sol";
import "../../lib/EIP712.sol";
import "../../lib/SignatureUtil.sol";


/// @title NewAccountTransaction
/// @dev   With a CreateAccount someone pays a fee to completely setup a new account for
///        a different Ethereum address. UpdateAccount is when the account owner himself
///        wants to update his account he already owns (update the EdDSA keys or update
///        the wallet data), and he pays the fee himself. Basically CreateAccount is
///        pretty much the same as a Transfer to a new account  + UpdateAccount, rolled
///        into a single transaction and completely paid by someone else.
/// @author Brecht Devos - <brecht@loopring.org>
library NewAccountTransaction
{
    using BytesUtil            for bytes;
    using SignatureUtil        for bytes32;

    bytes32 constant public NEWACCOUNT_TYPEHASH = keccak256(
        "NewAccount(uint32 accountID,address owner,uint256 publicKey,uint256 walletHash)"
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
        uint                              offset,
        bytes                     memory  auxiliaryData
        )
        internal
        returns (uint /*feeETH*/)
    {
        // Extract the data from the tx data
        //uint32 payerAccountID = data.toUint32(offset);
        offset += 4;
        //uint16 feeTokenID = data.toUint16(offset);
        offset += 2;
        //uint fee = uint(data.toUint16(offset)).decodeFloat(16);
        offset += 2;

        uint32 accountID = data.toUint32(offset);
        offset += 4;
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
