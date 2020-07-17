// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;

import "../../lib/AddressSet.sol";

/// @title AddressSetWrapper
/// @author Freeman Zhong - <kongliang@loopring.org>
contract AddressSetWrapper is AddressSet
{
    function add(
        bytes32 key,
        address addr,
        bool maintainList
        ) external
    {
        addAddressToSet(key, addr, maintainList);
    }

    function remove(
        bytes32 key,
        address addr
        )
        external
    {
        removeAddressFromSet(key, addr);
    }

    function removeAll(bytes32 key) external {
        removeSet(key);
    }

    function isInSet(bytes32 key, address addr) external view returns (bool) {
        return isAddressInSet(key, addr);
    }

    function numInSet(bytes32 key) external view returns (uint) {
        return numAddressesInSet(key);
    }

    function getAddresses(bytes32 key) external view returns (address[] memory) {
        return addressesInSet(key);
    }
}
