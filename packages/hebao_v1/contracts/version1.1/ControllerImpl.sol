// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;

import "../base/Controller.sol";
import "../iface/PriceOracle.sol";
import "../lib/Claimable.sol";
import "../stores/DappAddressStore.sol";
import "../stores/HashStore.sol";
import "../stores/NonceStore.sol";
import "../stores/QuotaStore.sol";
import "../stores/SecurityStore.sol";
import "../stores/WhitelistStore.sol";


/// @title ControllerImpl
/// @dev Basic implementation of a Controller.
///
/// @author Daniel Wang - <daniel@loopring.org>
contract ControllerImpl is Claimable, Controller
{
    address             public collectTo;
    uint                public defaultLockPeriod;
    uint                public minActiveGuardians;
    address             public ensManagerAddress;
    PriceOracle         public priceOracle;
    DappAddressStore    public dappAddressStore;
    HashStore           public hashStore;
    NonceStore          public nonceStore;
    QuotaStore          public quotaStore;
    SecurityStore       public securityStore;
    WhitelistStore      public whitelistStore;


    event ValueChanged  (string  indexed name, uint value);
    event AddressChanged(string  indexed name, address addr);

    constructor(
        ModuleRegistry    _moduleRegistry,
        WalletRegistry    _walletRegistry,
        uint              _defaultLockPeriod,
        address           _collectTo,
        uint              _minActiveGuardians,
        address           _ensManagerAddress,
        PriceOracle       _priceOracle,
        DappAddressStore  _dappAddressStore,
        HashStore         _hashStore,
        NonceStore        _nonceStore,
        QuotaStore        _quotaStore,
        SecurityStore     _securityStore,
        WhitelistStore    _whitelistStore
        )
        public
    {
        moduleRegistry = _moduleRegistry;
        walletRegistry = _walletRegistry;

        defaultLockPeriod = _defaultLockPeriod;

        require(_collectTo != address(0), "ZERO_ADDRESS");
        collectTo = _collectTo;

        require(
            _minActiveGuardians == 1 || _minActiveGuardians == 2,
            "INVALID_MIN_GUARDIAN"
        );
        minActiveGuardians = _minActiveGuardians;

        ensManagerAddress = _ensManagerAddress;
        priceOracle = _priceOracle;
        dappAddressStore = _dappAddressStore;
        hashStore = _hashStore;
        nonceStore = _nonceStore;
        quotaStore = _quotaStore;
        securityStore = _securityStore;
        whitelistStore = _whitelistStore;
    }

    function setCollectTo(address _collectTo)
        external
        onlyOwner
    {
        require(
            _collectTo != address(0) && _collectTo != collectTo,
            "INVALID_COLLECT_TO_ADDRESS"
        );
        collectTo = _collectTo;
        emit AddressChanged("CollectTo", _collectTo);
    }

    function setPriceOracle(PriceOracle _priceOracle)
        external
        onlyOwner
    {
        require(_priceOracle != priceOracle, "INVALID_PRICE_ORACLE");
        priceOracle = _priceOracle;
        emit AddressChanged("PriceOracle", address(_priceOracle));
    }

    function setWalletFactory(address _walletFactory)
        external
        onlyOwner
    {
        require(
            _walletFactory != address(0) && _walletFactory != walletFactory,
            "INVALID_WALLET_FACTORY"
        );
        walletFactory = _walletFactory;
        emit AddressChanged("WalletFactory", _walletFactory);
    }

    function setMinActiveGuardian(uint _minActiveGuardians)
        external
        onlyOwner
    {
        require(
            (_minActiveGuardians == 1 || _minActiveGuardians == 2) &&
            _minActiveGuardians != minActiveGuardians,
            "INVALID_MIN_ACTIVE_GUARDIANS"
        );
        minActiveGuardians = _minActiveGuardians;
        emit ValueChanged("MinActiveGuardian", _minActiveGuardians);
    }
}
