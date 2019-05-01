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

import "../iface/ICurve.sol";

import "../lib/MathUint.sol";


/// @title An Implementation of IBondingCurves.
/// @author Daniel Wang  - <daniel@loopring.org>
library BondingCurves
{
    using MathUint  for uint;
    using MathUint  for uint32;

    function calculateBonding(
        ICurve  curve,
        uint32  P, // target price
        uint32  S, // price scale
        uint8   M, // price factor
        uint    T,
        uint    askAmount, // i.e., LRC
        uint    bidAmount, // i.e., ETH
        uint    time,
        uint    askShift,
        uint    bidShift
        )
        internal
        view
        returns (
            bool bounded,
            uint actualPrice,
            uint askPrice,
            uint bidPrice,
            uint newAskShift,
            uint newBidShift,
            uint additionalAmountAskAllowed,
            uint additionalAmountBidAllowed
        )
    {
        if (askAmount > 0) {
            actualPrice = bidAmount.mul(S) / askAmount;
            bounded = actualPrice >= P / M && actualPrice <= P.mul(M);
        }

        require(bounded || (askShift == 0 && bidShift == 0), "unbound shift");

        uint askTime = askShift > 0 ? time.sub(askShift) : time;
        newAskShift = askShift;
        askPrice = curve.getCurveValue(P, S, M, T, askTime);
        additionalAmountBidAllowed = ~uint256(0); // = uint.MAX

        uint bidTime = bidShift > 0 ? time.sub(bidShift) : time;
        newBidShift = bidShift;
        bidPrice = P.mul(P) / S / curve.getCurveValue(P, S, M, T, bidTime);
        additionalAmountBidAllowed = ~uint256(0); // = uint.MAX

        if (bounded) {
            if (actualPrice > askPrice) {
                uint t = curve.getCurveTime(P, S, M, T, actualPrice);
                newAskShift = askTime.add(askShift).sub(t);
                askPrice = actualPrice;
                additionalAmountBidAllowed = 0;
            } else {
              additionalAmountBidAllowed = (askPrice.mul(askAmount) / S).sub(bidAmount);
            }

            if (actualPrice < bidPrice) {
                uint v = askAmount.mul(P).mul(P) / bidAmount;
                uint t = curve.getCurveTime(P, S, M, T, v);
                newAskShift = bidTime.add(bidShift).sub(t);
                bidPrice = actualPrice;
                additionalAmountAskAllowed = 0;
            } else {
                additionalAmountAskAllowed = (bidPrice.mul(askAmount) / S).sub(bidAmount);
            }
        }
    }

}
