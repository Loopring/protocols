// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/Wallet.sol";


/// @title DataStore
/// @dev Modules share states by accessing the same storage instance.
///      Using ModuleStorage will achieve better module decoupling.
///
/// @author Daniel Wang - <daniel@loopring.org>

abstract contract DataStore
{
    modifier onlyFromSelfOrWalletModule(address wallet)
    {
        requireSelfOrWalletModule(wallet);
        _;
    }

    function requireSelfOrWalletModule(address wallet) view internal
    {
        require(
            msg.sender == address(this) ||
            Wallet(wallet).hasModule(msg.sender),
            "UNAUTHORIZED"
        );
    }
}