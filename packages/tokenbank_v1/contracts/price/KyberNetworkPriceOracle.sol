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

import "../iface/PriceOracle.sol";
import "../lib/ERC20.sol";
import "../lib/Ownable.sol";

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
contract KyberNetworkPriceOracle is PriceOracle, Ownable
{
    KyberNetworkProxy kyber;
    address constant ethTokenInKyber = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function setKyberSource(address kyberContractAddr)
        public
        onlyOwner
    {
        require(kyberContractAddr != address(0), "ZERO_ADDRESS");
        kyber = KyberNetworkProxy(kyberContractAddr);
    }

    function tokenPrice(address token, uint amount)
        public
        view
        returns (uint value)
    {
        uint expectedRate;

        require(address(kyber) != address(0), "KyberNetworkProxy is None");
        (expectedRate,) = kyber.getExpectedRate(ERC20(token), ERC20(ethTokenInKyber), amount);
        return expectedRate;
    }
}
