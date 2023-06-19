// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;

import "../base/Controller.sol";
import "../iface/PriceOracle.sol";
import "../lib/Claimable.sol";
import "../stores/DappAddressStore.sol";
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
    constructor() public Claimable() {}
    bool private initialized;

    address                 public collectTo;
    uint                    public defaultLockPeriod;
    PriceOracle             public priceOracle;
    BaseENSManager        public ensManager;

    QuotaStore              public quotaStore;
    SecurityStore           public securityStore;
    DappAddressStore        public dappAddressStore;
    WhitelistStore          public whitelistStore;

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
        DappAddressStore  _dappAddressStore,
        BaseENSManager  _ensManager
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
        dappAddressStore = _dappAddressStore;
        ensManager = _ensManager;
    }

    function setCollectTo(address _collectTo)
        external
        onlyOwner
    {
        require(_collectTo != address(0), "ZERO_ADDRESS");
        collectTo = _collectTo;
        emit ValueChanged("CollectTo", _collectTo);
    }

    function setPriceOracle(PriceOracle _priceOracle)
        external
        onlyOwner
    {
        priceOracle = _priceOracle;
        emit ValueChanged("PriceOracle", address(priceOracle));
    }
}
