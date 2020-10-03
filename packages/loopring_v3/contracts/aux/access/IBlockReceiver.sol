// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/iface/ExchangeData.sol";

/// @title IBlockReceiver
/// @author Brecht Devos - <brecht@loopring.org>
abstract contract IBlockReceiver
{
    function beforeBlockSubmission(
        ExchangeData.Block memory _block,
        bytes              memory data,
        uint                      txIdx
        )
        external
        virtual
        returns (uint numTransactionsConsumed);
}
