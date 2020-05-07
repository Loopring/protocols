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

import "../DummyToken.sol";
import "../../iface/IExchangeV3.sol";

/// @author Brecht Devos - <brecht@loopring.org>
contract TEST is DummyToken {

    // Test cases
    uint8 public constant TEST_NOTHING = 0;
    uint8 public constant TEST_REENTRANCY = 1;
    uint8 public constant TEST_REQUIRE_FAIL = 2;
    uint8 public constant TEST_RETURN_FALSE = 3;
    uint8 public constant TEST_NO_RETURN_VALUE = 4;
    uint8 public constant TEST_INVALID_RETURN_SIZE = 5;
    uint8 public constant TEST_EXPENSIVE_TRANSFER = 6;

    uint public testCase = TEST_NOTHING;

    address public exchangeAddress = address(0);

    bytes public reentrancyCalldata;

    uint[16] private dummyStorageVariables;

    constructor() DummyToken(
        "TEST_TEST",
        "TEST",
        18,
        2 ** 128
    ) public
    {
    }

    function transfer(
        address _to,
        uint _value
        )
        public
        override
        returns (bool)
    {
        // require(_to != address(0), "ZERO_ADDRESS");
        require(_value <= balances[msg.sender], "INVALID_VALUE");
        // SafeMath.sub will throw if there is not enough balance.
        balances[msg.sender] = balances[msg.sender].sub(_value);
        balances[_to] = balances[_to].add(_value);
        emit Transfer(msg.sender, _to, _value);
        return doTestCase();
    }

    function transferFrom(
        address _from,
        address _to,
        uint _value
        )
        public
        override
        returns (bool)
    {
        // require(_to != address(0), "ZERO_ADDRESS");
        require(_value <= balances[_from], "INVALID_VALUE");
        require(_value <= allowed[_from][msg.sender], "INVALID_VALUE");
        balances[_from] = balances[_from].sub(_value);
        balances[_to] = balances[_to].add(_value);
        allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
        emit Transfer(_from, _to, _value);
        return doTestCase();
    }

    function doTestCase()
        internal
        returns (bool)
    {
        if (testCase == TEST_NOTHING) {
            return true;
        } else if (testCase == TEST_REENTRANCY) {
            // Call the exchange function without ever throwing
            (bool success, ) = exchangeAddress.call(reentrancyCalldata);
            success; // to disable unused local variable warning

            // Copy the 100 bytes containing the revert message
            bytes memory returnData = new bytes(100);
            assembly {
                if eq(returndatasize(), 100) {
                    returndatacopy(add(returnData, 32), 0, 100)
                }
            }

            // Revert reason should match REENTRANCY
            bytes memory reentryMessageData = abi.encodeWithSelector(
                bytes4(keccak256("Error(string)")),
                "REENTRANCY"
            );

            // Throw here when the results are as expected. This way we know the test was correctly executed.
            require(keccak256(reentryMessageData) != keccak256(returnData), "REVERT_MESSAGE_OK");
            return true;
        } else if (testCase == TEST_REQUIRE_FAIL) {
            require(false, "REQUIRE_FAILED");
            return true;
        } else if (testCase == TEST_RETURN_FALSE) {
            return false;
        } else if (testCase == TEST_NO_RETURN_VALUE) {
            assembly {
                return(0, 0)
            }
        } else if (testCase == TEST_INVALID_RETURN_SIZE) {
            assembly {
                return(0, 64)
            }
        } else if (testCase == TEST_EXPENSIVE_TRANSFER) {
            // Some expensive operation
            for (uint i = 0; i < 16; i++) {
                dummyStorageVariables[i] = block.number;
            }
        }
        return true;
    }

    function setTestCase(
        uint8 _testCase
        )
        external
    {
        testCase = _testCase;
    }

    function setExchangeAddress(
        address _exchangeAddress
        )
        external
    {
        exchangeAddress = _exchangeAddress;
    }

    function setCalldata(
        bytes calldata _reentrancyCalldata
        )
        external
    {
        reentrancyCalldata = _reentrancyCalldata;
    }
}
