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

import "../lib/ERC20.sol";

import "../iface/PriceOracle.sol";


contract KyberNetworkProxy {
    function getExpectedRate(
        ERC20 src,
        ERC20 dest,
        uint srcQty
        )
        public
        view
        returns (
            uint expectedRate,
            uint slippageRate
        );
}

/// @title KyberNetworkPriceOracle
/// @dev Return the value in Ether for any given ERC20 token.
contract KyberNetworkPriceOracle is PriceOracle
{
    KyberNetworkProxy kyber;
    address constant private ethTokenInKyber = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    constructor(KyberNetworkProxy _kyber)
        public
    {
        kyber = _kyber;
    }

    function tokenPrice(address token, uint amount)
        public
        view
        returns (uint value)
    {
        if (amount == 0) return 0;
        if (token == address(0) || token == ethTokenInKyber) {
            return amount;
        }
        (value,) = kyber.getExpectedRate(
            ERC20(token),
            ERC20(ethTokenInKyber),
            amount
        );
    }
}
