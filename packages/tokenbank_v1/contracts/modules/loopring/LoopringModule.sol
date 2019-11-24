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
pragma solidity ^0.5.11;

import "../security/SecurityModule.sol";

import "./IExchangeV3.sol";


/// @title LoopringModule
contract LoopringModule is SecurityModule
{

    function createDEXAccount(
        address            wallet,
        address[] calldata signers,
        IExchangeV3        exchange
        )
        external
        nonReentrantExceptFromThis
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        if (msg.sender == address(this)) {
            // (uint24 accountId, _, _) = exchange.getAccount(wallet);
            // if (accountId != 0) {

            // }

            // this is a meta-tx.
            // step1; query fee
            // step2: transfer fee from msg.sender to wallet
         }
        // trigger registration.
    }


    function extractMetaTxSigners(
        address /*wallet*/,
        bytes4  method,
        bytes   memory data
        )
        internal
        view
        returns (address[] memory signers)
    {
        require (
            method == this.createDEXAccount.selector,
            "INVALID_METHOD"
        );
        // ASSUMPTION:
        // data layout: {data_length:32}{wallet:32}{signers_length:32}{signer1:32}{signer2:32}
        require(data.length >= 64, "DATA_INVALID");

        uint numSigners;
        assembly { numSigners := mload(add(data, 64)) }
        require(data.length >= 64 + 32 * numSigners, "DATA_INVALID");

        signers = new address[](numSigners);

        address signer;
        for (uint i = 0; i < numSigners; i++) {
            uint start = 96 + 32 * i;
            assembly { signer := mload(add(data, start)) }
            signers[i] = signer;
        }
    }
}
