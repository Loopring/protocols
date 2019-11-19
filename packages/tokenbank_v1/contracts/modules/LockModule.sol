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

import "../lib/MathUint.sol";
import "../lib/SignatureUtil.sol";

import "../iface/Wallet.sol";

import "../impl/MetaTxModule.sol";

import "../storage/GuardianStorage.sol";


/// @title LockModule
/// @dev  A module for managing wallet locking and unlocking by guardians.
contract LockModule is MetaTxModule
{
    using SignatureUtil for bytes32;

    event WalletLock(address indexed wallet, bool locked);

    GuardianStorage public guardianStorage;

    constructor(GuardianStorage _guardianStorage)
        public
    {
        guardianStorage = _guardianStorage;
    }

    modifier onlyRelayerOrGuardian(address wallet)
    {
        require(
            msg.sender == address(this) || guardianStorage.isGuardian(msg.sender, wallet),
            "NOT_GUARDIAN");
        _;
    }

    function staticMethods()
        public
        pure
        returns (bytes4[] memory)
    {
        bytes4[] memory methods = new bytes4[](2);
        methods[0] = this.getWalletLock.selector;
        methods[2] = this.isWalletLocked.selector;
        return methods;
    }

    function lockWallet(address wallet)
        external
        onlyRelayerOrGuardian(wallet)
        nonReentrant
    {
        emit WalletLock(wallet, true);
    }

    function unlockWallet(address wallet)
        external
        onlyRelayerOrGuardian(wallet)
        nonReentrant
    {
        emit WalletLock(wallet, false);
    }

    function getWalletLock(address wallet)
        public
        view
        returns (uint)
    {
        return guardianStorage.getWalletLock(wallet);
    }

    function isWalletLocked(address wallet)
        public
        view
        returns (bool)
    {
        return getWalletLock(wallet) > 0;
    }

    /// @dev Validating meta-transaction signatures. For all methods
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
            method == this.lockWallet.selector || method == this.unlockWallet.selector,
            "INVALID_METHOD"
        );

        address signer = metaTxHash.recoverSigner(signatures, 0);
        return guardianStorage.isGuardian(signer, wallet);
    }
}