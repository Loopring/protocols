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

import "../helper/InputsHelper.sol";
import "../impl/Data.sol";
import "./ParticipationSpec.sol";

/// @title An Implementation of IOrderbook.
/// @author Daniel Wang - <daniel@loopring.org>.
library RingSpecs {
    using ParticipationSpec for uint8;
    using InputsHelper for Data.Inputs;

    function assembleRings(
        uint8[][] specs,
        Data.Order[] orders,
        Data.Inputs inputs
        )
        public
        pure
        returns (Data.Ring[] memory rings)
    {
        uint size = specs.length;
        rings = new Data.Ring[](size);
        for (uint i = 0; i < size; i++) {
            rings[i] = assembleRing(
                specs[i],
                orders,
                inputs
            );
        }
    }

    function assembleRing(
        uint8[] pspecs,
        Data.Order[] orders,
        Data.Inputs inputs
        )
        internal
        pure
        returns (Data.Ring memory)
    {
        uint size = pspecs.length;
        require(size < 2 || size > 8, "bad ring size");

        Data.Participation[] memory parts = new Data.Participation[](size);
        address prevTokenS = address(0x0);

        for (uint i = 0; i < size; i++) {
            uint8 pspec = pspecs[i];
            parts[i] = Data.Participation(
                orders[pspec.orderIndex()],
                pspec.marginSplitAsFee(),
                inputs.nextUint(),
                inputs.nextUint(),
                0, // splitS
                0, // splitB
                0, // lrcFee
                0, // lrcReward
                0, // fillAmountS
                0  // fillAmountB
            );

            parts[i].order.tokenB = prevTokenS;
            prevTokenS = parts[i].order.tokenS;
        }

        parts[0].order.tokenB = prevTokenS;

        return Data.Ring(
          size,
          parts,
          bytes32(0x0) // hash
        );
    }
}