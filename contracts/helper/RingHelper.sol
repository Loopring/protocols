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
import "../lib/MultihashUtil.sol";
import "./ParticipationHelper.sol";


/// @title An Implementation of IOrderbook.
library RingHelper {
    using MathUint for uint;
    using ParticipationHelper for Data.Participation;

    function updateHash(
        Data.Ring ring
        )
        public
        pure
    {
        for (uint i = 0; i < ring.size; i++) {
            Data.Participation memory p = ring.participations[i];
            ring.hash = keccak256(
                ring.hash,
                p.order.hash,
                p.marginSplitAsFee
            );
        }
    }

    function calculateFillAmountAndFee(
        Data.Ring ring,
        Data.Mining mining
        )
        public
        view
    {
        for (uint i = 0; i < ring.size; i++) {
            Data.Participation memory p = ring.participations[i];
            Data.Order memory order = p.order;
            p.fillAmountS = order.maxAmountS;
            p.fillAmountB = order.maxAmountB;
        }

        uint smallest = 0;

        for (uint i = 0; i < ring.size; i++) {
            smallest = calculateOrderFillAmounts(ring, i, smallest);
        }

        for (uint i = 0; i < smallest; i++) {
            calculateOrderFillAmounts(ring, i, smallest);
        }

        for (uint i = 0; i < ring.size; i++) {
            Data.Participation memory p = ring.participations[i];
            p.calculateFeeAmounts(mining);
            p.adjustOrderState();
        }
    }

    function calculateOrderFillAmounts(
        Data.Ring ring,
        uint i,
        uint smallest
        )
        internal
        pure
        returns (uint smallest_)
    {
        // Default to the same smallest index
        smallest_ = smallest;

        Data.Participation memory p = ring.participations[i];
        if (p.calculateFillAmounts()) {
            smallest_ = i;
        }

        uint j = (i + 1) % ring.size;
        Data.Participation memory nextP = ring.participations[j];

        if (p.fillAmountB < nextP.fillAmountS) {
            nextP.fillAmountS = p.fillAmountB;
        } else {
            smallest_ = j;
        }
    }
}