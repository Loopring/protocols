// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../lib/EIP712.sol";
import "../lib/SignatureUtil.sol";


/// @title StatelessWallet
/// @author Brecht Devos - <brecht@loopring.org>
contract StatelessWallet
{
    using SignatureUtil for bytes32;

    // bytes4(keccak256("transferOwnership(bytes,bytes)")
    bytes4 constant internal RECOVERY_MAGICVALUE = 0xd1f21f4f;

    bytes32 constant public GUARDIAN_TYPEHASH = keccak256(
        "Guardian(address addr,uint256 group)"
    );

    bytes32 constant public STATELESSWALLET_TYPEHASH = keccak256(
        "StatelessWallet(uint32 accountID,Guardian[] guardians,address inheritor,uint256 inheritableSince)Guardian(address addr,uint256 group)"
    );

    bytes32 constant public SOCIALRECOVERY_TYPEHASH = keccak256(
        "SocialRecovery(uint32 accountID,address oldOwner,address newOwner,uint32 nonce)"
    );

    struct Guardian
    {
        address  addr;
        uint     group;
    }

    struct Wallet
    {
        uint32     accountID;
        Guardian[] guardians;
        address    inheritor;
        uint       inheritableSince;
    }

    struct PermissionData
    {
        address[] signers;
        bytes[]   signatures;
    }

    bytes32 DOMAIN_SEPARATOR;

    modifier validateWallet(
        Wallet memory wallet,
        bytes32       walletDataHash,
        uint32        accountID
        )
    {
        require(wallet.accountID == accountID, "INVALID_WALLET_ACCOUNT");
        require(hashWalletData(wallet) == walletDataHash, "INVALID_WALLET_DATA");
        _;
    }

    constructor()
        public
    {
        DOMAIN_SEPARATOR = EIP712.hash(
            EIP712.Domain("Loopring Stateless Wallet", "1.0", address(this))
        );
    }

    function recover(
        uint32                accountID,
        uint32                nonce,
        address               oldOwner,
        address               newOwner,
        bytes32               walletDataHash,
        Wallet         memory wallet,
        PermissionData memory permissionData
        )
        external
        view
        validateWallet(wallet, walletDataHash, accountID)
        returns (bytes4)
    {
        require(
            permissionData.signers.length == permissionData.signatures.length,
            "INVALID_PERMISSION_DATA"
        );

        bytes32 hash = hashRecovery(
            accountID,
            oldOwner,
            newOwner,
            nonce
        );

        require(
            hash.verifySignatures(permissionData.signers, permissionData.signatures),
            "INVALID_SIGNATURES"
        );

        // TODO(brecht): Check guardians like usual in our main smart wallet...

        return RECOVERY_MAGICVALUE;
    }

    function inherit(
        uint32  accountID,
        uint32  /*nonce*/,
        address /*oldOwner*/,
        address newOwner,
        bytes32 walletDataHash,
        Wallet  memory wallet
        )
        external
        view
        validateWallet(wallet, walletDataHash, accountID)
        returns (bytes4)
    {
        require(now >= wallet.inheritableSince, "TOO_SOON_TO_INHERIT");
        require(wallet.inheritor == newOwner, "WRONG_INHERITOR");
        return RECOVERY_MAGICVALUE;
    }

    function hashWalletData(
        Wallet memory wallet
        )
        public
        view
        returns (bytes32)
    {
        bytes32[] memory guardianHashes = new bytes32[](wallet.guardians.length);
        for (uint i = 0; i < wallet.guardians.length; i++) {
            guardianHashes[i] = keccak256(
                abi.encode(
                    GUARDIAN_TYPEHASH,
                    wallet.guardians[i].addr,
                    wallet.guardians[i].group
                )
            );
        }
        return EIP712.hashPacked(
            DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    STATELESSWALLET_TYPEHASH,
                    wallet.accountID,
                    keccak256(abi.encodePacked(guardianHashes)),
                    wallet.inheritor,
                    wallet.inheritableSince
                )
            )
        );
    }

    // -- Internal --

    function hashRecovery(
        uint32  accountID,
        address oldOwner,
        address newOwner,
        uint32  nonce
        )
        internal
        view
        returns (bytes32)
    {
        return EIP712.hashPacked(
            DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    SOCIALRECOVERY_TYPEHASH,
                    accountID,
                    oldOwner,
                    newOwner,
                    nonce
                )
            )
        );
    }
}
