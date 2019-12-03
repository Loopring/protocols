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
pragma experimental ABIEncoderV2;

import "../../iface/Wallet.sol";

import "./SecurityModule.sol";


/// @title QuotaModule
/// @dev Manages transfer quota.
contract QuotaModule is SecurityModule, QuotaManager
{
    constructor(Controller _controller)
        public
        SecurityModule(_controller)
    {
    }

    function checkAndAddToSpent(
        address wallet,
        address token,
        uint    amount
        )
        external
    {
        uint value = controller.priceOracle().tokenPrice(token, amount);
        controller.quotaStore().checkAndAddToSpent(wallet, value);
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
        controller.quotaStore().changeQuota(wallet, newQuota);
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
        bytes   memory  /* data */
        )
        internal
        view
        returns (address[] memory signers)
    {
        require (
            method == this.changeDailyQuota.selector,
            "INVALID_METHOD"
        );

        signers = new address[](1);
        signers[0] = Wallet(wallet).owner();
    }
}
