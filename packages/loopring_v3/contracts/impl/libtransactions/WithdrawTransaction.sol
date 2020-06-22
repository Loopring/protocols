/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../iface/ExchangeData.sol";
import "../../lib/BytesUtil.sol";
import "../../lib/EIP712.sol";
import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";

import "../libexchange/ExchangeMode.sol";
import "../libexchange/ExchangeWithdrawals.sol";


/// @title WithdrawTransaction
/// @author Brecht Devos - <brecht@loopring.org>
library WithdrawTransaction
{
    using BytesUtil            for bytes;
    using MathUint             for uint;
    using SignatureUtil        for bytes32;
    using ExchangeMode         for ExchangeData.State;
    using ExchangeWithdrawals  for ExchangeData.State;

    bytes32 constant public WITHDRAWAL_TYPEHASH = keccak256(
        "Withdrawal(address owner,uint24 accountID,uint32 nonce,uint16 tokenID,uint256 amount,uint16 feeTokenID,uint256 fee,address to)"
    );

    struct Withdrawal
    {
        uint    withdrawalType;
        address owner;
        uint24  accountID;
        uint32  nonce;
        uint16  tokenID;
        uint    amount;
        uint16  feeTokenID;
        uint    fee;
        address to;
    }

    event OnchainWithdrawalConsumed(
        uint24  indexed owner,
        uint16          token,
        uint            amount
    );

    function process(
        ExchangeData.State storage S,
        bytes memory data,
        bytes memory auxiliaryData
        )
        internal
        returns (uint feeETH)
    {
        Withdrawal memory withdrawal = readWithdrawal(data);

        ExchangeData.WithdrawalAuxiliaryData memory auxData = abi.decode(auxiliaryData, (ExchangeData.WithdrawalAuxiliaryData));

        if (withdrawal.withdrawalType == 0) {
            // Signature checked offchain, nothing to do
        } else if (withdrawal.withdrawalType == 1) {
            // Check appproval onchain

            // Calculate the tx hash
            bytes32 txHash = EIP712.hashPacked(
                S.DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        WITHDRAWAL_TYPEHASH,
                        withdrawal.owner,
                        withdrawal.accountID,
                        withdrawal.nonce,
                        withdrawal.tokenID,
                        withdrawal.amount,
                        withdrawal.feeTokenID,
                        withdrawal.fee,
                        withdrawal.to
                    )
                )
            );

            // Verify the signature if one is provided, otherwise fall back to an approved tx
            if (auxData.signature.length > 0) {
                require(txHash.verifySignature(withdrawal.owner, auxData.signature), "INVALID_SIGNATURE");
            } else {
                require(S.approvedTx[withdrawal.owner][txHash], "TX_NOT_APPROVED");
                S.approvedTx[withdrawal.owner][txHash] = false;
            }
        } else if (withdrawal.withdrawalType == 2 || withdrawal.withdrawalType == 3) {
            require(withdrawal.owner == withdrawal.to, "INVALID_WITHDRAWAL_ADDRESS");
            require(withdrawal.fee == 0, "FEE_NOT_ZERO");

            ExchangeData.ForcedWithdrawal storage forcedWithdrawal = S.pendingForcedWithdrawals[withdrawal.accountID][withdrawal.tokenID];
            if (forcedWithdrawal.timestamp == 0) {
                // Allow the operator to submit fill withdrawals without authorization of the account owner
                // when in shutdown mode
                require(S.isShutdown(), "FULL_WITHDRAWAL_UNAUTHORIZED");
            } else {
                // Type == 2: valid onchain withdrawal started by the owner
                // Type == 3: invalid onchain withdrawal started by someone else
                bool authorized = (withdrawal.owner == forcedWithdrawal.owner);
                require((withdrawal.withdrawalType == 2) == authorized, "INVALID_WITHDRAW_TYPE");
                if (!authorized) {
                    require(withdrawal.amount == 0, "UNAUTHORIZED_WITHDRAWAL");
                }

                // Get the fee
                feeETH = forcedWithdrawal.fee;

                // Reset the approval so it can't be used again
                S.pendingForcedWithdrawals[withdrawal.accountID][withdrawal.tokenID] = ExchangeData.ForcedWithdrawal(address(0), 0, 0);

                // Open up a slot
                S.numPendingForcedTransactions--;

                emit OnchainWithdrawalConsumed(withdrawal.accountID, withdrawal.tokenID, withdrawal.amount);
            }
        } else {
            revert("INVALID_WITHDRAWAL_TYPE");
        }

        // Try to transfer the tokens with the provided gas limit
        S.distributeWithdrawal(
            withdrawal.to,
            withdrawal.tokenID,
            withdrawal.amount,
            auxData.gasLimit
        );
    }

    function readWithdrawal(
        bytes memory data
        )
        internal
        pure
        returns (Withdrawal memory)
    {
        uint offset = 1;

        uint withdrawalType = data.bytesToUint8(offset);
        offset += 1;
        address owner = data.bytesToAddress(offset);
        offset += 20;
        uint24 accountID = data.bytesToUint24(offset);
        offset += 3;
        uint32 nonce = data.bytesToUint32(offset);
        offset += 4;
        uint16 tokenID = data.bytesToUint16(offset) >> 4;
        uint16 feeTokenID = uint16(data.bytesToUint16(offset + 1) & 0xFFF);
        offset += 3;
        uint amount = data.bytesToUint96(offset);
        offset += 12;
        uint fee = uint(data.bytesToUint16(offset)).decodeFloat(16);
        offset += 2;
        address to = data.bytesToAddress(offset);
        offset += 20;

        return Withdrawal({
            withdrawalType: withdrawalType,
            owner: owner,
            accountID: accountID,
            nonce: nonce,
            tokenID: tokenID,
            amount: amount,
            feeTokenID: feeTokenID,
            fee: fee,
            to: to
        });
    }
}
