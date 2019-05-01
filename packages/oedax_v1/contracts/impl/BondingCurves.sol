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

import "../iface/IBondingCurves.sol";
import "../iface/ICurve.sol";

import "../lib/MathUint.sol";


/// @title An Implementation of IBondingCurves.
/// @author Daniel Wang  - <daniel@loopring.org>
contract BondingCurves is IBondingCurves
{
    using MathUint  for uint;

    ICurve    curve;

    // -- Constructor --
    constructor(
        address _curveAddress
        )
        public
    {
      require (_curveAddress != address(0x0), "zero address");
      curve = ICurve(_curveAddress);
    }

    // == Public Functions ==
    function getAskPriceAt(
        uint  P, // target price
        uint8 M, // price factor
        uint  amountAsk,
        uint  amountBid,
        uint  priceScale,
        uint  time,
        uint  shift
        )
        public
        view
        returns (
            uint askPrice,
            uint newShift
        )
    {
        uint maxPrice = P.mul(M);
        uint t = time.sub(shift);
        newShift = shift;
        askPrice = curve.getCurveValue(P, M, priceScale, t);

        if (amountAsk > 0) {
          uint actualPrice = amountBid.mul(priceScale) / amountAsk;
          if (actualPrice > askPrice && actualPrice < maxPrice ) {
             uint _t = curve.getCurveTime(P, M, priceScale, actualPrice);
             newShift = _t.sub(t).add(shift);
             askPrice = actualPrice;
          }
        }
    }

    // function getBidPriceAt(
    //     uint  P,
    //     uint8 M, // price factor
    //     uint  amountAsk,
    //     uint  amountBid,
    //     uint  priceScale,
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
