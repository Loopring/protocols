// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "../thirdparty/BytesUtil.sol";
import {SmartWallet} from "./SmartWallet.sol";
import "../core/BaseAccount.sol";
import "../iface/IEntryPoint.sol";
import "../iface/PriceOracle.sol";
import "./libwallet/WalletData.sol";
import "./libwallet/GuardianLib.sol";
import "./libwallet/RecoverLib.sol";
import "./libwallet/QuotaLib.sol";
import "./libwallet/RecoverLib.sol";
import "../lib/EIP712.sol";
import "./libwallet/UpgradeLib.sol";
import "./libwallet/WhitelistLib.sol";
import "./libwallet/ERC20Lib.sol";
import "../lib/SignatureUtil.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SmartWalletV3 is SmartWallet {
    using SignatureUtil for bytes32;
    using ECDSA for bytes32;
    using BytesUtil for bytes;

    constructor(
        PriceOracle _priceOracle,
        address _blankOwner,
        IEntryPoint entryPointInput
    ) SmartWallet(_priceOracle, _blankOwner, entryPointInput) {}

    /**
     * execute a transaction (called directly from owner, or by entryPoint)
     */
    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external {
        _requireFromEntryPointOrOwnerWhenUnlocked();
        _call(dest, value, func);
    }

    /**
     * execute a sequence of transactions
     */
    function executeBatch(
        address[] calldata dest,
        bytes[] calldata func
    ) external {
        _requireFromEntryPointOrOwnerWhenUnlocked();
        require(dest.length == func.length, "wrong array lengths");
        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], 0, func[i]);
        }
    }

    /// implement template method of BaseAccount
    function _validateAndUpdateNonce(
        UserOperation calldata userOp
    ) internal override {
        if (userOp.nonce == 0) {
            return;
        }
        require(
            userOp.nonce > wallet.nonce &&
                (userOp.nonce >> 128) <= block.number,
            "invalid nonce"
        );
        // update nonce
        wallet.nonce = userOp.nonce;
    }

    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /**
     * check current account deposit in the entryPoint
     */
    function getDeposit() public view returns (uint256) {
        return entryPoint().balanceOf(address(this));
    }

    /**
     * deposit more funds for this account in the entryPoint
     */
    function addDeposit() public payable {
        entryPoint().depositTo{value: msg.value}(address(this));
    }

    /**
     * withdraw value from the account's deposit
     * @param withdrawAddress target to send to
     * @param amount to withdraw
     */
    function withdrawDepositTo(
        address payable withdrawAddress,
        uint256 amount
    ) public onlyFromWalletOrOwnerWhenUnlocked {
        entryPoint().withdrawTo(withdrawAddress, amount);
    }

    /// implement template method of BaseAccount
    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        address
    ) internal virtual override returns (uint256 sigTimeRange) {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        bytes4 methodId = userOp.callData.toBytes4(0);
        bytes memory callData = userOp.callData[4:];
        bool skipNonce = userOp.nonce == 0;

        if (skipNonce && methodId == SmartWallet.addGuardian.selector) {
            (Approval memory approval, address guardian) = abi.decode(
                callData,
                (Approval, address)
            );
            return
                _verifyApproval(
                    SigRequirement.MAJORITY_OWNER_REQUIRED,
                    approval,
                    abi.encode(
                        GuardianLib.ADD_GUARDIAN_TYPEHASH,
                        approval.wallet,
                        approval.validUntil,
                        guardian
                    )
                );
        }

        if (skipNonce && methodId == SmartWallet.removeGuardian.selector) {
            (Approval memory approval, address guardian) = abi.decode(
                callData,
                (Approval, address)
            );
            return
                _verifyApproval(
                    SigRequirement.MAJORITY_OWNER_REQUIRED,
                    approval,
                    abi.encode(
                        GuardianLib.REMOVE_GUARDIAN_TYPEHASH,
                        approval.wallet,
                        approval.validUntil,
                        guardian
                    )
                );
        }

        if (skipNonce && methodId == SmartWallet.resetGuardians.selector) {
            (Approval memory approval, address[] memory newGuardians) = abi
                .decode(callData, (Approval, address[]));
            return
                _verifyApproval(
                    SigRequirement.MAJORITY_OWNER_REQUIRED,
                    approval,
                    abi.encode(
                        GuardianLib.RESET_GUARDIANS_TYPEHASH,
                        approval.wallet,
                        approval.validUntil,
                        keccak256(abi.encodePacked(newGuardians))
                    )
                );
        }

        if (skipNonce && methodId == SmartWallet.changeDailyQuota.selector) {
            (Approval memory approval, uint newQuota) = abi.decode(
                callData,
                (Approval, uint)
            );
            return
                _verifyApproval(
                    SigRequirement.MAJORITY_OWNER_REQUIRED,
                    approval,
                    abi.encode(
                        QuotaLib.CHANGE_DAILY_QUOTE_TYPEHASH,
                        approval.wallet,
                        approval.validUntil,
                        newQuota
                    )
                );
        }

        if (skipNonce && methodId == SmartWallet.addToWhitelist.selector) {
            (Approval memory approval, address addr) = abi.decode(
                callData,
                (Approval, address)
            );
            return
                _verifyApproval(
                    SigRequirement.MAJORITY_OWNER_REQUIRED,
                    approval,
                    abi.encode(
                        WhitelistLib.ADD_TO_WHITELIST_TYPEHASH,
                        approval.wallet,
                        approval.validUntil,
                        addr
                    )
                );
        }

        if (skipNonce && methodId == SmartWallet.transferToken.selector) {
            (
                Approval memory approval,
                address token,
                address to,
                uint amount,
                bytes memory logdata
            ) = abi.decode(callData, (Approval, address, address, uint, bytes));
            return
                _verifyApproval(
                    SigRequirement.MAJORITY_OWNER_REQUIRED,
                    approval,
                    abi.encode(
                        ERC20Lib.TRANSFER_TOKEN_TYPEHASH,
                        approval.wallet,
                        approval.validUntil,
                        token,
                        to,
                        amount,
                        keccak256(logdata)
                    )
                );
        }

        if (skipNonce && methodId == SmartWallet.callContract.selector) {
            (
                Approval memory approval,
                address to,
                uint value,
                bytes memory data
            ) = abi.decode(callData, (Approval, address, uint, bytes));
            return
                _verifyApproval(
                    SigRequirement.MAJORITY_OWNER_REQUIRED,
                    approval,
                    abi.encode(
                        ERC20Lib.CALL_CONTRACT_TYPEHASH,
                        approval.wallet,
                        approval.validUntil,
                        to,
                        value,
                        keccak256(data)
                    )
                );
        }

        if (skipNonce && methodId == SmartWallet.approveToken.selector) {
            (
                Approval memory approval,
                address token,
                address to,
                uint amount
            ) = abi.decode(callData, (Approval, address, address, uint));
            return
                _verifyApproval(
                    SigRequirement.MAJORITY_OWNER_REQUIRED,
                    approval,
                    abi.encode(
                        ERC20Lib.APPROVE_TOKEN_TYPEHASH,
                        approval.wallet,
                        approval.validUntil,
                        token,
                        to,
                        amount
                    )
                );
        }

        if (
            skipNonce &&
            methodId == SmartWallet.approveThenCallContract.selector
        ) {
            (
                Approval memory approval,
                address token,
                address to,
                uint amount,
                uint value,
                bytes memory data
            ) = abi.decode(
                    callData,
                    (Approval, address, address, uint, uint, bytes)
                );
            return
                _verifyApproval(
                    SigRequirement.MAJORITY_OWNER_REQUIRED,
                    approval,
                    abi.encode(
                        ERC20Lib.APPROVE_THEN_CALL_CONTRACT_TYPEHASH,
                        approval.wallet,
                        approval.validUntil,
                        token,
                        to,
                        amount,
                        value,
                        keccak256(data)
                    )
                );
        }

        // the following methods cannot be called by owner, so owner signature is invalid here
        if (methodId == SmartWallet.inherit.selector) {
            if (wallet.inheritor == hash.recover(userOp.signature)) {
                return 0;
            }
            return SIG_VALIDATION_FAILED;
        }
        if (methodId == SmartWallet.unlock.selector) {
            Approval memory approval = abi.decode(callData, (Approval));
            return
                _verifyApproval(
                    SigRequirement.MAJORITY_OWNER_REQUIRED,
                    approval,
                    abi.encode(
                        LockLib.UNLOCK_TYPEHASH,
                        approval.wallet,
                        approval.validUntil
                    )
                );
        }

        if (methodId == SmartWallet.changeMasterCopy.selector) {
            (Approval memory approval, address newMasterCopy) = abi.decode(
                callData,
                (Approval, address)
            );
            return
                _verifyApproval(
                    SigRequirement.MAJORITY_OWNER_REQUIRED,
                    approval,
                    abi.encode(
                        UpgradeLib.CHANGE_MASTER_COPY_TYPEHASH,
                        approval.wallet,
                        approval.validUntil,
                        newMasterCopy
                    )
                );
        }

        if (methodId == SmartWallet.recover.selector) {
            // decode calldata
            (
                Approval memory approval,
                address newOwner,
                address[] memory newGuardians
            ) = abi.decode(callData, (Approval, address, address[]));

            return
                _verifyApproval(
                    SigRequirement.MAJORITY_OWNER_NOT_ALLOWED,
                    approval,
                    abi.encode(
                        RecoverLib.RECOVER_TYPEHASH,
                        approval.wallet,
                        approval.validUntil,
                        newOwner,
                        keccak256(abi.encodePacked(newGuardians))
                    )
                );
        }

        if (wallet.owner != hash.recover(userOp.signature))
            return SIG_VALIDATION_FAILED;
        return 0;
    }

    function _verifyApproval(
        SigRequirement sigRequirement,
        Approval memory approval,
        bytes memory encodedRequest
    ) internal returns (uint256) {
        require(address(this) == approval.wallet, "INVALID_WALLET");
        require(
            block.timestamp <= approval.validUntil,
            "EXPIRED_SIGNED_REQUEST"
        );

        bytes32 approvedHash = EIP712.hashPacked(
            DOMAIN_SEPARATOR,
            keccak256(encodedRequest)
        );

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
            return 0;
        }
        return SIG_VALIDATION_FAILED;
    }

    function isDataless(bytes memory data) public pure returns (bool) {
        // We don't require any data in the meta tx when
        // - the meta-tx has no nonce
        // - the meta-tx needs to be successful
        // - a function is called that requires a majority of guardians and fails when replayed
        bytes4 methodId = data.toBytes4(0);
        return (methodId == SmartWallet.changeMasterCopy.selector ||
            methodId == SmartWallet.addGuardian.selector ||
            methodId == SmartWallet.removeGuardian.selector ||
            methodId == SmartWallet.resetGuardians.selector ||
            methodId == SmartWallet.unlock.selector ||
            methodId == SmartWallet.changeDailyQuota.selector ||
            methodId == SmartWallet.recover.selector ||
            methodId == SmartWallet.addToWhitelist.selector ||
            methodId == SmartWallet.transferToken.selector ||
            methodId == SmartWallet.callContract.selector ||
            methodId == SmartWallet.approveToken.selector ||
            methodId == SmartWallet.approveThenCallContract.selector);
    }
}
