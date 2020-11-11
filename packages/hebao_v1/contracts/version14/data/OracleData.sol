// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../base/WalletDataLayout.sol";
import "../../iface/IPriceOracle.sol";

/// @title OracleData
/// @author Daniel Wang - <daniel@loopring.org>
library OracleData
{
    function priceOracle(
        WalletDataLayout.State storage S
        )
        internal
        view
        returns (IPriceOracle)
    {

    }

    function setPriceOracle(
        WalletDataLayout.State storage S,
        IPriceOracle oracle
        )
        internal
    {
    }
}
