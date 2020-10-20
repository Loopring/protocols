// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../base/Controller.sol";
import "../iface/PriceOracle.sol";
import "../lib/Claimable.sol";
import "../stores/DappAddressStore.sol";
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
    address             public collectTo;
    uint                public defaultLockPeriod;
    BaseENSManager      public ensManager;
    PriceOracle         public priceOracle;
    DappAddressStore    public dappAddressStore;
    HashStore           public hashStore;
    QuotaStore          public quotaStore;
    SecurityStore       public securityStore;
    WhitelistStore      public whitelistStore;

    // Make sure this value if false in production env.
    // Ideally we can use chainid(), but there is a bug in truffle so testing is buggy:
    // https://github.com/trufflesuite/ganache/issues/1643
    bool                public allowChangingWalletFactory;

    event AddressChanged(
        string   name,
        address  addr
    );

    constructor(
        ModuleRegistry    _moduleRegistry,
        WalletRegistry    _walletRegistry,
        uint              _defaultLockPeriod,
        address           _collectTo,
        BaseENSManager    _ensManager,
        PriceOracle       _priceOracle,
        bool              _allowChangingWalletFactory
        )
    {
        moduleRegistry = _moduleRegistry;
        walletRegistry = _walletRegistry;

        defaultLockPeriod = _defaultLockPeriod;

        require(_collectTo != address(0), "ZERO_ADDRESS");
        collectTo = _collectTo;

        ensManager = _ensManager;
        priceOracle = _priceOracle;
        allowChangingWalletFactory = _allowChangingWalletFactory;
    }

    function initStores(
        DappAddressStore  _dappAddressStore,
        HashStore         _hashStore,
        QuotaStore        _quotaStore,
        SecurityStore     _securityStore,
        WhitelistStore    _whitelistStore
        )
        external
        onlyOwner
    {
        require(
            address(_dappAddressStore) != address(0),
            "ZERO_ADDRESS"
        );

        // Make sure this function can only invoked once.
        require(
            address(dappAddressStore) == address(0),
            "INITIALIZED_ALREADY"
        );

        dappAddressStore = _dappAddressStore;
        hashStore = _hashStore;
        quotaStore = _quotaStore;
        securityStore = _securityStore;
        whitelistStore = _whitelistStore;
    }

    function initWalletFactory(address _walletFactory)
        external
        onlyOwner
    {
        require(
            allowChangingWalletFactory || walletFactory == address(0),
            "INITIALIZED_ALREADY"
        );
        require(_walletFactory != address(0), "ZERO_ADDRESS");
        walletFactory = _walletFactory;
        emit AddressChanged("WalletFactory", walletFactory);
    }

    function setCollectTo(address _collectTo)
        external
        onlyOwner
    {
        require(_collectTo != address(0), "ZERO_ADDRESS");
        collectTo = _collectTo;
        emit AddressChanged("CollectTo", collectTo);
    }

    function setPriceOracle(PriceOracle _priceOracle)
        external
        onlyOwner
    {
        priceOracle = _priceOracle;
        emit AddressChanged("PriceOracle", address(priceOracle));
    }

}
