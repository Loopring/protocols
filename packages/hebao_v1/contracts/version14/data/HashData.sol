// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../base/WalletDataLayout.sol";
import "../../iface/IPriceOracle.sol";


/// @title HashData
/// @author Daniel Wang - <daniel@loopring.org>
library HashData
{
    function verifyAndUpdate(
        WalletDataLayout.State storage S,
        bytes32 hash
        )
        internal
    {
    }

}
