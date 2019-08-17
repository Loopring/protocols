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

import "../iface/IVersionManager.sol";
import "../iface/IGlobalRegistry.sol";

/// @title Implementation of IGlobalRegistry
/// @author Daniel Wang  - <daniel@loopring.org>
contract GlobalRegistry is IGlobalRegistry {

    // --- Data for managing exchanges ---

    mapping (address => bool) private exchangeMap;

    // -- Data for managing protocols ---

    struct Protocol
    {
        address protocol;
        string  version;
        bool    registered;
        bool    enabled;
    }

    address   public defaultVersionManager;
    address[] public managers;

    // IProtocol.version => IProtocol address
    mapping   (string => address) public versionMap;
    // IVersionManager address => Protocol
    mapping   (address => Protocol) private managerMap;
    // ILoopring address => IVersionManager address
    mapping   (address => address) private protocolMap;

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

    function defaultProtocolVersion()
        external
        view
        returns (string memory)
    {
        if (defaultVersionManager != address(0)) {
            return IVersionManager(defaultVersionManager).protocolVersion();
        }
    }

    function defaultProtocol()
        external
        view
        returns (address)
    {
        if (defaultVersionManager != address(0)) {
            return IVersionManager(defaultVersionManager).protocol();
        }
    }

    function registerProtocol(
        address versionManager
        )
        external
        onlyOwner
    {
        require(!managerMap[versionManager].registered, "MANAGER_REGISTERED");

        IVersionManager manager = IVersionManager(versionManager);
        address _owner = manager.owner();
        require(_owner == owner, "INVALID_OWNER");

        string memory version = manager.protocolVersion();
        require(versionMap[version] == address(0), "VERSION_REGISTERED");

        address protocol = manager.protocol();
        require(protocolMap[protocol] == address(0), "PROTOCOL_REGISTERED");

        managerMap[versionManager] = Protocol(protocol, version, true, true);
        versionMap[version] = protocol;
        protocolMap[protocol] = versionManager;
        managers.push(versionManager);

        if (defaultVersionManager == address(0)) {
            defaultVersionManager = versionManager;
        }

        emit ProtocolRegistered(protocol, version, protocol);
    }

    function isProtocolRegistered(
        address versionManager
        )
        public
        view
        returns (bool)
    {
        return managerMap[versionManager].registered;
    }

    function isVersionManagerEnabled(
        address versionManager
        )
        public
        view
        returns (bool)
    {
        return managerMap[versionManager].enabled;
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

