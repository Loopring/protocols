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
pragma solidity 0.4.21;


/// @title Utility Functions for address
/// @author Kongliang Zhong - <kongliang@loopring.org>
library StringUtil {
    function stringToBytes12(string str)
        internal
        pure
        returns (bytes12 result)
    {
        assembly {
            result := mload(add(str, 32))
        }
    }

    function stringToBytes10(string str)
        internal
        pure
        returns (bytes10 result)
    {
        assembly {
            result := mload(add(str, 32))
        }
    }

    /// check length >= min && <= max
    function checkStringLength(string name, uint min, uint max)
        internal
        pure
        returns (bool)
    {
        bytes memory temp = bytes(name);
        return temp.length >= min && temp.length <= max;
    }

}
