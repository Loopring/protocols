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
import "../../lib/ERC20.sol";

/// @title AuctionStatus.
/// @author Daniel Wang  - <daniel@loopring.org>
library AuctionStatus
{
    using MathUint for uint;
    using MathUint for uint64;

    function getAuctionStatus(
            IAuctionData.State storage s
        )
        internal
        view
        returns (IAuctionData.Status memory i)
    {
        i.askAmount = s.askAmount;
        i.bidAmount = s.bidAmount;
        i.queuedAskAmount = s.queueIsBid ? 0 : s.queueAmount;
        i.queuedBidAmount = s.queueIsBid ?  s.queueAmount: 0;

        if (s.askAmount > 0) {
            i.actualPrice  = s.bidAmount.mul(s.S) / s.askAmount;
            i.isBounded = i.actualPrice >= s.P0 && i.actualPrice <= s.P1;
        }

        require(i.isBounded || (s.askShift == 0 && s.bidShift == 0), "unbound shift");

        uint time = block.timestamp.sub(s.startTime);
        uint span;

        // calculating asks
        span = time.sub(s.askShift);

        i.askPrice = s.curve.getCurveValue(s.P0, s.P1, s.T, span);
        i.newAskShift = s.askShift;
        i.bidAllowed = ~uint256(0); // = uint.MAX

        if (i.isBounded) {
            if (i.actualPrice > i.askPrice) {
                i.newAskShift = time.sub(
                    s.curve.getCurveTime(s.P0, s.P1, s.T, i.actualPrice)
                );

                i.askPrice = i.actualPrice;
                i.bidAllowed = 0;
            } else {
                i.bidAllowed = (
                    s.askAmount.add(i.queuedAskAmount).mul(i.askPrice) / s.S
                ).sub(s.bidAmount);
            }
        }

        // calculating bids
        span = time.sub(s.bidShift);
        i.bidPrice = s.P.mul(s.P) / s.curve.getCurveValue(s.P0, s.P1, s.T, span);
        i.newBidShift = s.bidShift;
        i.bidAllowed = ~uint256(0); // = uint.MAX

        if (i.isBounded) {
            if (i.actualPrice < i.bidPrice) {
                i.newAskShift = time.sub(
                    s.curve.getCurveTime(s.P, s.M, s.T, s.P.mul(s.P) / i.actualPrice)
                );

                i.bidPrice = i.actualPrice;
                i.askAllowed = 0;
            } else {
                i.askAllowed = (
                    s.bidAmount.add(i.queuedBidAmount).mul(s.S) / i.bidPrice
                ).sub(s.askAmount);
            }
        }

        assert(
            s.queueAmount == 0 ||
            s.queueIsBid && i.bidAllowed == 0 ||
            !s.queueIsBid && i.askAllowed == 0
        );
    }
}