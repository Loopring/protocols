// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/iface/IAgentRegistry.sol";
import "../../core/iface/IExchangeV3.sol";
import "../../lib/Claimable.sol";
import "../../lib/EIP712.sol";
import "../../lib/MathUint.sol";
import "../../lib/ReentrancyGuard.sol";
import "../../lib/SignatureUtil.sol";
import "../../lib/TransferUtil.sol";

/// @title Fast withdrawal agent implementation. With the help of liquidity providers (LPs),
///        exchange operators can convert any normal withdrawals into fast withdrawals.
///
///        Fast withdrawals are a way for the owner to provide instant withdrawals for
///        users with the help of a liquidity provider and conditional transfers.
///
///        A fast withdrawal requires the non-trustless cooperation of 2 parties:
///        - A liquidity provider which provides funds to users immediately onchain
///        - The operator which will make sure the user has sufficient funds offchain
///          so that the liquidity provider can be paid back.
///          The operator also needs to process those withdrawals so that the
///          liquidity provider receives its funds back.
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
/// @author Kongliang Zhong - <kongliang@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
contract FastWithdrawalAgent is ReentrancyGuard, IAgent
{
    using AddressUtil       for address;
    using AddressUtil       for address payable;
    using MathUint          for uint;
    using TransferUtil      for address;

    event Processed(
        address exchange,
        address from,
        address to,
        address token,
        uint96  amount,
        address provider,
        bool    success
    );

    struct Withdrawal
    {
        address exchange;
        address from;                   // The owner of the account
        address to;                     // The `to` address of the withdrawal
        address token;
        uint96  amount;
        uint32  storageID;
    }

    // This method needs to be called by any liquidity provider
    function executeFastWithdrawals(Withdrawal[] calldata withdrawals)
        public
        nonReentrant
        payable
    {
        // Do all fast withdrawals
        for (uint i = 0; i < withdrawals.length; i++) {
            executeInternal(withdrawals[i]);
        }
        // Return any ETH left into this contract
        // (can happen when more ETH is sent than needed for the fast withdrawals)
        msg.sender.sendETHAndVerify(address(this).balance, gasleft());
    }

    // -- Internal --

    function executeInternal(Withdrawal calldata withdrawal)
        internal
    {
        require(
            withdrawal.exchange != address(0) &&
            withdrawal.from != address(0) &&
            withdrawal.to != address(0) &&
            withdrawal.amount != 0,
            "INVALID_WITHDRAWAL"
        );

        // The liquidity provider always authorizes the fast withdrawal by being the direct caller
        address payable liquidityProvider = msg.sender;

        bool success;
        // Override the destination address of a withdrawal to the address of the liquidity provider
        try IExchangeV3(withdrawal.exchange).setWithdrawalRecipient(
            withdrawal.from,
            withdrawal.to,
            withdrawal.token,
            withdrawal.amount,
            withdrawal.storageID,
            liquidityProvider
        ) {
            // Transfer the tokens immediately to the requested address
            // using funds from the liquidity provider (`msg.sender`).
            withdrawal.token.transferFromOut(
                liquidityProvider,
                withdrawal.to,
                withdrawal.amount
            );
            success = true;
        } catch {
            success = false;
        }

        emit Processed(
            withdrawal.exchange,
            withdrawal.from,
            withdrawal.to,
            withdrawal.token,
            withdrawal.amount,
            liquidityProvider,
            success
        );
    }
}
