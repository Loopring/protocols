// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../lib/Claimable.sol";
import "../lib/Drainable.sol";


/// @title BatchTransactor
/// @author Daniel Wang - <daniel@loopring.org>
contract BatchTransactor is Drainable, Claimable
{
    address public immutable target;

    constructor(address _target)
        Claimable()
        Drainable()
    {
        target = _target;
    }

    function batchTransact(
        bytes[] calldata txs,
        uint[]  calldata gasLimits
        )
        external
    {
        require(txs.length == gasLimits.length, "SIZE_DIFF");

        for (uint i = 0; i < txs.length; i++) {
            (bool success, bytes memory returnData) = target.call{gas: gasLimits[i]}(txs[i]);
            if (!success) {
                assembly {
                    revert(add(returnData, 32), mload(returnData))
                }
            }
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
