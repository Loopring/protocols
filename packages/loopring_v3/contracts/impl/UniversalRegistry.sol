// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;

import "../lib/SimpleProxy.sol";
import "../lib/ERC20SafeTransfer.sol";

import "../iface/IExchange.sol";
import "../iface/ILoopring.sol";
import "../iface/ILoopringV3.sol";
import "../iface/IUniversalRegistry.sol";

import "./proxies/AutoUpgradabilityProxy.sol";
import "./proxies/ManualUpgradabilityProxy.sol";

import "./ImplementationManager.sol";

/// @title An Implementation of IUniversalRegistry
/// @author Daniel Wang  - <daniel@loopring.org>
contract UniversalRegistry is IUniversalRegistry {

    using ERC20SafeTransfer for address;

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
        override
        nonReentrant
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

        string memory version = loopring.version();
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
        override
        nonReentrant
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
        override
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
        override
        nonReentrant
        onlyOwner
    {
        require(protocolMap[protocol].enabled, "ALREADY_DISABLED");

        protocolMap[protocol].enabled = false;
        emit ProtocolDisabled(protocol);
    }

    function forgeExchange(
        ForgeMode forgeMode,
        bool      rollupMode,
        address   protocol,
        address   implementation
        )
        external
        override
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

        ILoopringV3 loopring = ILoopringV3(_protocol);
        uint exchangeCreationCostLRC = loopring.exchangeCreationCostLRC();

        if (exchangeCreationCostLRC > 0) {
            lrcAddress.safeTransferFromAndVerify(
                msg.sender,
                loopring.protocolFeeVault(),
                exchangeCreationCostLRC
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
            rollupMode
        );

        emit ExchangeForged(
            _protocol,
            _implementation,
            exchangeAddress,
            msg.sender,
            forgeMode,
            rollupMode,
            exchangeId,
            exchangeCreationCostLRC
        );
    }

    function defaultProtocol()
        public
        override
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
        override
        view
        returns (bool)
    {
        return protocolMap[protocol].registered;
    }

    function isProtocolEnabled(
        address protocol
        )
        public
        override
        view
        returns (bool)
    {
        return protocolMap[protocol].enabled;
    }

    function isExchangeRegistered(
        address exchange
        )
        public
        override
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
        override
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
        public
        override
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
