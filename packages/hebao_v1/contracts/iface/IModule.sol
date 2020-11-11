// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @title IModule
/// @author Daniel Wang - <daniel@loopring.org>
interface IModule
{
    /// @dev Activates the module for the given wallet (msg.sender) after the module is added.
    ///      Warning: this method shall ONLY be callable by a wallet.
    function activate(address wallet) external;

    function bindableMethods() external pure returns (bytes4[] memory);
}
