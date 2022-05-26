// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;


/// @title ReentrancyGuard
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev Exposes a modifier that guards a function against reentrancy
///      Changing the value of the same storage value multiple times in a transaction
///      is cheap (starting from Istanbul) so there is no need to minimize
///      the number of times the value is changed
contract ReentrancyGuard
{
    //The default value must be 1 in order to work behind a proxy.
    uint private _guardValue = 0;

    modifier nonReentrant()
    {
        require(_guardValue == 0, "REENTRANCY");
        _guardValue = 1;
        _;
        _guardValue = 0;
    }
}
