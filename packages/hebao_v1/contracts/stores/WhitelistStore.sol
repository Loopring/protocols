// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;

import "../base/DataStore.sol";
import "../lib/AddressSet.sol";


/// @title WhitelistStore
/// @dev This store maintains a wallet's whitelisted addresses.
contract WhitelistStore is DataStore, AddressSet
{
    // wallet => whitelisted_addr => effective_since
    mapping(address => mapping(address => uint)) public effectiveTimeMap;

    event Whitelisted(
        address indexed wallet,
        address indexed addr,
        bool            whitelisted,
        uint            effectiveTime
    );

    constructor() public DataStore() {}

    function addToWhitelist(
        address wallet,
        address addr,
        uint    effectiveTime
        )
        public
        onlyWalletModule(wallet)
    {
        addAddressToSet(walletKey(wallet), addr, true);
        uint effective = effectiveTime >= now ? effectiveTime : now;
        effectiveTimeMap[wallet][addr] = effective;
        emit Whitelisted(wallet, addr, true, effective);
    }

    function removeFromWhitelist(
        address wallet,
        address addr
        )
        public
        onlyWalletModule(wallet)
    {
        removeAddressFromSet(walletKey(wallet), addr);
        delete effectiveTimeMap[wallet][addr];
        emit Whitelisted(wallet, addr, false, 0);
    }

    function whitelist(address wallet)
        public
        view
        returns (
            address[] memory addresses,
            uint[]    memory effectiveTimes
        )
    {
        addresses = addressesInSet(walletKey(wallet));
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
        isWhitelistedAndEffective = effectiveTime > 0 && effectiveTime <= now;
    }

    function whitelistSize(address wallet)
        public
        view
        returns (uint)
    {
        return numAddressesInSet(walletKey(wallet));
    }

    function walletKey(address addr)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked("__WHITELIST__", addr));
    }
}