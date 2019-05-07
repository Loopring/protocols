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
import "../../lib/MathUint.sol";

/// @title AuctionStatus.
/// @author Daniel Wang  - <daniel@loopring.org>
library AuctionStatus
{
    using MathUint for uint;

    function actualPrice(
            IAuctionData.State storage s
        )
        internal
        view
        returns (uint)
    {
        assert(s.askAmount > 0);
        return s.S.mul(s.bidAmount).mul(s.askBaseUnit) / s.askAmount / s.bidBaseUnit;
    }

    function getAuctionStatus(
            IAuctionData.State storage s
        )
        internal
        view
        returns (IAuctionData.Status memory i)
    {
        uint elapsed = block.timestamp - s.startTime;
        i.timeRemaining = elapsed >= s.T ? elapsed - s.T : 0;

        uint p = s.P; // target price where bid/ask curves converge

        if (s.askAmount > 0) {
            i.actualPrice  = actualPrice(s);
            i.isBounded = i.actualPrice >= s.P / s.M && i.actualPrice <= s.P.mul(s.M);

            if (i.isBounded) {
                p = i.actualPrice;
            }
        }

        if (i.timeRemaining == 0)  {
            // auction ended already
            i.askPrice = p;
            i.bidPrice = p;
        } else {
            // auction still open
            i.askPrice = s.P.add(s.curve.xToY(s.P.mul(s.M).sub(s.P), s.T, elapsed));
            i.bidPrice = s.P.sub(s.curve.xToY(s.P.sub(s.P / s.M), s.T, elapsed));

            if (i.isBounded) {
                 // price bounded and not settled yet
                i.bidAllowed = (s.askAmount
                    .add(s.Q.isBidding ? 0 : s.Q.amount) // the asks-queued
                    .mul(i.askPrice) / s.S
                ).sub(s.bidAmount);

                i.askAllowed = (s.bidAmount
                    .add(s.Q.isBidding ? s.Q.amount : 0) // the bids-queued
                    .mul(s.S) / i.bidPrice
                ).sub(s.askAmount);
            } else {
                 // price unbounded and not settled yet
                i.askAllowed = ~uint256(0); // = uint.MAX
                i.bidAllowed = ~uint256(0); // = uint.MAX
            }
        }

    }
}