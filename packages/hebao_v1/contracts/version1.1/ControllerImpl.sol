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
    address             public ensManagerAddress;
    PriceOracle         public priceOracle;
    DappAddressStore    public dappAddressStore;
    HashStore           public hashStore;
    NonceStore          public nonceStore;
    QuotaStore          public quotaStore;
    SecurityStore       public securityStore;
    WhitelistStore      public whitelistStore;

    // Make sure this value if false in production env.
    bool                public allowChangingWalletFactory;

    event ValueChanged(
        string  indexed name,
        address indexed addr
    );

    constructor(
        ModuleRegistry    _moduleRegistry,
        WalletRegistry    _walletRegistry,
        uint              _defaultLockPeriod,
        address           _collectTo,
        address           _ensManagerAddress,
        PriceOracle       _priceOracle,
        DappAddressStore  _dappAddressStore,
        HashStore         _hashStore,
        NonceStore        _nonceStore,
        QuotaStore        _quotaStore,
        SecurityStore     _securityStore,
        WhitelistStore    _whitelistStore,
        bool              _allowChangingWalletFactory
        )
        public
    {
        moduleRegistry = _moduleRegistry;
        walletRegistry = _walletRegistry;

        defaultLockPeriod = _defaultLockPeriod;

        require(_collectTo != address(0), "ZERO_ADDRESS");
        collectTo = _collectTo;

        ensManagerAddress = _ensManagerAddress;
        priceOracle = _priceOracle;
        dappAddressStore = _dappAddressStore;
        hashStore = _hashStore;
        nonceStore = _nonceStore;
        quotaStore = _quotaStore;
        securityStore = _securityStore;
        whitelistStore = _whitelistStore;
        allowChangingWalletFactory = _allowChangingWalletFactory;
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
        emit ValueChanged("WalletFactory", walletFactory);
    }
}
