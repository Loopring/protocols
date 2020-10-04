// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/iface/ExchangeData.sol";
import "./AmmData.sol";

/// @title IAmmBlockReceiver
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract IAmmBlockReceiver
{
    function onAmmTransaction(
        ExchangeData.Block memory _block,
        AmmData.Context    memory ctx,
        bytes              memory data,
        uint                      txIdx
        )
        external
        virtual
        returns (uint  numTxConsumed);

    function beforeEachBlock(
        ExchangeData.Block memory /* _block */,
        AmmData.Context    memory ctx
        )
        external
        virtual
    {
    }

    function afterEachBlock(
        ExchangeData.Block memory /* _block */,
        AmmData.Context    memory ctx
        )
        external
        virtual
    {
    }

    function beforeAllBlocks()
        external
        virtual
        returns(AmmData.Context memory ctx);

    function afterAllBlocks(AmmData.Context memory ctx)
        external
        virtual
    {
    }
}
