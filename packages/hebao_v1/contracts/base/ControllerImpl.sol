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

import "../lib/Claimable.sol";

import "../iface/Controller.sol";


/// @title ControllerImpl
/// @dev Basic implementation of a Controller.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract ControllerImpl is Claimable, Controller
{
    constructor() public Claimable() {}
    bool private initialized;

    event ContractChanged(
        string  indexed name,
        address indexed addr
    );

    function init(
        ModuleRegistry    _moduleRegistry,
        WalletRegistry    _walletRegistry,
        PriceCacheStore   _priceCacheStore,
        QuotaStore        _quotaStore,
        SecurityStore     _securityStore,
        WhitelistStore    _whitelistStore,
        PriceOracle       _priceOracle,
        WalletENSManager  _ensManager,
        QuotaManager      _quotaManager
        )
        external
        onlyOwner
    {
        require(!initialized, "INITIALIZED_ALREADY");
        initialized = true;

        moduleRegistry = _moduleRegistry;
        walletRegistry = _walletRegistry;

        priceCacheStore = _priceCacheStore;
        quotaStore = _quotaStore;
        securityStore = _securityStore;
        whitelistStore = _whitelistStore;

        priceOracle = _priceOracle;             // modifiable
        ensManager = _ensManager;
        quotaManager = _quotaManager;
    }

    function setPriceOracle(PriceOracle _priceOracle)
        external
        onlyOwner
    {
        priceOracle = _priceOracle;
        emit ContractChanged("PriceOracle", address(priceOracle));
    }


    function setQuotaManager(QuotaManager _quotaManager)
        external
        onlyOwner
    {
        quotaManager = _quotaManager;
        emit ContractChanged("QuotaManager", address(quotaManager));
    }
}