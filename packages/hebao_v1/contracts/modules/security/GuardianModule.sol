// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "./SecurityModule.sol";


/// @title GuardianModule
contract GuardianModule is SecurityModule
{
    using SignatureUtil for bytes32;
    using AddressUtil   for address;

    uint constant public MAX_GUARDIANS = 20;
    uint public pendingPeriod;

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

    constructor(
        ControllerImpl _controller,
        address        _trustedForwarder,
        uint           _pendingPeriod
        )
        public
        SecurityModule(_controller, _trustedForwarder)
    {
        DOMAIN_SEPERATOR = EIP712.hash(
            EIP712.Domain("GuardianModule", "1.1.0", address(this))
        );
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
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
        notWalletOwner(wallet, guardian)
    {
        require(guardian != wallet, "INVALID_ADDRESS");
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
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
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
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
        onlyWalletGuardian(wallet, guardian)
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
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        controller.securityStore().cancelGuardianRemoval(wallet, guardian);
        emit GuardianRemovalCancelled(wallet, guardian);
    }

    function lock(address wallet)
        external
        nonReentrant
        // onlyWhenWalletUnlocked(wallet)
        onlyFromGuardian(wallet)
        onlyHaveEnoughGuardians(wallet)
    {
        lockWallet(wallet);
    }

    function unlock(address wallet)
        external
        nonReentrant
        // onlyWhenWalletLocked(wallet)
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
        nonReentrant
        notWalletOwner(request.wallet, newOwner)
        eligibleAsWalletOwner(newOwner)
        onlyHaveEnoughGuardians(request.wallet)
    {
        controller.verifyRequest(
            DOMAIN_SEPERATOR,
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

        SecurityStore securityStore = controller.securityStore();
        if (securityStore.isGuardianOrPendingAddition(request.wallet, newOwner)) {
            securityStore.removeGuardian(request.wallet, newOwner, now);
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
