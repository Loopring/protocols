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

import "../lib/BurnableERC20.sol";
import "../lib/SimpleProxy.sol";

import "../iface/IExchange.sol";
import "../iface/ILoopring.sol";
import "../iface/IUniversalRegistry.sol";

import "./proxies/AutoUpgradabilityProxy.sol";
import "./proxies/ManualUpgradabilityProxy.sol";

import "./ImplementationManager.sol";

/// @title An Implementation of IUniversalRegistry
/// @author Daniel Wang  - <daniel@loopring.org>
contract UniversalRegistry is IUniversalRegistry {
    struct Protocol
    {
        address protocol;
        bool    registered;
        bool    enabled;
        address manager;
        string  version;
    }

    // IExchange addresses => IProtocol addresses
    mapping (address => address) private exchangeMap;
     // ILoopring address => Protocol
    mapping (address => Protocol) private protocolMap;

    address private defaultProtocolAddress;

    /// === Functions ==
    constructor(
        address _lrcAddress
        )
        Claimable()
        public
    {
        require(_lrcAddress != address(0), "ZERO_ADDRESS");
        lrcAddress = _lrcAddress;
    }

    function registerProtocol(
        address protocol,
        address implementation
        )
        external
        onlyOwner
        returns (address manager)
    {
        require(!protocolMap[protocol].registered, "PROTOCOL_REGISTERED");

        ILoopring loopring = ILoopring(protocol);
        require(loopring.universalRegistry() == address(this), "REGISTRY_MISMATCH");
        require(loopring.owner() == owner, "OWNER_MISMATCH");
        require(loopring.lrcAddress() == lrcAddress, "LRC_ADDRESS_MISMATCH");

        IImplementationManager m = new ImplementationManager(owner, protocol, implementation);
        manager = address(m);

        string memory version = ILoopring(protocol).version();
        require(versionMap[version] == address(0), "VERSION_REGISTERED");
        require(!protocolMap[protocol].registered, "PROTOCOL_REGISTERED");

        protocols.push(protocol);
        versionMap[version] = protocol;
        protocolMap[protocol] = Protocol(protocol, true, true, manager, version);

        if (defaultProtocolAddress == address(0)) {
            defaultProtocolAddress = protocol;
        }

        emit ProtocolRegistered(protocol, manager, version);
    }

    function setDefaultProtocol(
        address protocol
        )
        external
        onlyOwner
    {
        require(protocol != defaultProtocolAddress, "SAME_PROTOCOL");
        require(protocolMap[protocol].registered, "NOT_REGISTERED");
        require(protocolMap[protocol].enabled, "PROTOCOL_DISABLED");
        address oldDefault = defaultProtocolAddress;
        defaultProtocolAddress = protocol;
        emit DefaultProtocolChanged(oldDefault, defaultProtocolAddress);
    }

    function enableProtocol(
        address protocol
        )
        external
        nonReentrant
        onlyOwner
    {
        require(protocolMap[protocol].registered, "NOT_REGISTERED");
        require(!protocolMap[protocol].enabled, "ALREADY_ENABLED");

        protocolMap[protocol].enabled = true;
        emit ProtocolEnabled(protocol);
    }

    function disableProtocol(
        address protocol
        )
        external
        nonReentrant
        onlyOwner
    {
        require(protocolMap[protocol].enabled, "ALREADY_DISABLED");

        protocolMap[protocol].enabled = false;
        emit ProtocolDisabled(protocol);
    }

    function forgeExchange(
        ForgeMode forgeMode,
        bool      onchainDataAvailability,
        address   protocol,
        address   implementation
        )
        external
        nonReentrant
        returns (
            address exchangeAddress,
            uint    exchangeId
        )
    {
        (address _protocol, address _implementation) = getProtocolAndImplementationToUse(
            protocol,
            implementation
        );

        ILoopring loopring = ILoopring(_protocol);
        uint exchangeCreationCostLRC = loopring.exchangeCreationCostLRC();

        if (exchangeCreationCostLRC > 0) {
            require(
                BurnableERC20(lrcAddress).burnFrom(msg.sender, exchangeCreationCostLRC),
                "BURN_FAILURE"
            );
        }

        exchangeAddress = forgeInternal(forgeMode, _implementation);
        assert(exchangeMap[exchangeAddress] == address(0));

        exchangeMap[exchangeAddress] = _protocol;
        exchanges.push(exchangeAddress);
        exchangeId = exchanges.length;

        loopring.initializeExchange(
            exchangeAddress,
            exchangeId,
            msg.sender,  // owner
            msg.sender,  // operator
            onchainDataAvailability
        );

        emit ExchangeForged(
            _protocol,
            _implementation,
            exchangeAddress,
            msg.sender,
            forgeMode,
            onchainDataAvailability,
            exchangeId,
            exchangeCreationCostLRC
        );
    }

    function defaultProtocol()
        external
        view
        returns (
            address protocol,
            address manager,
            address defaultImpl,
            string  memory protocolVersion,
            string  memory defaultImplVersion
        )
    {
        protocol = defaultProtocolAddress;
        Protocol storage p = protocolMap[protocol];
        manager = p.manager;

        IImplementationManager m = IImplementationManager(manager);
        defaultImpl = m.defaultImpl();
        (protocolVersion, defaultImplVersion) = m.version();
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

    function isExchangeRegistered(
        address exchange
        )
        public
        view
        returns (bool)
    {
        return exchangeMap[exchange] != address(0);
    }

    function isProtocolAndImplementationEnabled(
        address protocol,
        address implementation
        )
        public
        view
        returns (bool enabled)
    {
        if (!isProtocolEnabled(protocol)) {
            return false;
        }

        address managerAddr = protocolMap[protocol].manager;
        IImplementationManager m = IImplementationManager(managerAddr);
        return m.isEnabled(implementation);
    }

    function getExchangeProtocol(
        address exchangeAddress
        )
        external
        view
        returns (
            address protocol,
            address manager
        )
    {
        require(exchangeAddress != address(0), "ZERO_ADDRESS");
        protocol = exchangeMap[exchangeAddress];
        require(protocol != address(0), "INVALID_EXCHANGE");
        manager = protocolMap[protocol].manager;
    }

    /// === Private Functions ===

    function getProtocolAndImplementationToUse(
        address protocol,
        address implementation
        )
        private
        view
        returns (
            address protocolToUse,
            address implementationToUse
        )
    {
        protocolToUse = protocol;
        if (protocolToUse == address(0)) {
            protocolToUse = defaultProtocolAddress;
        } else {
            require(isProtocolEnabled(protocolToUse), "INVALID_PROTOCOL");
        }

        implementationToUse = implementation;
        IImplementationManager m = IImplementationManager(protocolMap[protocolToUse].manager);
        if (implementationToUse == address(0)) {
            implementationToUse = m.defaultImpl();
        } else {
            require(m.isEnabled(implementationToUse), "INVALID_IMPLEMENTATION");
        }
    }

    function forgeInternal(
        ForgeMode forgeMode,
        address   implementation
        )
        private
        returns (address)
    {
        if (forgeMode == ForgeMode.AUTO_UPGRADABLE) {
            return address(new AutoUpgradabilityProxy(address(this)));
        } else if (forgeMode == ForgeMode.MANUAL_UPGRADABLE) {
            return address(new ManualUpgradabilityProxy(address(this), implementation));
        } else if (forgeMode == ForgeMode.PROXIED) {
            return address(new SimpleProxy(implementation));
        } else if (forgeMode == ForgeMode.NATIVE) {
            return IExchange(implementation).clone();
        } else {
            revert("INVALID_FORGE_MODE");
        }
    }
}
