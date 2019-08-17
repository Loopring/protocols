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

import "../iface/ILoopring.sol";
import "../iface/IGlobalRegistry.sol";

import "./VersionManager.sol";

/// @title Implementation of IGlobalRegistry
/// @author Daniel Wang  - <daniel@loopring.org>
contract GlobalRegistry is IGlobalRegistry {

    // --- Data for managing exchanges ---

    mapping (address => bool) private exchangeMap;

    // -- Data for managing protocols ---

    struct Protocol
    {
        address protocol;
        address versionManager;
        string  version;
        bool    registered;
        bool    enabled;
    }

    address   private defaultProtocolAddress;
    address[] public  protocols;

    // IProtocol.version => IProtocol address
    mapping   (string => address) public versionMap;
    // ILoopring address => Protocol
    mapping   (address => Protocol) private protocolMap;

    // --- Constructor ---
    constructor() public Ownable() {}

    // --- Public Functions for Exchange Registry ---

    function isExchangeRegistered(
        address exchange
        )
        public
        view
        returns (bool)
    {
        return exchangeMap[exchange];
    }

    // --- Public Functions for Version Manager Registry ---

    function defaultProtocol()
        external
        view
        returns (
            address protocol,
            address versionmanager,
            address defaultImplementation,
            string  memory protocolVersion,
            string  memory defaultImplementationVersion
        )
    {
        // TODO
    }

    function registerProtocol(
        address protocol,
        address implementation
        )
        external
        onlyOwner
        returns (address versionManager)
    {
        require(!protocolMap[protocol].registered, "MANAGER_REGISTERED");

        IVersionManager manager = new VersionManager(owner, protocol, implementation);
        versionManager = address(manager);

        string memory version = ILoopring(protocol).version();
        require(versionMap[version] == address(0), "VERSION_REGISTERED");
        require(!protocolMap[protocol].registered, "PROTOCOL_REGISTERED");

        protocols.push(protocol);
        versionMap[version] = protocol;
        protocolMap[protocol] = Protocol(protocol, versionManager, version, true, true);

        if (defaultProtocolAddress == address(0)) {
            defaultProtocolAddress = protocol;
        }

        emit ProtocolRegistered(protocol, versionManager, version);
    }

    function isProtocolRegistered(
        address protocol
        )
        public
        view
        returns (bool)
    {
        return protocolMap[protocol].registered;
    }

    function isProtocolEnabled(
        address protocol
        )
        public
        view
        returns (bool)
    {
        return protocolMap[protocol].enabled;
    }

    // --- Private Functions ---

    function registerExchange(
        address exchange
        )
        private
    {
        require(exchange != address(0), "ZERO_ADDRESS");
        require(!exchangeMap[exchange], "EXCHANGE_REGISTERED");

        exchanges.push(exchange);
        exchangeMap[exchange] = true;

        emit ExchangeRegistered(exchange);
    }
}

