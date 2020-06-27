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
pragma solidity ^0.6.6;

import "../base/Controller.sol";
import "../base/WalletENSManager.sol";
import "../iface/PriceOracle.sol";
import "../stores/DappAddressStore.sol";
import "../stores/QuotaStore.sol";
import "../stores/SecurityStore.sol";
import "../stores/WhitelistStore.sol";

/// @title ControllerV1
///
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract ControllerV1 is Controller
{
    address public collectTo;
    uint    public defaultLockPeriod;
    PriceOracle             public priceOracle;
    WalletENSManager        public ensManager;

    QuotaStore              public quotaStore;
    SecurityStore           public securityStore;
    DappAddressStore        public dappAddressStore;
    WhitelistStore          public whitelistStore;
}
