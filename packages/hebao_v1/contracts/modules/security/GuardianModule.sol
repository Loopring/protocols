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

    uint public constant MAX_GUARDIANS           = 10;
    uint public constant GUARDIAN_PENDING_PERIOD = 7 days;

    bytes32 public constant ADD_GUARDIAN_TYPEHASH = keccak256(
        "addGuardian(address wallet,uint256 validUntil,address guardian)"
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
        _addGuardian(wallet, guardian, GUARDIAN_PENDING_PERIOD);
    }

    function addGuardiansWithTheirApproval(
        SignedRequest.Request memory request
        )
        external
    {
        require(block.timestamp <= request.validUntil, "EXPIRED_SIGNED_REQUEST");
        require(request.signers.length > 0, "EMPTY_SIGNERS");

        bytes32 _txAwareHash = EIP712.hashPacked(
            GUARDIAN_DOMAIN_SEPERATOR,
            abi.encode(
                ADD_GUARDIAN_TYPEHASH,
                request.wallet,
                request.validUntil,
                address(0)
            )
        );

        require(_txAwareHash == txAwareHash(), "TX_INNER_HASH_MISMATCH");
        controllerCache.hashStore.verifyAndUpdate(request.wallet, _txAwareHash);

        require(
            _txAwareHash.verifySignatures(request.signers, request.signatures),
            "INVALID_SIGNATURES"
        );

        address owner = Wallet(request.wallet).owner();
        for (uint i = 0; i < request.signers.length; i++) {
            if (request.signers[i] != owner) {
                _addGuardian(
                    request.wallet,
                    request.signers[i],
                    GUARDIAN_PENDING_PERIOD
                );
            }
        }
    }

    function addGuardianWA(
        SignedRequest.Request calldata request,
        address guardian
        )
        external
    {
        controller().verifyRequest(
            GUARDIAN_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.OwnerRequired,
            request,
            abi.encode(
                ADD_GUARDIAN_TYPEHASH,
                request.wallet,
                request.validUntil,
                guardian
            )
        );

        _addGuardian(request.wallet, guardian, 0);
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
            GuardianUtils.SigRequirement.OwnerRequired,
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

    function lock(address wallet)
        external
        txAwareHashNotAllowed()
    {
        address payable _logicalSender = logicalSender();
        if (_logicalSender == wallet ||
            _logicalSender == Wallet(wallet).owner()) {
            _lockWallet(wallet, address(0), true);
        } else if (controllerCache.securityStore.isGuardian(wallet, _logicalSender, false)) {
            _lockWallet(wallet, _logicalSender, true);
        } else {
            revert("NOT_FROM_WALLET_OR_OWNER_OR_GUARDIAN");
        }
    }

    function unlock(
        SignedRequest.Request calldata request
        )
        external
    {
        controller().verifyRequest(
            GUARDIAN_DOMAIN_SEPERATOR,
            txAwareHash(),
            GuardianUtils.SigRequirement.OwnerRequired,
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

        if (controllerCache.securityStore.isGuardian(request.wallet, newOwner, true)) {
            controllerCache.securityStore.removeGuardian(request.wallet, newOwner, block.timestamp);
        }

        Wallet(request.wallet).setOwner(newOwner);
        _lockWallet(request.wallet, address(this), false);
        // TODO(kongliang): cancel or pending guardian addition and removal.

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
        uint    pendingPeriod
        )
        private
    {
        require(guardian != wallet, "INVALID_ADDRESS");
        require(guardian != address(0), "ZERO_ADDRESS");

        SecurityStore ss = controllerCache.securityStore;
        uint numGuardians = ss.numGuardians(wallet, true);
        require(numGuardians < MAX_GUARDIANS, "TOO_MANY_GUARDIANS");

        uint effectiveTime = block.timestamp;
        if (numGuardians >= 2) {
            effectiveTime = block.timestamp + pendingPeriod;
        }
        ss.addGuardian(wallet, guardian, effectiveTime);
        emit GuardianAdded(wallet, guardian, effectiveTime);
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
