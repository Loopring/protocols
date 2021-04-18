// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/iface/ExchangeData.sol";
import "../../amm/libamm/AmmData.sol";

/// @title ITransactionReceiver
/// @author Brecht Devos - <brecht@loopring.org>
abstract contract ITransactionReceiver
{
    function onReceiveTransactions(
        bytes calldata txsData,
        bytes calldata callbackData
        )
        external
        virtual;
}
