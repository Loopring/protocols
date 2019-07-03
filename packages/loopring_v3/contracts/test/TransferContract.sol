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
pragma solidity 0.5.7;

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
        uint256 value,
        uint    gasLimit
        )
        external
    {
        require(
            token.safeTransferWithGasLimit(to, value, gasLimit),
            "TRANSFER_FAILURE"
        );
    }

    function safeTransferFromWithGasLimit(
        address token,
        address from,
        address to,
        uint256 value,
        uint    gasLimit
        )
        external
    {
        require(
            token.safeTransferFromWithGasLimit(from, to, value, gasLimit),
            "TRANSFER_FAILURE"
        );
    }

    function sendETH(
        address to,
        uint    amount,
        uint    gasLimit
        )
        external
    {
        require(to.sendETH(amount, gasLimit), "TRANSFER_FAILURE");
    }

    function setTestCase(
        uint8 _testCase
        )
        external
    {
        testCase = _testCase;
    }

    function()
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
