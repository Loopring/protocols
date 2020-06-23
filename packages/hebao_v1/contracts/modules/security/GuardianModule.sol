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

import "../../thirdparty/ERC1271.sol";

import "../../iface/Wallet.sol";

import "./SecurityModule.sol";


/// @title GuardianModule
contract GuardianModule is SecurityModule
{
    using SignatureUtil for bytes32;
    using AddressUtil   for address;

    uint constant public MAX_GUARDIANS = 20;
    uint public pendingPeriod;

    event GuardianAdded             (address indexed wallet, address indexed guardian, uint group, uint effectiveTime);
    event GuardianAdditionCancelled (address indexed wallet, address indexed guardian);
    event GuardianRemoved           (address indexed wallet, address indexed guardian, uint removalEffectiveTime);
    event GuardianRemovalCancelled  (address indexed wallet, address indexed guardian);

    event Recovered(
        address indexed wallet,
        address indexed oldOwner,
        address indexed newOwner,
        bool            removedAsGuardian
    );

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
        require(group < GuardianUtils.MAX_NUM_GROUPS, "INVALID_GROUP");
        uint numGuardians = controller.securityStore().numGuardiansWithPending(wallet);
        require(numGuardians < MAX_GUARDIANS, "TOO_MANY_GUARDIANS");

        uint effectiveTime = now;
        if (numGuardians >= MIN_ACTIVE_GUARDIANS) {
            effectiveTime = now + pendingPeriod;
        }
        controller.securityStore().addGuardian(wallet, guardian, group, effectiveTime);
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

    function lock(
        address wallet,
        address guardian
        )
        external
        nonReentrant
        // onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOr(guardian)
        onlyWalletGuardian(wallet, guardian)
        onlyHaveEnoughGuardians(wallet)
    {
        lockWallet(wallet);
    }

    function unlock(
        address wallet,
        address guardian
        )
        external
        nonReentrant
        // onlyWhenWalletLocked(wallet)
        onlyFromMetaTxOr(guardian)
        onlyWalletGuardian(wallet, guardian)
    {
        unlockWallet(wallet, false);
    }

    /// @dev Recover a wallet by setting a new owner.
    /// @param wallet The wallet for which the recovery shall be cancelled.
    /// @param newOwner The new owner address to set.
    ///        The addresses must be sorted ascendently.
    function recover(
        address            wallet,
        address            newOwner
        )
        external
        nonReentrant
        notWalletOwner(wallet, newOwner)
        onlyFromMetaTx
        onlyHaveEnoughGuardians(wallet)
    {
        Wallet w = Wallet(wallet);
        address oldOwner = w.owner();
        require(newOwner != oldOwner, "SAME_ADDRESS");
        require(newOwner != address(0), "ZERO_ADDRESS");

        SecurityStore securityStore = controller.securityStore();
        bool removedAsGuardian = securityStore.isGuardianOrPendingAddition(wallet, newOwner);

        if (removedAsGuardian) {
           securityStore.removeGuardian(wallet, newOwner, now);
        }

        w.setOwner(newOwner);
        unlockWallet(wallet, true /*force*/);

        emit Recovered(wallet, oldOwner, newOwner, removedAsGuardian);
    }

    function getLock(address wallet)
        public
        view
        returns (uint _lock, address _lockedBy)
    {
        return getWalletLock(wallet);
    }

    function isLocked(address wallet)
        public
        view
        returns (bool)
    {
        return isWalletLocked(wallet);
    }

    function extractWalletAddresses(bytes memory data)
        internal
        view
        virtual
        returns (address msgSender, address wallet)
    {
        bytes4 method = extractMethod(data);

        if (method == this.lock.selector ||
            method == this.unlock.selector) {
            msgSender = extractAddressFromCallData(data, 1);
            wallet = extractAddressFromCallData(data, 0);
        } else {
            return super.extractWalletAddresses(data);
        }
    }
    function verifySigners(
        address   wallet,
        bytes4    method,
        bytes     memory data,
        address[] memory signers
        )
        internal
        view
        override
        returns (bool)
    {
        if (method == this.addGuardian.selector ||
            method == this.removeGuardian.selector ||
            method == this.cancelGuardianAddition.selector ||
            method == this.cancelGuardianRemoval.selector) {
            return isOnlySigner(Wallet(wallet).owner(), signers);
        } else if (method == this.lock.selector ||
            method == this.unlock.selector) {
            address expectedSigner = extractAddressFromCallData(data, 1);
            return isOnlySigner(expectedSigner, signers) &&
                controller.securityStore().isGuardian(wallet, expectedSigner);
        } else if (method == this.recover.selector) {
            return GuardianUtils.requireMajority(
                controller.securityStore(),
                wallet,
                signers,
                GuardianUtils.SigRequirement.OwnerNotAllowed
            );
        } else {
            revert("INVALID_METHOD");
        }
    }
}
