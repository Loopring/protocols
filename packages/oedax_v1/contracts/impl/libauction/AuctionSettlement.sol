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

    using MathUint          for uint;
    using ERC20SafeTransfer for address;
    using AuctionStatus     for IAuctionData.State;

    function settle(
        IAuctionData.State storage s,
        address payable owner
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
        uint gracePeriod = s.oedax.settleGracePeriod();
        address payable feeRecipient = s.oedax.feeRecipient();

        require(timeSinceClose > gracePeriod || msg.sender == owner);

        uint creationFeeRebate = calcCreationFeeRebate(
            timeSinceClose,
            gracePeriod,
            s.fees.creationFeeEther);

        if (creationFeeRebate > 0) {
            msg.sender.transfer(creationFeeRebate);
        }

        calcBalancesAndPayParticipants(s);

        // transfer remaining Ether to fee recipient
        withdrawToken(
            feeRecipient,
            address(0x0),
            address(this).balance
        );

         // transfer remaining ask token to fee recipient
        if (s.askToken != address(0x0)) {
            withdrawToken(
                feeRecipient,
                s.askToken,
                ERC20(s.askToken).balanceOf(address(this))
            );
        }

         // transfer remaining bid token to fee recipient
        if (s.bidToken != address(0x0)) {
            withdrawToken(
                feeRecipient,
                s.bidToken,
                ERC20(s.bidToken).balanceOf(address(this))
            );
        }

        // omit an event
        s.oedax.logTrade(
            s.auctionId,
            s.askToken,
            s.bidToken,
            s.askAmount,
            s.bidAmount
        );
    }

    function calcCreationFeeRebate(
        uint timeSinceClose,
        uint gracePeriod,
        uint creationFeeEther
        )
        private
        pure
        returns (uint rebate)
    {
        if (timeSinceClose >= gracePeriod) {
            return creationFeeEther / 2;
        } else if (timeSinceClose <= gracePeriod / 2) {
            return creationFeeEther;
        } else {
            uint bips = 15000 - timeSinceClose.mul(10000) / gracePeriod;
            return creationFeeEther.mul(bips) / 10000;
        }
    }

    function calcBalancesAndPayParticipants(
        IAuctionData.State storage s
        )
        private
    {
        uint size = s.users.length;
        uint[] memory bips = calcUserRewardBips(s);

        uint askMakerReward = s.askAmount.mul(s.fees.makerRewardBips) / 10000;
        uint askSettlement = s.askAmount
            .sub(askMakerReward)
            .sub(s.askAmount.mul(s.fees.protocolFeeBips) / 10000);

        uint bidMakerReward = s.bidAmount.mul(s.fees.makerRewardBips) / 10000;
        uint bidSettlement = s.bidAmount
            .sub(bidMakerReward)
            .sub(s.bidAmount.mul(s.fees.protocolFeeBips) / 10000);


        for (uint i = 0; i < size; i++) {
            address payable user = s.users[i];
            IAuctionData.Account storage account = s.accounts[user];

            withdrawTokens(
                user,
                s.askToken,
                account.askAccepted,
                askSettlement.mul(account.bidAccepted) / s.bidAmount,
                account.askQueued,
                askMakerReward.mul(bips[i]) / 10000,
                s.bidToken,
                account.bidAccepted,
                bidSettlement.mul(account.askAccepted) / s.askAmount,
                account.bidQueued,
                bidMakerReward.mul(bips[i]) / 10000
            );
        }
    }

    function calcUserRewardBips(
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
          IAuctionData.Account storage account = s.accounts[s.users[i]];
          bips[i] = (account.bidFeeShare / s.bidAmount)
              .add(account.askFeeShare / s.askAmount);

          total = total.add(bips[i]);
      }

      total /= 10000;

      for (i = 0; i < size; i++) {
          bips[i] /= total;
      }
    }

    function withdrawTokens(
        address payable target,
        address askToken,
        uint    askPaid,
        uint    askReceived,
        uint    askReturend,
        uint    askReward,
        address bidToken,
        uint    bidPaid,
        uint    bidReceived,
        uint    bidReturend,
        uint    bidReward
        )
        private
    {
        withdrawToken(
            target,
            askToken,
            askReceived.add(askReturend).add(askReward)
        );

        withdrawToken(
            target,
            bidToken,
            bidReceived.add(bidReturend).add(bidReward)
        );

        emit Trade(
            target,
            int(askReceived.add(askReward)) - int(askPaid),
            int(bidReceived.add(bidReward)) - int(bidPaid)
        );
    }

    function withdrawToken(
        address payable target,
        address token,
        uint    amount
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