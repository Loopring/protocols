// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../../core/iface/IBlockVerifier.sol";
import "./DelayedOwner.sol";


/// @title  BlockVerifierOwner
/// @author Brecht Devos - <brecht@loopring.org>
contract BlockVerifierOwner is DelayedOwner
{
    constructor(
        IBlockVerifier blockVerifier
        )
        DelayedOwner(address(blockVerifier), 3 days)
    {
        setFunctionDelay(blockVerifier.transferOwnership.selector, 7 days);
        setFunctionDelay(blockVerifier.registerCircuit.selector, 7 days);
        setFunctionDelay(blockVerifier.disableCircuit.selector, 1 days);
    }
}
