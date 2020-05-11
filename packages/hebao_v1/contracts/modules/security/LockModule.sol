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
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "../../lib/MathUint.sol";

import "../../thirdparty/ERC1271.sol";

import "../../iface/Wallet.sol";

import "./SecurityModule.sol";


/// @title LockModule
/// @dev  A module for managing wallet locking and unlocking by guardians.
///       Guardians of a wallet can use a meta-transaction to lock/unlock a wallet,
///       or they can call the lock/unlock method directly.
///
///       Wallet guardians can be contract addresses. If guardian contracts support
///       ERC1271, then meta-transactions will also be supported.
contract LockModule is SecurityModule
{
    using SignatureUtil for bytes32;
    using AddressUtil   for address;

    constructor(
        Controller _controller
        )
        public
        SecurityModule(_controller)
    {
    }

    function bindableMethods()
        public
        pure
        override
        returns (bytes4[] memory methods)
    {
        methods = new bytes4[](2);
        methods[0] = this.getLock.selector;
        methods[1] = this.isLocked.selector;
    }

    function lock(
        address wallet,
        address guardian
        )
        external
        nonReentrant
        // onlyWhenWalletUnlocked(wallet)
        onlyFromMetaTxOr(guardian)
        onlyWalletGuardian(wallet, guardian)
    {
        lockWallet(wallet);
    }

    function unlock(
        address wallet,
        address guardian
        )
        external
        nonReentrant
        // onlyWhenWalletLocked(wallet)
        onlyFromMetaTxOr(guardian)
        onlyWalletGuardian(wallet, guardian)
    {
        unlockWallet(wallet, false);
    }

    function getLock(address wallet)
        public
        view
        returns (uint _lock, address _lockedBy)
    {
        return getWalletLock(wallet);
    }

    function isLocked(address wallet)
        public
        view
        returns (bool)
    {
        return isWalletLocked(wallet);
    }

    function verifySigners(
        address   wallet,
        bytes4    method,
        bytes     memory data,
        address[] memory signers
        )
        internal
        view
        override
        returns (bool)
    {
        require(
            method == this.lock.selector || method == this.unlock.selector,
            "INVALID_METHOD"
        );

        address expectedSigner = extractAddressFromCallData(data, 1);

        // Check here already if the address is a guardian.
        // Otherwise anyone could create meta transaction for a wallet and spend the gas costs
        // (even a call that fails will reimburse the gas costs).
        require(isWalletOwnerOrGuardian(wallet, expectedSigner), "UNAUTHORIZED");

        return isOnlySigner(expectedSigner, signers);
    }
}
