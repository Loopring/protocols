// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

abstract contract ERC1271 {

    // bytes4(keccak256("isValidSignature(bytes,bytes)")
    bytes4 constant internal ERC1271_MAGICVALUE_BS = 0x20c13b0b;

    // bytes4(keccak256("isValidSignature(bytes32,bytes)")
    bytes4 constant internal ERC1271_MAGICVALUE_B32 = 0x1626ba7e;

    bytes4 constant internal ERC1271_SELECTOR_BS = bytes4(
        keccak256(bytes("isValidSignature(bytes,bytes)"))
    );

    bytes4 constant internal ERC1271_SELECTOR_B32 = bytes4(
        keccak256(bytes("isValidSignature(bytes32,bytes)"))
    );

    function isValidSignature(
        bytes memory _data,
        bytes memory _signature)
        public
        view
        virtual
        returns (bytes4 magicValueBS);

    function isValidSignature(
        bytes32      _hash,
        bytes memory _signature)
        public
        view
        virtual
        returns (bytes4 magicValueB32);
}
