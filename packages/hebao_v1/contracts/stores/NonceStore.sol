/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
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
        returns(bool)
    {
        return nonce > nonces[wallet] && (nonce >> 128) <= block.number;
    }

    function verifyAndUpdate(address wallet, uint nonce)
        public
    {
        require(isNonceValid(wallet, nonce), "INVALID_NONCE");
        nonces[wallet] = nonce;
    }
}
