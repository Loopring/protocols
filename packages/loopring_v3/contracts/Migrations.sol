// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Project Ltd (Loopring Foundation).
pragma solidity ^0.6.10;


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
        public
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
