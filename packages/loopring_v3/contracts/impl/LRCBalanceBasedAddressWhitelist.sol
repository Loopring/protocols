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

import "../lib/Claimable.sol";
import "../lib/ERC20.sol";
import "../lib/MathUint.sol";

import "../iface/IAddressWhitelist.sol";


// See https://etherscan.io/address/0xc8fcc48d1454a83589169294470549a2e1713dec#code
contract LTIP {
    struct Record {
        uint lrcAmount;
        uint timestamp;
    }
    mapping (address => Record) public records;
}

/// @title An Implementation of IAddressWhitelist.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @dev LRCBalanceBasedAddressWhitelist will treat an address as being whitelisted
///      if and only if its LRC balance plus its outstanding balance in the
///      Long-Term-Incentive-Plan is no smaller than an adjustable threshold.
contract LRCBalanceBasedAddressWhitelist is Claimable, IAddressWhitelist
{
    using MathUint for uint;

    address public constant LTIPAddr = 0xC8Fcc48D1454a83589169294470549A2e1713DeC;
    address public constant LRCToken = 0xBBbbCA6A901c926F240b89EacB641d8Aec7AEafD;

    uint public minLRCRequired = 0;

    constructor() Claimable() public {}

    event MinLRCRequiredUpdated(uint value);

    function setMinLRCRequired(
        uint _minLRCRequired
        )
        external
        onlyOwner
    {
        minLRCRequired = _minLRCRequired;
        emit MinLRCRequiredUpdated(minLRCRequired);
    }

    function isAddressWhitelisted(
        address addr,
        bytes   memory // not used
        )
        public
        view
        returns (bool)
    {
        return hasEnoughLRC(addr);
    }

    function hasEnoughLRC(address addr)
        public
        view
        returns (bool)
    {
        if (minLRCRequired == 0) {
            return true;
        }

        uint accountBalance = ERC20(LRCToken).balanceOf(addr);
        if (accountBalance >= minLRCRequired) {
            return true;
        }

        (uint ltipBalance,) = LTIP(LTIPAddr).records(addr);

        if (accountBalance.add(ltipBalance) >= minLRCRequired) {
            return true;
        }

        return false;
    }
}
