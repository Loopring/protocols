// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;


/// @title WalletRegistry
/// @dev A registry for wallets.
/// @author Daniel Wang - <daniel@loopring.org>
interface WalletRegistry
{
    function registerWallet(address wallet) external;
    function isWalletRegistered(address addr) external view returns (bool);
    function numOfWallets() external view returns (uint);
}
