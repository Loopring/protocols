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

import "../iface/ILoopring.sol";
import "../iface/IProtocolRegistry.sol";

import "./ExchangeProxy.sol";


/// @title An Implementation of IProtocolRegistry.
/// @dev After the deployment of this contract, an OwnedUpgradabilityProxy
///      should be placed in front of it to ensure upgradeability of
//       this registry.
/// @author Daniel Wang  - <daniel@loopring.org>
contract ProtocolRegistry is IProtocolRegistry
{
    struct Protocol
    {
       address instance;
       string  version;
    }

    mapping (address => address /* protocol */) public proxies;
    mapping (address => Protocol) private protocols;

    constructor() Claimable() public {}

    function() external payable
    {
        forgeExchange(true, true);
    }

    function registerProtocol(
        address protocol,
        string  memory version
        )
        public
        nonReentrant
    {
        require(protocol != address(0), "ZERO_ADDRESS");
        require(bytes(version).length > 0, "INVALID_VERSION_LABEL");

        ILoopring loopring = ILoopring(protocol);
        address instance = loopring.deployExchange();

        // Initialize the instance in a way that it's onwed by the protocol address itself.
        // This is to prevent the default instance from being used by any entity.
        // TODO(daniel): uncomment this
        // uint id = loopring.registerExchange(instance, false);
        // require(id == uint(1), "DEFAULT_INSTANCE_MUST_HAVE_ID_1");

        protocols[protocol] = Protocol(instance, version);
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

    function setDefaultProtocol(
        address protocol
        )
        external
        onlyOwner
        nonReentrant
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

        exchangeId = loopring.registerExchange(
            exchangeAddress,
            msg.sender,
            msg.sender,
            onchainDataAvailability
        );

        emit ExchangeForged(
            protocol,
            exchangeAddress,
            msg.sender,
            exchangeId
        );
    }
}