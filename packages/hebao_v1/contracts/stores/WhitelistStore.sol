// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../base/DataStore.sol";
import "../lib/AddressSet.sol";
import "../lib/OwnerManagable.sol";


/// @title WhitelistStore
/// @dev This store maintains a wallet's whitelisted addresses.
contract WhitelistStore is DataStore, AddressSet, OwnerManagable
{
    bytes32 internal constant DAPPS = keccak256("__DAPPS__");

    // wallet => whitelisted_addr => effective_since
    mapping(address => mapping(address => uint)) public effectiveTimeMap;

    event Whitelisted(
        address wallet,
        address addr,
        bool    whitelisted,
        uint    effectiveTime
    );

    event DappWhitelisted(
        address addr,
        bool    whitelisted
    );

    constructor() DataStore() {}

    function addToWhitelist(
        address wallet,
        address addr,
        uint    effectiveTime
        )
        external
        onlyWalletModule(wallet)
    {
        addAddressToSet(_walletKey(wallet), addr, true);
        uint effective = effectiveTime >= block.timestamp ? effectiveTime : block.timestamp;
        effectiveTimeMap[wallet][addr] = effective;
        emit Whitelisted(wallet, addr, true, effective);
    }

    function removeFromWhitelist(
        address wallet,
        address addr
        )
        external
        onlyWalletModule(wallet)
    {
        removeAddressFromSet(_walletKey(wallet), addr);
        delete effectiveTimeMap[wallet][addr];
        emit Whitelisted(wallet, addr, false, 0);
    }

    function addDapp(address addr)
        external
        onlyManager
    {
        addAddressToSet(DAPPS, addr, true);
        emit DappWhitelisted(addr, true);
    }

    function removeDapp(address addr)
        external
        onlyManager
    {
        removeAddressFromSet(DAPPS, addr);
        emit DappWhitelisted(addr, false);
    }

    function whitelist(address wallet)
        public
        view
        returns (
            address[] memory addresses,
            uint[]    memory effectiveTimes
        )
    {
        addresses = addressesInSet(_walletKey(wallet));
        effectiveTimes = new uint[](addresses.length);
        for (uint i = 0; i < addresses.length; i++) {
            effectiveTimes[i] = effectiveTimeMap[wallet][addresses[i]];
        }
    }

    function isWhitelisted(
        address wallet,
        address addr
        )
        public
        view
        returns (
            bool isWhitelistedAndEffective,
            uint effectiveTime
        )
    {
        effectiveTime = effectiveTimeMap[wallet][addr];
        isWhitelistedAndEffective = effectiveTime > 0 && effectiveTime <= block.timestamp;
    }

    function whitelistSize(address wallet)
        public
        view
        returns (uint)
    {
        return numAddressesInSet(_walletKey(wallet));
    }

    function dapps()
        public
        view
        returns (
            address[] memory addresses
        )
    {
        return addressesInSet(DAPPS);
    }

    function isDapp(
        address addr
        )
        public
        view
        returns (bool)
    {
        return isAddressInSet(DAPPS, addr);
    }

    function numDapps()
        public
        view
        returns (uint)
    {
        return numAddressesInSet(DAPPS);
    }

    function isDappOrWhitelisted(
        address wallet,
        address addr
        )
        public
        view
        returns (bool res)
    {
        (res,) = isWhitelisted(wallet, addr);
        return res || isAddressInSet(DAPPS, addr);
    }

    function _walletKey(address addr)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked("__WHITELIST__", addr));
    }

}
