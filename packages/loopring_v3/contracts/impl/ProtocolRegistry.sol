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
///      can be placed in front of it to ensure upgradeability of
//       this registry.
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

    /// @dev The constructor must do NOTHING to support proxy.
    constructor() public {}

    /// @dev The default function will create an upgradabile exchange
    ///      with on-chain data-availability.
    function() external payable
    {
        forgeExchange(true, true);
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
        address instance = loopring.deployExchange();

        // Initialize the instance in a way that it's onwed by the protocol address itself.
        // This is to prevent the default instance from being used by any entity.
        // TODO(daniel): uncomment this
        // uint id = loopring.initializeExchange(instance, false);
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
        if (supportUpgradability) {
            // Deploy an exchange proxy
            exchangeAddress = address(new ExchangeProxy(address(this)));
            assert(exchangeToProtocolMap[exchangeAddress] == address(0));
            exchangeToProtocolMap[exchangeAddress] = protocol;
        } else {
            // Deploy a native exchange
            exchangeAddress = loopring.deployExchange();
        }

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
            exchangeId
        );
    }
}