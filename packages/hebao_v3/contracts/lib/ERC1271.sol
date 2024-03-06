// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

abstract contract ERC1271 {
    // bytes4(keccak256("isValidSignature(bytes32,bytes)")
    bytes4 internal constant ERC1271_MAGICVALUE = 0x1626ba7e;

    function isValidSignature(
        bytes32 _hash,
        bytes calldata _signature
    ) public view virtual returns (bytes4 magicValue);
}
