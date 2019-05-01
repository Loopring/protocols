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

    function getAskPriceAt(
        address curveAddress,
        uint    P, // target price
        uint8   M, // price factor
        uint    S, // price scale
        uint    amountAsk,
        uint    amountBid,
        uint    time,
        uint    shift
        )
        internal
        view
        returns (
            uint askPrice,
            uint newShift,
            uint additionalAmountBidAllowed
        )
    {
        ICurve curve = ICurve(curveAddress);
        uint t = time.sub(shift);
        newShift = shift;
        askPrice = curve.getCurveValue(P, M, S, t);
        additionalAmountBidAllowed = ~uint256(0); // = uint.MAX

        if (amountAsk == 0) {
            // when the ask price is undefined, the price is not bounded yet.
            require(shift == 0, "unbound shift");
        } else {
          // when the ask price is defined
          uint actualPrice = amountBid.mul(S) / amountAsk;
          if (actualPrice < P / M || actualPrice > P.mul(M)) {
              // price not bounded yet
              require(shift == 0, "unbound shift");
          } else if (actualPrice > askPrice) {
              // price bounded
             uint _t = curve.getCurveTime(P, M, S, actualPrice);
             newShift = _t.sub(t).add(shift);
             askPrice = actualPrice;
             additionalAmountBidAllowed = 0;
          } else {
            // actual price <= ask price
            additionalAmountBidAllowed = (askPrice.mul(amountAsk) / S).sub(amountBid);
          }
        }
    }

    // function getBidPriceAt(
    //     uint  P,
    //     uint8 M, // price factor
    //     uint  amountAsk,
    //     uint  amountBid,
    //     uint  S,
    //     uint  time,
    //     uint  shift
    //     )
    //     public
    //     view
    //     returns (
    //         uint bidPrice,
    //         uint newShift
    //     );

    // == Internal Functions ==

}
