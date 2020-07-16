// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Project Ltd (Loopring Foundation).
pragma solidity ^0.6.10;


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
