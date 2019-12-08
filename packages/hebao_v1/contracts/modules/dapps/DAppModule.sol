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
pragma experimental ABIEncoderV2;

import "../../base/BaseSubAccount.sol";

import "../security/SecurityModule.sol";


/// @title DAppModule
contract DAppModule is BaseSubAccount, SecurityModule
{
    // Override this methods to return a list of functions that the owner
    // can invoke through meta-transactions.
    function ownerMetaFunctions()
        internal
        pure
        returns (bytes4[] memory selectors)
    {
        selectors = new bytes4[](2);
        selectors[0] = this.deposit.selector;
        selectors[1] = this.withdraw.selector;
    }

    function extractMetaTxSigners(
        address wallet,
        bytes4  method,
        bytes   memory
        )
        internal
        view
        returns (address[] memory signers)
    {
        bool found = false;
        bytes4[] memory selectors = ownerMetaFunctions();

        for (uint i = 0; i < selectors.length && !found; i++) {
            if (method == selectors[i]) found = true;
        }
        require(found, "INVALID_METHOD");

        signers = new address[](1);
        signers[0] = Wallet(wallet).owner();
    }
}
