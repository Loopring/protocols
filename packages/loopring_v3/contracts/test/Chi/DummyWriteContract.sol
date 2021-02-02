// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../aux/gas/ChiDiscount.sol";

contract DummyWriteContract is ChiDiscount {
    mapping (address => uint) data;
    address public chiToken;

    constructor(address _chiToken) {
        chiToken = _chiToken;
    }

    function write(ChiConfig calldata config, uint offset)
        external
        discountCHI(chiToken, config)
    {
        for (uint i = 0; i < 20; i++) {
            data[address(i + offset)] = i + offset;
        }
    }
}
