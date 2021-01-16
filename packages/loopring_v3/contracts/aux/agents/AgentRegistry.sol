// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/iface/IAgentRegistry.sol";
import "../../lib/AddressSet.sol";
import "../../lib/Claimable.sol";


contract AgentRegistry is IAgentRegistry, AddressSet, Claimable
{
    bytes32 internal constant UNIVERSAL_AGENTS = keccak256("__UNVERSAL_AGENTS__");

    event AgentRegistered(
        address indexed user,
        address indexed agent,
        bool            registered
    );

    event TrustUniversalAgents(
        address indexed user,
        bool            trust
    );

    constructor() Claimable() {}

    function isAgent(
        address user,
        address agent
        )
        external
        override
        view
        returns (bool)
    {
        return isUniversalAgent(agent) || isUserAgent(user, agent);
    }

    function isAgent(
        address[] calldata users,
        address            agent
        )
        external
        override
        view
        returns (bool)
    {
        if (isUniversalAgent(agent)) {
            return true;
        }
        for (uint i = 0; i < users.length; i++) {
            if (!isUserAgent(users[i], agent)) {
                return false;
            }
        }
        return true;
    }

    function registerUniversalAgent(
        address agent,
        bool    toRegister
        )
        external
        onlyOwner
    {
        registerInternal(UNIVERSAL_AGENTS, agent, toRegister);
        emit AgentRegistered(address(0), agent, toRegister);
    }

    function isUniversalAgent(address agent)
        public
        override
        view
        returns (bool)
    {
        return isAddressInSet(UNIVERSAL_AGENTS, agent);
    }

    function registerUserAgent(
        address agent,
        bool    toRegister
        )
        external
    {
        registerInternal(userKey(msg.sender), agent, toRegister);
        emit AgentRegistered(msg.sender, agent, toRegister);
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
        bool    toRegister
        )
        private
    {
        require(agent != address(0), "ZERO_ADDRESS");
        if (toRegister) {
            addAddressToSet(key, agent, false /* maintanList */);
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