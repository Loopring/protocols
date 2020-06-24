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

import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";

import "../../iface/Wallet.sol";

import "../../modules/security/GuardianUtils.sol";

import "./SecurityModule.sol";

library MultiSigRequest {
    using SignatureUtil for bytes32;

    struct Request {
        address[] signers;
        bytes[]   signatures;
        uint      nonce;
        address   wallet;
    }


    function verifySignatures(Request memory request, bytes32 txHash)
        public
    {
        require(txHash.verifySignatures(request.signers, request.signatures), "INVALID_SIGNATURES");
    }

    function verifyPermission(
        Controller controller,
        Request memory request,
        GuardianUtils.SigRequirement sigRequirement)
        public
    {
        require(
            GuardianUtils.requireMajority(
                controller.securityStore(),
                request.wallet,
                request.signers,
                sigRequirement
            ),
            "PERMISSION_DENIED"
        );
    }
}
/// @title WhitelistModule
/// @dev Manages whitelisted addresses.
contract WhitelistModule is SecurityModule
{
    using MathUint      for uint;
    using SignatureUtil for bytes32;

    uint public delayPeriod;

    constructor(
        Controller  _controller,
        address     _trustedRelayer,
        uint        _delayPeriod
        )
        public
        SecurityModule(_controller, _trustedRelayer)
    {
        require(_delayPeriod > 0, "INVALID_DELAY");
        delayPeriod = _delayPeriod;
    }

    function addToWhitelist(
        address wallet,
        address addr
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromWallet(wallet)
    {
        controller.whitelistStore().addToWhitelist(wallet, addr, now.add(delayPeriod));
    }

    function addToWhitelistImmediately(
        MultiSigRequest.Request calldata request ,
        address         addr
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(request.wallet)
        // verifyPermissionAndUpdateNonce(signers, wallet,  GuardianUtils.SigRequirement.OwnerRequired)
    {
        bytes32 txhash; // TODO... nonce?
        MultiSigRequest.verifySignatures(request, txhash);

        // require(metaTxHash.verifySignatures(signers, signatures), "INVALID_SIGNATURES");


        controller.whitelistStore().addToWhitelist(request.wallet, addr, now);
    }

    function removeFromWhitelist(
        address wallet,
        address addr
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromWallet(wallet)
    {
        controller.whitelistStore().removeFromWhitelist(wallet, addr);
    }

    function getWhitelist(address wallet)
        public
        view
        returns (
            address[] memory addresses,
            uint[]    memory effectiveTimes
        )
    {
        return controller.whitelistStore().whitelist(wallet);
    }

    function isWhitelisted(
        address wallet,
        address addr)
        public
        view
        returns (
            bool isWhitelistedAndEffective,
            uint effectiveTime
        )
    {
        return controller.whitelistStore().isWhitelisted(wallet, addr);
    }
}
