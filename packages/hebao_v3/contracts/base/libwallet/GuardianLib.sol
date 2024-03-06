// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "./WalletData.sol";
import "../../lib/SignatureUtil.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "./ApprovalLib.sol";
import "../../lib/EIP712.sol";
import "../../lib/LoopringErrors.sol";

/// @title GuardianModule
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
library GuardianLib {
    using AddressUtil for address;
    using SafeCast for uint;
    using SignatureUtil for bytes32;

    uint private constant MAX_GUARDIANS = 10;
    uint private constant GUARDIAN_PENDING_PERIOD = 3 days;
    SigRequirement public constant SIG_REQUIREMENT =
        SigRequirement.MAJORITY_OWNER_REQUIRED;

    bytes32 private constant ADD_GUARDIAN_TYPEHASH =
        keccak256(
            "addGuardian(address wallet,uint256 validUntil,address guardian)"
        );
    bytes32 private constant REMOVE_GUARDIAN_TYPEHASH =
        keccak256(
            "removeGuardian(address wallet,uint256 validUntil,address guardian)"
        );
    bytes32 private constant RESET_GUARDIANS_TYPEHASH =
        keccak256(
            "resetGuardians(address wallet,uint256 validUntil,address[] guardians)"
        );

    event GuardianAdded(address guardian, uint effectiveTime);
    event GuardianRemoved(address guardian, uint effectiveTime);

    function addGuardiansImmediately(
        Wallet storage wallet,
        address[] memory _guardians
    ) external {
        address guardian = address(0);
        for (uint i = 0; i < _guardians.length; i++) {
            _require(_guardians[i] > guardian, Errors.INVALID_ORDERING);
            guardian = _guardians[i];
            _addGuardian(wallet, guardian, 0, true);
        }
    }

    function addGuardian(Wallet storage wallet, address guardian) external {
        _addGuardian(wallet, guardian, GUARDIAN_PENDING_PERIOD, false);
    }

    function addGuardianWA(Wallet storage wallet, address guardian) external {
        _addGuardian(wallet, guardian, 0, true);
    }

    function removeGuardian(Wallet storage wallet, address guardian) external {
        _removeGuardian(wallet, guardian, GUARDIAN_PENDING_PERIOD, false);
    }

    function removeGuardianWA(
        Wallet storage wallet,
        address guardian
    ) external {
        _removeGuardian(wallet, guardian, 0, true);
    }

    function resetGuardians(
        Wallet storage wallet,
        address[] calldata newGuardians
    ) external {
        Guardian[] memory allGuardians = guardians(wallet, true);
        for (uint i = 0; i < allGuardians.length; i++) {
            _removeGuardian(
                wallet,
                allGuardians[i].addr,
                GUARDIAN_PENDING_PERIOD,
                false
            );
        }

        for (uint j = 0; j < newGuardians.length; j++) {
            _addGuardian(
                wallet,
                newGuardians[j],
                GUARDIAN_PENDING_PERIOD,
                false
            );
        }
    }

    function resetGuardiansWA(
        Wallet storage wallet,
        address[] calldata newGuardians
    ) external {
        removeAllGuardians(wallet);
        for (uint i = 0; i < newGuardians.length; i++) {
            _addGuardian(wallet, newGuardians[i], 0, true);
        }
    }

    function requireMajority(
        Wallet storage wallet,
        address[] memory signers,
        SigRequirement requirement
    ) internal view returns (bool) {
        // We always need at least one signer
        if (signers.length == 0) {
            return false;
        }

        // Calculate total group sizes
        Guardian[] memory allGuardians = guardians(wallet, false);
        _require(allGuardians.length > 0, Errors.NO_GUARDIANS);

        address lastSigner;
        bool walletOwnerSigned = false;
        address owner = wallet.owner;
        for (uint i = 0; i < signers.length; i++) {
            // Check for duplicates
            _require(signers[i] > lastSigner, Errors.INVALID_SIGNERS_ORDER);
            lastSigner = signers[i];

            if (signers[i] == owner) {
                walletOwnerSigned = true;
            } else {
                bool _isGuardian = false;
                for (uint j = 0; j < allGuardians.length; j++) {
                    if (allGuardians[j].addr == signers[i]) {
                        _isGuardian = true;
                        break;
                    }
                }
                _require(_isGuardian, Errors.SIGNER_NOT_GUARDIAN);
            }
        }

        if (requirement == SigRequirement.OWNER_OR_ANY_GUARDIAN) {
            return signers.length == 1;
        } else if (requirement == SigRequirement.ANY_GUARDIAN) {
            _require(
                !walletOwnerSigned,
                Errors.WALLET_OWNER_SIGNATURE_NOT_ALLOWED
            );
            return signers.length == 1;
        }

        // Check owner requirements
        if (requirement == SigRequirement.MAJORITY_OWNER_REQUIRED) {
            _require(walletOwnerSigned, Errors.WALLET_OWNER_SIGNATURE_REQUIRED);
        } else if (requirement == SigRequirement.MAJORITY_OWNER_NOT_ALLOWED) {
            _require(
                !walletOwnerSigned,
                Errors.WALLET_OWNER_SIGNATURE_NOT_ALLOWED
            );
        }

        uint numExtendedSigners = allGuardians.length;
        if (walletOwnerSigned) {
            numExtendedSigners += 1;
            _require(
                signers.length > 1,
                Errors.NO_GUARDIAN_SIGNED_BESIDES_OWNER
            );
        }

        return signers.length >= (numExtendedSigners >> 1) + 1;
    }

    function isGuardian(
        Wallet storage wallet,
        address addr,
        bool includePendingAddition
    ) public view returns (bool) {
        Guardian memory g = _getGuardian(wallet, addr);
        return _isActiveOrPendingAddition(g, includePendingAddition);
    }

    function guardians(
        Wallet storage wallet,
        bool includePendingAddition
    ) public view returns (Guardian[] memory _guardians) {
        _guardians = new Guardian[](wallet.guardians.length);
        uint index = 0;
        for (uint i = 0; i < wallet.guardians.length; i++) {
            Guardian memory g = wallet.guardians[i];
            if (_isActiveOrPendingAddition(g, includePendingAddition)) {
                _guardians[index] = g;
                index++;
            }
        }
        // solhint-disable-next-line no-inline-assembly
        assembly {
            mstore(_guardians, index)
        }
    }

    function numGuardians(
        Wallet storage wallet,
        bool includePendingAddition
    ) public view returns (uint count) {
        for (uint i = 0; i < wallet.guardians.length; i++) {
            Guardian memory g = wallet.guardians[i];
            if (_isActiveOrPendingAddition(g, includePendingAddition)) {
                count++;
            }
        }
    }

    function removeAllGuardians(Wallet storage wallet) internal {
        uint size = wallet.guardians.length;
        if (size == 0) return;

        for (uint i = 0; i < wallet.guardians.length; i++) {
            delete wallet.guardianIdx[wallet.guardians[i].addr];
        }
        delete wallet.guardians;
    }

    function cancelPendingGuardians(Wallet storage wallet) internal {
        bool cancelled = false;
        for (uint i = 0; i < wallet.guardians.length; i++) {
            Guardian memory g = wallet.guardians[i];
            if (_isPendingAddition(g)) {
                wallet.guardians[i].status = uint8(GuardianStatus.REMOVE);
                wallet.guardians[i].timestamp = 0;
                cancelled = true;
            }
            if (_isPendingRemoval(g)) {
                wallet.guardians[i].status = uint8(GuardianStatus.ADD);
                wallet.guardians[i].timestamp = 0;
                cancelled = true;
            }
        }
        _cleanRemovedGuardians(wallet, true);
    }

    function storeGuardian(
        Wallet storage wallet,
        address addr,
        uint validSince,
        bool alwaysOverride
    ) internal returns (uint) {
        _require(validSince >= block.timestamp, Errors.INVALID_VALID_SINCE);
        _require(addr != address(0), Errors.ZERO_ADDRESS);
        _require(addr != address(this), Errors.INVALID_GUARDIAN_ADDRESS);

        uint pos = wallet.guardianIdx[addr];

        if (pos == 0) {
            // Add the new guardian
            Guardian memory _g = Guardian(
                addr,
                uint8(GuardianStatus.ADD),
                validSince.toUint64()
            );
            wallet.guardians.push(_g);
            wallet.guardianIdx[addr] = wallet.guardians.length;

            _cleanRemovedGuardians(wallet, false);
            return validSince;
        }

        Guardian memory g = wallet.guardians[pos - 1];

        if (_isRemoved(g)) {
            wallet.guardians[pos - 1].status = uint8(GuardianStatus.ADD);
            wallet.guardians[pos - 1].timestamp = validSince.toUint64();
            return validSince;
        }

        if (_isPendingRemoval(g)) {
            wallet.guardians[pos - 1].status = uint8(GuardianStatus.ADD);
            wallet.guardians[pos - 1].timestamp = 0;
            return 0;
        }

        if (_isPendingAddition(g)) {
            if (!alwaysOverride) return g.timestamp;

            wallet.guardians[pos - 1].timestamp = validSince.toUint64();
            return validSince;
        }

        _require(_isAdded(g), Errors.UNEXPECTED_RESULT);
        return 0;
    }

    function deleteGuardian(
        Wallet storage wallet,
        address addr,
        uint validUntil,
        bool alwaysOverride
    ) internal returns (uint) {
        _require(validUntil >= block.timestamp, Errors.INVALID_VALID_UNTIL);
        _require(addr != address(0), Errors.INVALID_GUARDIAN_ADDRESS);

        uint pos = wallet.guardianIdx[addr];
        _require(pos > 0, Errors.GUARDIAN_NOT_EXISTS);

        Guardian memory g = wallet.guardians[pos - 1];

        if (_isAdded(g)) {
            wallet.guardians[pos - 1].status = uint8(GuardianStatus.REMOVE);
            wallet.guardians[pos - 1].timestamp = validUntil.toUint64();
            return validUntil;
        }

        if (_isPendingAddition(g)) {
            wallet.guardians[pos - 1].status = uint8(GuardianStatus.REMOVE);
            wallet.guardians[pos - 1].timestamp = 0;
            return 0;
        }

        if (_isPendingRemoval(g)) {
            if (!alwaysOverride) return g.timestamp;

            wallet.guardians[pos - 1].timestamp = validUntil.toUint64();
            return validUntil;
        }

        _require(_isRemoved(g), Errors.UNEXPECTED_RESULT);
        return 0;
    }

    // --- Internal functions ---

    function _addGuardian(
        Wallet storage wallet,
        address guardian,
        uint pendingPeriod,
        bool alwaysOverride
    ) internal {
        uint _numGuardians = numGuardians(wallet, true);
        _require(_numGuardians < MAX_GUARDIANS, Errors.TOO_MANY_GUARDIANS);
        _require(guardian != wallet.owner, Errors.GUARDIAN_CAN_NOT_BE_OWNER);

        uint validSince = block.timestamp + 1;
        if (_numGuardians >= 2) {
            validSince = block.timestamp + pendingPeriod;
        }
        validSince = storeGuardian(
            wallet,
            guardian,
            validSince,
            alwaysOverride
        );
        emit GuardianAdded(guardian, validSince);
    }

    function _removeGuardian(
        Wallet storage wallet,
        address guardian,
        uint pendingPeriod,
        bool alwaysOverride
    ) private {
        uint validUntil = block.timestamp + pendingPeriod;
        validUntil = deleteGuardian(
            wallet,
            guardian,
            validUntil,
            alwaysOverride
        );
        emit GuardianRemoved(guardian, validUntil);
    }

    function _getGuardian(
        Wallet storage wallet,
        address addr
    ) private view returns (Guardian memory guardian) {
        uint pos = wallet.guardianIdx[addr];
        if (pos > 0) {
            guardian = wallet.guardians[pos - 1];
        }
    }

    function _isAdded(Guardian memory guardian) private view returns (bool) {
        return
            guardian.status == uint8(GuardianStatus.ADD) &&
            guardian.timestamp <= block.timestamp;
    }

    function _isPendingAddition(
        Guardian memory guardian
    ) private view returns (bool) {
        return
            guardian.status == uint8(GuardianStatus.ADD) &&
            guardian.timestamp > block.timestamp;
    }

    function _isRemoved(Guardian memory guardian) private view returns (bool) {
        return
            guardian.status == uint8(GuardianStatus.REMOVE) &&
            guardian.timestamp <= block.timestamp;
    }

    function _isPendingRemoval(
        Guardian memory guardian
    ) private view returns (bool) {
        return
            guardian.status == uint8(GuardianStatus.REMOVE) &&
            guardian.timestamp > block.timestamp;
    }

    function _isActive(Guardian memory guardian) private view returns (bool) {
        return _isAdded(guardian) || _isPendingRemoval(guardian);
    }

    function _isActiveOrPendingAddition(
        Guardian memory guardian,
        bool includePendingAddition
    ) private view returns (bool) {
        return
            _isActive(guardian) ||
            (includePendingAddition && _isPendingAddition(guardian));
    }

    function _cleanRemovedGuardians(Wallet storage wallet, bool force) private {
        uint count = wallet.guardians.length;
        if (!force && count < 10) return;

        for (int i = int(count) - 1; i >= 0; i--) {
            Guardian memory g = wallet.guardians[uint(i)];
            if (_isRemoved(g)) {
                Guardian memory lastGuardian = wallet.guardians[
                    wallet.guardians.length - 1
                ];

                if (g.addr != lastGuardian.addr) {
                    wallet.guardians[uint(i)] = lastGuardian;
                    wallet.guardianIdx[lastGuardian.addr] = uint(i) + 1;
                }
                wallet.guardians.pop();
                delete wallet.guardianIdx[g.addr];
            }
        }
    }

    function encodeApprovalForAddGuardian(
        bytes memory data,
        bytes32 domainSeparator,
        uint256 validUntil
    ) external view returns (bytes32) {
        address guardian = abi.decode(data, (address));
        bytes32 approvedHash = EIP712.hashPacked(
            domainSeparator,
            keccak256(
                abi.encode(
                    ADD_GUARDIAN_TYPEHASH,
                    address(this),
                    validUntil,
                    guardian
                )
            )
        );
        return approvedHash;
    }

    function encodeApprovalForRemoveGuardian(
        bytes memory data,
        bytes32 domainSeparator,
        uint256 validUntil
    ) external view returns (bytes32) {
        address guardian = abi.decode(data, (address));
        bytes32 approvedHash = EIP712.hashPacked(
            domainSeparator,
            keccak256(
                abi.encode(
                    REMOVE_GUARDIAN_TYPEHASH,
                    address(this),
                    validUntil,
                    guardian
                )
            )
        );
        return approvedHash;
    }

    function encodeApprovalForResetGuardians(
        bytes memory data,
        bytes32 domainSeparator,
        uint256 validUntil
    ) external view returns (bytes32) {
        address[] memory newGuardians = abi.decode(data, (address[]));
        bytes32 approvedHash = EIP712.hashPacked(
            domainSeparator,
            keccak256(
                abi.encode(
                    RESET_GUARDIANS_TYPEHASH,
                    address(this),
                    validUntil,
                    keccak256(abi.encodePacked(newGuardians))
                )
            )
        );
        return approvedHash;
    }
}
