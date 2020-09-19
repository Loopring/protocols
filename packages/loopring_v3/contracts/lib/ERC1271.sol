// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

abstract contract ERC1271 {
    // bytes4(keccak256("isValidSignature(bytes32,bytes)")
    bytes4 constant internal ERC1271_MAGICVALUE = 0x1626ba7e;

    function isValidSignature(
        bytes32      _hash,
        bytes memory _signature)
        public
        view
        virtual
        returns (bytes4 magicValueB32);

}
