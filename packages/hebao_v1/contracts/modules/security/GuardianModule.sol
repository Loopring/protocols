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

    bytes32 public immutable GUARDIAN_DOMAIN_SEPERATOR;

    uint public constant MAX_GUARDIANS           = 10;
    uint public constant GUARDIAN_PENDING_PERIOD = 3 days;

    bytes32 public constant ADD_GUARDIAN_TYPEHASH = keccak256(
        "addGuardian(address wallet,uint256 validUntil,address guardian)"
    );
    bytes32 public constant REMOVE_GUARDIAN_TYPEHASH = keccak256(
        "removeGuardian(address wallet,uint256 validUntil,address guardian)"
    );
    bytes32 public constant RECOVER_TYPEHASH = keccak256(
        "recover(address wallet,uint256 validUntil,address newOwner)"
    );
    bytes32 public constant LOCK_TYPEHASH = keccak256(
        "lock(address wallet,uint256 validUntil)"
    );
    bytes32 public constant UNLOCK_TYPEHASH = keccak256(
        "unlock(address wallet,uint256 validUntil)"
    );

    event GuardianAdded   (address indexed wallet, address guardian, uint effectiveTime);
    event GuardianRemoved (address indexed wallet, address guardian, uint effectiveTime);
    event Recovered       (address indexed wallet, address newOwner);

    constructor()
    {
        GUARDIAN_DOMAIN_SEPERATOR = EIP712.hash(
            EIP712.Domain("GuardianModule", "1.2.0", address(this))
        );
    }

    function addGuardian(
        address wallet,
        address guardian
        )
        external
        txAwareHashNotAllowed()
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
        notWalletOwner(wallet, guardian)
    {
        _addGuardian(wallet, guardian, GUARDIAN_PENDING_PERIOD, false);
    }

    function addGuardianWA(
        SignedRequest.Request calldata request,
        address guardian
        )
        external
        notWalletOwner(request.wallet, guardian)
    {
        SignedRequest.verifyRequest(
            hashStore,
            securityStore,
            GUARDIAN_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
            request,
            abi.encode(
                ADD_GUARDIAN_TYPEHASH,
                request.wallet,
                request.validUntil,
                guardian
            )
        );

        _addGuardian(request.wallet, guardian, 0, true);
    }

    function removeGuardian(
        address wallet,
        address guardian
        )
        external
        txAwareHashNotAllowed()
        onlyFromWalletOrOwnerWhenUnlocked(wallet)
    {
        _removeGuardian(wallet, guardian, GUARDIAN_PENDING_PERIOD, false);
    }

    function removeGuardianWA(
        SignedRequest.Request calldata request,
        address guardian
        )
        external
    {
        SignedRequest.verifyRequest(
            hashStore,
            securityStore,
            GUARDIAN_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
            request,
            abi.encode(
                REMOVE_GUARDIAN_TYPEHASH,
                request.wallet,
                request.validUntil,
                guardian
            )
        );

        _removeGuardian(request.wallet, guardian, 0, true);
    }

    function lock(address wallet)
        external
        txAwareHashNotAllowed()
    {
        address payable _logicalSender = logicalSender();
        require(
            _logicalSender == wallet ||
            _logicalSender == Wallet(wallet).owner() ||
            securityStore.isGuardian(wallet, _logicalSender, false),
            "NOT_FROM_WALLET_OR_OWNER_OR_GUARDIAN"
        );

        _lockWallet(wallet, _logicalSender, true);
    }

    function lockWA(
        SignedRequest.Request calldata request
        )
        external
    {
        SignedRequest.verifyRequest(
            hashStore,
            securityStore,
            GUARDIAN_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.OWNER_OR_ANY_GUARDIAN,
            request,
            abi.encode(
                LOCK_TYPEHASH,
                request.wallet,
                request.validUntil
            )
        );

        _lockWallet(request.wallet, request.signers[0], true);
    }

    function unlock(
        SignedRequest.Request calldata request
        )
        external
    {
        SignedRequest.verifyRequest(
            hashStore,
            securityStore,
            GUARDIAN_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.MAJORITY_OWNER_REQUIRED,
            request,
            abi.encode(
                UNLOCK_TYPEHASH,
                request.wallet,
                request.validUntil
            )
        );

        _lockWallet(request.wallet, address(this), false);
    }

    /// @dev Recover a wallet by setting a new owner.
    /// @param request The general request object.
    /// @param newOwner The new owner address to set.
    function recover(
        SignedRequest.Request calldata request,
        address newOwner
        )
        external
        notWalletOwner(request.wallet, newOwner)
        eligibleWalletOwner(newOwner)
    {
        SignedRequest.verifyRequest(
            hashStore,
            securityStore,
            GUARDIAN_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.MAJORITY_OWNER_NOT_ALLOWED,
            request,
            abi.encode(
                RECOVER_TYPEHASH,
                request.wallet,
                request.validUntil,
                newOwner
            )
        );

        SecurityStore ss = securityStore;
        if (ss.isGuardian(request.wallet, newOwner, true)) {
            ss.removeGuardian(request.wallet, newOwner, block.timestamp, true);
        }

        Wallet(request.wallet).setOwner(newOwner);
        _lockWallet(request.wallet, address(this), false);
        ss.cancelPendingGuardians(request.wallet);

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
        uint    pendingPeriod,
        bool    alwaysOverride
        )
        private
    {
        require(guardian != wallet, "INVALID_ADDRESS");
        require(guardian != address(0), "ZERO_ADDRESS");

        SecurityStore ss = securityStore;
        uint numGuardians = ss.numGuardians(wallet, true);
        require(numGuardians < MAX_GUARDIANS, "TOO_MANY_GUARDIANS");

        uint validSince = block.timestamp;
        if (numGuardians >= 2) {
            validSince = block.timestamp + pendingPeriod;
        }
        validSince = ss.addGuardian(wallet, guardian, validSince, alwaysOverride);
        emit GuardianAdded(wallet, guardian, validSince);
    }

    function _removeGuardian(
        address wallet,
        address guardian,
        uint    pendingPeriod,
        bool    alwaysOverride
        )
        private
    {
        uint validUntil = block.timestamp + pendingPeriod;
        SecurityStore ss = securityStore;
        validUntil = ss.removeGuardian(wallet, guardian, validUntil, alwaysOverride);
        emit GuardianRemoved(wallet, guardian, validUntil);
    }
}
