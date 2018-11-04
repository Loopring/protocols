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
pragma solidity 0.4.24;

import "../DummyToken.sol";
import "../../iface/IRingSubmitter.sol";

/// @author Brecht Devos - <brecht@loopring.org>
contract TEST is DummyToken {

    // Test cases
    uint8 public constant TEST_NOTHING = 0;
    uint8 public constant TEST_REENTRANCY = 1;
    uint8 public constant TEST_REQUIRE_FAIL = 2;
    uint8 public constant TEST_RETURN_FALSE = 3;
    uint8 public constant TEST_NO_RETURN_VALUE = 4;
    uint8 public constant TEST_INVALID_RETURN_SIZE = 5;

    uint public testCase = TEST_NOTHING;

    address public exchangeAddress = 0x0;
    bytes public submitRingsData;

    constructor() DummyToken(
        "TEST_TEST",
        "TEST",
        18,
        10 ** 27
    ) public
    {
    }

    function transfer(
        address _to,
        uint256 _value
        )
        public
        returns (bool)
    {
        require(_to != 0x0, "ZERO_ADDRESS");
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
        uint256 _value
        )
        public
        returns (bool)
    {
        require(_to != 0x0, "ZERO_ADDRESS");
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
            // Call submitRings without ever throwing
            bytes memory calldata = abi.encodeWithSelector(
                IRingSubmitter(exchangeAddress).submitRings.selector,
                submitRingsData
            );
            bool success = exchangeAddress.call(calldata);
            success; // to disable unused local variable warning

            // Copy the 100 bytes containing the revert message
            bytes memory returnData = new bytes(100);
            assembly {
                returndatacopy(add(returnData, 32), 0, 100)
            }

            // Revert reason should match REENTRY
            bytes memory reentryMessageData = abi.encodeWithSelector(
                bytes4(keccak256("Error(string)")),
                REENTRY
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

    function setReentrancyAttackData(
        address _exchangeAddress,
        bytes _submitRingsData
        )
        public
    {
        exchangeAddress = _exchangeAddress;
        submitRingsData = new bytes(_submitRingsData.length);
        for (uint i = 0; i < _submitRingsData.length; i++) {
            submitRingsData[i] = _submitRingsData[i];
        }
    }
}
