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
pragma experimental ABIEncoderV2;

import "../../iface/IAuctionData.sol";

import "../../lib/MathUint.sol";
import "../../lib/ERC20SafeTransfer.sol";

/// @title AuctionSettlement
/// @author Daniel Wang  - <daniel@loopring.org>
library AuctionSettlement
{
    using MathUint          for uint;
    using ERC20SafeTransfer for address;

    function settle(
        IAuctionData.State storage s
        )
        internal
    {

        calcBalanceAndClear(s);

        s.oedax.logTrade(
            s.auctionId,
            s.askToken,
            s.bidToken,
            s.askAmount,
            s.bidAmount
        );
    }

    function calcBalanceAndClear(
        IAuctionData.State storage s
        )
        private
    {
        uint size = s.users.length;
        uint[] memory bips = calcPerUserRewardBips(s);

        uint makerRewardBips = s.oedax.makerRewardBips();
        uint protocolFeeBips = s.oedax.protocolFeeBips();

        uint bidFeeReward = s.bidAmount.mul(makerRewardBips) / 10000;
        uint bidSettlement = s.bidAmount
            .sub(bidFeeReward)
            .sub(s.bidAmount.mul(protocolFeeBips) / 10000);

        uint askFeeReward = s.askAmount.mul(makerRewardBips) / 10000;
        uint askSettlement = s.askAmount
            .sub(askFeeReward)
            .sub(s.askAmount.mul(protocolFeeBips) / 10000);

        for (uint i = 0; i < size; i++) {
            address payable user = s.users[i];
            IAuctionData.Account storage account = s.accounts[user];

            withdrawToken(
                s.askToken,
                user,
                account.askQueued
                    .add(account.bidAccepted.mul(askSettlement) / s.bidAmount)
                    .add(askFeeReward.mul(bips[i]) / 10000)
            );

            withdrawToken(
                s.bidToken,
                user,
                account.bidQueued
                    .add(account.askAccepted.mul(bidSettlement) / s.askAmount)
                    .add(bidFeeReward.mul(bips[i]) / 10000)
            );
        }
    }

    function calcPerUserRewardBips(
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

    function withdrawToken(
        address token,
        address payable to,
        uint    amount
        )
        private
    {
        if (token == address(0x0)) {
            to.transfer(amount);
        } else {
            require(token.safeTransfer(to, amount));
        }
    }

}