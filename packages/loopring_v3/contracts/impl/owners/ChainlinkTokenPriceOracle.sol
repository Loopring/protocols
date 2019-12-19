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

import "../../thirdparty/chainlink/AggregatorInterfaceV1.sol";
import "../../thirdparty/chainlink/AggregatorInterfaceV2.sol";

import "../../lib/MathUint.sol";


/// @author Brecht Devos - <brecht@loopring.org>
contract ChainlinkTokenPriceOracle
{
    using MathUint    for uint;

    AggregatorInterfaceV1 public Eth2Usd;
    AggregatorInterfaceV2 public Lrc2Eth;

    constructor(
        AggregatorInterfaceV1 _Eth2Usd,
        AggregatorInterfaceV2 _Lrc2Eth
        )
        public
    {
        Eth2Usd = _Eth2Usd;
        Lrc2Eth = _Lrc2Eth;
    }

    /// @param usd 1 wei == 1 USD
    function usd2lrc(uint usd)
        external
        view
        returns (uint)
    {
        uint EthUsd = uint(Eth2Usd.currentAnswer());
        uint LrcEth = uint(Lrc2Eth.latestAnswer());
        return usd.mul(100000000 * 1 ether * 1 ether) / LrcEth.mul(EthUsd);
    }
}
