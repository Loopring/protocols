// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/IVersion.sol";
import "../iface/IVersionRegistry.sol";
import "../iface/IWallet.sol";
import "../lib/ERC20.sol";


/// @title BaseWallet
/// @dev This contract provides basic implementation for a Wallet.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract WalletDataLayout
{
    struct State {
        address owner;
        address version;

        mapping (bytes32 => address) addresses;
        mapping (bytes32 => uint) uints;
        mapping (bytes32 => bytes) byteArrays;
    }

    State   internal state;
}
