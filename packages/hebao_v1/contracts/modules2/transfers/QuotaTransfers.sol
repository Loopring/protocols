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
    bytes32 public constant CHANGE_DAILY_QUOTE_IMMEDIATELY_HASHTYPE = keccak256(
        "changeDailyQuotaImmediately(Request request,uint256 newQuota)Request(address[] signers,bytes[] signatures,uint256 nonce,address wallet)"
    );

    uint public delayPeriod;

    constructor(
        Controller  _controller,
        address     _trustedRelayer,
        uint        _delayPeriod
        )
        public
        TransferModule(_controller, _trustedRelayer)
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
        onlyFromWallet(wallet)
    {
        controller.quotaStore().changeQuota(wallet, newQuota, now.add(delayPeriod));
    }

    function changeDailyQuotaImmediately(
        SignedRequest.Request calldata request,
        uint newQuota
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(request.wallet)
    {
        controller.verifyRequest(
            DOMAIN_SEPERATOR,
            GuardianUtils.SigRequirement.OwnerRequired,
            request,
            abi.encode(
                CHANGE_DAILY_QUOTE_IMMEDIATELY_HASHTYPE,
                SignedRequest.hash(request),
                newQuota
            )
        );

        controller.quotaStore().changeQuota(request.wallet, newQuota, now);
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
        onlyFromWallet(wallet)
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
        onlyFromWallet(wallet)
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
        onlyFromWallet(wallet)
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
        onlyFromWallet(wallet)
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
        require(controller.priceOracle().tokenValue(to, 1e18) == 0, "CALL_DISALLOWED");
        return super.callContractInternal(wallet, to, value, txData);
    }
}
