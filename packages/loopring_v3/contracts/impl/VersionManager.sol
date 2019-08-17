/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.5.11;

import "../iface/IExchange.sol";
import "../iface/ILoopring.sol";
import "../iface/IVersionManager.sol";


/// @title An Implementation of IVersionManager.
/// @author Daniel Wang  - <daniel@loopring.org>
contract VersionManager is IVersionManager
{
    struct Status
    {
        bool registered;
        bool enabled;
    }

    // IExchange addresses => Status
    mapping (address => Status) private statusMap;

    /// === Constructor ===

    constructor(
        address _owner,
        address _protocol,
        address _implementation
        )
        public
    {
        require(_owner != address(0), "ZERO_ADDRESS");
        require(_protocol != address(0), "ZERO_PROTOCOL");

        owner = _owner;
        protocolAddress = _protocol;
        defaultImplementation = _implementation;

        registerImplementation(_implementation);
    }

    /// === Functions ===

    function version()
        external
        view
        returns (
            string  memory protocolVersion,
            string  memory defaultImplementationVersion
        )
    {
        protocolVersion = ILoopring(protocolAddress).version();
        defaultImplementationVersion = IExchange(defaultImplementation).version();
    }

    function registerImplementation(
        address implementation
        )
        public
    {
        require(implementation != address(0), "INVALID_IMPLEMENTATION");

        string memory _version = IExchange(implementation).version();
        require(bytes(_version).length >= 3, "INVALID_VESION");
        require(versionMap[_version] == address(0), "VERSION_USED");
        require(!statusMap[implementation].registered, "ALREADY_REGISTERED");

        implementations.push(implementation);
        statusMap[implementation] = Status(true, true);
        versionMap[_version] = implementation;

        emit ImplementationRegistered(implementation, _version);
    }

    function setDeaultImplementation(
        address implementation
        )
        external
        nonReentrant
    {
        require(isImplementationEnabled(implementation), "INVALID_IMPLEMENTATION");
        require(implementation != defaultImplementation, "SAME_IMPLEMENTATION");

        address oldDefault = defaultImplementation;
        defaultImplementation = implementation;

        emit DefaultChanged(
            oldDefault,
            implementation
        );
    }

    function enableImplementation(
        address implementation
        )
        external
        nonReentrant
    {
        Status storage status = statusMap[implementation];
        require(status.registered && !status.enabled, "INVALID_IMPLEMENTATION");

        status.enabled = true;
        emit ImplementationEnabled(implementation);
    }

    function disableImplementation(
        address implementation
        )
        external
        nonReentrant
    {
        require(isImplementationEnabled(implementation), "INVALID_IMPLEMENTATION");

        statusMap[implementation].enabled = false;
        emit ImplementationDisabled(implementation);
    }

    function latestImplementation()
        public
        view
        returns (address)
    {
        return implementations[implementations.length - 1];
    }

    function isImplementationRegistered(
        address implementation
        )
        public
        view
        returns (bool)
    {
        return statusMap[implementation].registered;
    }

    function isImplementationEnabled(
        address implementation
        )
        public
        view
        returns (bool)
    {
        return statusMap[implementation].enabled;
    }
}