// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../iface/IAgentRegistry.sol";

import "../lib/AddressSet.sol";
import "../lib/Claimable.sol";


contract AgentRegistry is IAgentRegistry, AddressSet, Claimable
{
    function isAgent(address owner, address agent)
        external
        override
        view
        returns (bool)
    {
        return false;
    }
}