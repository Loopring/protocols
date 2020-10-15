// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../aux/access/DelayedOwner.sol";
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
    {
        if (setDefaultFunctionDelays) {
            DelayedTargetContract delayedTarget = DelayedTargetContract(delayedTargetAddress);
            setFunctionDelay(delayedTarget.delayedFunctionPayable.selector, 1 days);
            setFunctionDelay(delayedTarget.delayedFunctionRevert.selector, 2 days);
            setFunctionDelay(delayedTarget.transferOwnership.selector, 3 days);
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
