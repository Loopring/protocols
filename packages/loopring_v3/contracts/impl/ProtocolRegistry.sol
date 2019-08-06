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

import "../iface/ILoopring.sol";
import "../iface/IProtocolRegistry.sol";

import "./ExchangeProxy.sol";

/// @title An Implementation of IProtocolRegistry.
/// @author Daniel Wang  - <daniel@loopring.org>
contract ProtocolRegistry is IProtocolRegistry, Claimable
{
    struct Protocol
    {
       address instance;
       string  version;
    }

    mapping (address => Protocol) private protocols;
    address private defaultProtocol;

    constructor() Claimable() public {}

    function getDefaultProtocol()
        external
        view
        returns (
            address loopring,
            address instance,
            string  memory version
        )
    {
        require(defaultProtocol != address(0), "NO_DEFAULT");
        loopring = defaultProtocol;
        (instance, version) = getProtocol(loopring);
    }

    function setDefaultProtocol(
        address loopring
        )
        external
        onlyOwner
    {
        (address instance, ) = getProtocol(loopring);
        require(instance != address(0), "INVALID_PROTOCOL");
        defaultProtocol = loopring;
    }

    function getProtocol(
        address loopring
        )
        public
        view
        returns (
            address instance,
            string  memory version
        )
    {
        Protocol storage protocol = protocols[loopring];
        instance = protocol.instance;
        version = protocol.version;
        require(instance != address(0), "INVALID_PROTOCOL");
    }

    function registerProtocol(
        address loopring,
        address instance,
        string  memory version
        )
        public
    {
        require(loopring != address(0), "ZERO_ADDRESS");
        require(instance != address(0), "ZERO_ADDRESS");
        require(bytes(version).length > 0, "INVALID_VERSION_LABEL");
        protocols[loopring] = Protocol(instance, version);
    }

    function createExchange(
        bool    onchainDataAvailability
        )
        external
        returns (
            address exchangeProxy,
            uint    exchangeId
        )
    {
        return createExchange(defaultProtocol, msg.sender, onchainDataAvailability);
    }

    function createExchange(
        address loopring,
        address payable operator,
        bool    onchainDataAvailability
        )
        public
        returns (
            address exchangeProxy,
            uint    exchangeId
        )
    {
        getProtocol(loopring); // verifies the input

        ExchangeProxy proxy = new ExchangeProxy(address(this), loopring);
        exchangeProxy = address(proxy);

        exchangeId = ILoopring(loopring).registerExchange(
            exchangeProxy,
            msg.sender,
            operator,
            onchainDataAvailability
        );
    }
}