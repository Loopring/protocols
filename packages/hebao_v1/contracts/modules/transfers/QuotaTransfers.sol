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
pragma experimental ABIEncoderV2;

import "../../lib/Claimable.sol";
import "../../lib/ERC20.sol";

import "../../iface/PriceOracle.sol";
import "../../iface/Wallet.sol";

import "./TransferModule.sol";

/// @title QuotaTransfers
contract QuotaTransfers is TransferModule
{
    constructor(
        Controller  _controller
        )
        public
        TransferModule(_controller)
    {
    }

    function transferToken(
        address        wallet,
        address        token,
        address        to,
        uint           amount,
        bytes calldata logdata
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        (bool whitelisted,) = controller.whitelistStore().isWhitelisted(wallet, to);
        if (!whitelisted) {
            updateQuota(wallet, token, amount);
        }

        transferInternal(wallet, token, to, amount, logdata);
    }

    function callContract(
        address            wallet,
        address            to,
        uint               value,
        bytes     calldata data
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
        returns (bytes memory returnData)
    {
        (bool whitelisted,) = controller.whitelistStore().isWhitelisted(wallet, to);
        if (!whitelisted) {
            updateQuota(wallet, address(0), value);
        }

        return callContractInternal(wallet, to, value, data);
    }

    function approveToken(
        address            wallet,
        address            token,
        address            to,
        uint               amount
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        uint additionalAllowance = approveInternal(wallet, token, to, amount);
        (bool whitelisted,) = controller.whitelistStore().isWhitelisted(wallet, to);

        if (!whitelisted) {
            updateQuota(wallet, token, additionalAllowance);
        }
    }

    function approveThenCallContract(
        address            wallet,
        address            token,
        address            to,
        uint               amount,
        uint               value,
        bytes     calldata data
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
        returns (bytes memory returnData)
    {
        uint additionalAllowance = approveInternal(wallet, token, to, amount);
        (bool whitelisted,) = controller.whitelistStore().isWhitelisted(wallet, to);
        
        if (!whitelisted) {
            updateQuota(wallet, token, additionalAllowance);
            updateQuota(wallet, address(0), value);
        }

        return callContractInternal(wallet, to, value, data);
    }

    function verifySigners(
        address   wallet,
        bytes4    method,
        bytes     memory /*data*/,
        address[] memory signers
        )
        internal
        view
        override
        returns (bool)
    {
        require (
            method == this.transferToken.selector ||
            method == this.approveToken.selector ||
            method == this.callContract.selector ||
            method == this.approveThenCallContract.selector,
            "INVALID_METHOD"
        );
        return isOnlySigner(Wallet(wallet).owner(), signers);
    }

    function callContractInternal(
        address wallet,
        address to,
        uint    value,
        bytes   memory txData
        )
        internal
        override
        returns (bytes memory returnData)
    {
        // Disallow general calls to token contracts (for tokens that have price data
        // so the quota is actually used).
        require(controller.priceOracle().tokenPrice(to, 1e18) == 0, "CALL_DISALLOWED");
        return super.callContractInternal(wallet, to, value, txData);
    }
}
