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
pragma solidity ^0.5.11;

import "../lib/AddressUtil.sol";
import "../lib/MathUint.sol";
import "../lib/SignatureUtil.sol";

import "../thirdparty/ERC1271.sol";

import "../iface/Wallet.sol";

import "../impl/MetaTxModule.sol";

import "../storage/GuardianStorage.sol";


/// @title LockModule
/// @dev  A module for managing wallet locking and unlocking by guardians.
///       Guardians of a wallet can use a meta-transaction to lock/unlock a wallet,
///       or they can can the lock/unlock method directly.
///
///       Wallet guardians can be contract addresses. If guardian contracts support
///       ERC1271, then meta-transactions will also be supported.
contract LockModule is MetaTxModule
{
    using SignatureUtil for bytes32;
    using AddressUtil   for address;

    event WalletLock(address indexed wallet, bool locked);

    GuardianStorage public guardianStorage;

    constructor(GuardianStorage _guardianStorage)
        public
    {
        guardianStorage = _guardianStorage;
    }

    modifier onlyGuardian(address wallet)
    {
        require(
            guardianStorage.isGuardian(msg.sender, wallet),
            "NOT_GUARDIAN");
        _;
    }

    function staticMethods()
        public
        pure
        returns (bytes4[] memory)
    {
        bytes4[] memory methods = new bytes4[](2);
        methods[0] = this.getLock.selector;
        methods[2] = this.isLocked.selector;
        return methods;
    }

    function lock(address wallet)
        external
        onlyGuardian(wallet)
        nonReentrant
    {
        lockInternal(wallet, msg.sender);
    }

    function unlock(address wallet)
        external
        onlyGuardian(wallet)
        nonReentrant
    {
        unlockInternal(wallet, msg.sender);
    }

    function lockAsGuardian(
        address wallet,
        address guardian
        )
        external
        onlyMetaTx
        nonReentrant
    {
        lockInternal(wallet, guardian);
    }

    function unlockAsGuardian(
        address wallet,
        address guardian
        )
        external
        onlyMetaTx
        nonReentrant
    {
        unlockInternal(wallet, guardian);
    }

    function getLock(address wallet)
        public
        view
        returns (uint)
    {
        return guardianStorage.getWalletLock(wallet);
    }

    function isLocked(address wallet)
        public
        view
        returns (bool)
    {
        return getLock(wallet) > 0;
    }

    /// @dev Validating meta-transaction signatures.
    function validateSignatures(
        address wallet,
        bytes   memory data,
        bytes32 metaTxHash,
        bytes   memory signatures)
        internal
        view
        returns (bool)
    {
        require(signatures.length == 65, "INVALID_SIGNATURE");

        bytes4 method = extractMethod(data);
        require(
            method == this.lockAsGuardian.selector ||
            method == this.unlockAsGuardian.selector,
            "INVALID_METHOD"
        );

        address guardian = extractGuardianAddress(data);
        if (!guardianStorage.isGuardian(guardian, wallet)) {
            return false;
        }

        if (guardian.isContract()) {
            return ERC1271(guardian).isValidSignature(data, signatures) == 0x20c13b0b;
        } else {
            return metaTxHash.recoverSigner(signatures, 0) == guardian;
        }
    }

    function extractGuardianAddress(bytes memory data)
        internal
        pure
        returns (address guardian)
    {
        require(data.length >= 68, "INVALID_DATA");
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            // data layout: {length:32}{sig:4}{_wallet:32}{_guardian:32}{...}
            guardian := mload(add(data, 68))
        }
    }

    function lockInternal(
        address wallet,
        address guardian
        )
        internal
    {
        // TODO
        emit WalletLock(wallet, true);
    }

    function unlockInternal(
        address wallet,
        address guardian
        )
        internal
    {
        // TODO
        emit WalletLock(wallet, false);
    }
}