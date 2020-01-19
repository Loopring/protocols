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

import "../lib/Claimable.sol";
import "../lib/ReentrancyGuard.sol";


/// @title IImplementationManager
/// @dev This contract manages implementation versions for a specific ILoopring
///      contract. The ILoopring contract can be considered as the "major" version
///      of a Loopring protocol and each IExchange implementation can be considered
///      as a "minor" version. Multiple IExchange contracts can use the same
///      ILoopring contracts.
///
/// @author Daniel Wang  - <daniel@loopring.org>
contract IImplementationManager is Claimable, ReentrancyGuard
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
        public;

    /// @dev Sets the default implemenation.
    /// @param implementation The new default implementation.
    function setDefault(
        address implementation
        )
        external;

    /// @dev Enables an implemenation.
    /// @param implementation The implementation to be enabled.
    function enable(
        address implementation
        )
        external;

    /// @dev Disables an implemenation.
    /// @param implementation The implementation to be disabled.
    function disable(
        address implementation
        )
        external;

    /// @dev Returns version information.
    /// @return protocolVersion The protocol's version.
    /// @return defaultImplVersion The default implementation's version.
    function version()
        external
        view
        returns (
            string  memory protocolVersion,
            string  memory defaultImplVersion
        );

    /// @dev Returns the latest implemenation added.
    /// @param implementation The latest implemenation added.
    function latest()
        public
        view
        returns (address implementation);

    /// @dev Returns if an implementation has been registered.
    /// @param registered True if the implementation is registered.
    function isRegistered(
        address implementation
        )
        public
        view
        returns (bool registered);

    /// @dev Returns if an implementation has been registered and enabled.
    /// @param enabled True if the implementation is registered and enabled.
    function isEnabled(
        address implementation
        )
        public
        view
        returns (bool enabled);
}