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
    uint public confirmPeriod;

    mapping (address => mapping(address => mapping(uint => uint))) public pendingAdditions;
    mapping (address => mapping(address => uint)) public pendingRemovals;

    event GuardianAdditionPending   (address indexed wallet, address indexed guardian, uint group, uint confirmAfter);
    event GuardianAdded             (address indexed wallet, address indexed guardian, uint group);
    event GuardianAdditionCancelled (address indexed wallet, address indexed guardian);

    event GuardianRemovalPending    (address indexed wallet, address indexed guardian, uint confirmAfter);
    event GuardianRemoved           (address indexed wallet, address indexed guardian);
    event GuardianRemovalCancelled  (address indexed wallet, address indexed guardian);

    constructor(
        Controller _controller,
        uint       _pendingPeriod,
        uint       _confirmPeriod
        )
        public
        SecurityModule(_controller)
    {
        require(_pendingPeriod > 0 && _confirmPeriod > 0, "INVALID_DELAY");
        pendingPeriod = _pendingPeriod;
        confirmPeriod = _confirmPeriod;
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

        if (controller.securityStore().numGuardians(wallet) == 0) {
            controller.securityStore().addOrUpdateGuardian(wallet, guardian, group);
            emit GuardianAdded(wallet, guardian, group);
        } else {
            uint confirmStart = pendingAdditions[wallet][guardian][group];
            require(confirmStart == 0 || now > confirmStart + confirmPeriod, "ALREADY_PENDING");
            pendingAdditions[wallet][guardian][group] = now + pendingPeriod;
            emit GuardianAdditionPending(wallet, guardian, group, now + pendingPeriod);
        }
    }

    function confirmGuardianAddition(
        address wallet,
        address guardian,
        uint    group
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
    {
        uint confirmStart = pendingAdditions[wallet][guardian][group];
        require(confirmStart != 0, "NOT_PENDING");
        require(now >= confirmStart && now < confirmStart + confirmPeriod, "TOO_EARLY_OR_EXPIRED");
        controller.securityStore().addOrUpdateGuardian(wallet, guardian, group);

        // Now check if we don't have too many guardians active at once
        uint count = controller.securityStore().numGuardians(wallet);
        require(count <= MAX_GUARDIANS, "TOO_MANY_GUARDIANS");

        delete pendingAdditions[wallet][guardian][group];
        emit GuardianAdded(wallet, guardian, group);
    }

    function cancelGuardianAddition(
        address wallet,
        address guardian,
        uint    group
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        uint confirmStart = pendingAdditions[wallet][guardian][group];
        require(confirmStart > 0, "INVALID_GUARDIAN");
        delete pendingAdditions[wallet][guardian][group];
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
        uint confirmStart = pendingRemovals[wallet][guardian];
        require(confirmStart == 0 || now > confirmStart + confirmPeriod, "ALREADY_PENDING");
        pendingRemovals[wallet][guardian] = now + pendingPeriod;
        emit GuardianRemovalPending(wallet, guardian, now + pendingPeriod);
    }

    function confirmGuardianRemoval(
        address wallet,
        address guardian
        )
        external
        nonReentrant
        onlyWhenWalletUnlocked(wallet)
    {
        uint confirmStart = pendingRemovals[wallet][guardian];
        require(confirmStart != 0, "NOT_PENDING");
        require(now >= confirmStart && now < confirmStart + confirmPeriod, "TOO_EARLY_OR_EXPIRED");
        controller.securityStore().removeGuardian(wallet, guardian);
        delete pendingRemovals[wallet][guardian];
        emit GuardianRemoved(wallet, guardian);
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
        uint confirmStart = pendingRemovals[wallet][guardian];
        require(confirmStart > 0, "INVALID_GUARDIAN");
        delete pendingRemovals[wallet][guardian];
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
            method == this.cancelGuardianRemoval.selector ||
            method == this.confirmGuardianAddition.selector ||
            method == this.confirmGuardianRemoval.selector) {
            signers = new address[](1);
            signers[0] = Wallet(wallet).owner();
        } else {
            revert("INVALID_METHOD");
        }
    }
}
