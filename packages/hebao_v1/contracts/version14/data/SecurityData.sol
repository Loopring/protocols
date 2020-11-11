// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../base/WalletDataLayout.sol";

/// @title SecurityData
/// @author Daniel Wang - <daniel@loopring.org>
library SecurityData
{
    bytes32 public constant KEY_META_TX_FORWARDER =
        keccak256("eth.loopring.hebao.modules.security.lock");

    function isGuardian(
        WalletDataLayout.State storage S,
        address wallet,
        address addr,
        bool    includePendingAddition
        )
        public
        view
        returns (bool)
    {
        // Data.Guardian memory g = _getGuardian(wallet, addr);
        // return _isActiveOrPendingAddition(g, includePendingAddition);
    }
}
