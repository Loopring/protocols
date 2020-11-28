// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../lib/Drainable.sol";
import "../lib/OwnerManagable.sol";


/// @title BatchTxOperator
/// @author Daniel Wang - <daniel@loopring.org>
contract BatchTxOperator is Drainable, OwnerManagable
{
    address immutable target;
    constructor(address _target)
        Drainable()
        OwnerManagable()
    {
        require(_target != address(0));
        target = _target;
    }

    function transactTo(
        bytes[] calldata txs,
        uint[]  calldata gasLimits
        )
        external
        payable
        onlyManager
    {
        require(msg.value == 0, "INVALID_VALUES");
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
