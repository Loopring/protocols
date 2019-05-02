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

/// @title AuctionInfo.
/// @author Daniel Wang  - <daniel@loopring.org>
library AuctionInfo
{
    using MathUint for uint;
    using MathUint for uint32;

    function getAuctionInfo(
            IAuctionData.State storage s
        )
        internal
        view
        returns (IAuctionData.Info memory i)
    {
        i.askAmount = s.askAmount;
        i.bidAmount = s.bidAmount;
        i.queuedAskAmount = s.queueIsBid ? 0 : s.queueAmount;
        i.queuedBidAmount = s.queueIsBid ?  s.queueAmount: 0;

        if (s.askAmount > 0) {
            i.actualPrice  = s.bidAmount.mul(s.S) / s.askAmount;
            i.isBounded = i.actualPrice >= s.P / s.M && i.actualPrice <= s.P.mul(s.M);
        }

        require(i.isBounded || (s.askShift == 0 && s.bidShift == 0), "unbound shift");

        uint span;

        // calculating asks
        span = block.timestamp.sub(s.startTime).sub(s.askShift);
        i.askPrice = s.curve.getCurveValue(s.P, s.S, s.M, s.T, span);
        i.newAskShift = s.askShift;
        i.additionalBidAmountAllowed = ~uint256(0); // = uint.MAX

        if (i.isBounded) {
            if (i.actualPrice > i.askPrice) {
                i.newAskShift = span
                    .add(s.askShift)
                    .sub(s.curve.getCurveTime(
                        s.P, s.S, s.M, s.T,
                        i.actualPrice
                    ));
                i.askPrice = i.actualPrice;
                i.additionalBidAmountAllowed = 0;
            } else {
                i.additionalBidAmountAllowed = (
                    s.askAmount.add(i.queuedAskAmount).mul(i.askPrice ) / s.S
                ).sub(s.bidAmount);
            }
        }

        // calculating bids
        span = block.timestamp.sub(s.startTime).sub(s.bidShift);
        i.bidPrice = s.P.mul(s.P) / s.S / s.curve.getCurveValue(s.P, s.S, s.M, s.T, span);
        i.newBidShift = s.bidShift;
        i.additionalBidAmountAllowed = ~uint256(0); // = uint.MAX

        if (i.isBounded) {
            if (i.actualPrice < i.bidPrice) {
                i.newAskShift = span
                    .add(s.bidShift)
                    .sub(s.curve.getCurveTime(
                        s.P, s.S, s.M, s.T,
                        s.askAmount.mul(s.P).mul(s.P) / s.bidAmount
                    ));
                i.bidPrice = i.actualPrice;
                i.additionalAskAmountAllowed = 0;
            } else {
                i.additionalAskAmountAllowed = (
                    s.askAmount.add(i.queuedBidAmount).mul(i.bidPrice) / s.S
                ).sub(s.bidAmount);
            }
        }

        if (s.queueAmount > 0) {
            require(s.queueIsBid || i.additionalAskAmountAllowed == 0);
            require(!s.queueIsBid || i.additionalBidAmountAllowed == 0);
        }
    }
}