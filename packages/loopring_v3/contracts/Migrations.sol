// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

contract Migrations
{
    address public owner;
    uint public last_completed_migration;

    modifier restricted()
    {
        if (msg.sender == owner) {
            _;
        }
    }

    constructor()
    {
        owner = msg.sender;
    }

    function setCompleted(uint completed)
        public
        restricted
    {
        last_completed_migration = completed;
    }

    function upgrade(address newAddress)
        public
        restricted
    {
        Migrations upgraded = Migrations(newAddress);
        upgraded.setCompleted(last_completed_migration);
    }
}
