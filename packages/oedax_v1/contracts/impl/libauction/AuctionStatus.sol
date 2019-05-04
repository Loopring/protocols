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

        if (s.askAmount > 0) {
            i.actualPrice  = actualPrice(s);
            i.isBounded = i.actualPrice >= P0 && i.actualPrice <= P1;
        }

        if (!i.isBounded) {
            assert(s.askShift == 0 && s.bidShift == 0);
            i.askPrice = s.P;
            i.bidPrice = s.P;

            if (s.settlementTime == 0) {
                // price unbounded and not settled yet
                i.duration = s.curve.yToX(P0, P1, s.T, s.P); // the earliest end time

                if (i.duration > time) {
                    // the auction is open
                    i.askPrice = s.curve.xToY(P0, P1, s.T, time);
                    i.bidPrice = s.P.mul(s.P) / s.curve.xToY(P0, P1, s.T, time);

                    i.askAllowed = ~uint256(0); // = uint.MAX
                    i.bidAllowed = ~uint256(0); // = uint.MAX
                }
            }
        } else {
            i.askPrice = i.actualPrice;
            i.bidPrice = i.actualPrice;

            if (s.settlementTime == 0) {
                // price bounded and not settled yet
                uint askCrossTime = s.curve.yToX(P0, P1, s.T, i.actualPrice) + s.askShift;
                uint bidCrossTime = s.curve.yToX(P0, P1, s.T, s.P.mul(s.P) / i.actualPrice) + s.bidShift;
                i.duration = askCrossTime.max(bidCrossTime);

                if (i.duration > time) {
                    // the auction is open
                    if (askCrossTime > time) {
                        // The ask-curve has not crossed the actual price line
                        i.askPrice = s.curve.xToY(P0, P1, s.T, time - s.askShift);
                        i.bidAllowed = (s.askAmount
                            .add(s.Q.isBidding ? 0: s.Q.amount) // the ask-queued
                            .mul(i.askPrice) / s.S
                        ).sub(s.bidAmount);
                    } else {
                        // The ask-curve has already crossed the actual price line
                        i.newAskShift = time + s.askShift - askCrossTime;
                    }

                    if (bidCrossTime > time) {
                        // The bid-curve has not cross the actual price line
                        i.bidPrice = s.P.mul(s.P) / s.curve.xToY(P0, P1, s.T, time - s.bidShift);
                        i.askAllowed = (s.bidAmount.add(
                            s.Q.isBidding ? s.Q.amount: 0
                            ).mul(s.S) / i.bidPrice).sub(s.askAmount);
                    } else {
                        // The bid-curve has already crossed the actual price line
                        i.newBidShift = time + s.bidShift - bidCrossTime;
                    }
                }
            }
        }
    }
}