// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../base/WalletDataLayout.sol";

/// @title SecurityData
/// @author Daniel Wang - <daniel@loopring.org>
library SecurityData
{
    function touchLastActive(
        WalletDataLayout.State storage S
        )
        internal
    {
        address wallet = msg.sender;
        // wallets[wallet].lastActive = uint64(block.timestamp);
    }

    function touchLastActiveWhenRequired(
        WalletDataLayout.State storage S,
        uint minInternval
        )
        internal
    {
        address wallet = msg.sender;
        // if (wallets[wallet].inheritor != address(0) &&
        //     block.timestamp > lastActive(wallet) + minInternval) {
        //     requireStoreAccessor();
        //     wallets[wallet].lastActive = uint64(block.timestamp);
        // }
    }

    function setLock(
        WalletDataLayout.State storage S,
        bool locked
        )
        internal
    {
        address wallet = msg.sender;
        // wallets[wallet].locked = locked;
    }

    function isLocked(
        WalletDataLayout.State storage S
        )
        internal
        view
        returns (bool)
    {
        address wallet = msg.sender;
        // return wallets[wallet].locked;
    }
}
