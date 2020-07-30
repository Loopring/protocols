// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/WalletRegistry.sol";
import "../lib/Claimable.sol";


/// @title WalletRegistryImpl
/// @dev Basic implementation of a WalletRegistry.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract WalletRegistryImpl is Claimable, WalletRegistry
{
    mapping (address => bool) public wallets;
    uint public count;

    address internal factory;

    event WalletRegistered      (address wallet);
    event WalletFactoryUpdated  (address factory);

    modifier onlyFactory()
    {
        require(msg.sender == factory, "FACTORY_UNAUTHORIZED");
        _;
    }

    function setWalletFactory(address _factory)
        external
        onlyOwner
    {
        require(_factory != address(0), "ZERO_ADDRESS");
        factory = _factory;
        emit WalletFactoryUpdated(factory);
    }

    function registerWallet(address wallet)
        external
        override
        onlyFactory
    {
        require(wallets[wallet] == false, "ALREADY_REGISTERED");
        wallets[wallet] = true;
        count += 1;
        emit WalletRegistered(wallet);
    }

    function isWalletRegistered(address addr)
        public
        view
        override
        returns (bool)
    {
        return wallets[addr];
    }

    function numOfWallets()
        public
        view
        override
        returns (uint)
    {
        return count;
    }
}
