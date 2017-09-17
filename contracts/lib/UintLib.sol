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
pragma solidity ^0.4.11;

/// @title UintUtil
/// @author Daniel Wang - <daniel@loopring.org>
/// @dev uint utility functions

import "zeppelin-solidity/contracts/math/SafeMath.sol";

library UintLib {
    using SafeMath  for uint;

    function tolerantSub(uint x, uint y) constant returns (uint z) {
        if (x >= y) z = x - y; 
        else z = 0;
    }

    function next(uint i, uint size) internal constant returns (uint) {
        return (i + 1) % size;
    }

    function prev(uint i, uint size) internal constant returns (uint) {
        return (i + size - 1) % size;
    }

    function caculateVariance(
        uint[] arr,
        uint avg
        )
        internal
        constant
        returns (uint) {
            
        uint len = arr.length;
        uint variance = 0;
        for (uint i = 0; i < len; i++) {
            uint _sub = 0;
            if (arr[i] > avg) {
                _sub = arr[i] - avg;
            } else {
                _sub = avg - arr[i];
            }
            variance += _sub.mul(_sub);
        }
        variance = variance.div(len);
        variance = variance.div(avg).div(avg);
        return variance;
    }
}
