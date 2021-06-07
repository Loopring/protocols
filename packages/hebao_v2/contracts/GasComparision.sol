// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

// Kongliang:
// 我们只需要测试简单的例子：设置7个guardian，然后用同样这个7个guardian去做验证。
// 没有必要验证不是guardian的情况，这种遇上也是例外，不用做对比。
contract Impl1 {

    mapping (address => bool) guardians;

    function verifyGuardians(address[] calldata addrs)
        public
        view
        returns (bool)
    {
        for (uint i = 0; i < addrs.length; i++) {
            if (!guardians[addrs[i]]) return false; // no optimization
        }
        return true;
    }

    function addGuardian(address guardian)
        public
    {
        guardians[guardian] = true;
    }
}


contract Impl2 {

    bytes32 guardianHash;

    function verifyGuardians(address[] calldata guardians)
        public
        view
        returns (bool)
    {
        if (guardians.length == 0) return true;
        return guardianHash == keccak256(abi.encodePacked(guardians));
    }

    function addGuardian(address[] calldata guardians, address newGuardian)
        public
    {
        require(verifyGuardians(guardians), "INVALID_GUARDIANS");
        address[] memory newGuardians = new address[](guardians.length + 1);
        for (uint i = 0; i < guardians.length; i++) {
            newGuardians[i] = guardians[i];
        }
        newGuardians[guardians.length] = newGuardian;
        bytes32 newHash = keccak256(abi.encodePacked(newGuardians));
        guardianHash = newHash;
    }

}
