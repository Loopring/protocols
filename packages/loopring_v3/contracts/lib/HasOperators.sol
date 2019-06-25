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

import "../lib/Claimable.sol";


/// @title NonTransferrableToken
/// @author Daniel Wang  - <daniel@loopring.org>
contract HasOperators is Claimable
{
    uint8 private constant DEFAULT_ROLE = 0;

    mapping (uint8 => address[]) public operators;
    mapping (uint8 => mapping (address => uint)) public operatorMap;

    function addOperator(address who)
        public
        onlyOwner
        returns (bool)
    {
        return addOperator(who, DEFAULT_ROLE);
    }

    function addOperator(address who, uint8 role)
        public
        onlyOwner
        returns (bool)
    {
        uint idx = operatorMap[role][who];
        if (idx != 0) return false;

        operators[role].push(who);
        operatorMap[role][who] = operators[role].length;
        return true;
    }

    function removeOperator(address who)
        public
        onlyOwner
        returns (bool)
    {
        return removeOperator(who, DEFAULT_ROLE);
    }

    function removeOperator(address who, uint8 role)
        public
        onlyOwner
        returns (bool)
    {
        uint idx = operatorMap[role][who];
        if (idx == 0) return false;
        uint size = operators[role].length;

        if (idx != size) {
          address last = operators[role][size - 1];
          operators[role][idx - 1] = last;
          operatorMap[role][last] = idx;
        }

        operatorMap[role][who] = 0;
        operators[role].length -= 1;
        return true;
    }

    function isOperator(address who)
        public
        returns (bool)
    {
        return isOperator(who, DEFAULT_ROLE);
    }

    function isOperator(address who, uint8 role)
        public
        returns (bool)
    {
        return operatorMap[role][who] != 0;
    }
}
