// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../base/Controller.sol";
import "../iface/PriceOracle.sol";
import "../lib/Claimable.sol";
import "../stores/HashStore.sol";
import "../stores/QuotaStore.sol";
import "../stores/SecurityStore.sol";
import "../stores/WhitelistStore.sol";
import "../thirdparty/ens/BaseENSManager.sol";


/// @title ControllerImpl
/// @dev Basic implementation of a Controller.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract ControllerImpl is Claimable, Controller
{
    HashStore           public immutable hashStore;
    QuotaStore          public immutable quotaStore;
    SecurityStore       public immutable securityStore;
    WhitelistStore      public immutable whitelistStore;
    ModuleRegistry      public immutable override moduleRegistry;
    address             public override  walletFactory;
    address             public immutable feeCollector;
    BaseENSManager      public immutable ensManager;
    PriceOracle         public immutable priceOracle;

    event AddressChanged(
        string   name,
        address  addr
    );

    constructor(
        HashStore         _hashStore,
        QuotaStore        _quotaStore,
        SecurityStore     _securityStore,
        WhitelistStore    _whitelistStore,
        ModuleRegistry    _moduleRegistry,
        address           _feeCollector,
        BaseENSManager    _ensManager,
        PriceOracle       _priceOracle
        )
    {
        hashStore = _hashStore;
        quotaStore = _quotaStore;
        securityStore = _securityStore;
        whitelistStore = _whitelistStore;
        moduleRegistry = _moduleRegistry;

        require(_feeCollector != address(0), "ZERO_ADDRESS");
        feeCollector = _feeCollector;

        ensManager = _ensManager;
        priceOracle = _priceOracle;
    }

    function initWalletFactory(address _walletFactory)
        external
        onlyOwner
    {
        require(walletFactory == address(0), "INITIALIZED_ALREADY");
        require(_walletFactory != address(0), "ZERO_ADDRESS");
        walletFactory = _walletFactory;
        emit AddressChanged("WalletFactory", _walletFactory);
    }
}
