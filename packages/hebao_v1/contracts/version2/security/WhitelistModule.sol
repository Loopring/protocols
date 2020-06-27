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

import "../../iface/Wallet.sol";
import "../../lib/EIP712.sol";
import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";
import "../../version1/security/GuardianUtils.sol";
import "../core/SignedRequest.sol";
import "./SecurityModule.sol";


/// @title WhitelistModule
/// @dev Manages whitelisted addresses.
contract WhitelistModule is SecurityModule
{
    using MathUint      for uint;
    using SignatureUtil for bytes32;

    bytes32 public constant ADD_TO_WHITELIST_IMMEDIATELY_HASHTYPE = keccak256(
        "addToWhitelistImmediately(address wallet,uint256 nonce,address addr)"
    );

    uint public delayPeriod;

    constructor(
        ControllerV2 _controller,
        address      _trustedForwarder,
        uint         _delayPeriod
        )
        public
        SecurityModule(_controller, _trustedForwarder)
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
        SignedRequest.Request calldata request,
        address addr
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
                ADD_TO_WHITELIST_IMMEDIATELY_HASHTYPE,
                request.wallet,
                request.nonce,
                addr
            )
        );
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
