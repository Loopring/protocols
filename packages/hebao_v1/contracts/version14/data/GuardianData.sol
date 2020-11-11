// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../base/WalletDataLayout.sol";

/// @title GuardianData
/// @author Daniel Wang - <daniel@loopring.org>
library GuardianData
{
    function isGuardian(
        WalletDataLayout.State storage S,
        address addr,
        bool    includePendingAddition
        )
        internal
        view
        returns (bool)
    {
        address wallet = msg.sender;
        // Data.Guardian memory g = _getGuardian(wallet, addr);
        // return _isActiveOrPendingAddition(g, includePendingAddition);
    }
}
