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

import "../iface/IExchange.sol";
import "../iface/ILoopring.sol";
import "../iface/IProtocolRegistry.sol";

import "./ExchangeProxy.sol";
import "./ImplementationManager.sol";

/// @title An Implementation of IProtocolRegistry
/// @author Daniel Wang  - <daniel@loopring.org>
contract ProtocolRegistry is IProtocolRegistry {
    struct Protocol
    {
        address protocol;
        address implManager;
        string  version;
        bool    registered;
        bool    enabled;
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

    function isExchangeRegistered(
        address exchange
        )
        public
        view
        returns (bool)
    {
        return exchangeMap[exchange] != address(0);
    }

    function defaultProtocol()
        external
        view
        returns (
            address protocol,
            address implManager,
            address defaultImpl,
            string  memory protocolVersion,
            string  memory defaultImplVersion
        )
    {
        protocol = defaultProtocolAddress;
        Protocol storage p = protocolMap[protocol];
        implManager = p.implManager;

        IImplementationManager manager = IImplementationManager(implManager);
        defaultImpl = manager.defaultImpl();
        (protocolVersion, defaultImplVersion) = manager.version();
    }

    function registerProtocol(
        address protocol,
        address implementation
        )
        external
        onlyOwner
        returns (address implManager)
    {
        require(!protocolMap[protocol].registered, "MANAGER_REGISTERED");

        IImplementationManager manager = new ImplementationManager(owner, protocol, implementation);
        implManager = address(manager);

        string memory version = ILoopring(protocol).version();
        require(versionMap[version] == address(0), "VERSION_REGISTERED");
        require(!protocolMap[protocol].registered, "PROTOCOL_REGISTERED");

        protocols.push(protocol);
        versionMap[version] = protocol;
        protocolMap[protocol] = Protocol(protocol, implManager, version, true, true);

        if (defaultProtocolAddress == address(0)) {
            defaultProtocolAddress = protocol;
        }

        emit ProtocolRegistered(protocol, implManager, version);
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

    function enableProtocol(
        address protocol
        )
        external
        nonReentrant
        onlyOwner
    {
        require(protocolMap[protocol].registered, "NOT_REREGISTERED");
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
        bool supportUpgradability,
        bool onchainDataAvailability
        )
        external
        nonReentrant
        returns (
            address exchangeAddress,
            uint    exchangeId
        )
    {
        return forgeExchangeInternal(
            defaultProtocolAddress,
            supportUpgradability,
            onchainDataAvailability
        );
    }

    function forgeExchange(
        address protocol,
        bool    supportUpgradability,
        bool    onchainDataAvailability
        )
        external
        nonReentrant
        returns (
            address exchangeAddress,
            uint    exchangeId
        )
    {
        return forgeExchangeInternal(
            protocol,
            supportUpgradability,
            onchainDataAvailability
        );
    }

    function getExchangeProtocol(
        address exchangeAddress
        )
        external
        view
        returns (
            address protocol,
            address implManager
        )
    {
        require(exchangeAddress != address(0), "ZERO_ADDRESS");
        protocol = exchangeMap[exchangeAddress];
        require(protocol != address(0), "INVALID_EXCHANGE");

        implManager = protocolMap[protocol].implManager;
    }

    /// === Internal & Private Functions ===

    function forgeExchangeInternal(
        address protocol,
        bool    supportUpgradability,
        bool    onchainDataAvailability
        )
        private
        returns (
            address exchangeAddress,
            uint    exchangeId
        )
    {
        require(protocolMap[protocol].enabled, "INVALID_PROTOCOL");

        ILoopring loopring = ILoopring(protocol);
        uint exchangeCreationCostLRC = loopring.exchangeCreationCostLRC();

        if (exchangeCreationCostLRC > 0) {
            require(
                BurnableERC20(lrcAddress).burnFrom(msg.sender, exchangeCreationCostLRC),
                "BURN_FAILURE"
            );
        }

        Protocol storage p = protocolMap[protocol];
        IImplementationManager manager = IImplementationManager(p.implManager);
        IExchange implementation = IExchange(manager.defaultImpl());

        if (supportUpgradability) {
            // Deploy an exchange proxy and points to the implementation
            exchangeAddress = address(new ExchangeProxy(address(this)));
        } else {
            // Clone a native exchange from the implementation.
            exchangeAddress = implementation.clone();
        }

        assert(exchangeMap[exchangeAddress] == address(0));

        exchangeMap[exchangeAddress] = protocol;
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
            protocol,
            exchangeAddress,
            msg.sender,
            supportUpgradability,
            onchainDataAvailability,
            exchangeId,
            exchangeCreationCostLRC
        );
    }
}

