// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./SecurityModule.sol";
import "./SignedRequest.sol";


/// @title GuardianModule
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract GuardianModule is SecurityModule
{
    using SignatureUtil for bytes32;
    using AddressUtil   for address;
    using SignedRequest for ControllerImpl;

    bytes32 public GUARDIAN_DOMAIN_SEPERATOR;

    uint constant public MAX_GUARDIANS = 20;
    uint public constant GUARDIAN_PENDING_PERIOD = 1 days;

    event GuardianAdded             (address indexed wallet, address guardian, uint group, uint effectiveTime);
    event GuardianAdditionCancelled (address indexed wallet, address guardian);
    event GuardianRemoved           (address indexed wallet, address guardian, uint removalEffectiveTime);
    event GuardianRemovalCancelled  (address indexed wallet, address guardian);

    event Recovered(
        address indexed wallet,
        address         newOwner
    );

    bytes32 public constant RECOVER_TYPEHASH = keccak256(
        "recover(address wallet,uint256 validUntil,address newOwner)"
    );

    constructor()
    {
        GUARDIAN_DOMAIN_SEPERATOR = EIP712.hash(
            EIP712.Domain("GuardianModule", "1.2.0", address(this))
        );
    }

    function addGuardian(
        address wallet,
        address guardian,
        uint    group
        )
        external
        txAwareHashNotAllowed()
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
        notWalletOwner(wallet, guardian)
    {
        require(guardian != wallet, "INVALID_ADDRESS");
        require(guardian != address(0), "ZERO_ADDRESS");
        require(group < GuardianUtils.MAX_NUM_GROUPS, "INVALID_GROUP");
        uint numGuardians = controllerCache.securityStore.numGuardiansWithPending(wallet);
        require(numGuardians < MAX_GUARDIANS, "TOO_MANY_GUARDIANS");

        uint effectiveTime = block.timestamp;
        if (numGuardians >= MIN_ACTIVE_GUARDIANS) {
            effectiveTime = block.timestamp + GUARDIAN_PENDING_PERIOD;
        }
        controllerCache.securityStore.addGuardian(wallet, guardian, group, effectiveTime);
        emit GuardianAdded(wallet, guardian, group, effectiveTime);
    }

    function cancelGuardianAddition(
        address wallet,
        address guardian
        )
        external
        txAwareHashNotAllowed()
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        controllerCache.securityStore.cancelGuardianAddition(wallet, guardian);
        emit GuardianAdditionCancelled(wallet, guardian);
    }

    function removeGuardian(
        address wallet,
        address guardian
        )
        external
        txAwareHashNotAllowed()
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
        onlyWalletGuardian(wallet, guardian)
    {
        controllerCache.securityStore.removeGuardian(wallet, guardian, block.timestamp + GUARDIAN_PENDING_PERIOD);
        emit GuardianRemoved(wallet, guardian, block.timestamp + GUARDIAN_PENDING_PERIOD);
    }

    function cancelGuardianRemoval(
        address wallet,
        address guardian
        )
        external
        txAwareHashNotAllowed()
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        controllerCache.securityStore.cancelGuardianRemoval(wallet, guardian);
        emit GuardianRemovalCancelled(wallet, guardian);
    }

    function lock(address wallet)
        external
        txAwareHashNotAllowed()
        onlyFromGuardian(wallet)
        onlyHaveEnoughGuardians(wallet)
    {
        lockWallet(wallet);
    }

    function unlock(address wallet)
        external
        txAwareHashNotAllowed()
        onlyFromGuardian(wallet)
    {
        unlockWallet(wallet, false);
    }

    /// @dev Recover a wallet by setting a new owner.
    /// @param request The general request object.
    /// @param newOwner The new owner address to set.
    ///        The addresses must be sorted ascendently.
    function recover(
        SignedRequest.Request calldata request,
        address newOwner
        )
        external
        notWalletOwner(request.wallet, newOwner)
        eligibleWalletOwner(newOwner)
        onlyHaveEnoughGuardians(request.wallet)
    {
        controller().verifyRequest(
            GUARDIAN_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.OwnerNotAllowed,
            request,
            abi.encode(
                RECOVER_TYPEHASH,
                request.wallet,
                request.validUntil,
                newOwner
            )
        );

        if (controllerCache.securityStore.isGuardianOrPendingAddition(request.wallet, newOwner)) {
            controllerCache.securityStore.removeGuardian(request.wallet, newOwner, block.timestamp);
        }

        Wallet(request.wallet).setOwner(newOwner);

        // solium-disable-next-line
        unlockWallet(request.wallet, true /*force*/);

        emit Recovered(request.wallet, newOwner);
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
}
