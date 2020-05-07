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
pragma solidity ^0.6.6;

import "../../iface/ITokenPriceProvider.sol";

import "../../thirdparty/chainlink/AggregatorInterface.sol";

import "../../lib/MathUint.sol";


/// @author Brecht Devos - <brecht@loopring.org>
contract ChainlinkTokenPriceProvider is ITokenPriceProvider
{
    using MathUint    for uint;

    AggregatorInterface public Eth2Usd;
    AggregatorInterface public Lrc2Eth;

    constructor(
        AggregatorInterface _Eth2Usd,
        AggregatorInterface _Lrc2Eth
        )
        public
    {
        Eth2Usd = _Eth2Usd;
        Lrc2Eth = _Lrc2Eth;
    }

    function usd2lrc(uint usd)
        external
        override
        view
        returns (uint)
    {
        uint EthUsd = uint(Eth2Usd.latestAnswer());
        uint LrcEth = uint(Lrc2Eth.latestAnswer());
        // https://docs.chain.link/docs/using-chainlink-reference-contracts#section-live-reference-data-contracts-ethereum-mainnet
        // EthUsd is scaled by 100000000
        // LrcEth is scaled by 10**18
        return usd.mul(100000000 * 1 ether) / LrcEth.mul(EthUsd);
    }
}
