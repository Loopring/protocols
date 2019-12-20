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
pragma solidity ^0.5.11;


/// @title Set
/// @author Daniel Wang - <daniel@loopring.org>
library Set
{
    struct Data
    {
        bytes[] values;
        mapping (bytes => uint) positions;
        uint count;
    }

    function add(
        Data storage set,
        bytes memory value,
        bool maintainList
        )
        internal
    {
        require(set.positions[value] == 0, "ALREADY_IN_SET");
        if (maintainList) {
            set.values.push(value);
            set.positions[value] = set.values.length;
        } else {
            require(set.values.length == 0, "MUST_MAINTAIN_LIST");
            set.positions[value] = 1;
            set.count += 1;
        }
    }

    function remove(
        Data storage set,
        bytes memory value
        )
        internal
    {
        uint pos = set.positions[value];
        require(pos != 0, "NOT_IN_SET");

        if (set.values.length > 0) {
            bytes memory lastValue = set.values[set.values.length - 1];
            if (keccak256(lastValue) != keccak256(value)) {
                set.values[pos - 1] = lastValue;
                set.positions[lastValue] = pos;
            }
            set.values.length -= 1;
        } else {
            set.count -= 1;
        }
        delete set.positions[value];
    }

    function contains(
        Data storage set,
        bytes memory value
        )
        internal
        view
        returns (bool)
    {
        return set.positions[value] != 0;
    }

    function size(
        Data storage set
        )
        internal
        view
        returns (uint)
    {
        return set.values.length + set.count;
    }

    function getValues(
        Data storage set
        )
        internal
        view
        returns (bytes[] memory)
    {
        return set.values;
    }
}