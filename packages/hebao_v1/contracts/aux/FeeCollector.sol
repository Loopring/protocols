// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../lib/Drainable.sol";
import "../lib/OwnerManagable.sol";


/// @title FeeCollector
/// @author Daniel Wang - <daniel@loopring.org>
contract FeeCollector is Drainable, OwnerManagable
{
    function canDrain(address drainer, address /*token*/)
        public
        override
        view
        returns (bool)
    {
        return isManager(drainer);
    }
}
