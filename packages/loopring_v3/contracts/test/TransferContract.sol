// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../lib/AddressUtil.sol";
import "../lib/ERC20SafeTransfer.sol";


contract TransferContract {

    using AddressUtil       for address;
    using AddressUtil       for address payable;
    using ERC20SafeTransfer for address;

    uint8 public constant TEST_NOTHING = 0;
    uint8 public constant TEST_REQUIRE_FAIL = 1;
    uint8 public constant TEST_EXPENSIVE_TRANSFER = 2;

    uint public testCase = TEST_NOTHING;

    uint[16] private dummyStorageVariables;

    function safeTransferWithGasLimit(
        address token,
        address to,
        uint    value,
        uint    gasLimit
        )
        external
    {
        token.safeTransferWithGasLimitAndVerify(to, value, gasLimit);
    }

    function safeTransferFromWithGasLimit(
        address token,
        address from,
        address to,
        uint    value,
        uint    gasLimit
        )
        external
    {
        token.safeTransferFromWithGasLimitAndVerify(from, to, value, gasLimit);
    }

    function sendETH(
        address to,
        uint    amount,
        uint    gasLimit
        )
        external
    {
        to.sendETHAndVerify(amount, gasLimit);
    }

    function setTestCase(
        uint8 _testCase
        )
        external
    {
        testCase = _testCase;
    }

    receive()
        external
        payable
    {
        if (testCase == TEST_NOTHING) {
            return;
        } else if (testCase == TEST_REQUIRE_FAIL) {
            revert("ETH_FAILURE");
        } else if (testCase == TEST_EXPENSIVE_TRANSFER) {
            // Some expensive operation
            for (uint i = 0; i < 16; i++) {
                dummyStorageVariables[i] = block.number;
            }
        }
    }
}
