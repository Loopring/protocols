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
       string  version;
    }

    mapping (address => Protocol) private protocols;
    mapping (address => address) public exchangeToProtocol;

    address[] public exchanges;

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
        string  calldata version
        )
        external
        nonReentrant
        onlyOwner
        returns (address implementation)
    {
        require(protocol != address(0), "ZERO_ADDRESS");
        require(bytes(version).length > 0, "INVALID_VERSION");
        require(protocols[protocol].implementation == address(0), "PROTOCOL_REGISTERED_ALREADY");

        ILoopring loopring = ILoopring(protocol);
        require(loopring.owner() == owner, "INCONSISTENT_OWNER");
        require(loopring.protocolRegistry() == address(this), "INCONSISTENT_REGISTRY");
        require(loopring.lrcAddress() == lrcAddress, "INCONSISTENT_LRC_ADDRESS");

        // Leave this implementation uninitialized.
        implementation = loopring.createExchange();
        protocols[protocol] = Protocol(implementation, version);

        emit ProtocolRegistered(protocol, implementation, version);
    }

    function upgradeProtocol(
        address protocol,
        address newImplementation
        )
        external
        nonReentrant
        onlyOwner
        returns (address oldImplementation)
    {
        require(protocol != address(0), "ZERO_ADDRESS");
        require(newImplementation != address(0), "ZERO_ADDRESS");

        oldImplementation = protocols[protocol].implementation;

        require(oldImplementation != address(0), "PROTOCOL_NOT_REGISTERED");
        require(newImplementation != oldImplementation, "SAME_IMPLEMENTATION");

        protocols[protocol].implementation = newImplementation;
        emit ProtocolUpgraded(protocol, newImplementation, oldImplementation);
    }

    function setDefaultProtocol(
        address protocol
        )
        external
        nonReentrant
        onlyOwner
    {
        require(protocol != address(0), "ZERO_ADDRESS");
        require(protocols[protocol].implementation != address(0), "PROTOCOL_NOT_REGISTERED");

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
            string  memory version
        )
    {
        if (defaultProtocol != address(0)) {
            protocol = defaultProtocol;
            Protocol storage p = protocols[protocol];
            implementation = p.implementation;
            version = p.version;
        }
    }

    function getProtocol(
        address protocol
        )
        external
        view
        returns (
            address implementation,
            string  memory version
        )
    {
        require(protocol != address(0), "ZERO_ADDRESS");
        require(protocols[protocol].implementation != address(0), "PROTOCOL_NOT_REGISTERED");
        Protocol storage p = protocols[protocol];
        implementation = p.implementation;
        version = p.version;
    }

    function getExchangeProtocol(
        address exchangeAddress
        )
        external
        view
        returns (
            address protocol,
            address implementation,
            string  memory version
        )
    {
        protocol = exchangeToProtocol[exchangeAddress];
        require(protocol != address(0), "EXCHANGE_NOT_REGISTERED");

        Protocol storage p = protocols[protocol];
        implementation = p.implementation;
        version = p.version;
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
        returns (
            address exchangeAddress,
            uint    exchangeId
        )
    {
        require(protocols[protocol].implementation != address(0), "PROTOCOL_NOT_REGISTERED");

        exchanges.push(exchangeAddress);
        exchangeId = exchanges.length;

        ILoopring loopring = ILoopring(protocol);
        uint exchangeCreationCostLRC = loopring.exchangeCreationCostLRC();

        if (exchangeCreationCostLRC > 0) {
            require(
                BurnableERC20(lrcAddress).burnFrom(msg.sender, exchangeCreationCostLRC),
                "BURN_FAILURE"
            );
        }

        if (supportUpgradability) {
            // Deploy an exchange proxy
            exchangeAddress = address(new ExchangeProxy(address(this)));

        } else {
            // Deploy a native exchange
            exchangeAddress = loopring.createExchange();
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
            exchangeId,
            exchangeCreationCostLRC
        );
    }
}