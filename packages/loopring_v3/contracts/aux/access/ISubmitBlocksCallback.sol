// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/iface/ExchangeData.sol";

/// @title ISubmitBlocksCallback
/// @author Brecht Devos - <brecht@loopring.org>
abstract contract ISubmitBlocksCallback
{
    function onSubmitBlocks(
        ExchangeData.Block[] memory blocks,
        bytes memory auxiliaryData
        )
        public
        virtual;
}
