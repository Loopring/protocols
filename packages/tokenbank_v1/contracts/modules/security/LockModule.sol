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

    uint public lockPeriod;

    event WalletLock(
        address indexed wallet,
        address indexed guardian,
        bool            locked
    );

    constructor(
        SecurityStorage _securityStorage,
        uint _lockPeriod
        )
        public
        SecurityModule(_securityStorage)
    {
        lockPeriod = _lockPeriod;
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

    function lock(address wallet, address guardian)
        external
        nonReentrantExceptFromThis
        onlyFromMetaTxOr(guardian)
        onlyWalletGuardian(wallet, guardian)
        onlyWhenWalletUnlocked(wallet)
    {
        require(guardian != address(0), "NULL_GUARDIAN");
        securityStorage.setLock(wallet, now + lockPeriod);
        emit WalletLock(wallet, guardian, true);
    }

    function unlock(address wallet, address guardian)
        external
        nonReentrantExceptFromThis
        onlyFromMetaTxOr(guardian)
        onlyWalletGuardian(wallet, guardian)
        onlyWhenWalletLocked(wallet)
    {
        securityStorage.setLock(wallet, 0);
        emit WalletLock(wallet, guardian, false);
    }

    function getLock(address wallet)
        public
        view
        returns (uint)
    {
        return securityStorage.getLock(wallet);
    }

    function isLocked(address wallet)
        public
        view
        returns (bool)
    {
        return securityStorage.isLocked(wallet);
    }

    function extractMetaTxSigners(
        bytes4  method,
        address /*wallet*/,
        bytes   memory data
        )
        internal
        pure
        returns (address[] memory signers)
    {
        require(
            method == this.lock.selector || method == this.unlock.selector,
            "INVALID_METHOD"
        );
        // data layout: {length:32}{sig:4}{_wallet:32}{_guardian:32}
        require(data.length == 68, "INVALID_DATA");
        address guardian;
        assembly { guardian := mload(add(data, 68)) }
        signers = new address[](1);
        signers[0] = guardian;
    }
}
