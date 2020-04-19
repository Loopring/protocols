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
pragma experimental ABIEncoderV2;

import "../thirdparty/Cloneable.sol";

import "../lib/Claimable.sol";
import "../lib/ReentrancyGuard.sol";


/// @title IExchange
/// @author Daniel Wang  - <daniel@loopring.org>
contract IExchange is Claimable, ReentrancyGuard
{
    string constant public version = ""; // must override this

    event Cloned (address indexed clone);

    /// @dev Clones an exchange without any initialization
    /// @return cloneAddress The address of the new exchange.
    function clone()
        external
        nonReentrant
        returns (address cloneAddress)
    {
        address origin = address(this);
        cloneAddress = Cloneable.clone(origin);

        assert(cloneAddress != origin);
        assert(cloneAddress != address(0));

        emit Cloned(cloneAddress);
    }
}
