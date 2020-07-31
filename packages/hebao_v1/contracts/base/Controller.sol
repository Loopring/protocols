// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/ModuleRegistry.sol";
import "../iface/WalletRegistry.sol";


/// @title Controller
///
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract Controller
{
    ModuleRegistry public moduleRegistry;
    WalletRegistry public walletRegistry;
    address        public walletFactory;
}
