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

import "../../lib/Ownable.sol";

import "../../iface/IExchangeProxy.sol";
import "../../iface/IUniversalRegistry.sol";


/// @title ManualUpgradabilityProxy
/// @dev This proxy is designed to support manual upgradability.
/// @author Daniel Wang  - <daniel@loopring.org>
contract ManualUpgradabilityProxy is IExchangeProxy
{
    event Upgraded(address indexed implementation);

    bytes32 private constant implementationPosition = keccak256(
        "org.loopring.protocol.v3.implementation"
    );

    modifier onlyUnderlyingOwner()
    {
        address underlyingOwner = Ownable(address(this)).owner();
        require(underlyingOwner != address(0), "NO_OWNER");
        require(underlyingOwner == msg.sender, "UNAUTHORIZED");
        _;
    }

    constructor(
        address _registry,
        address _implementation
        )
        public
        IExchangeProxy(_registry)
    {
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
        onlyUnderlyingOwner
    {
        require(implementation() != newImplementation, "SAME_IMPLEMENTATION");

        IUniversalRegistry r = IUniversalRegistry(registry());
        require(
            r.isProtocolAndImplementationEnabled(protocol(), newImplementation),
            "INVALID_PROTOCOL_OR_IMPLEMENTATION"
        );

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
}