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
    mapping (address => bool) private exchangeRegistrationMap;


    address   public defaultVersionManager;
    address[] public versionManagers;

    // IProtocol.version => IProtocol address
    mapping   (string => address) public versionLabelMap;

    // IVersionManager address => MajorVersion
    mapping   (address => MajorVersion) private versionMap;

    // ILoopring address => IVersionManager address
    mapping   (address => address) private protocolMap;


    constructor() public Ownable() {}

    function registerExchange(
        address exchange
        )
        public
    {
        require(exchange != address(0), "ZERO_ADDRESS");
        require(!exchangeRegistrationMap[exchange], "ALREADY_REGISTERED");

        exchanges.push(exchange);
        exchangeRegistrationMap[exchange] = true;

        emit ExchangeRegistered(exchange);
    }

    function isExchangeRegistered(
        address exchange
        )
        public
        view
        returns (bool)
    {
        return exchangeRegistrationMap[exchange];
    }


     event VersionManagerRegistered (
        address versionManager,
        address protocol,
        string version
    );

    struct MajorVersion
    {
        address protocol;
        string  version;
        bool    registered;
        bool    enabled;
    }



    function defaultProtocolVersion()
        external
        view
        returns (string memory)
    {
        if (defaultVersionManager != address(0)) {
            return IVersionManager(defaultVersionManager).protocolVersion();
        }
    }

    function registerVersionManager(
        address versionManager
        )
        external
        onlyOwner
    {
        require(versionManager != address(0), "ZERO_ADDRESS");
        IVersionManager manager = IVersionManager(versionManager);

        address _owner = manager.owner();
        require(_owner == owner, "INVALID_OWNER");

        string memory version = manager.protocolVersion();
        address protocol = manager.protocol();

        require(versionLabelMap[version] == address(0), "VERSION_REGISTERED");
        require(!versionMap[versionManager].registered, "MANAGER_REGISTERED");
        require(protocolMap[protocol] == address(0), "PROTOCOL_REGISTERED");

        versionLabelMap[version] = protocol;
        versionMap[versionManager] = MajorVersion(protocol, version, true, true);
        protocolMap[protocol] = versionManager;
        versionManagers.push(versionManager);

        if (defaultVersionManager == address(0)) {
            defaultVersionManager = versionManager;
        }

        emit VersionManagerRegistered(versionManager, protocol, version);
    }

    function isVersionManagerRegistered(
        address versionManager
        )
        public
        view
        returns (bool)
    {
        return versionMap[versionManager].registered;
    }

    function isVersionManagerEnabled(
        address versionManager
        )
        public
        view
        returns (bool)
    {
        return versionMap[versionManager].enabled;
    }
}

