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
    struct ImplState
    {
        bool registered;
        bool enabled;
    }

    // implementation => ImplState
    mapping (address => ImplState) private implementationMap;

    // --- Constructor ---

    constructor(
        address _protocol,
        address _implementation
        )
        public
        Ownable()
    {
        require(_protocol != address(0), "ZERO_PROTOCOL");
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

    function addImplementation(
        address implementation
        )
        public
    {
        require(implementation != address(0), "INVALID_IMPLEMENTATION");

        IExchange exchange = IExchange(implementation);
        string memory version = exchange.version();

        require(bytes(version).length > 0, "INVALID_VERISON_LABEL");
        require(versionMap[version] == address(0), "VERISON_LABEL_USED");

        ImplState storage state = implementationMap[implementation];
        require(!state.registered, "INVALID_IMPLEMENTATION");

        implementations.push(implementation);
        implementationMap[implementation] = ImplState(true, true);
        versionMap[version] = implementation;

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

        emit DefaultImplementationChanged(
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
        ImplState storage state = implementationMap[implementation];
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

        implementationMap[implementation].enabled = false;
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
        return implementationMap[implementation].registered;
    }

    function isImplementationEnabled(
        address implementation
        )
        public
        view
        returns (bool)
    {
        return implementationMap[implementation].enabled;
    }
}