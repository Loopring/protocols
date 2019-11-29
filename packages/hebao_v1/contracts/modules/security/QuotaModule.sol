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

import "../../iface/Wallet.sol";

import "../stores/QuotaStore.sol";
import "../stores/SecurityStore.sol";

import "./SecurityModule.sol";


/// @title QuotaModule
/// @dev Manages transfer quota.
contract QuotaModule is SecurityModule
{
    QuotaStore    public quotaStore;
    SecurityStore public securityStore;

    constructor(
        SecurityStore  _securityStore,
        QuotaStore    _quotaStore
        )
        public
        SecurityModule(_securityStore)
    {
        quotaStore = _quotaStore;
    }

    function changeQuota(
        address wallet,
        uint    newQuota
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        quotaStore.changeQuota(wallet, newQuota);
    }

    function getQuota(address wallet)
        public
        view
        returns (
            uint total,
            uint spent,
            uint available
        )
    {
        total = quotaStore.currentQuota(wallet);
        spent = quotaStore.spentQuota(wallet);
        available = quotaStore.availableQuota(wallet);
    }

    function staticMethods()
        public
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](1);
        methods[0] = this.getQuota.selector;
    }

    function extractMetaTxSigners(
        address       wallet,
        bytes4        method,
        bytes memory  /* data */
        )
        internal
        view
        returns (address[] memory signers)
    {
        require (
            method == this.changeQuota.selector,
            "INVALID_METHOD"
        );

        signers = new address[](1);
        signers[0] = Wallet(wallet).owner();
    }
}
