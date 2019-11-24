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

import "../../lib/ERC20.sol";

import "../../iface/PriceProvider.sol";

import "../stores/QuotaStore.sol";
import "../stores/WhitelistStore.sol";

import "./TransferModule.sol";


/// @title QuotaTransfers
contract QuotaTransfers is TransferModule
{
    PriceProvider  public priceProvider;
    QuotaStore     public quotaStore;
    WhitelistStore public whitelistStore;

    constructor(
        PriceProvider  _priceProvider,
        SecurityStore  _securityStore,
        QuotaStore     _quotaStore,
        WhitelistStore _whitelistStore
        )
        public
        SecurityModule(_securityStore)
    {
        priceProvider = _priceProvider;
        quotaStore = _quotaStore;
        whitelistStore = _whitelistStore;
    }

    function transferToken(
        address            wallet,
        address            token,
        address            to,
        uint               amount,
        bytes     calldata data
        )
        external
        nonReentrant
        onlyFromWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        if (whitelistStore.isWhitelisted(wallet, to)) {
            return transferInternal(wallet, token, to, amount, data);
        }

        uint valueInCNY = priceProvider.getValueInCNY(token, amount);
        if (quotaStore.checkAndAddToSpent(wallet, valueInCNY)) {
            return transferInternal(wallet, token, to, amount, data);
        }
    }

    function approveToken(
        address            wallet,
        address            token,
        address            to,
        uint               amount
        )
        external
        nonReentrant
        onlyFromWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        approveInternal(wallet, token, to, amount);
    }

    function callContract(
        address            wallet,
        address            to,
        uint               amount,
        bytes     calldata data
        )
        external
        nonReentrant
        onlyFromWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {

        callContractInternal(wallet, to, amount, data);
    }

    function approveThenCallContract(
        address            wallet,
        address            token,
        address            to,
        uint               amount,
        bytes     calldata data
        )
        external
        nonReentrant
        onlyFromMetaTx
        onlyWhenWalletUnlocked(wallet)
        notWalletOrItsModule(wallet, to)
    {
        approveInternal(wallet, token, to, amount);
        callContractInternal(wallet, to, 0, data);
    }

    function extractMetaTxSigners(
        address       /* wallet */,
        bytes4        /* method */,
        bytes memory  /* data */
        )
        internal
        view
        returns (address[] memory)
    {
        revert("UNSUPPORTED");
    }
}
