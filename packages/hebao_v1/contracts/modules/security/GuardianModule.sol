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

import "../../lib/MathUint.sol";

import "../../thirdparty/ERC1271.sol";

import "../../iface/Wallet.sol";

import "./SecurityModule.sol";


/// @title GuardianModule
contract GuardianModule is SecurityModule
{
    uint constant public MAX_GUARDIANS = 20;
    uint public pendingPeriod;

    event GuardianAdded             (address indexed wallet, address indexed guardian, uint group, uint effectiveTime);
    event GuardianAdditionCancelled (address indexed wallet, address indexed guardian);
    event GuardianRemoved           (address indexed wallet, address indexed guardian, uint removalEffectiveTime);
    event GuardianRemovalCancelled  (address indexed wallet, address indexed guardian);

    constructor(
        Controller _controller,
        uint       _pendingPeriod
        )
        public
        SecurityModule(_controller)
    {
        require(_pendingPeriod > 0, "INVALID_DELAY");
        pendingPeriod = _pendingPeriod;
    }

    function addGuardian(
        address wallet,
        address guardian,
        uint    group
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        notWalletOwner(wallet, guardian)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        require(guardian != address(0), "ZERO_ADDRESS");
        require(group < GuardianUtils.MAX_NUM_GROUPS(), "INVALID_GROUP");
        uint effectiveTime = now;
        if (controller.securityStore().numGuardians(wallet) > 0) {
            effectiveTime = now + pendingPeriod;
        }
        controller.securityStore().addOrUpdateGuardian(wallet, guardian, group, effectiveTime);
        emit GuardianAdded(wallet, guardian, group, effectiveTime);
    }

    function cancelGuardianAddition(
        address wallet,
        address guardian
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        controller.securityStore().cancelGuardianAddition(wallet, guardian);
        emit GuardianAdditionCancelled(wallet, guardian);
    }

    function removeGuardian(
        address wallet,
        address guardian
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyWalletGuardian(wallet, guardian)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        controller.securityStore().removeGuardian(wallet, guardian, now + pendingPeriod);
        emit GuardianRemoved(wallet, guardian, now + pendingPeriod);
    }

    function cancelGuardianRemoval(
        address wallet,
        address guardian
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        controller.securityStore().cancelGuardianRemoval(wallet, guardian);
        emit GuardianRemovalCancelled(wallet, guardian);
    }

    function extractMetaTxSigners(
        address wallet,
        bytes4  method,
        bytes   memory
        )
        internal
        view
        override
        returns (address[] memory signers)
    {
        if (method == this.addGuardian.selector ||
            method == this.removeGuardian.selector ||
            method == this.cancelGuardianAddition.selector ||
            method == this.cancelGuardianRemoval.selector) {
            signers = new address[](1);
            signers[0] = Wallet(wallet).owner();
        } else {
            revert("INVALID_METHOD");
        }
    }
}
