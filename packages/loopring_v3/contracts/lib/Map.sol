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


/// @title Map
/// @author Daniel Wang - <daniel@loopring.org>
library Map
{
    struct Data
    {
        bytes[] keys;
        mapping (bytes => uint) positions;
        mapping (bytes => bytes) values;
    }

    function set(
        Data storage map,
        bytes memory key,
        bytes memory value
        )
        internal
    {
        map.values[key] = value;
        if(map.positions[key] == 0) {
            map.keys.push(key);
            map.positions[key] = map.keys.length;
        }
    }

    function remove(
        Data storage map,
        bytes memory key
        )
        internal
    {
        uint pos = map.positions[key];
        require(pos != 0, "NOT_FOUND");

        bytes memory lastKey = map.keys[map.keys.length - 1];
        if (keccak256(lastKey) != keccak256(key)) {
            map.keys[pos - 1] = lastKey;
            map.positions[lastKey] = pos;
        }
        map.keys.length -= 1;
        delete map.positions[key];
    }

    function get(
        Data storage map,
        bytes memory key
        )
        internal
        view
        returns (bytes memory)
    {
        require(contains(map, key), "NOT_FOUND");
        return map.values[key];
    }

    function contains(
        Data storage map,
        bytes memory key
        )
        internal
        view
        returns (bool)
    {
        return map.positions[key] != 0;
    }

    function clear(
        Data storage map
        )
        internal
    {
        for (uint i = 0; i < map.keys.length; i++) {
            delete map.positions[map.keys[i]];
            delete map.values[map.keys[i]];
        }
        map.keys.length = 0;
    }

    function size(
        Data storage map
        )
        internal
        view
        returns (uint)
    {
        return map.keys.length;
    }

    function getKeys(
        Data storage map
        )
        internal
        view
        returns (bytes[] memory)
    {
        return map.keys;
    }

    function getValues(
        Data storage map
        )
        internal
        view
        returns (bytes[] memory)
    {
        bytes[] memory _values = new bytes[](map.keys.length);
        for (uint i = 0; i < map.keys.length; i++) {
            _values[i] = map.values[map.keys[i]];
        }
        return _values;
    }
}