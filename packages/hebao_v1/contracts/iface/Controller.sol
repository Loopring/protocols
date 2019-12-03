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

import "./ModuleRegistry.sol";
import "./RelayerRegistry.sol";
import "./WalletRegistry.sol";

import "../stores/PriceCacheStore.sol";
import "../stores/QuotaStore.sol";
import "../stores/SecurityStore.sol";
import "../stores/WhitelistStore.sol";

import "../iface/PriceOracle.sol";

import "../base/WalletENSManager.sol";

/// @title Controller
///
/// @author Daniel Wang - <daniel@loopring.org>
contract Controller
{
    ModuleRegistry   public moduleRegistry;
    RelayerRegistry  public relayerRegistry;
    WalletRegistry   public walletRegistry;

    PriceCacheStore  public priceCacheStore;
    QuotaStore       public quotaStore;
    SecurityStore    public securityStore;
    WhitelistStore   public whitelistStore;

    PriceOracle      public priceOracle;
    WalletENSManager public ensManager;
}
