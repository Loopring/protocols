// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;

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
        override
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