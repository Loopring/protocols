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
pragma solidity ^0.5.13;
pragma experimental ABIEncoderV2;

import "../../iface/Wallet.sol";

import "./SecurityModule.sol";
import "./GuardianUtils.sol";


/// @title QuotaModule
/// @dev Manages transfer quota.
contract QuotaModule is SecurityModule, QuotaManager
{
    uint public delayPeriod;

    modifier onlySufficientSigners(address wallet, address[] memory signers) {
        GuardianUtils.requireSufficientSigners(
            securityStore,
            wallet,
            signers,
            GuardianUtils.SigRequirement.OwnerRequired
        );
        _;
    }

    constructor(
        Controller _controller,
        uint       _delayPeriod
        )
        public
        SecurityModule(_controller)
    {
        delayPeriod = _delayPeriod;
    }

    function changeDailyQuota(
        address wallet,
        uint    newQuota
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        controller.quotaStore().changeQuota(wallet, newQuota, now.add(delayPeriod));
    }

    function changeDailyQuotaImmediately(
        address            wallet,
        address[] calldata signers,
        uint               newQuota
        )
        external
        nonReentrant
        onlySufficientSigners(wallet, signers)
        onlyWhenWalletUnlocked(wallet)
    {
        controller.quotaStore().changeQuota(wallet, newQuota, now);
    }

    function getDailyQuota(address wallet)
        public
        view
        returns (
            uint total,
            uint spent,
            uint available
        )
    {
        total = controller.quotaStore().currentQuota(wallet);
        spent = controller.quotaStore().spentQuota(wallet);
        available = controller.quotaStore().availableQuota(wallet);
    }

    function boundMethods()
        public
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](1);
        methods[0] = this.getDailyQuota.selector;
    }

    function extractMetaTxSigners(
        address wallet,
        bytes4  method,
        bytes   memory data
        )
        internal
        view
        returns (address[] memory signers)
    {
        if (method == this.changeDailyQuota.selector) {
            signers = new address[](1);
            signers[0] = Wallet(wallet).owner();
        } else if(method == this.changeDailyQuotaImmediately.selector) {
            return extractAddressesFromCallData(data, 1);
        } else {
            revert("INVALID_METHOD");
        }
    }
}
