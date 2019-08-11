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
pragma solidity 0.5.10;

import "../lib/BurnableERC20.sol";

import "../iface/IExchange.sol";
import "../iface/ILoopring.sol";
import "../iface/IProtocolRegistry.sol";

import "./ExchangeProxy.sol";


/// @title An Implementation of IProtocolRegistry.
/// @author Daniel Wang  - <daniel@loopring.org>
contract ProtocolRegistry is IProtocolRegistry
{
    struct Protocol
    {
       address implementation;
       bool    enabled;
    }

    struct Version
    {
        address protocol;
        address implementation;
    }

    mapping (address => Protocol)   private protocols;
    mapping (string => Version)     private versions;
    mapping (address => address)    public  exchangeToProtocol;

    address[] public exchanges;

    modifier checkAddress(address addr)
    {
        require(addr != address(0), "ZERO_ADDRESS");
        _;
    }

    modifier protocolRegistered(address protocol)
    {
        require(protocols[protocol].implementation != address(0), "PROTOCOL_NOT_REGISTERED");
        _;
    }

    modifier protocolNotRegistered(address protocol)
    {
        require(protocols[protocol].implementation == address(0), "PROTOCOL_REGISTERED_ALREADY");
        _;
    }

    modifier protocolEnabled(address protocol)
    {
        require(protocols[protocol].enabled , "PROTOCOL_DISABLED");
        _;
    }
    modifier protocolDisabled(address protocol)
    {
        require(!protocols[protocol].enabled, "PROTOCOL_ENABLED");
        _;
    }

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
        address initialImplementation
        )
        external
        nonReentrant
        onlyOwner
        checkAddress(protocol)
        checkAddress(initialImplementation)
        protocolNotRegistered(protocol)
    {
        ILoopring loopring = ILoopring(protocol);
        require(loopring.owner() == owner, "INCONSISTENT_OWNER");
        require(loopring.protocolRegistry() == address(this), "INCONSISTENT_REGISTRY");
        require(loopring.lrcAddress() == lrcAddress, "INCONSISTENT_LRC_ADDRESS");

        IExchange exchange = IExchange(initialImplementation);
        string memory version = exchange.version();
        require(versions[version].protocol == address(0), "VERSION_USED");
        checkAndRegisterVersion(protocol, initialImplementation, version);

        // Leave this implementation uninitialized.
        protocols[protocol] = Protocol(initialImplementation, true);
        emit ProtocolRegistered(protocol, initialImplementation);
    }

    function upgradeProtocol(
        address protocol,
        address newImplementation
        )
        external
        nonReentrant
        onlyOwner
        checkAddress(newImplementation)
        protocolRegistered(protocol)
        returns (address oldImplementation)
    {
        oldImplementation = protocols[protocol].implementation;
        require(newImplementation != oldImplementation, "SAME_IMPLEMENTATION");

        IExchange exchange = IExchange(newImplementation);
        checkAndRegisterVersion(protocol, newImplementation, exchange.version());

        protocols[protocol].implementation = newImplementation;
        emit ProtocolUpgraded(protocol, newImplementation, oldImplementation);
    }

    function disableProtocol(
        address protocol
        )
        external
        nonReentrant
        onlyOwner
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
            address implementation
        )
    {
        require(defaultProtocol != address(0), "NO_DEFAULT_PROTOCOL");

        protocol = defaultProtocol;
        Protocol storage p = protocols[protocol];
        implementation = p.implementation;
    }

    function getProtocol(
        address protocol
        )
        external
        view
        returns (
            address implementation,
            bool    enabled
        )
    {
        Protocol storage p = protocols[protocol];
        require(p.implementation != address(0), "PROTOCOL_NOT_REGISTERED");
        return (p.implementation, p.enabled);
    }

    function getExchangeProtocol(
        address exchangeAddress
        )
        external
        view
        returns (
            address protocol,
            address implementation,
            bool    enabled
        )
    {
        protocol = exchangeToProtocol[exchangeAddress];
        Protocol storage p = protocols[protocol];
        require(p.implementation != address(0), "PROTOCOL_NOT_REGISTERED");
        return (protocol, p.implementation, p.enabled);
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

    // --- Internal Functions ---

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
        exchanges.push(exchangeAddress);
        exchangeId = exchanges.length;

        Protocol storage p = protocols[protocol];
        require(p.enabled, "PROTOCOL_DISABLED");

        ILoopring loopring = ILoopring(protocol);
        IExchange implementation = IExchange(p.implementation);

        uint exchangeCreationCostLRC = loopring.exchangeCreationCostLRC();

        if (exchangeCreationCostLRC > 0) {
            require(
                BurnableERC20(lrcAddress).burnFrom(msg.sender, exchangeCreationCostLRC),
                "BURN_FAILURE"
            );
        }

        if (supportUpgradability) {
            // Deploy an exchange proxy and points to the implementation
            exchangeAddress = address(new ExchangeProxy(address(this)));
        } else {
            // Clone a native exchange from the implementation.
            exchangeAddress = implementation.clone();
        }

        assert(exchangeToProtocol[exchangeAddress] == address(0));
        exchangeToProtocol[exchangeAddress] = protocol;

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

    function checkAndRegisterVersion(
        address protocol,
        address implementation,
        string  memory version
        )
        private
    {
        require(bytes(version).length > 0, "INVALID_VERSION");
        Version storage ver = versions[version];

        if (ver.protocol == address(0)) {
            ver.protocol = protocol;
            ver.implementation = implementation;
        } else {
            require(
                ver.protocol == protocol && ver.implementation == implementation,
                "VERSION_USED"
            );
        }
    }
}