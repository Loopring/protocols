// SPDX-License-Identifier: Apache-2.0
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
    bytes4 constant internal ERC1271_MAGICVALUE = 0xd1f21f4f;

    bytes32 constant public GUARDIAN_TYPEHASH = keccak256(
        "Guardian(address addr,uint256 group)"
    );

    bytes32 constant public STATELESSWALLET_TYPEHASH = keccak256(
        "StatelessWallet(uint24 accountID,Guardian[] guardians,address inheritor,uint256 inheritableSince)Guardian(address addr,uint256 group)"
    );

    bytes32 constant public SOCIALRECOVERY_TYPEHASH = keccak256(
        "SocialRecovery(uint24 accountID,address oldOwner,address newOwner,uint32 nonce)"
    );

    struct Guardian
    {
        address  addr;
        uint     group;
    }

    struct Wallet
    {
        uint24     accountID;

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
        bytes32       expectedWalletHash,
        uint24        accountID
    )
    {
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
        bytes32 walletHash = EIP712.hashPacked(
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
        require(walletHash == expectedWalletHash, "INVALID_WALLET_DATA");
        require(wallet.accountID == accountID, "INVALID_WALLET_ACCOUNT");
        }
        _;
    }


    constructor()
        public
    {
        DOMAIN_SEPARATOR = EIP712.hash(EIP712.Domain("Loopring Stateless Wallet", "1.0", address(this)));
    }

    function recover(
        uint24                accountID,
        uint32                nonce,
        address               oldOwner,
        address               newOwner,
        bytes32               walletHash,
        Wallet         memory wallet,
        PermissionData memory permissionData
        )
        external
        view
        validateWallet(wallet, walletHash, accountID)
        returns (bytes4)
    {
        require(permissionData.signers.length == permissionData.signatures.length, "INVALID_DATA");

        bytes32 hash = hashRecovery(
            accountID,
            oldOwner,
            newOwner,
            nonce
        );
        require(hash.verifySignatures(permissionData.signers, permissionData.signatures), "INVALID_SIGNATURES");

        // TODO: Check guardians like usual in our main smart wallet...
        return ERC1271_MAGICVALUE;
    }

    function inherit(
        uint24                accountID,
        uint32                /*nonce*/,
        address               /*oldOwner*/,
        address               newOwner,
        bytes32               walletHash,
        Wallet         memory wallet
        )
        external
        view
        validateWallet(wallet, walletHash, accountID)
        returns (bytes4)
    {
        require(now >= wallet.inheritableSince, "TOO_SOON_TO_INHERIT");
        require(wallet.inheritor == newOwner, "WRONG_INHERITOR");
        return ERC1271_MAGICVALUE;
    }

    // -- Internal

    function hashRecovery(
        uint24                accountID,
        address               oldOwner,
        address               newOwner,
        uint32                nonce
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
