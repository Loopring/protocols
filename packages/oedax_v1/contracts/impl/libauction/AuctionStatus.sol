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
        uint P0 = s.P.mul(s.M);
        uint P1 = s.P / s.M;
        assert(P0 > 0 && P1 > P0);

        uint time = block.timestamp.sub(s.startTime);
        uint t0 = time;

        if (s.askAmount > 0) {
            i.actualPrice  = actualPrice(s);
            i.isBounded = i.actualPrice >= P0 && i.actualPrice <= P1;
        }

        i.askPrice = s.curve.xToY(P0, P1, s.T, time - s.askShift);
        i.bidPrice = s.P.mul(s.P) / s.curve.xToY(P0, P1, s.T, time - s.bidShift);

        if (!i.isBounded) {
            // price not bounded yet
            assert(s.askShift == 0 && s.bidShift == 0);

            if (s.hasSettled) {
                // prie unbounded and settled
                i.askPrice = s.P;
                i.bidPrice = s.P;
                // assert(i.timeRemaining == 0);
                // assert(i.actualPrice == 0);
                // assert(i.askAllowed ==0);
                // assert(i.bidAllowed == 0);
                // assert(i.newAskShift == 0);
                // assert(i.newBidShift == 0);
            } else {
                // unbounded but not settled
                t0 = s.curve.yToX(P0, P1, s.T, s.P); // the earliest end time
                if (t0 > time) {
                    // the auction is still open
                    i.timeRemaining = t0 - time;
                    i.askAllowed = ~uint256(0); // = uint.MAX
                    i.bidAllowed = ~uint256(0); // = uint.MAX
                    // assert(i.actualPrice == 0);
                    // assert(i.newAskShift == 0);
                    // assert(i.newBidShift == 0);
                }
            }
        } else {
            if (s.hasSettled) {
                // price bounded and settled
                i.askPrice = i.actualPrice;
                i.bidPrice = i.actualPrice;
                // assert(i.timeRemaining == 0);
                // assert(i.actualPrice == 0);
                // assert(i.askAllowed ==0);
                // assert(i.bidAllowed == 0);
                // assert(i.newAskShift == 0);
                // assert(i.newBidShift == 0);
            } else {
                // price bounded and but unsettled
                i.newAskShift = s.askShift;
                i.newBidShift = s.bidShift;

                // calculating asks
                if (i.askPrice < i.actualPrice) {
                    i.askPrice = i.actualPrice;

                    // The ask-curve is bounded by the actual price line,
                    // we need to calculate the new ask-shift
                    i.newAskShift = time.sub(s.curve.yToX(P0, P1, s.T, i.actualPrice));

                    // assert(i.bidAllowed == 0);
                } else if (i.askPrice > i.actualPrice) {
                    // There is still room for new bids to be accepted
                    i.bidAllowed = (s.askAmount
                        .add(s.Q.isBidding ? 0: s.Q.amount) // the ask-queued
                        .mul(i.askPrice) / s.S
                    ).sub(s.bidAmount);

                    // there are still extra time for the ask-curve to drop
                    t0 = s.curve.yToX(P0, P1, s.T, i.actualPrice) + s.askShift;
                }

                // calculating bids
                if (i.bidPrice > i.actualPrice) {
                    i.bidPrice = i.actualPrice;

                    // The bid-curve is bounded by the actual price line,
                    // we need to calculate the new bid-shift
                    i.newBidShift = time.sub(s.curve.yToX(P0, P1, s.T, s.P.mul(s.P) / i.actualPrice));

                    // assert(i.askAllowed = 0);
                } else if (i.bidPrice < i.actualPrice) {
                    // There is still room for new asks to be accepted
                    i.askAllowed = (s.bidAmount.add(
                        s.Q.isBidding ? s.Q.amount: 0
                        ).mul(s.S) / i.bidPrice).sub(s.askAmount);

                    // there are still extra time for the ask-curve to rise
                    t0 = t0.max(
                        s.curve.yToX(P0, P1, s.T, s.P.mul(s.P) / i.actualPrice) + s.bidShift
                    );
                }

                i.timeRemaining = t0 - time;
            }
        }
    }
}