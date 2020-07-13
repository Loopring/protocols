// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;

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
