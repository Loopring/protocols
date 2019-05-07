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
        IAuctionData.State storage s,
        address payable owner
        )
        internal
    {
        require(s.settlementTime == 0, "auction already settled");

        IAuctionData.Status memory i = s.getAuctionStatus();
        require(block.timestamp >= s.startTime + i.duration, "auction still open");

        // update state
        s.closeTime = s.startTime + i.duration;
        s.settlementTime = block.timestamp;
        uint rebate = s.fees.creatorEtherStake;

        if (i.isBounded) {
            settleTrades(s);
        } else{
            rebate /= 2;
            returnDeposits(s);
        }

        if (block.timestamp - s.closeTime <= s.oedax.settleGracePeriod()) {
            owner.transfer(rebate);
        } else {
            msg.sender.transfer(rebate / 2);
        }

        // collect everything remaining in this contract as protocol fees.
        collectFees(s, s.oedax.feeRecipient());

        // omit an event
        s.oedax.logSettlement(
            s.auctionId,
            s.askToken,
            s.bidToken,
            s.askAmount,
            s.bidAmount
        );
    }

    function collectFees(
        IAuctionData.State storage s,
        address payable feeRecipient
        )
        private
    {
        // collect remaining ask token to fee recipient
        if (s.askToken != address(0x0)) {
            payToken(
                feeRecipient,
                s.askToken,
                ERC20(s.askToken).balanceOf(address(this))
            );
        }

         // collect remaining bid token to fee recipient
        if (s.bidToken != address(0x0)) {
            payToken(
                feeRecipient,
                s.bidToken,
                ERC20(s.bidToken).balanceOf(address(this))
            );
        }

        // collect remaining Ether to fee recipient
        payToken(
            feeRecipient,
            address(0x0),
            address(this).balance
        );
    }

    function returnDeposits(
        IAuctionData.State storage s
        )
        private
    {
        for (uint i = 0; i < s.users.length; i++) {
            address payable user = s.users[i];
            IAuctionData.Account storage a = s.accounts[user];

            payToken(user, s.askToken, a.askAmount);
            payToken(user, s.bidToken, a.bidAmount);
        }
    }

    function settleTrades(
        IAuctionData.State storage s
        )
        private
    {
        uint[] memory bips = calcUserFeeRebateBips(s);

        uint askTakerFee = s.askAmount.mul(s.fees.takerFeeBips) / 10000;
        uint askSettlement = s.askAmount
            .sub(askTakerFee)
            .sub(s.askAmount.mul(s.fees.protocolFeeBips) / 10000);

        uint bidTakerFee = s.bidAmount.mul(s.fees.takerFeeBips) / 10000;
        uint bidSettlement = s.bidAmount
            .sub(bidTakerFee)
            .sub(s.bidAmount.mul(s.fees.protocolFeeBips) / 10000);

        address payable user;
        Trading memory t = Trading(0, 0, 0, 0, 0, 0);

        for (uint i = 0; i < s.users.length; i++) {
            user = s.users[i];
            IAuctionData.Account storage a = s.accounts[user];

            t.askPaid = a.askAmount;
            t.askReceived =  askSettlement.mul(a.bidAmount) / s.bidAmount;
            t.askFeeRebate = askTakerFee.mul(bips[i]) / 10000;

            t.bidPaid = a.bidAmount;
            t.bidReceived =  bidSettlement.mul(a.askAmount) / s.askAmount;
            t.bidFeeRebate = bidTakerFee.mul(bips[i]) / 10000;

            payUser(s.askToken, s.bidToken, user, t);
        }
    }

    function calcUserFeeRebateBips(
        IAuctionData.State storage s
        )
        private
        view
        returns (uint[] memory bips)
    {
      uint size = s.users.length;
      uint total;
      bips = new uint[](size);

      uint i;
      for (i = 0; i < size; i++) {
          IAuctionData.Account storage a = s.accounts[s.users[i]];

          bips[i] = (a.bidRebateWeight / s.bidAmount)
              .add(a.askRebateWeight / s.askAmount);

          total = total.add(bips[i]);
      }

      total /= 10000;
      assert(total > 0);

      for (i = 0; i < size; i++) {
          bips[i] /= total;
      }
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
        public
    {
        if(amount > 0) {
            if (token == address(0x0)) {
                target.transfer(amount);
            } else {
                require(token.safeTransfer(target, amount));
            }
        }
    }
}