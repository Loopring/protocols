// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;

import "../lib/Ownable.sol";
import "./Wallet.sol";


/// @title Module
/// @dev Base contract for all smart wallet modules.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
interface Module
{
    /// @dev Activates the module for the given wallet (msg.sender) after the module is added.
    ///      Warning: this method shall ONLY be callable by a wallet.
    function activate() external;

    /// @dev Deactivates the module for the given wallet (msg.sender) before the module is removed.
    ///      Warning: this method shall ONLY be callable by a wallet.
    function deactivate() external;
}
