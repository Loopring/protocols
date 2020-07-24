// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../lib/AddressSet.sol";
import "../lib/Claimable.sol";


interface IAgentManager is IAgentManager, AddressSet, Claimable
{
    mapping (address => bool) globalAgents;
    mapping (address => bool) whitelistedAgents;
    mapping (address => mapping (address => bool)) userAgents；

    function authorizeGlobalAgents(
        address agent,
        bool    authorized
        )
        external
        virtual;

    function whitelistAgent(
        address agents,
        bool    whitelisted
        )
        external
        virtual;

    function authorizeAgent(
        address   owner,
        address   agent,
        bool      authorized
        )
        external
        virtual;

    function isAgent(address owner, address agent)
        public
        virtual
        view
        returns (bool)
    {
        return globalAgents[agent] || userAgents[owner][agent];
    }
}