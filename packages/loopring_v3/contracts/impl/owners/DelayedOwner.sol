// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Project Ltd (Loopring Foundation).
pragma solidity ^0.6.10;

import "../../lib/Claimable.sol";

import "../../impl/DelayedTransaction.sol";


/// @title  DelayedOwner
/// @author Brecht Devos - <brecht@loopring.org>
contract DelayedOwner is DelayedTransaction, Claimable
{
    address public defaultContract;

    constructor(
        address _defaultContract,
        uint    _timeToLive
        )
        DelayedTransaction(_timeToLive)
        public
    {
        defaultContract = _defaultContract;
    }

    receive()
        external
        // nonReentrant
        payable
    {
        // Don't do anything when receiving ETH
    }

    fallback()
        external
        nonReentrant
        payable
    {
        // Don't do anything if msg.sender isn't the owner
        if (msg.sender != owner) {
            return;
        }
        transactInternal(defaultContract, msg.value, msg.data);
    }

    function isAuthorizedForTransactions(address sender)
        internal
        override
        view
        returns (bool)
    {
        return sender == owner;
    }

    function setFunctionDelay(
        bytes4  functionSelector,
        uint    delay
        )
        internal
    {
        setFunctionDelay(defaultContract, functionSelector, delay);
    }
}
