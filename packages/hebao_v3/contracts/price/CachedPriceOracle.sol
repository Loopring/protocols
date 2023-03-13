// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "../iface/PriceOracle.sol";
import "../lib/MathUint.sol";
import "../lib/OwnerManagable.sol";
import "../thirdparty/SafeCast.sol";

/// @title CachedPriceOracle
contract CachedPriceOracle is PriceOracle, OwnerManagable {
    using MathUint for uint;
    using SafeCast for uint;

    uint public constant EXPIRY_PERIOD = 7 days;

    PriceOracle public oracle;

    event PriceCached(address token, uint amount, uint value, uint timestamp);

    // Optimized to fit into 32 bytes (1 slot)
    struct TokenPrice {
        uint128 amount;
        uint96 value;
        uint32 timestamp;
    }

    mapping(address => TokenPrice) prices;

    constructor(PriceOracle _oracle) {
        oracle = _oracle;
    }

    function tokenValue(
        address token,
        uint amount
    ) public view override returns (uint) {
        TokenPrice memory tp = prices[token];
        if (
            tp.timestamp > 0 && block.timestamp < tp.timestamp + EXPIRY_PERIOD
        ) {
            return uint(tp.value).mul(amount) / tp.amount;
        } else {
            return 0;
        }
    }

    function updateTokenPrice(
        address token,
        uint amount
    ) external returns (uint value) {
        value = oracle.tokenValue(token, amount);
        if (value > 0) {
            _cacheTokenPrice(token, amount, value);
        }
    }

    function setTokenPrice(
        address token,
        uint amount,
        uint value
    ) external onlyManager {
        _cacheTokenPrice(token, amount, value);
    }

    function setOracle(PriceOracle _oracle) external onlyManager {
        oracle = _oracle;
    }

    function _cacheTokenPrice(address token, uint amount, uint value) internal {
        prices[token].amount = amount.toUint128();
        prices[token].value = value.toUint96();
        prices[token].timestamp = block.timestamp.toUint32();
        emit PriceCached(token, amount, value, block.timestamp);
    }
}
