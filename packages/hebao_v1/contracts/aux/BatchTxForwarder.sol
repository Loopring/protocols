// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../lib/Claimable.sol";
import "../lib/Drainable.sol";


/// @title BatchTxForwarder
/// @author Daniel Wang - <daniel@loopring.org>
contract BatchTxForwarder is Drainable, Claimable
{
    address immutable target;
    constructor(address _target)
        Drainable()
        Claimable()
    {
        target = _target;
    }

    function transactTo(
        bytes[] calldata txs,
        uint[]  calldata gasLimits
        )
        external
    {
        require(txs.length == gasLimits.length, "INVALID_DATA");

        for (uint i = 0; i < txs.length; i++) {
            (bool success,) = target.call{gas: gasLimits[i]}(txs[i]);
            require(success, "FAILED_TX");
        }
    }

    function canDrain(address drainer, address /*token*/)
        public
        override
        view
        returns (bool)
    {
        return drainer == owner;
    }
}
