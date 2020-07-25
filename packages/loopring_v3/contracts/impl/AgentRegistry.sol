// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../iface/IAgentRegistry.sol";

import "../lib/AddressSet.sol";
import "../lib/Claimable.sol";


contract AgentRegistry is IAgentRegistry, AddressSet, Claimable
{
    bytes32 internal constant UNIVERSAL_AGENTS = keccak256("__UNVERSAL_AGENTS__");

    event AgentRegistered(
        address user,
        address agent,
        bool    registered
    );

    constructor() public Claimable() {}

    function isAgent(
        address user,
        address agent
        )
        external
        override
        view
        returns (bool)
    {
        return isUnversalAgent(agent) || isUserAgent(user, agent);
    }

    function registerUniversalAgent(
        address agent,
        bool toRegister
        )
        external
        onlyOwner
    {
        registerInternal(UNIVERSAL_AGENTS, agent, toRegister);
        emit AgentRegistered(address(0), agent, toRegister);
    }

    function getUniversalAgents()
        public
        view
        returns (address[] memory)
    {
        return addressesInSet(UNIVERSAL_AGENTS);
    }

    function isUnversalAgent(address agent)
        public
        view
        returns (bool)
    {
        return isAddressInSet(UNIVERSAL_AGENTS, agent);
    }

    function registerUserAgent(
        address agent,
        bool toRegister
        )
        external
    {
        registerInternal(userKey(msg.sender), agent, toRegister);
        emit AgentRegistered(msg.sender, agent, toRegister);
    }

    function getUserAgents(address user)
        public
        view
        returns (address[] memory agents)
    {
        if (user != address(0)) {
            agents = addressesInSet(userKey(user));
        }
    }

    function isUserAgent(
        address user,
        address agent
        )
        public
        view
        returns (bool)
    {
        return isAddressInSet(userKey(user), agent);
    }

    function registerInternal(
        bytes32 key,
        address agent,
        bool toRegister
        )
        private
    {
        require(agent != address(0), "ZERO_ADDRESS");
        if (toRegister) {
            addAddressToSet(key, agent, true);
        } else {
            removeAddressFromSet(key, agent);
        }
    }

    function userKey(address addr)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked("__AGENT__", addr));
    }
}