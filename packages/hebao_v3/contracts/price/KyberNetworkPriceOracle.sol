// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "../iface/PriceOracle.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract KyberNetworkProxy {
    function getExpectedRate(
        IERC20 src,
        IERC20 dest,
        uint srcQty
    ) public view virtual returns (uint expectedRate, uint slippageRate);
}

/// @title KyberNetworkPriceOracle
/// @dev Returns the value in Ether for any given ERC20 token.
contract KyberNetworkPriceOracle is PriceOracle {
    KyberNetworkProxy public immutable kyber;
    address public constant ETH_ADDR =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    constructor(KyberNetworkProxy _kyber) {
        kyber = _kyber;
    }

    function tokenValue(
        address token,
        uint amount
    ) public view override returns (uint value) {
        if (amount == 0) return 0;
        if (token == address(0) || token == ETH_ADDR) {
            return amount;
        }
        (uint expectedRate, ) = kyber.getExpectedRate(
            IERC20(token),
            IERC20(ETH_ADDR),
            amount
        );
        value = expectedRate * amount;
    }
}
