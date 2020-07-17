// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;

import "../base/DataStore.sol";
import "../lib/MathUint.sol";


/// @title NonceStore
/// @dev This store maintains all nonces for metaTx
contract NonceStore is DataStore
{
    mapping(address => uint) public nonces;

    constructor() public DataStore() {}

    function lastNonce(address wallet)
        public
        view
        returns (uint)
    {
        return nonces[wallet];
    }

    function isNonceValid(address wallet, uint nonce)
        public
        view
        returns (bool)
    {
        return nonce > nonces[wallet] && (nonce >> 128) <= block.number;
    }

    function verifyAndUpdate(address wallet, uint nonce)
        public
        onlyWalletModule(wallet)
    {
        require(isNonceValid(wallet, nonce), "INVALID_NONCE");
        nonces[wallet] = nonce;
    }
}
