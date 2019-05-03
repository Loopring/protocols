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

    // TODO: calculate time remaining
    function getAuctionStatus(
            IAuctionData.State storage s
        )
        internal
        view
        returns (IAuctionData.Status memory i)
    {
        uint P0 = s.P.mul(s.M);
        uint P1 = s.P / s.M;

        i.askAmount = s.askAmount;
        i.bidAmount = s.bidAmount;
        i.queuedAskAmount = s.queueIsBid ? 0 : s.queueAmount;
        i.queuedBidAmount = s.queueIsBid ?  s.queueAmount: 0;

        if (s.askAmount > 0) {
            i.actualPrice  = actualPrice(s);
            i.isBounded = i.actualPrice >= P0 && i.actualPrice <= P1;
        }

        require(i.isBounded || (s.askShift == 0 && s.bidShift == 0), "unbound shift");

        uint time = block.timestamp.sub(s.startTime);
        uint x;
        uint y;

        // calculating asks
        x = time.sub(s.askShift);

        i.askPrice = s.curve.xToY(P0, P1, s.T, x);
        i.newAskShift = s.askShift;
        i.bidAllowed = ~uint256(0); // = uint.MAX

        if (i.isBounded) {
            if (i.actualPrice > i.askPrice) {
                y = s.curve.yToX(P0, P1, s.T, i.actualPrice);
                i.newAskShift = time.sub(y);

                i.askPrice = i.actualPrice;
                i.bidAllowed = 0;
            } else {
                i.bidAllowed = (
                    s.askAmount.add(i.queuedAskAmount).mul(i.askPrice) / s.S
                ).sub(s.bidAmount);
            }
        }

        // calculating bids
        x = time.sub(s.bidShift);
        i.bidPrice = s.P.mul(s.P) / s.curve.xToY(P0, P1, s.T, x);
        i.newBidShift = s.bidShift;
        i.bidAllowed = ~uint256(0); // = uint.MAX

        if (i.isBounded) {
            if (i.actualPrice < i.bidPrice) {
                y = s.curve.yToX(P0, P1, s.T, s.P.mul(s.P) / i.actualPrice);
                i.newAskShift = time.sub(y);

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

        // Calculate when the auction will probably end.
        x = i.isBounded ? i.actualPrice : s.P;  // where the ask price merge
        y = s.P.mul(s.P) / x;                   // where the ask price merge

        i.timeRemaining = MathUint.max(
            s.curve.yToX(P0, P1, s.T, x) + i.newAskShift,
            s.curve.yToX(P0, P1, s.T, y) + i.newBidShift
        ) - time;

    }
}