// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../../lib/Claimable.sol";
import "../../lib/ReentrancyGuard.sol";


/// @title IImplementationManager
/// @dev This contract manages implementation versions for a specific ILoopring
///      contract. The ILoopring contract can be considered as the "major" version
///      of a Loopring protocol and each IExchange implementation can be considered
///      as a "minor" version. Multiple IExchange contracts can use the same
///      ILoopring contracts.
///
/// @author Daniel Wang  - <daniel@loopring.org>
abstract contract IImplementationManager is Claimable, ReentrancyGuard
{
    /// === Events ===

    event DefaultChanged (
        address indexed oldDefault,
        address indexed newDefault
    );

    event Registered (
        address indexed implementation,
        string          version
    );

    event Enabled (
        address indexed implementation
    );

    event Disabled (
        address indexed implementation
    );

    /// === Data ===

    address   public protocol;
    address   public defaultImpl;
    address[] public implementations;

    // version strings => IExchange addresses
    mapping (string => address) public versionMap;

    /// === Functions ===

    /// @dev Registers a new implementation.
    /// @param implementation The implemenation to add.
    function register(
        address implementation
        )
        external
        virtual;

    /// @dev Sets the default implemenation.
    /// @param implementation The new default implementation.
    function setDefault(
        address implementation
        )
        external
        virtual;

    /// @dev Enables an implemenation.
    /// @param implementation The implementation to be enabled.
    function enable(
        address implementation
        )
        external
        virtual;

    /// @dev Disables an implemenation.
    /// @param implementation The implementation to be disabled.
    function disable(
        address implementation
        )
        external
        virtual;

    /// @dev Returns version information.
    /// @return protocolVersion The protocol's version.
    /// @return defaultImplVersion The default implementation's version.
    function version()
        public
        virtual
        view
        returns (
            string  memory protocolVersion,
            string  memory defaultImplVersion
        );

    /// @dev Returns the latest implemenation added.
    /// @param implementation The latest implemenation added.
    function latest()
        public
        virtual
        view
        returns (address implementation);

    /// @dev Returns if an implementation has been registered.
    /// @param registered True if the implementation is registered.
    function isRegistered(
        address implementation
        )
        public
        virtual
        view
        returns (bool registered);

    /// @dev Returns if an implementation has been registered and enabled.
    /// @param enabled True if the implementation is registered and enabled.
    function isEnabled(
        address implementation
        )
        public
        virtual
        view
        returns (bool enabled);
}