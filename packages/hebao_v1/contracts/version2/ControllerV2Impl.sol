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

import "../lib/Claimable.sol";

import "./ControllerV2.sol";


/// @title ControllerImpl
/// @dev Basic implementation of a Controller.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract ControllerV2Impl is Claimable, ControllerV2
{
    constructor() public Claimable() {}
    bool private initialized;

    event ValueChanged(
        string  indexed name,
        address indexed addr
    );

    function init(
        uint              _defaultLockPeriod,
        address           _collectTo,
        PriceOracle       _priceOracle,
        ModuleRegistry    _moduleRegistry,
        WalletRegistry    _walletRegistry,
        QuotaStore        _quotaStore,
        SecurityStore     _securityStore,
        WhitelistStore    _whitelistStore,
        NonceStore        _nonceStore,
        DappAddressStore  _dappAddressStore,
        WalletENSManager  _ensManager
        )
        external
        onlyOwner
    {
        require(!initialized, "INITIALIZED_ALREADY");
        initialized = true;
        defaultLockPeriod = _defaultLockPeriod;

        // modifiable
        require(_collectTo != address(0), "ZERO_ADDRESS");
        collectTo = _collectTo;  
        priceOracle = _priceOracle;     

        // non-modifiable
        moduleRegistry = _moduleRegistry;
        walletRegistry = _walletRegistry;
        quotaStore = _quotaStore;
        securityStore = _securityStore;
        whitelistStore = _whitelistStore;
        nonceStore = _nonceStore;
        dappAddressStore = _dappAddressStore;
        ensManager = _ensManager;
    }

    function setCollectTo(address _collectTo)
        external
        onlyOwner
    {
        require(_collectTo != address(0), "ZERO_ADDRESS");
        collectTo = _collectTo;
        emit ValueChanged("CollectTo", collectTo);
    }

    function setPriceOracle(PriceOracle _priceOracle)
        external
        onlyOwner
    {
        priceOracle = _priceOracle;
        emit ValueChanged("PriceOracle", address(priceOracle));
    }
}
