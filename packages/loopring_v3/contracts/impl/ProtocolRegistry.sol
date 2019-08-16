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

import "../thirdparty/Proxy.sol";

import "../lib/BurnableERC20.sol";

import "../iface/IExchange.sol";
import "../iface/ILoopring.sol";
import "../iface/IProtocolRegistry.sol";

import "./ExchangeSimpleProxy.sol";
import "./ExchangeUpgradabilityProxy.sol";


/// @title An Implementation of IProtocolRegistry.
/// @author Daniel Wang  - <daniel@loopring.org>
contract ProtocolRegistry is IProtocolRegistry
{
    struct Protocol
    {
       address implementation;  // updatable
       bool    enabled;         // updatable
    }

    struct Implementation
    {
        address protocol; // must never change
        string  version;  // must be unique globally
    }

    mapping (address => Protocol)       private protocols;
    mapping (address => Implementation) private impls;
    mapping (string => address)         private versions;
    mapping (address => address)        private exchangeToProtocol;

    modifier addressNotZero(address addr)
    {
        require(addr != address(0), "ZERO_ADDRESS");
        _;
    }

    modifier protocolNotRegistered(address addr)
    {
        require(protocols[addr].implementation == address(0), "PROTOCOL_REGISTERED");
        _;
    }

    modifier protocolRegistered(address addr)
    {
        require(protocols[addr].implementation != address(0), "PROTOCOL_NOT_REGISTERED");
        _;
    }

    modifier protocolDisabled(address addr)
    {
        require(!protocols[addr].enabled, "PROTOCOL_ENABLED");
        _;
    }

    modifier protocolEnabled(address addr)
    {
        require(protocols[addr].enabled, "PROTOCOL_DISABLED");
        _;
    }

    modifier implNotRegistered(address addr)
    {
        require(impls[addr].protocol == address(0), "IMPL_REGISTERED");
        _;
    }

    modifier implRegistered(address addr)
    {
        require(impls[addr].protocol != address(0), "IMPL_NOT_REGISTERED");
        _;
    }

    /// === Public Functions ==
    constructor(
        address _lrcAddress
        )
        Claimable()
        public
        addressNotZero(_lrcAddress)
    {
        lrcAddress = _lrcAddress;
    }

    function registerProtocol(
        address protocol,
        address implementation
        )
        external
        nonReentrant
        onlyOwner
        addressNotZero(protocol)
        addressNotZero(implementation)
        protocolNotRegistered(protocol)
        implNotRegistered(implementation)
    {
        ILoopring loopring = ILoopring(protocol);
        require(loopring.owner() == owner, "INCONSISTENT_OWNER");
        require(loopring.protocolRegistry() == address(this), "INCONSISTENT_REGISTRY");
        require(loopring.lrcAddress() == lrcAddress, "INCONSISTENT_LRC_ADDRESS");

        string memory version = IExchange(implementation).version();
        require(versions[version] == address(0), "VERSION_USED");

        // register
        impls[implementation] = Implementation(protocol, version);
        versions[version] = implementation;

        protocols[protocol] = Protocol(implementation, true);
        emit ProtocolRegistered(protocol, implementation);
    }

    function upgradeProtocol(
        address protocol,
        address newImplementation
        )
        external
        nonReentrant
        onlyOwner
        addressNotZero(protocol)
        addressNotZero(newImplementation)
        protocolRegistered(protocol)
        returns (address oldImplementation)
    {
        require(protocols[protocol].implementation != newImplementation, "SAME_IMPLEMENTATION");

        oldImplementation = protocols[protocol].implementation;

        if (impls[newImplementation].protocol == address(0)) {
            // the new implementation is new
            string memory version = IExchange(newImplementation).version();
            require(versions[version] == address(0), "VERSION_USED");

            impls[newImplementation] = Implementation(protocol, version);
            versions[version] = newImplementation;
        } else {
            require(impls[newImplementation].protocol == protocol, "IMPLEMENTATION_BINDED");
        }

        protocols[protocol].implementation = newImplementation;
        emit ProtocolUpgraded(protocol, newImplementation, oldImplementation);
    }

    function disableProtocol(
        address protocol
        )
        external
        nonReentrant
        onlyOwner
        addressNotZero(protocol)
        protocolRegistered(protocol)
        protocolEnabled(protocol)
    {
        require(protocol != defaultProtocol, "FORBIDDEN");
        protocols[protocol].enabled = false;
        emit ProtocolDisabled(protocol);
    }

    function enableProtocol(
        address protocol
        )
        external
        nonReentrant
        onlyOwner
        addressNotZero(protocol)
        protocolRegistered(protocol)
        protocolDisabled(protocol)
    {
        protocols[protocol].enabled = true;
        emit ProtocolEnabled(protocol);
    }

    function setDefaultProtocol(
        address protocol
        )
        external
        nonReentrant
        onlyOwner
        addressNotZero(protocol)
        protocolRegistered(protocol)
        protocolEnabled(protocol)
    {
        address oldDefaultProtocol = defaultProtocol;
        defaultProtocol = protocol;
        emit DefaultProtocolChanged(protocol, oldDefaultProtocol);
    }

    function getDefaultProtocol()
        external
        view
        returns (
            address protocol,
            address implementation,
            bool    enabled
        )
    {
        require(defaultProtocol != address(0), "NO_DEFAULT_PROTOCOL");
        protocol = defaultProtocol;
        Protocol storage p = protocols[protocol];
        implementation = p.implementation;
        enabled = p.enabled;
    }

    function getProtocol(
        address protocol
        )
        external
        view
        addressNotZero(protocol)
        protocolRegistered(protocol)
        returns (
            address implementation,
            bool    enabled
        )
    {
        Protocol storage p = protocols[protocol];
        implementation = p.implementation;
        enabled = p.enabled;
    }

    function getExchangeProtocol(
        address exchangeAddress
        )
        external
        view
        addressNotZero(exchangeAddress)
        returns (
            address protocol,
            address implementation,
            bool    enabled
        )
    {
        protocol = exchangeToProtocol[exchangeAddress];
        require(protocol != address(0), "INVALID_EXCHANGE");

        Protocol storage p = protocols[protocol];
        implementation = p.implementation;
        enabled = p.enabled;
    }

    function forgeExchange(
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
            defaultProtocol,
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

    // --- Private Functions ---

    function forgeExchangeInternal(
        address protocol,
        bool    supportUpgradability,
        bool    onchainDataAvailability
        )
        private
        protocolRegistered(protocol)
        protocolEnabled(protocol)
        returns (
            address exchangeAddress,
            uint    exchangeId
        )
    {
        ILoopring loopring = ILoopring(protocol);
        uint exchangeCreationCostLRC = loopring.exchangeCreationCostLRC();

        if (exchangeCreationCostLRC > 0) {
            require(
                BurnableERC20(lrcAddress).burnFrom(msg.sender, exchangeCreationCostLRC),
                "BURN_FAILURE"
            );
        }

        if (supportUpgradability) {
            // Deploy an exchange proxy and points to the implementation
            exchangeAddress = address(new ExchangeUpgradabilityProxy(address(this)));
        } else {
            // Clone a native exchange from the implementation.
            exchangeAddress = address(new ExchangeSimpleProxy(address(this)));
        }

        assert(exchangeToProtocol[exchangeAddress] == address(0));

        exchangeToProtocol[exchangeAddress] = protocol;
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