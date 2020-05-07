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


/// @title DelayedTargetContract
/// @author Brecht Devos - <brecht@loopring.org>
contract DelayedTargetContract
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
