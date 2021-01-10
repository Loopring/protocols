// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

interface IAgent{}

abstract contract IAgentRegistry
{
    /// @dev Returns whether an agent address is an agent of an account owner
    /// @param owner The account owner.
    /// @param agent The agent address
    /// @return True if the agent address is an agent for the account owner, else false
    function isAgent(
        address owner,
        address agent
        )
        external
        virtual
        view
        returns (bool);

    /// @dev Returns whether an agent address is an agent of all account owners
    /// @param owners The account owners.
    /// @param agent The agent address
    /// @return True if the agent address is an agent for the account owner, else false
    function isAgent(
        address[] calldata owners,
        address            agent
        )
        external
        virtual
        view
        returns (bool);

    /// @dev Returns whether an agent address is a universal agent.
    /// @param agent The agent address
    /// @return True if the agent address is a universal agent, else false
    function isUniversalAgent(address agent)
        public
        virtual
        view
        returns (bool);
}
