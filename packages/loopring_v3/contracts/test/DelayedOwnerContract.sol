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
pragma solidity ^0.5.11;

import "../impl/owners/DelayedOwner.sol";
import "./DelayedTargetContract.sol";


/// @title DelayedOwnerContract
/// @author Brecht Devos - <brecht@loopring.org>
contract DelayedOwnerContract is DelayedOwner
{
    constructor(
        address delayedTargetAddress,
        bool setDefaultFunctionDelays
        )
        DelayedOwner(delayedTargetAddress, 3 days)
        public
    {
        if (setDefaultFunctionDelays) {
            DelayedTargetContract delayedTarget = DelayedTargetContract(delayedTargetAddress);
            setFunctionDelay(delayedTarget.delayedFunctionPayable.selector, 1 days);
            setFunctionDelay(delayedTarget.delayedFunctionRevert.selector, 2 days);
        }
    }

    function setFunctionDelayExternal(
        address to,
        bytes4  functionSelector,
        uint    delay
        )
        external
    {
        setFunctionDelay(to, functionSelector, delay);
    }
}
