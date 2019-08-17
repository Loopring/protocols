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

import "../lib/Ownable.sol";

import "../iface/IExchange.sol";
import "../iface/IExchangeUpgradabilityProxy.sol";
import "../iface/IProtocolRegistry.sol";


/// @title ExchangeManualUpgradabilityProxy
/// @author Daniel Wang  - <daniel@loopring.org>
contract ExchangeManualUpgradabilityProxy is IExchangeUpgradabilityProxy
{
    event Upgraded(address indexed implementation);

    bytes32 private constant implementationPosition = keccak256(
        "org.loopring.protocol.v3.implementation"
    );

    modifier onlyOwner()
    {
        require(msg.sender == Ownable(address(this)).owner(), "UNAUTHORIZED");
        _;
    }

    constructor(
        address _registry,
        address _implementation
        )
        public
    {
        setRegistry(_registry);
        setImplementation(_implementation);
    }

    function implementation()
        public
        view
        returns (address impl)
    {
        bytes32 position = implementationPosition;
        assembly { impl := sload(position) }
    }

    function upgradeTo(
        address newImplementation
        )
        external
        onlyOwner
    {
        validateImplementation(newImplementation);
        address currentImplementation = implementation();
        require(currentImplementation != newImplementation);
        setImplementation(newImplementation);
        emit Upgraded(newImplementation);
    }

    function setImplementation(
        address newImplementation
        )
        private
    {
        bytes32 position = implementationPosition;
        assembly {sstore(position, newImplementation) }
    }

    function validateImplementation(
        address newImplementation
        )
        private
        view
    {

    }
}
