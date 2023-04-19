// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "../iface/PriceOracle.sol";
import "../lib/MathUint.sol";


/// @title AggregationalPriceOracle
contract AggregationalPriceOracle is PriceOracle
{
    using MathUint for uint;

    address[] public oracles;

    constructor(address[] memory _oracles)
    {
        oracles = _oracles;
    }

    function tokenValue(address token, uint amount)
        public
        view
        override
        returns (uint)
    {
        uint total;
        uint count;
        for (uint i = 0; i < oracles.length; i++) {
            uint value = PriceOracle(oracles[i]).tokenValue(token, amount);
            if (value > 0) {
                count += 1;
                total = total.add(value);
            }
        }
        return count == 0 ? 0 : total / count;
    }
}
