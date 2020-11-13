// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../base/WalletDataLayout.sol";
import "../../iface/IPriceOracle.sol";


/// @title QuotaData
/// @author Daniel Wang - <daniel@loopring.org>
library QuotaData
{
    function checkAndAddToSpent(
        WalletDataLayout.State storage S,
        address     token,
        uint        amount,
        IPriceOracle priceOracle
        )
        internal
    {
    }

    function addToSpent(
        WalletDataLayout.State storage S,
        uint    amount
        )
        internal
    {
    }

}
