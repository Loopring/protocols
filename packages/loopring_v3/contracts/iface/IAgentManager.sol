// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;


interface IAgentManager
{
    /// @dev Authorizes/Deauthorizes agents for all accounts.
    ///      An agent is allowed to authorize onchain operations for the account owner.
    ///
    ///      This function can only be called by the exchange owner.
    ///
    /// @param agent The agents to be authorized/deauthorized.
    /// @param authorized True to authorize the agent, false to deauthorize
    function authorizeGlobalAgents(
        address agent,
        bool    authorized
        )
        external
        virtual;

    /// @dev Add to /remove from whitelisted agent list for all users
    ///
    ///      This function can only be called by the exchange owner.
    ///
    /// @param agent The agents to be authorized/deauthorized.
    /// @param whitelisted True to authorize the agent, false to deauthorize
    function whitelistAgent(
        address agents,
        bool    whitelisted
        )
        external
        virtual;

    /// @dev Authorizes/Deauthorizes agents for an account.
    ///      An agent is allowed to authorize onchain operations for the account owner.
    ///      By definition the account owner is an agent for himself.
    ///
    ///      This function can only be called by an agent.
    ///
    /// @param owner The account owner.
    /// @param agent The agents to be authorized/deauthorized.
    /// @param authorized True to authorize the agent, false to deauthorize
    function authorizeAgent(
        address   owner,
        address   agent,
        bool      authorized
        )
        external
        virtual;

    /// @dev Returns whether an agent address is an agent of an account owner
    /// @param owner The account owner.
    /// @param agent The agent address
    /// @return True if the agent address is an agent for the account owner, else false
    function isAgent(address owner, address agent)
        public
        virtual
        view
        returns (bool);
}