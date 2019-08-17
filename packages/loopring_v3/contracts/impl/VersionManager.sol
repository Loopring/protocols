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
    struct Version
    {
        bool registered;
        bool enabled;
    }

    // implementation => Version
    mapping (address => Version) private versions;

    // --- Constructor ---

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
        protocol = _protocol;
        defaultImplementation = _implementation;

        addImplementation(_implementation);
    }

    // --- Public and External Functions ---

    function protocolVersion()
        external
        view
        returns (string memory)
    {
        return ILoopring(protocol).version();
    }

    function defaultImplementationVersion()
        external
        view
        returns (string memory)
    {
        return IExchange(defaultImplementation).version();
    }

    function addImplementation(
        address implementation
        )
        public
    {
        require(implementation != address(0), "INVALID_IMPLEMENTATION");

        IExchange exchange = IExchange(implementation);
        string memory version = exchange.version();

        require(bytes(version).length > 0, "INVALID_VERISON_LABEL");
        require(versionLabelMap[version] == address(0), "VERISON_LABEL_USED");

        Version storage state = versions[implementation];
        require(!state.registered, "INVALID_IMPLEMENTATION");

        implementations.push(implementation);
        versions[implementation] = Version(true, true);
        versionLabelMap[version] = implementation;

        emit ImplementationAdded(implementation, version);
    }

    function setDeaultImplementation(
        address implementation
        )
        external
        nonReentrant
    {
        require(isImplementationEnabled(implementation), "INVALID_IMPLEMENTATION");

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
        Version storage state = versions[implementation];
        require(state.registered && !state.enabled, "INVALID_IMPLEMENTATION");

        state.enabled = true;
        emit ImplementationEnabled(implementation);
    }

    function disableImplementation(
        address implementation
        )
        external
        nonReentrant
    {
        require(isImplementationEnabled(implementation), "INVALID_IMPLEMENTATION");

        versions[implementation].enabled = false;
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
        return versions[implementation].registered;
    }

    function isImplementationEnabled(
        address implementation
        )
        public
        view
        returns (bool)
    {
        return versions[implementation].enabled;
    }
}