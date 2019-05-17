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
pragma solidity 0.5.7;

import "../../iface/IAuctionData.sol";

import "../../lib/ERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";

import "./AuctionStatus.sol";

/// @title AuctionSettlement
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library AuctionSettlement
{
    event Trade(
        address user,
        int     askAmount,
        int     bidAmount
    );

    struct Trading {
        uint    askPaid;
        uint    askReceived;
        uint    askFeeRebate;
        uint    bidPaid;
        uint    bidReceived;
        uint    bidFeeRebate;
    }

    using MathUint          for uint;
    using ERC20SafeTransfer for address;
    using AuctionStatus     for IAuctionData.State;

    uint32 public constant MIN_GAS_TO_DISTRIBUTE_TOKENS = 80000;
    uint32 public constant MIN_GAS_TO_DISTRIBUTE_FEES = 100000;

    function settle(
        IAuctionData.State storage s,
        address payable owner
        )
        internal
    {
        IAuctionData.Status memory i = s.getAuctionStatus();
        require(!s.isAuctionOpen(i), "auction needs to be closed");
        require(s.settledAt == 0, "settlement has been completed");

        bool hasTokensBeenDistributed = false;
        // First all tokens for all users need to be distributed
        if (s.numDistributed < s.users.length) {
            distributeTokens(s, i);
            hasTokensBeenDistributed = true;
        }

        // Once all users have received their tokens we will distribute the fees
        if (s.numDistributed == s.users.length) {
            // If the caller also distributed tokens for users in this transaction
            // we check here if we still have enough gas to distribute the fees.
            // If not then it's the responsibility of the caller to set a correct gas limit.
            if (!hasTokensBeenDistributed || gasleft() >= MIN_GAS_TO_DISTRIBUTE_FEES) {
                address payable _owner = address(uint160(owner));
                distributeFees(s, i, _owner);
            }
        }
    }

    function withdrawFor(
        IAuctionData.State storage s,
        IAuctionData.Status memory i,
        address payable user
        )
        internal
    {
        require(!s.isAuctionOpen(i), "auction needs to be closed");

        if (i.isBounded) {
            withdrawSettledTrade(s, user);
        } else{
            withdrawOriginalDeposit(s, user);
        }

        // Make sure the user can't withdraw again
        // Setting these to 0 again also rebates some gas to the withdrawer.
        IAuctionData.Account storage a = s.accounts[user];
        a.bidAmount = 0;
        a.bidRebateWeight = 0;
        a.askAmount = 0;
        a.askRebateWeight = 0;
    }

    function distributeFees(
        IAuctionData.State storage s,
        IAuctionData.Status memory i,
        address payable owner
        )
        private
    {
        address payable ownerFeeRecipient = owner;
        uint amountStakeToOwner = s.fees.creatorEtherStake;
        uint amountStakeToCaller = 0;

        uint closeTime = s.startTime + i.duration;
        uint maxGracePeriod = s.users.length.mul(s.oedax.settleGracePeriodPerUser())
            .add(s.oedax.settleGracePeriodBase());

        if (block.timestamp.sub(closeTime) > maxGracePeriod) {
            amountStakeToOwner = 0;
            // Reward msg.sender with 25% of the stake and the owner fees
            amountStakeToCaller = s.fees.creatorEtherStake / 4;
            ownerFeeRecipient = msg.sender;
        }

        // Punish the auction owner for not making sure the auction is bounded
        if (!i.isBounded) {
            amountStakeToOwner /= 2;
        }

        // Stake to the owner
        payToken(
            owner,
            address(0x0),
            amountStakeToOwner
        );
        // Stake to the caller
        payToken(
            msg.sender,
            address(0x0),
            amountStakeToCaller
        );


        // Stake to the protocol pool
        payToken(
            s.oedax.feeRecipient(),
            address(0x0),
            s.fees.creatorEtherStake.sub(amountStakeToOwner).sub(amountStakeToCaller)
        );
        
        if (i.isBounded) {
            // Collect the owner trading fees
            collectTradingFees(s, s.fees.ownerFeeBips, ownerFeeRecipient);
            // Collect the protocol fees
            collectTradingFees(s, s.fees.protocolFeeBips, s.oedax.feeRecipient());
        }   

        // Only emit an event once
        if (s.fees.creatorEtherStake > 0) {
            s.oedax.logSettlement(
                s.auctionId,
                s.askToken,
                s.bidToken,
                s.askAmount,
                s.bidAmount
            );
        }

        // Make sure the fees above cannot be withdrawn again by cleaning up the state
        s.settledAt = block.timestamp;
    }

    function distributeTokens(
        IAuctionData.State storage s,
        IAuctionData.Status memory i
        )
        private
    {
        uint gasLimit = MIN_GAS_TO_DISTRIBUTE_TOKENS;
        uint j = s.numDistributed;
        uint numUsers = s.users.length;
        while (j < numUsers && gasleft() >= gasLimit) {
            withdrawFor(s, i, s.users[j]);
            j++;
        }
        s.numDistributed = j;

        // TODO: If too late for the owner we could reward msg.sender here with a
        //       part of the stake or owner fees (proportionally to numWithdrawn/users.length)
        //       May not be worth it because this is not a scenario that will be common,
        //       users can always just withdraw their tokens with withdraw()
    }

    function collectTradingFees(
        IAuctionData.State storage s,
        uint feeBips,
        address payable feeRecipient
        )
        private
    {
        uint askFee = s.askAmount.mul(feeBips) / 10000;
        uint bidFee = s.bidAmount.mul(feeBips) / 10000;

        payToken(
            feeRecipient,
            s.askToken,
            askFee
        );

        payToken(
            feeRecipient,
            s.bidToken,
            bidFee
        );
    }

    function withdrawOriginalDeposit(
        IAuctionData.State storage s,
        address payable user
        )
        private
    {
        IAuctionData.Account storage a = s.accounts[user];

        payToken(user, s.askToken, a.askAmount);
        payToken(user, s.bidToken, a.bidAmount);
    }

    function withdrawSettledTrade(
        IAuctionData.State storage s,
        address payable user
        )
        private
    {
        uint bips = calcUserFeeRebateBips(s, user);

        uint askOwnerFee = s.askAmount.mul(s.fees.ownerFeeBips) / 10000;
        uint askTakerFee = s.askAmount.mul(s.fees.takerFeeBips) / 10000;
        uint askSettlement = s.askAmount
            .sub(askOwnerFee)
            .sub(askTakerFee)
            .sub(s.askAmount.mul(s.fees.protocolFeeBips) / 10000);

        uint bidOwnerFee = s.bidAmount.mul(s.fees.ownerFeeBips) / 10000;
        uint bidTakerFee = s.bidAmount.mul(s.fees.takerFeeBips) / 10000;
        uint bidSettlement = s.bidAmount
            .sub(bidOwnerFee)
            .sub(bidTakerFee)
            .sub(s.bidAmount.mul(s.fees.protocolFeeBips) / 10000);

        Trading memory t = Trading(0, 0, 0, 0, 0, 0);

        IAuctionData.Account storage a = s.accounts[user];

        t.askPaid = a.askAmount;
        t.askReceived = askSettlement.mul(a.bidAmount) / s.bidAmount;
        t.askFeeRebate = askTakerFee.mul(bips) / 10000;

        t.bidPaid = a.bidAmount;
        t.bidReceived = bidSettlement.mul(a.askAmount) / s.askAmount;
        t.bidFeeRebate = bidTakerFee.mul(bips) / 10000;

        payUser(s.askToken, s.bidToken, user, t);
    }

    function calcUserFeeRebateBips(
        IAuctionData.State storage s,
        address user
        )
        private
        view
        returns (uint bips)
    {
        IAuctionData.Account storage a = s.accounts[user];

        uint total = (s.totalBidRebateWeight / s.bidAmount)
            .add(s.totalAskRebateWeight / s.askAmount);

        bips = (a.bidRebateWeight / s.bidAmount)
            .add(a.askRebateWeight / s.askAmount);

        total /= 10000;
        
        // some times total will be smaller than 10000 
        if (total == 0) {
            total = 1;
        }

        bips /= total;
    }

    function payUser(
        address         askToken,
        address         bidToken,
        address payable user,
        Trading memory  t
        )
        private
    {
        payToken(user, askToken, t.askReceived.add(t.askFeeRebate));

        payToken(user, bidToken, t.bidReceived.add(t.bidFeeRebate));

        emit Trade(
            user,
            int(t.askReceived.add(t.askFeeRebate)) - int(t.askPaid),
            int(t.bidReceived.add(t.bidFeeRebate)) - int(t.bidPaid)
        );
    }

    function payToken(
        address payable target,
        address         token,
        uint            amount
        )
        internal
    {
        if(amount > 0) {
            if (token == address(0x0)) {
                target.transfer(amount);
            } else {
                require(token.safeTransfer(target, amount), "transfer failed");
            }
        }
    }
}
