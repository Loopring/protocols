// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Project Ltd (Loopring Foundation).
pragma solidity ^0.6.10;


import "../lib/Claimable.sol";


/// @title Killable
/// @dev The Killable contract allows the contract owner to suspend, resume or kill the contract
/// @author Brecht Devos - <brecht@loopring.org>
contract Killable is Claimable
{
    bool public suspended = false;

    modifier notSuspended()
    {
        require(!suspended, "INVALID_MODE");
        _;
    }

    modifier isSuspended()
    {
        require(suspended, "INVALID_MODE");
        _;
    }

    function suspend()
        external
        onlyOwner
        notSuspended
    {
        suspended = true;
    }

    function resume()
        external
        onlyOwner
        isSuspended
    {
        suspended = false;
    }

    /// owner must suspend the delegate first before invoking the kill method.
    function kill()
        external
        onlyOwner
        isSuspended
    {
        owner = address(0);
        emit OwnershipTransferred(owner, address(0));
    }
}
