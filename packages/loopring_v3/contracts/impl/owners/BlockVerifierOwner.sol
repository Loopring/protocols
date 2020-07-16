// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Project Ltd (Loopring Foundation).
pragma solidity ^0.6.10;

import "./DelayedOwner.sol";
import "../../iface/IBlockVerifier.sol";


/// @title  BlockVerifierOwner
/// @author Brecht Devos - <brecht@loopring.org>
contract BlockVerifierOwner is DelayedOwner
{
    constructor(
        IBlockVerifier blockVerifier
        )
        DelayedOwner(address(blockVerifier), 3 days)
        public
    {
        setFunctionDelay(blockVerifier.transferOwnership.selector, 7 days);
        setFunctionDelay(blockVerifier.registerCircuit.selector, 7 days);
        setFunctionDelay(blockVerifier.disableCircuit.selector, 1 days);
    }
}
