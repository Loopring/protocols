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

import "../lib/Claimable.sol";
import "../lib/ReentrancyGuard.sol";

import "../iface/ILoopring.sol";
import "../iface/IProtocolRegistry.sol";

import "./ExchangeProxy.sol";

/// @title An Implementation of IProtocolRegistry.
/// @dev After the deployment of this contract, an OwnedUpgradabilityProxy
///      should be placed in front of this contract to ensure upgradeability of
//       this registry.
/// @author Daniel Wang  - <daniel@loopring.org>
contract ProtocolRegistry is IProtocolRegistry, ReentrancyGuard, Claimable
{
    struct Protocol
    {
       address instance;
       string  version;
    }

    mapping (address => address /* protocol */) public proxies;
    mapping (address => Protocol) private protocols;
    address private defaultProtocol;

    constructor() Claimable() public {}

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

    function setDefaultProtocol(
        address protocol
        )
        external
        onlyOwner
    {
        (address instance, ) = getProtocol(protocol);
        require(instance != address(0), "INVALID_PROTOCOL");
        defaultProtocol = protocol;
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
        protocol = proxies[msg.sender];
        Protocol storage p = protocols[protocol];
        instance = p.instance;
        version = p.version;
        require(instance != address(0), "INVALID_INSTANCE");
    }

    function registerProtocol(
        address protocol,
        string  memory version
        )
        nonReentrant
        public
    {
        require(protocol != address(0), "ZERO_ADDRESS");
        require(bytes(version).length > 0, "INVALID_VERSION_LABEL");

        ILoopring loopring = ILoopring(protocol);
        address instance = loopring.deployExchange();

        protocols[protocol] = Protocol(instance, version);
    }

    function createExchange(
        bool supportUpgradability,
        bool onchainDataAvailability
        )
        external
        returns (
            address exchangeAddress,
            uint    exchangeId
        )
    {
        return createExchange(
            msg.sender,
            msg.sender,
            defaultProtocol,
            supportUpgradability,
            onchainDataAvailability
        );
    }

    function createExchange(
        address owner,
        address payable operator,
        address protocol,
        bool    supportUpgradability,
        bool    onchainDataAvailability
        )
        public
        nonReentrant
        returns (
            address exchangeAddress,
            uint    exchangeId
        )
    {
        getProtocol(protocol); // verifies the input

        ILoopring loopring = ILoopring(protocol);
        if (supportUpgradability) {
            // Deploy an exchange proxy
            exchangeAddress = address(new ExchangeProxy(address(this)));
            assert(proxies[exchangeAddress] == address(0));
            proxies[exchangeAddress] = protocol;
        } else {
            // Deploy a native exchange
            exchangeAddress = loopring.deployExchange();
        }

        exchangeId = loopring.initializeAndRegisterExchange(
            exchangeAddress,
            owner,
            operator,
            onchainDataAvailability
        );

        emit ExchangeCreated(
            protocol,
            exchangeAddress,
            msg.sender,
            exchangeId
        );
    }
}