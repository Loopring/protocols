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
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../../iface/Wallet.sol";

import "./SecurityModule.sol";
import "./GuardianUtils.sol";


/// @title QuotaModule
/// @dev Manages transfer quota.
contract QuotaModule is SecurityModule
{
    uint public delayPeriod;

    constructor(
        Controller _controller,
        uint       _delayPeriod
        )
        public
        SecurityModule(_controller)
    {
        require(_delayPeriod > 0, "INVALID_DELAY");
        delayPeriod = _delayPeriod;
    }

    function changeDailyQuota(
        address wallet,
        uint    newQuota
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        controller.quotaStore().changeQuota(wallet, newQuota, now.add(delayPeriod));
    }

    function changeDailyQuotaImmediately(
        address            wallet,
        uint               newQuota
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTx
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
        override
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](1);
        methods[0] = this.getDailyQuota.selector;
    }

    function extractMetaTxSigners(
        address   wallet,
        bytes4    method,
        bytes     memory /*data*/,
        address[] memory txSigners
        )
        internal
        view
        override
        returns (address[] memory signers)
    {
        if (method == this.changeDailyQuota.selector) {
            signers = new address[](1);
            signers[0] = Wallet(wallet).owner();
        } else if(method == this.changeDailyQuotaImmediately.selector) {
            return txSigners;
        } else {
            revert("INVALID_METHOD");
        }
    }

    function areMetaTxSignersAuthorized(
        address   wallet,
        bytes     memory data,
        address[] memory signers
        )
        internal
        view
        override
        returns (bool)
    {
        // First validate that all signers are the owner or a guardian
        if (!super.areMetaTxSignersAuthorized(wallet, data, signers)) {
            return false;
        }

        bytes4 method = extractMethod(data);
        if(method == this.changeDailyQuotaImmediately.selector) {
            GuardianUtils.requireMajority(
                controller.securityStore(),
                wallet,
                signers,
                GuardianUtils.SigRequirement.OwnerRequired
            );
        }
    }
}
