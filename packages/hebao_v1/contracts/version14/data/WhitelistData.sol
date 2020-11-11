// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../base/WalletDataLayout.sol";

/// @title WhitelistData
/// @author Daniel Wang - <daniel@loopring.org>
library WhitelistData
{
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
}
