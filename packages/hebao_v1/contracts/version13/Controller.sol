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
    address             public walletFactory;
    address             public immutable feeCollector;
    IPriceOracle        public immutable priceOracle;
    BaseENSManager      public immutable ensManager;
    HashStore           public immutable hashStore;
    QuotaStore          public immutable quotaStore;
    SecurityStore       public immutable securityStore;
    WhitelistStore      public immutable whitelistStore;

    event AddressChanged(string name, address addr);

    constructor(
        address           _feeCollector,
        IPriceOracle      _priceOracle,
        BaseENSManager    _ensManager,
        HashStore         _hashStore,
        QuotaStore        _quotaStore,
        SecurityStore     _securityStore,
        WhitelistStore    _whitelistStore
        )
    {
        feeCollector = _feeCollector;
        priceOracle = _priceOracle;
        ensManager = _ensManager;
        hashStore = _hashStore;
        quotaStore = _quotaStore;
        securityStore = _securityStore;
        whitelistStore = _whitelistStore;
    }

    function initWalletFactory(address _walletFactory)
        external
        onlyOwner
    {
        require(walletFactory == address(0), "INITIALIZED_ALREADY");
        require(_walletFactory != address(0), "ZERO_ADDRESS");
        walletFactory = _walletFactory;
        emit AddressChanged("WalletFactory", walletFactory);
    }
}
