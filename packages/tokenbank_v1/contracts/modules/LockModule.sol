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
///       or they can call the lock/unlock method directly.
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

    modifier onlyGuardianOrRelayed(address wallet)
    {
        require(
            msg.sender == address(this) || guardianStorage.isGuardian(msg.sender, wallet),
            "NOT_GUARDIAN");
        _;
    }

    function staticMethods()
        public
        pure
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](2);
        methods[0] = this.getLock.selector;
        methods[1] = this.isLocked.selector;
    }

    function lock(address wallet)
        external
        onlyGuardianOrRelayed(wallet)
        nonReentrant
    {
        // TODO
        emit WalletLock(wallet, true);
    }

    function unlock(address wallet)
        external
        onlyGuardianOrRelayed(wallet)
        nonReentrant
    {
        // TODO
        emit WalletLock(wallet, false);
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
    function validateMetaTx(
        address signer,
        address wallet,
        bytes   memory data,
        bytes32 metaTxHash,
        bytes   memory signatures)
        internal
        view
        returns (bool)
    {
        bytes4 method = extractMethod(data);
        if (method == this.lock.selector || method == this.unlock.selector) {
            if (!guardianStorage.isGuardian(signer, wallet)) {
                return false;
            }
            if (signer.isContract()) {
                return ERC1271(signer).isValidSignature(data, signatures) == ERC1271_MAGICVALUE;
            } else {
                return signatures.length == 65 && metaTxHash.recoverSigner(signatures, 0) == signer;
            }
        }
    }
}
