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

    function settle(
        IAuctionData.State storage s
        )
        internal
    {
        require(s.settlementTime == 0, "auction already settled");

        IAuctionData.Status memory i = s.getAuctionStatus();
        require(block.timestamp >= s.startTime + i.duration, "auction still open");

        // update state
        s.closeTime = s.startTime + i.duration;
        s.settlementTime = block.timestamp;

        // Collect the protocol fees
        collectProtocolFees(s, s.oedax.feeRecipient());

        // omit an event
        s.oedax.logSettlement(
            s.auctionId,
            s.askToken,
            s.bidToken,
            s.askAmount,
            s.bidAmount
        );
    }

    function withdrawOwnerStakeAndFees(
        IAuctionData.State storage s,
        address payable owner
        )
        internal
    {
        require(s.distributedTime > 0, "all tokens for all users need to be distributed");

        uint amountStakeReturned = s.fees.creatorEtherStake;
        address payable ownerFeeRecipient = owner;

        IAuctionData.Status memory i = s.getAuctionStatus();
        if (!i.isBounded) {
            amountStakeReturned /= 2;
        }
        if (s.settlementTime - s.closeTime > s.oedax.settleGracePeriod()) {
            amountStakeReturned /= 2;
        }
        uint maxTimeAllowedToDistribute = s.users.length.mul(s.oedax.distributeGracePeriodPerUser())
            .add(s.oedax.distributeGracePeriodBase());
        if (s.distributedTime - s.settlementTime > maxTimeAllowedToDistribute) {
            amountStakeReturned = 0;
            // Reward msg.sender with the owner fees
            ownerFeeRecipient = msg.sender;
        }

        // Stake to the owner
        payToken(
            owner,
            address(0x0),
            amountStakeReturned
        );

        // Stake to the protocol pool
        payToken(
            s.oedax.feeRecipient(),
            address(0x0),
            s.fees.creatorEtherStake.sub(amountStakeReturned)
        );

        // Collect the owner fees
        collectOwnerFees(s, ownerFeeRecipient);

        // Make sure the above fees cannot be withdrawn agains by cleaning up the state
        s.askAmount = 0;
        s.bidAmount = 0;
        s.fees.creatorEtherStake = 0;
    }

    function withdrawFor(
        IAuctionData.State storage s,
        IAuctionData.Status memory i,
        address payable user
        )
        internal
    {
        require(s.settlementTime > 0, "auction needs to be settled");

        if (i.isBounded) {
            settleTrade(s, user);
        } else{
            returnDeposit(s, user);
        }

        // Make sure the user can't withdraw again
        // Setting these to 0 again also rebates some gas to the withdrawer.
        IAuctionData.Account storage a = s.accounts[user];
        a.bidAmount = 0;
        a.bidRebateWeight = 0;
        a.askAmount = 0;
        a.askRebateWeight = 0;
    }

    function collectProtocolFees(
        IAuctionData.State storage s,
        address payable feeRecipient
        )
        private
    {
        uint askProtocolFee = s.askAmount.mul(s.fees.protocolFeeBips) / 10000;
        uint bidProtocolFee = s.bidAmount.mul(s.fees.protocolFeeBips) / 10000;

        payToken(
            feeRecipient,
            s.askToken,
            askProtocolFee
        );

        payToken(
            feeRecipient,
            s.bidToken,
            bidProtocolFee
        );
    }

    function collectOwnerFees(
        IAuctionData.State storage s,
        address payable feeRecipient
        )
        private
    {
        uint askOwnerFee = s.askAmount.mul(s.fees.ownerFeeBips) / 10000;
        uint bidOwnerFee = s.bidAmount.mul(s.fees.ownerFeeBips) / 10000;

        payToken(
            feeRecipient,
            s.askToken,
            askOwnerFee
        );

        payToken(
            feeRecipient,
            s.bidToken,
            bidOwnerFee
        );
    }

    function returnDeposit(
        IAuctionData.State storage s,
        address payable user
        )
        private
    {
        IAuctionData.Account storage a = s.accounts[user];

        payToken(user, s.askToken, a.askAmount);
        payToken(user, s.bidToken, a.bidAmount);
    }

    function settleTrade(
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

        IAuctionData.Account storage a = s.accounts[msg.sender];

        t.askPaid = a.askAmount;
        t.askReceived = askSettlement.mul(a.bidAmount) / s.bidAmount;
        t.askFeeRebate = askTakerFee.mul(bips) / 10000;

        t.bidPaid = a.bidAmount;
        t.bidReceived = bidSettlement.mul(a.askAmount) / s.askAmount;
        t.bidFeeRebate = bidTakerFee.mul(bips) / 10000;

        payUser(s.askToken, s.bidToken, msg.sender, t);
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
        assert(total > 0);

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
