// SPDX-License-Identifier: UNLICENSED
// Copied from https://eips.ethereum.org/EIPS/eip-1271.
pragma solidity ^0.6.10;

abstract contract ERC1271 {

    // bytes4(keccak256("isValidSignature(bytes,bytes)")
    bytes4 constant internal MAGICVALUE = 0x20c13b0b;

    /**
     * @dev Should return whether the signature provided is valid for the provided data
     * @param _data Arbitrary length data signed on the behalf of address(this)
     * @param _signature Signature byte array associated with _data
     *
     * MUST return the bytes4 magic value 0x20c13b0b when function passes.
     * MUST NOT modify state (using STATICCALL for solc < 0.5, view modifier for solc > 0.5)
     * MUST allow external calls
     */
    function isValidSignature(
        bytes memory _data,
        bytes memory _signature)
        public
        virtual
        view
        returns (bytes4 magicValue);
}