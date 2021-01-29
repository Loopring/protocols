// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../lib/OwnerManagable.sol";
import "../lib/Drainable.sol";
import "./ChiDiscount.sol";


/// @title BatchTransactor
/// @author Daniel Wang - <daniel@loopring.org>
contract BatchTransactor is Drainable, ChiDiscount, OwnerManagable
{
    address public immutable chiToken;

    constructor(address _chiToken)
    {
        chiToken = _chiToken;
    }

    function batchTransact(
        address target,
        bytes[]   calldata txs,
        uint[]    calldata gasLimits,
        ChiConfig calldata chiConfig
        )
        external
        discountCHI(chiToken, chiConfig)
    {
        require(target != address(0), "EMPTY_TARGET");
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
