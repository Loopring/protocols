// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../lib/Claimable.sol";


/// @title DelayedTargetContract
/// @author Brecht Devos - <brecht@loopring.org>
contract DelayedTargetContract is Claimable
{
    uint public constant MAGIC_VALUE = 0xFEDCBA987654321;
    uint public value = 7;

    function delayedFunctionPayable(
        uint _value
        )
        external
        payable
        returns (uint)
    {
        value = _value;
        return _value;
    }

    function delayedFunctionRevert(
        uint _value
        )
        external
    {
        require(false, "DELAYED_REVERT");
        value = _value;
    }

    function immediateFunctionPayable(
        uint _value
        )
        external
        payable
    {
        value = _value;
    }

    function immediateFunctionView()
        external
        pure
        returns (uint)
    {
        return MAGIC_VALUE;
    }

    function immediateFunctionRevert(
        uint _value
        )
        external
        payable
    {
        require(false, "IMMEDIATE_REVERT");
        value = _value;
    }
}
