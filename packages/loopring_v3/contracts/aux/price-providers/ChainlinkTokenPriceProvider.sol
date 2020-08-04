// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../../lib/MathUint.sol";
import "../../thirdparty/chainlink/AggregatorInterface.sol";
import "./ITokenPriceProvider.sol";


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
