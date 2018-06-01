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
pragma solidity 0.4.23;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "../impl/Data.sol";
import "../lib/MathUint.sol";


/// @title ParticipationHelper
/// @author Daniel Wang - <daniel@loopring.org>.
library ParticipationHelper {
    using MathUint      for uint;

    function adjustOrderState(
        Data.Participation p
        )
        public
        pure
    {
        p.order.maxAmountS = p.order.maxAmountS.sub(p.fillAmountS);
        p.order.maxAmountB = p.order.maxAmountB.sub(p.fillAmountB);
        p.order.maxAmountLrcFee = p.order.maxAmountLrcFee.sub(p.lrcFee);

        if (p.order.sellLRC) {
            p.order.maxAmountLrcFee = p.order.maxAmountLrcFee.sub(p.fillAmountS);
        }
    }

    function calculateFillAmounts(
        Data.Participation p
        )
        public
        pure
        returns (bool thisOrderIsSmaller)
    {
        Data.Order memory order = p.order;

        p.fillAmountB = p.fillAmountS.mul(p.rateB) / p.rateS;

        if (order.limitByAmountB) {
            if (p.fillAmountB > order.maxAmountB) {
                p.fillAmountB = order.maxAmountB;
                p.fillAmountS = p.fillAmountB.mul(p.rateS) / p.rateB;
                thisOrderIsSmaller = true;
            }
            p.lrcFee = order.lrcFee.mul(p.fillAmountB) / order.amountB;
        } else {
            p.lrcFee = order.lrcFee.mul(p.fillAmountS) / order.amountS;
        }
    }

    function calculateFeeAmounts(
        Data.Participation p,
        Data.Mining mining
        )
        public
        pure
    {
        Data.Order memory order = p.order;

    }
}