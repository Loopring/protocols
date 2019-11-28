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

// import "../../lib/Claimable.sol";
// import "../../lib/ERC20.sol";

// import "../../iface/PriceOracle.sol";
// import "../../iface/Wallet.sol";

// import "../stores/PriceCacheStore.sol";
// import "../stores/QuotaStore.sol";
// import "../stores/WhitelistStore.sol";

// import "./TransferModule.sol";


/// @title QuotaModule
contract QuotaModule// is Claimable, TransferModule
{
    // QuotaStore      public quotaStore;

    // event Quota  (address indexed wallet, bytes32 indexed txid, uint timestamp);
    // event PendingTxExecuted  (address indexed wallet, bytes32 indexed txid, uint timestamp);
    // event PriceOracleUpdated (address indexed priceOracle);

    // constructor(
    //     SecurityStore   _securityStore,
    //     QuotaStore      _quotaStore,
    //     )
    //     public
    //     Claimable()
    //     TransferModule(_securityStore)
    // {
    //     priceOracle = _priceOracle;
    //     priceCacheStore = _priceCacheStore;
    //     quotaStore = _quotaStore;
    //     whitelistStore = _whitelistStore;
    //     pendingExpiry = _pendingExpiry;
    // }

    // function staticMethods()
    //     public
    //     pure
    //     returns (bytes4[] memory methods)
    // {
    //     methods = new bytes4[](0);
    // }


    // function extractMetaTxSigners(
    //     address       /* wallet */,
    //     bytes4        /* method */,
    //     bytes memory  /* data */
    //     )
    //     internal
    //     view
    //     returns (address[] memory)
    // {
    //     revert("UNSUPPORTED");
    // }
}
