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
import "../iface/IImplementationManager.sol";
import "../iface/IProtocolManager.sol";


/// @title An Implementation of IProtocolManager.
/// @author Daniel Wang  - <daniel@loopring.org>
contract ProtocolManager is IProtocolManager
{
    event ImplementationManagerRegistered (
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

    address   public defaultImplementationManager;
    address[] public versionManagers;

    // IProtocol.version => IProtocol address
    mapping   (string => address) public versionLabelMap;

    // IImplementationManager address => MajorVersion
    mapping   (address => MajorVersion) private versionMap;

    // ILoopring address => IImplementationManager address
    mapping   (address => address) private protocolMap;

    constructor () public Ownable() {}

    function defaultProtocolVersion()
        external
        view
        returns (string memory)
    {
        if (defaultImplementationManager != address(0)) {
            return IImplementationManager(defaultImplementationManager).protocolVersion();
        }
    }

    function registerImplementationManager(
        address versionManager
        )
        external
        onlyOwner
    {
        require(versionManager != address(0), "ZERO_ADDRESS");
        IImplementationManager manager = IImplementationManager(versionManager);

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

        if (defaultImplementationManager == address(0)) {
            defaultImplementationManager = versionManager;
        }

        emit ImplementationManagerRegistered(versionManager, protocol, version);
    }

    function isImplementationManagerRegistered(
        address versionManager
        )
        public
        view
        returns (bool)
    {
        return versionMap[versionManager].registered;
    }

    function isImplementationManagerEnabled(
        address versionManager
        )
        public
        view
        returns (bool)
    {
        return versionMap[versionManager].enabled;
    }
}