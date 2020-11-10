// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../iface/IPriceOracle.sol";
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
contract Controller is Claimable
{
    address             public immutable walletFactory;
    address             public immutable feeCollector;
    BaseENSManager      public immutable ensManager;
    HashStore           public immutable hashStore;
    QuotaStore          public immutable quotaStore;
    SecurityStore       public immutable securityStore;
    WhitelistStore      public immutable whitelistStore;
    IPriceOracle        public priceOracle;

    event AddressChanged(
        string   name,
        address  addr
    );

    constructor(
        address           _walletFactory,
        address           _feeCollector,
        BaseENSManager    _ensManager,
        HashStore         _hashStore,
        QuotaStore        _quotaStore,
        SecurityStore     _securityStore,
        WhitelistStore    _whitelistStore,
        IPriceOracle      _priceOracle
        )
    {
        walletFactory = _walletFactory;
        feeCollector = _feeCollector;
        ensManager = _ensManager;
        hashStore = _hashStore;
        quotaStore = _quotaStore;
        securityStore = _securityStore;
        whitelistStore = _whitelistStore;
        priceOracle = _priceOracle;
    }

    function setPriceOracle(IPriceOracle _priceOracle)
        external
        onlyOwner
    {
        priceOracle = _priceOracle;
        emit AddressChanged("IPriceOracle", address(priceOracle));
    }
}
