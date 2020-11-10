// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/IPriceOracle.sol";
import "../iface/IStoreWriterManager.sol";
import "../lib/Claimable.sol";
import "../stores/HashStore.sol";
import "../stores/QuotaStore.sol";
import "../stores/SecurityStore.sol";
import "../stores/WhitelistStore.sol";
import "../thirdparty/ens/BaseENSManager.sol";


/// @title Controller
///
/// @author Daniel Wang - <daniel@loopring.org>
contract Controller
{
    address             public immutable walletFactory;
    address             public immutable feeCollector;
    IStoreWriterManager public immutable storeWriterManager;
    IPriceOracle        public immutable priceOracle;
    BaseENSManager      public immutable ensManager;
    HashStore           public immutable hashStore;
    QuotaStore          public immutable quotaStore;
    SecurityStore       public immutable securityStore;
    WhitelistStore      public immutable whitelistStore;

    constructor(
        address             _walletFactory,
        address             _feeCollector,
        IStoreWriterManager _storeWriterManager,
        IPriceOracle        _priceOracle,
        BaseENSManager      _ensManager,
        HashStore           _hashStore,
        QuotaStore          _quotaStore,
        SecurityStore       _securityStore,
        WhitelistStore      _whitelistStore
        )
    {
        walletFactory = _walletFactory;
        feeCollector = _feeCollector;
        storeWriterManager = _storeWriterManager;
        priceOracle = _priceOracle;
        ensManager = _ensManager;
        hashStore = _hashStore;
        quotaStore = _quotaStore;
        securityStore = _securityStore;
        whitelistStore = _whitelistStore;
    }
}
