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

import "../lib/MathUint.sol";

import "../base/DataStore.sol";


/// @title NonceStore
/// @dev This store maintains all nonces.
contract NonceStore is DataStore
{
    uint public constant WINDOW_SIZE = 100;

    struct Nonce {
        mapping (uint =>bool) used;
        uint next;
    }

    event NextNonceChanged(
        address indexed wallet,
        uint            next
    );

    mapping(address => Nonce) public nonces;

    constructor() public DataStore() {}

    function getNonce(address wallet)
        public
        view
        returns (uint)
    {
        return nonces[wallet].next;
    }

    function verifyNonce(address wallet, uint nonce)
        public
        view
    {
        Nonce storage n = nonces[wallet];
        require(nonce <= n.next + WINDOW_SIZE, "NONCE_TOO_LARGE");
        require(n.used[nonce] == false, "NONCE_USED");
    }

    function verifyAndUpdateNonce(address wallet, uint nonce)
        public
    {
        verifyNonce(wallet, nonce);

        Nonce storage n = nonces[wallet];
        n.used[nonce] = true;
        if (nonce >= n.next) {
            n.next = nonce + 1;
            emit NextNonceChanged(wallet, nonce + 1);
        }
    }
}
