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
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "../../iface/IExchangeV3.sol";

import "../../lib/Claimable.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/ReentrancyGuard.sol";
import "../../lib/SignatureUtil.sol";
import "../../lib/EIP712.sol";


/// @title Fast withdrawal agent implementation. The fast withdrawal request reduces to
///        a normal onchain withdrawal request after a specified time limit has exceeded.
///
///        Fast withdrawals are a way for an operator to provide instant withdrawals for
///        users with the help of a liquidity provider and conditional transfers.
///
///        A fast withdrawal requires the non-trustless cooperation of 2 parties:
///        - A liquidity provider which provides funds to users immediately onchain
///        - The operator which will make sure the user has sufficient funds offchain
///          so that the liquidity provider can be paid back offchain using a conditional transfer.
///          The operator also needs to process those conditional transfers so that the
///          liquidity provider receives its funds back in its own account where it
///          again has full custody over it.
///
///        However, there is a special case when the fast withdrawal reduces to a standard
///        withdrawal and the fee is paid onchain. In this case the withdrawal can be
///        done completely trustless, no cooperation with the operator is needed.
///
///        We require the fast withdrawals to be executed by the liquidity provider (as msg.sender)
///        so that the liquidity provider can impose its own rules on how its funds are spent. This will
///        inevitably need to be done in close cooperation with the operator, or by the operator
///        itself using a smart contract where the liquidity provider enforces who, how
///        and even if their funds can be used to facilitate the fast withdrawals.
///
///        The liquidity provider can call `executeFastWithdrawals` to provide users
///        immediately with funds onchain. This allows the security of the funds to be handled
///        by any EOA or smart contract.
///
///        Users that want to make use of this functionality have to
///        authorize this contract as their agent.
///
/// @author Brecht Devos - <brecht@loopring.org>
contract FastWithdrawalAgent is ReentrancyGuard
{
    using AddressUtil       for address;
    using AddressUtil       for address payable;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using SignatureUtil     for bytes32;

    struct FastWithdrawal
    {
        address exchange;
        address from;                   // The owner of the account
        address to;                     // The address that will receive the tokens withdrawn
        address token;
        uint    amount;
        address feeToken;
        uint    fastFee;                // Fee paid for a fast withdrawal
        uint    fee;                    // Fee paid for a standard onchain withdrawal
        bool    onchainFeePayment;
        uint    fastUntil;
        uint    validUntil;
        bytes   signature;
    }

    // Replay protection
    mapping (bytes32 => bool) txHash;

    // EIP712
    bytes32 constant public FASTWITHDRAWAL_TYPEHASH = keccak256(
        "FastWithdrawal(address exchange,address from,address to,address token,uint256 amount,address feeToken,uint256 fastFee,uint256 fee,bool onchainFeePayment,uint256 fastUntil,uint256 validUntil)"
    );
    bytes32 public DOMAIN_SEPARATOR;

    constructor()
        public
    {
        DOMAIN_SEPARATOR = EIP712.hash(EIP712.Domain("FastWithdrawalAgent", "1.0", address(this)));
    }

    // This method needs to be called by any liquidity provider
    function executeFastWithdrawals(FastWithdrawal[] memory fastWithdrawals)
        public
        nonReentrant
        payable
    {
        // Do all fast withdrawals
        for (uint i = 0; i < fastWithdrawals.length; i++) {
            executeFastWithdrawal(fastWithdrawals[i]);
        }
        // Return any ETH left into this contract
        // (can happen when more ETH is sent than needed for the fast withdrawals)
        msg.sender.sendETHAndVerify(address(this).balance, gasleft());
    }

    // -- Internal --

    function executeFastWithdrawal(FastWithdrawal memory fastWithdrawal)
        internal
    {
        // Compute the hash
        bytes32 hash = EIP712.hashPacked(
            DOMAIN_SEPARATOR,
            keccak256(
                abi.encodePacked(
                    FASTWITHDRAWAL_TYPEHASH,
                    fastWithdrawal.exchange,
                    fastWithdrawal.from,
                    fastWithdrawal.to,
                    fastWithdrawal.token,
                    fastWithdrawal.amount,
                    fastWithdrawal.feeToken,
                    fastWithdrawal.fastFee,
                    fastWithdrawal.fee,
                    fastWithdrawal.onchainFeePayment,
                    fastWithdrawal.fastUntil,
                    fastWithdrawal.validUntil
                )
            )
        );

        // Make sure the tx isn't used multiple times
        require(txHash[hash] == false, "TX_REPLAY");
        txHash[hash] = true;

        // Check the signature
        require(hash.verifySignature(fastWithdrawal.from, fastWithdrawal.signature), "INVALID_SIGNATURE");

        // The liquidity provider always authorizes the fast withdrawal by being the direct caller
        address payable liquidityProvider = msg.sender;

        IExchangeV3 exchange = IExchangeV3(fastWithdrawal.exchange);

        uint fee;
        if (now <= fastWithdrawal.fastUntil) {
            /* Fast withdrawal */

            // Transfer the tokens immediately to the requested address
            // using funds from the liquidity provider (`msg.sender`).
            transfer(
                liquidityProvider,
                fastWithdrawal.to,
                fastWithdrawal.token,
                fastWithdrawal.amount
            );

            // Pay the fast fee
            fee = fastWithdrawal.fastFee;

            // If the fee is paid offchain in the same token as the main transfer
            // just add it to the transfer amount
            if (!fastWithdrawal.onchainFeePayment && fastWithdrawal.token == fastWithdrawal.feeToken) {
                fastWithdrawal.amount = fastWithdrawal.amount.add(fee);
                fee = 0;
            }

            // Approve the offchain transfer from the account that's withdrawing back to the liquidity provider
            exchange.approveOffchainTransfer(
                fastWithdrawal.from,
                liquidityProvider,
                fastWithdrawal.token,
                fastWithdrawal.amount
            );
        } else {
            /* Standard onchain withdrawal */

            // Check the time limit
            require(now <= fastWithdrawal.validUntil, "TX_EXPIRED");

            // Do the onchain withdrawal request
            (,,, uint withdrawalFeeETH) = exchange.getFees();
            exchange.withdraw{value: withdrawalFeeETH}(
                fastWithdrawal.from,
                fastWithdrawal.token,
                uint96(fastWithdrawal.amount)
            );

            // Pay the standard fee
            fee = fastWithdrawal.fee;
        }

        // Fee payment to the liquidity provider
        if (fee > 0) {
            if (fastWithdrawal.onchainFeePayment) {
                // Do fee payment directly from the user's wallet if requested
                // (using the approval for the exchange)
                exchange.onchainTransferFrom(
                    fastWithdrawal.from,
                    liquidityProvider,
                    fastWithdrawal.feeToken,
                    fee
                );
            } else {
                // Do the fee payment with an internal transfer as well
                // Approve the fee transfer
                exchange.approveOffchainTransfer(
                    fastWithdrawal.from,
                    liquidityProvider,
                    fastWithdrawal.feeToken, 
                    fee
                );
            }
        }
    }

    function transfer(
        address from,
        address to,
        address token,
        uint    amount
        )
        internal
    {
        if (amount > 0) {
            if (token == address(0)) {
                to.sendETHAndVerify(amount, gasleft()); // ETH
            } else {
                token.safeTransferFromAndVerify(from, to, amount);  // ERC20 token
            }
        }
    }
}