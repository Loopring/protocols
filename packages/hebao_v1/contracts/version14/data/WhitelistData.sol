// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../base/WalletDataLayout.sol";

/// @title WhitelistData
/// @author Daniel Wang - <daniel@loopring.org>
library WhitelistData
{
    function whitelist(WalletDataLayout.State storage S)
        internal
        view
        returns (
            address[] memory addresses,
            uint[]    memory effectiveTimes
        )
    {
        // addresses = addressesInSet(_walletKey(wallet));
        // effectiveTimes = new uint[](addresses.length);
        // for (uint i = 0; i < addresses.length; i++) {
        //     effectiveTimes[i] = effectiveTimeMap[wallet][addresses[i]];
        // }
    }

    function isWhitelisted(
        WalletDataLayout.State storage S,
        address addr
        )
        internal
        view
        returns (
            bool isWhitelistedAndEffective,
            uint effectiveTime
        )
    {

    }

    function addToWhitelist(
        WalletDataLayout.State storage S,
        address addr,
        uint    effectiveTime
        )
        internal
    {
        address wallet = msg.sender;
        // addAddressToSet(_walletKey(wallet), addr, true);
        // uint effective = effectiveTime >= block.timestamp ? effectiveTime : block.timestamp;
        // effectiveTimeMap[wallet][addr] = effective;
        // emit Whitelisted(wallet, addr, true, effective);
    }

    function removeFromWhitelist(
        WalletDataLayout.State storage S,
        address addr
        )
        internal
    {
        address wallet = msg.sender;
        // addAddressToSet(_walletKey(wallet), addr, true);
        // uint effective = effectiveTime >= block.timestamp ? effectiveTime : block.timestamp;
        // effectiveTimeMap[wallet][addr] = effective;
        // emit Whitelisted(wallet, addr, true, effective);
    }

}
