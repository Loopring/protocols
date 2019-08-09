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
       address instance;
       string  version;
    }

    mapping (address => Protocol) private protocols;
    mapping (address => address) public exchangeToProtocolMap;
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
    {
        require(protocol != address(0), "ZERO_ADDRESS");
        require(bytes(version).length > 0, "INVALID_VERSION_LABEL");

        ILoopring loopring = ILoopring(protocol);
        require(loopring.owner() == owner, "INCONSISTENT_OWNER");
        require(loopring.protocolRegistry() == address(this), "INCONSISTENT_REGISTRY");
        require(loopring.lrcAddress() == lrcAddress, "INCONSISTENT_LRC_ADDRESS");

        // Leave this instance uninitialized.
        protocols[protocol] = Protocol(loopring.createExchange(), version);
    }

    function getProtocol(
        address protocol
        )
        public
        view
        returns (
            address instance,
            string  memory version
        )
    {
        require(protocol != address(0), "INVALID_PROTOCOL");
        Protocol storage p = protocols[protocol];
        instance = p.instance;
        version = p.version;
        require(instance != address(0), "INVALID_INSTANCE");
    }

    function getProtocol()
        external
        view
        returns (
            address protocol,
            address instance,
            string  memory version
        )
    {
        protocol = exchangeToProtocolMap[msg.sender];
        Protocol storage p = protocols[protocol];
        instance = p.instance;
        version = p.version;
        require(instance != address(0), "INVALID_INSTANCE");
    }

    function setDefaultProtocol(
        address protocol
        )
        external
        nonReentrant
        onlyOwner
    {
        (address instance, ) = getProtocol(protocol);
        require(instance != address(0), "INVALID_PROTOCOL");
        defaultProtocol = protocol;
    }

    function getDefaultProtocol()
        external
        view
        returns (
            address protocol,
            address instance,
            string  memory version
        )
    {
        require(defaultProtocol != address(0), "NO_DEFAULT");
        protocol = defaultProtocol;
        (instance, version) = getProtocol(protocol);
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
        getProtocol(protocol); // verifies protocol is valid

        exchangeId = exchanges.length + 1;
        exchanges.push(exchangeAddress);

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

        assert(exchangeToProtocolMap[exchangeAddress] == address(0));
        exchangeToProtocolMap[exchangeAddress] = protocol;

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