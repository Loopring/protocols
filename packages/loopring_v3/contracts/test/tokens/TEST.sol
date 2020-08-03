// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../DummyToken.sol";
import "../../core/iface/IExchangeV3.sol";

/// @author Brecht Devos - <brecht@loopring.org>
contract TEST is DummyToken {
    using SafeMath for uint;

    // Test cases
    uint8 public constant TEST_NOTHING = 0;
    uint8 public constant TEST_REENTRANCY = 1;
    uint8 public constant TEST_REQUIRE_FAIL = 2;
    uint8 public constant TEST_RETURN_FALSE = 3;
    uint8 public constant TEST_NO_RETURN_VALUE = 4;
    uint8 public constant TEST_INVALID_RETURN_SIZE = 5;
    uint8 public constant TEST_EXPENSIVE_TRANSFER = 6;
    uint8 public constant TEST_DIFFERENT_TRANSFER_AMOUNT = 7;

    uint public testCase = TEST_NOTHING;

    address public exchangeAddress = address(0);

    bytes public reentrancyCalldata;

    uint[16] private dummyStorageVariables;

    constructor() DummyToken(
        "TEST_TEST",
        "TEST",
        18,
        2 ** 128
    )
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
        if (testCase == TEST_DIFFERENT_TRANSFER_AMOUNT) {
            _value = _value.mul(99) / 100;
        }
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
        if (testCase == TEST_DIFFERENT_TRANSFER_AMOUNT) {
            _value = _value.mul(99) / 100;
        }
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
