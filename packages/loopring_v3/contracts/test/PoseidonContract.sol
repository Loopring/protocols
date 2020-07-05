// SPDX-License-Identifier: Apache-2.0
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
pragma solidity ^0.6.10;

import "../lib/Poseidon.sol";
import "../iface/ExchangeData.sol";


contract PoseidonContract {
    function hash_t5f6p52(
        uint t0,
        uint t1,
        uint t2,
        uint t3,
        uint t4
        )
        external
        pure
        returns (uint)
    {
        Poseidon.HashInputs5 memory inputs = Poseidon.HashInputs5(t0, t1, t2, t3, t4);
        return Poseidon.hash_t5f6p52(inputs, ExchangeData.SNARK_SCALAR_FIELD());
    }

    function hash_t7f6p52(
        uint t0,
        uint t1,
        uint t2,
        uint t3,
        uint t4,
        uint t5,
        uint t6
        )
        external
        pure
        returns (uint)
    {
        Poseidon.HashInputs7 memory inputs = Poseidon.HashInputs7(t0, t1, t2, t3, t4, t5, t6);
        return Poseidon.hash_t7f6p52(inputs, ExchangeData.SNARK_SCALAR_FIELD());
    }
}
