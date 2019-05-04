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

import "../../lib/MathUint.sol";
import "../../lib/ERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";

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
        uint    askReturend;
        uint    askFeeRebate;
        uint    bidPaid;
        uint    bidReceived;
        uint    bidReturend;
        uint    bidFeeRebate;
    }

    using MathUint          for uint;
    using ERC20SafeTransfer for address;
    using AuctionStatus     for IAuctionData.State;

    function settle(
        IAuctionData.State storage s,
        address owner
        )
        internal
    {
        require(s.settledAt == 0, "auction already settled");

        IAuctionData.Status memory i = s.getAuctionStatus();
        require(block.timestamp >= i.closingAt, "auction still open");

        // update state
        s.settledAt = block.timestamp;
        s.closedAt = i.closingAt;

        uint timeSinceClose = block.timestamp - i.closingAt;

        require(
            timeSinceClose > s.oedax.settleGracePeriod() ||
            msg.sender == owner,
            "unauthorized"
        );

        payUsers(s);

        paySettler(s, timeSinceClose);

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
       // collect remaining Ether to fee recipient
        payToken(
            feeRecipient,
            address(0x0),
            address(this).balance
        );

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
    }

    function paySettler(
        IAuctionData.State storage s,
        uint timeSinceClose
        )
        private
    {
        uint gracePeriod = s.oedax.settleGracePeriod();

        uint rebate = 0;//.s.fees.creationFeeEther();

        if (timeSinceClose >= gracePeriod) {
            rebate /= 2;
        } else if (timeSinceClose > gracePeriod / 2) {
            uint bips = 15000 - timeSinceClose.mul(10000) / gracePeriod;
            rebate = rebate.mul(bips) / 10000;
        }

        if (rebate > 0) {
            msg.sender.transfer(rebate);
        }
    }

    function payUsers(
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
        Trading memory t = Trading(0, 0, 0, 0, 0, 0, 0, 0);

        for (uint i = 0; i < s.users.length; i++) {
            user = s.users[i];
            IAuctionData.Account storage a = s.accounts[user];

            t.askPaid = a.askAccepted;
            t.askReceived =  askSettlement.mul(a.bidAccepted) / s.bidAmount;
            t.askReturend = a.askQueued;
            t.askFeeRebate = askTakerFee.mul(bips[i]) / 10000;

            t.bidPaid = a.bidAccepted;
            t.bidReceived =  bidSettlement.mul(a.askAccepted) / s.askAmount;
            t.bidReturend = a.bidQueued;
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

          bips[i] = (a.bidFeeRebateWeight / s.bidAmount)
              .add(a.askFeeRebateWeight / s.askAmount);

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
        payToken(
            user,
            askToken,
            t.askReceived.add(t.askReturend).add(t.askFeeRebate)
        );

        payToken(
            user,
            bidToken,
            t.bidReceived.add(t.bidReturend).add(t.bidFeeRebate)
        );

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
        private
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