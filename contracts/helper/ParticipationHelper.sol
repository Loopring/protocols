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
pragma solidity 0.4.24;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "../impl/Data.sol";
import "../lib/MathUint.sol";


/// @title ParticipationHelper
/// @author Daniel Wang - <daniel@loopring.org>.
library ParticipationHelper {
    using MathUint for uint;

    function adjustOrderState(
        Data.Participation p
        )
        internal
        pure
    {
        uint totalAmountS = p.fillAmountS + p.splitS + p.taxS;
        uint totalAmountFee = p.feeAmount + p.taxFee;
        p.order.filledAmountS += totalAmountS;
        p.order.maxAmountS = p.order.maxAmountS.sub(totalAmountS);
        // Update spendeables
        p.order.spendableS = p.order.spendableS.sub(totalAmountS);
        p.order.spendableFee = p.order.spendableFee.sub(totalAmountFee);
        if (p.order.tokenS == p.order.feeToken) {
            p.order.spendableS = p.order.spendableS.sub(totalAmountFee);
            p.order.spendableFee = p.order.spendableFee.sub(totalAmountS);
        }
    }

}
