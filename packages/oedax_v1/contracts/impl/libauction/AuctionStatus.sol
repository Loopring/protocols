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

/// @title AuctionStatus
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
        uint P0 = s.P / s.M;
        uint P1 = s.P.mul(s.M);
        assert(P0 > 0 && P1 > P0);

        uint elapsed = block.timestamp - s.startTime;

        if (s.askAmount > 0) {
            i.actualPrice  = actualPrice(s);
            i.isBounded = i.actualPrice >= P0 && i.actualPrice <= P1;
        }

        if (!i.isBounded) {
            assert(s.askShift == 0 && s.bidShift == 0);
            i.askPrice = s.P;
            i.bidPrice = s.P;

            // price unbounded
            i.duration = yToX(s, s.P); // the earliest end elapsed

            if (i.duration > elapsed) {
                // the auction is open
                i.askPrice = xToY(s, elapsed);
                i.bidPrice = s.P.mul(s.P) / i.askPrice;

                i.askAllowed = ~uint256(0); // = uint.MAX
                i.bidAllowed = ~uint256(0); // = uint.MAX
            }
        } else {
            i.askPrice = i.actualPrice;
            i.bidPrice = i.actualPrice;

            // price bounded
            uint askCrossTime = yToX(s, i.actualPrice) + s.askShift;
            uint bidCrossTime = yToX(s, s.P.mul(s.P) / i.actualPrice) + s.bidShift;
            i.duration = askCrossTime.max(bidCrossTime);

            if (i.duration > elapsed) {
                // the auction is open
                if (askCrossTime > elapsed) {
                    // The ask-curve has not crossed the actual price line
                    i.askPrice = xToY(s, elapsed - s.askShift);
                    i.bidAllowed = (s.askAmount.mul(i.askPrice) / s.S).sub(s.bidAmount);
                } else {
                    // The ask-curve has already crossed the actual price line
                    i.newAskShift = s.askShift + elapsed - askCrossTime;
                }

                if (bidCrossTime > elapsed) {
                    // The bid-curve has not cross the actual price line
                    i.bidPrice = s.P.mul(s.P) / xToY(s, elapsed - s.bidShift);
                    i.askAllowed = (s.bidAmount.mul(s.S) / i.bidPrice).sub(s.askAmount);
                } else {
                    // The bid-curve has already crossed the actual price line
                    i.newBidShift = s.bidShift + elapsed - bidCrossTime;
                }
            }
        }
    }

    function isAuctionOpen(
        IAuctionData.State storage s,
        IAuctionData.Status memory i
        )
        internal
        view
        returns (bool)
    {
        return block.timestamp < s.startTime + i.duration;
    }

    function xToY(
        IAuctionData.State storage s,
        uint x
        )
        private
        view
        returns (uint y)
    {
        y = s.curve.xToY(s.C, s.P / s.M, s.P.mul(s.M), s.T, x);
    }

    function yToX(
        IAuctionData.State storage s,
        uint y
        )
        private
        view
        returns (uint x)
    {
        x = s.curve.yToX(s.C, s.P / s.M, s.P.mul(s.M), s.T, y);
    }
}