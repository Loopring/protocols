// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../../lib/EIP712.sol";
import "../../lib/SignatureUtil.sol";
import "./GuardianLib.sol";
import "./WalletData.sol";
import "../../iface/UserOperation.sol";
import "../../base/SmartWallet.sol";
import "../../base/libwallet/QuotaLib.sol";
import "../../base/libwallet/WhitelistLib.sol";
import "../../base/libwallet/ERC20Lib.sol";
import "../../base/libwallet/LockLib.sol";
import "../../base/libwallet/UpgradeLib.sol";
import "../../base/libwallet/RecoverLib.sol";
import "../../base/libwallet/AutomationLib.sol";

/// @title ApprovalLib
/// @dev Utility library for better handling of signed wallet requests.
///      This library must be deployed and linked to other modules.
///
/// @author Daniel Wang - <daniel@loopring.org>
library ApprovalLib {
    using SignatureUtil for bytes32;
    using SignatureUtil for bytes32;
    using ECDSA for bytes32;
    using BytesUtil for bytes;
    uint256 constant SIG_VALIDATION_FAILED = 1;

    /**
     * helper to pack the return value for validateUserOp
     * @param sigFailed true if the signature check failed, false, if it succeeded.
     * @param validUntil last timestamp this UserOperation is valid (or zero for infinite)
     * @param validAfter first timestamp this UserOperation is valid
     */
    function packSigTimeRange(
        bool sigFailed,
        uint256 validUntil,
        uint256 validAfter
    ) internal pure returns (uint256) {
        return
            uint256(sigFailed ? 1 : 0) |
            uint256(validUntil << 8) |
            uint256(validAfter << (64 + 8));
    }

    function verifyApproval(
        Wallet storage wallet,
        bytes32 approvedHash,
        SigRequirement sigRequirement,
        Approval memory approval
    ) internal returns (uint256) {
        // Save hash to prevent replay attacks
        require(!wallet.hashes[approvedHash], "HASH_EXIST");
        wallet.hashes[approvedHash] = true;

        if (
            approvedHash.verifySignatures(
                approval.signers,
                approval.signatures
            ) &&
            GuardianLib.requireMajority(
                wallet,
                approval.signers,
                sigRequirement
            )
        ) {
            return
                packSigTimeRange(
                    false,
                    approval.validUntil,
                    0 /*valid immediately*/
                );
        }
        return SIG_VALIDATION_FAILED;
    }

    function _validateSignature(
        Wallet storage wallet,
        UserOperation calldata userOp,
        bytes32 userOpHash,
        bytes32 DOMAIN_SEPARATOR
    ) public returns (uint256 sigTimeRange) {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        bytes4 methodId = userOp.callData.toBytes4(0);

        if (isDataless(userOp)) {
            bytes memory data = userOp.callData[4:];
            (Approval memory approval, bytes memory ownerSignature) = abi
                .decode(userOp.signature, (Approval, bytes));
            if (
                methodId != SmartWallet.recover.selector &&
                !hash.verifySignature(wallet.owner, ownerSignature)
            ) {
                return SIG_VALIDATION_FAILED;
            }

            // then check guardians signature for actions
            if (methodId == SmartWallet.addGuardianWA.selector) {
                bytes32 approvedHash = GuardianLib.encodeApprovalForAddGuardian(
                    data,
                    DOMAIN_SEPARATOR,
                    approval.validUntil
                );
                return
                    verifyApproval(
                        wallet,
                        approvedHash,
                        GuardianLib.sigRequirement,
                        approval
                    );
            }

            if (methodId == SmartWallet.removeGuardianWA.selector) {
                bytes32 approvedHash = GuardianLib
                    .encodeApprovalForRemoveGuardian(
                        data,
                        DOMAIN_SEPARATOR,
                        approval.validUntil
                    );
                return
                    verifyApproval(
                        wallet,
                        approvedHash,
                        GuardianLib.sigRequirement,
                        approval
                    );
            }

            if (methodId == SmartWallet.resetGuardiansWA.selector) {
                bytes32 approvedHash = GuardianLib
                    .encodeApprovalForResetGuardians(
                        data,
                        DOMAIN_SEPARATOR,
                        approval.validUntil
                    );
                return
                    verifyApproval(
                        wallet,
                        approvedHash,
                        GuardianLib.sigRequirement,
                        approval
                    );
            }

            if (methodId == SmartWallet.changeDailyQuotaWA.selector) {
                bytes32 approvedHash = QuotaLib
                    .encodeApprovalForChangeDailyQuota(
                        data,
                        DOMAIN_SEPARATOR,
                        approval.validUntil
                    );
                return
                    verifyApproval(
                        wallet,
                        approvedHash,
                        QuotaLib.sigRequirement,
                        approval
                    );
            }

            if (methodId == SmartWallet.addToWhitelistWA.selector) {
                bytes32 approvedHash = WhitelistLib
                    .encodeApprovalForAddToWhitelist(
                        data,
                        DOMAIN_SEPARATOR,
                        approval.validUntil
                    );
                return
                    verifyApproval(
                        wallet,
                        approvedHash,
                        WhitelistLib.sigRequirement,
                        approval
                    );
            }

            if (methodId == SmartWallet.transferTokenWA.selector) {
                bytes32 approvedHash = ERC20Lib.encodeApprovalForTransferToken(
                    data,
                    DOMAIN_SEPARATOR,
                    approval.validUntil
                );
                return
                    verifyApproval(
                        wallet,
                        approvedHash,
                        ERC20Lib.sigRequirement,
                        approval
                    );
            }

            if (methodId == SmartWallet.callContractWA.selector) {
                bytes32 approvedHash = ERC20Lib.encodeApprovalForCallContract(
                    data,
                    DOMAIN_SEPARATOR,
                    approval.validUntil
                );
                return
                    verifyApproval(
                        wallet,
                        approvedHash,
                        ERC20Lib.sigRequirement,
                        approval
                    );
            }

            if (methodId == SmartWallet.approveTokenWA.selector) {
                bytes32 approvedHash = ERC20Lib.encodeApprovalForApproveToken(
                    data,
                    DOMAIN_SEPARATOR,
                    approval.validUntil
                );
                return
                    verifyApproval(
                        wallet,
                        approvedHash,
                        ERC20Lib.sigRequirement,
                        approval
                    );
            }

            if (methodId == SmartWallet.approveThenCallContractWA.selector) {
                bytes32 approvedHash = ERC20Lib
                    .encodeApprovalForApproveThenCallContract(
                        data,
                        DOMAIN_SEPARATOR,
                        approval.validUntil
                    );
                return
                    verifyApproval(
                        wallet,
                        approvedHash,
                        ERC20Lib.sigRequirement,
                        approval
                    );
            }

            if (methodId == SmartWallet.unlock.selector) {
                bytes32 approvedHash = LockLib.encodeApprovalForUnlock(
                    data,
                    DOMAIN_SEPARATOR,
                    approval.validUntil
                );
                return
                    verifyApproval(
                        wallet,
                        approvedHash,
                        LockLib.sigRequirement,
                        approval
                    );
            }

            if (methodId == SmartWallet.changeMasterCopy.selector) {
                bytes32 approvedHash = UpgradeLib
                    .encodeApprovalForChangeMasterCopy(
                        data,
                        DOMAIN_SEPARATOR,
                        approval.validUntil
                    );
                return
                    verifyApproval(
                        wallet,
                        approvedHash,
                        UpgradeLib.sigRequirement,
                        approval
                    );
            }

            if (methodId == SmartWallet.recover.selector) {
                (address newOwner, address[] memory newGuardians) = abi.decode(
                    data,
                    (address, address[])
                );
                if (!hash.verifySignature(newOwner, ownerSignature))
                    return SIG_VALIDATION_FAILED;
                bytes32 approvedHash = RecoverLib.encodeApprovalForRecover(
                    newOwner,
                    newGuardians,
                    DOMAIN_SEPARATOR,
                    approval.validUntil
                );
                return
                    verifyApproval(
                        wallet,
                        approvedHash,
                        RecoverLib.sigRequirement,
                        approval
                    );
            }
        }

        if (methodId == SmartWallet.inherit.selector) {
            if (hash.verifySignature(wallet.inheritor, userOp.signature)) {
                return 0;
            }
            return SIG_VALIDATION_FAILED;
        }

        if (methodId == SmartWallet.cast.selector) {
            (address executor, address[] memory connectors, bytes[] memory datas) = abi
                .decode(userOp.callData[4:], (address, address[], bytes[]));
            if (hash.verifySignature(executor, userOp.signature) && AutomationLib._verifyPermission(wallet, executor, connectors)
            ) {
                return 0;
            }
            if (hash.verifySignature(wallet.owner, userOp.signature)) {
                return 0;
            }
            return SIG_VALIDATION_FAILED;
        }

        require(!wallet.locked, "wallet is locked");

        if (!hash.verifySignature(wallet.owner, userOp.signature))
            return SIG_VALIDATION_FAILED;
        return 0;
    }

    function isDataless(
        UserOperation calldata userOp
    ) internal pure returns (bool) {
        // We don't require any data in the meta tx when
        // - the meta-tx has no nonce
        // - the meta-tx needs to be successful
        // - a function is called that requires a majority of guardians and fails when replayed
        bytes4 methodId = userOp.callData.toBytes4(0);
        return (methodId == SmartWallet.changeMasterCopy.selector ||
            methodId == SmartWallet.addGuardianWA.selector ||
            methodId == SmartWallet.removeGuardianWA.selector ||
            methodId == SmartWallet.resetGuardiansWA.selector ||
            methodId == SmartWallet.unlock.selector ||
            methodId == SmartWallet.changeDailyQuotaWA.selector ||
            methodId == SmartWallet.recover.selector ||
            methodId == SmartWallet.addToWhitelistWA.selector ||
            methodId == SmartWallet.transferTokenWA.selector ||
            methodId == SmartWallet.callContractWA.selector ||
            methodId == SmartWallet.approveTokenWA.selector ||
            methodId == SmartWallet.approveThenCallContractWA.selector);
    }
    
}
