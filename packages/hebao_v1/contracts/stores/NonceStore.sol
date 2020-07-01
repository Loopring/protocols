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
pragma solidity ^0.6.6;

import "../base/DataStore.sol";
import "../lib/MathUint.sol";


/// @title NonceStore
/// @dev This store maintains all nonces for metaTx
contract NonceStore is DataStore
{
    mapping(address => uint) public nonces;

    constructor() public DataStore() {}

    function getLastNonce(address wallet)
        public
        view
        returns (uint)
    {
        return nonces[wallet];
    }

    function verifyNonce(address wallet, uint nonce)
        public
        view
    {
        require(nonce > nonces[wallet], "NONCE_TOO_SMALL");
        require((nonce >> 128) <= (block.number), "NONCE_TOO_LARGE");
    }

    function verifyAndUpdateNonce(address wallet, uint nonce)
        public
    {
        verifyNonce(wallet, nonce);
        nonces[wallet] = nonce;
    }
}
