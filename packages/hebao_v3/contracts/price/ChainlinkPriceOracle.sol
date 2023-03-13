// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "../iface/PriceOracle.sol";
import "@chainlink/contracts/src/v0.8/interfaces/FeedRegistryInterface.sol";
import "@chainlink/contracts/src/v0.8/Denominations.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @title ChainlinkPriceOracle
contract ChainlinkPriceOracle is PriceOracle {
    FeedRegistryInterface internal registry;

    constructor(address _registry) {
        registry = FeedRegistryInterface(_registry);
    }

    function tokenValue(
        address token,
        uint amount
    ) public view override returns (uint) {
        // prettier-ignore
        (
                             /*uint80 roundID*/,
                             int price,
                             /*uint startedAt*/,
                             /*uint timeStamp*/,
                             /*uint80 answeredInRound*/
                         ) = registry.latestRoundData(token, Denominations.ETH);
        uint8 priceDecimal = registry.decimals(token, Denominations.ETH);
        uint256 missingDecimals = uint256(18) -
            (IERC20Metadata(token).decimals());
        return
            (uint(price) * (10 ** missingDecimals) * amount) /
            (10 ** priceDecimal);
    }
}
