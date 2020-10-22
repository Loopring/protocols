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

    uint public constant MAX_GUARDIANS = 20;
    uint public constant GUARDIAN_PENDING_PERIOD = 3 days;

    bytes32 public constant ADD_GUARDIAN_TYPEHASH = keccak256(
        "addGuardian(address wallet,uint256 validUntil,address guardian,uint256 group)"
    );
    bytes32 public constant REMOVE_GUARDIAN_TYPEHASH = keccak256(
        "removeGuardian(address wallet,uint256 validUntil,address guardian)"
    );
    bytes32 public constant RECOVER_TYPEHASH = keccak256(
        "recover(address wallet,uint256 validUntil,address newOwner)"
    );
    bytes32 public constant UNLOCK_TYPEHASH = keccak256(
        "unlock(address wallet,uint256 validUntil)"
    );

    event GuardianAdded             (address indexed wallet, address guardian, uint group, uint effectiveTime);
    event GuardianAdditionCancelled (address indexed wallet, address guardian);
    event GuardianRemoved           (address indexed wallet, address guardian, uint removalEffectiveTime);
    event GuardianRemovalCancelled  (address indexed wallet, address guardian);

    event Recovered(
        address indexed wallet,
        address         newOwner
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
        _addGuardian(wallet, guardian, group, GUARDIAN_PENDING_PERIOD);
    }

    function addGuardianWA(
        SignedRequest.Request calldata request,
        address guardian,
        uint    group
        )
        external
    {
        controller().verifyRequest(
            GUARDIAN_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.OwnerAllowed,
            request,
            abi.encode(
                ADD_GUARDIAN_TYPEHASH,
                request.wallet,
                request.validUntil,
                guardian,
                group
            )
        );

        _addGuardian(request.wallet, guardian, group, 0);
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
        _removeGuardian(wallet, guardian, GUARDIAN_PENDING_PERIOD);
    }

    function removeGuardianWA(
        SignedRequest.Request calldata request,
        address guardian
        )
        external
    {
        controller().verifyRequest(
            GUARDIAN_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.OwnerAllowed,
            request,
            abi.encode(
                REMOVE_GUARDIAN_TYPEHASH,
                request.wallet,
                request.validUntil,
                guardian
            )
        );

        _removeGuardian(request.wallet, guardian, 0);
    }

    // TODO(kongliang): delete this function
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

    // TODO(kongliang): delete this function
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
    {
        _lockWallet(wallet, true);
    }

    function unlock(address wallet)
        external
        txAwareHashNotAllowed()
        onlyFromGuardian(wallet)
    {
        _lockWallet(wallet, false);
    }

    function unlockWA(
        SignedRequest.Request calldata request
        )
        external
    {
        controller().verifyRequest(
            GUARDIAN_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.OwnerRequired,
            request,
            abi.encode(UNLOCK_TYPEHASH)
        );

        _lockWallet(request.wallet, false);
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
        _lockWallet(request.wallet, false);

        emit Recovered(request.wallet, newOwner);
    }

    function isLocked(address wallet)
        public
        view
        returns (bool)
    {
        return _isWalletLocked(wallet);
    }

    // ---- internal functions ---

    function _addGuardian(
        address wallet,
        address guardian,
        uint    group,
        uint    pendingPeriod
        )
        private
    {
        require(guardian != wallet, "INVALID_ADDRESS");
        require(guardian != address(0), "ZERO_ADDRESS");
        require(group < GuardianUtils.MAX_NUM_GROUPS, "INVALID_GROUP");
        uint numGuardians = controllerCache.securityStore.numGuardiansWithPending(wallet);
        require(numGuardians < MAX_GUARDIANS, "TOO_MANY_GUARDIANS");

        uint effectiveTime = block.timestamp;
        if (numGuardians >= 2) {
            effectiveTime = block.timestamp + pendingPeriod;
        }
        controllerCache.securityStore.addGuardian(wallet, guardian, group, effectiveTime);
        emit GuardianAdded(wallet, guardian, group, effectiveTime);
    }

    function _removeGuardian(
        address wallet,
        address guardian,
        uint    pendingPeriod
        )
        private
    {
        uint effectiveTime = block.timestamp + pendingPeriod;
        controllerCache.securityStore.removeGuardian(wallet, guardian, effectiveTime);
        emit GuardianRemoved(wallet, guardian, effectiveTime);
    }
}
