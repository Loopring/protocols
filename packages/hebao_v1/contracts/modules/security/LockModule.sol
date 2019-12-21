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
pragma solidity ^0.6.0;
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

    uint public lockPeriod;

    event WalletLock(
        address indexed wallet,
        address indexed guardian,
        bool            locked
    );

    constructor(
        Controller _controller,
        uint       _lockPeriod
        )
        public
        SecurityModule(_controller)
    {
        require(_lockPeriod > 0, "INVALID_DELAY");
        lockPeriod = _lockPeriod;
    }

    function boundMethods()
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
        onlyFromMetaTxOr(guardian)
        onlyWalletGuardian(wallet, guardian)
    {
        controller.securityStore().setLock(wallet, now + lockPeriod, guardian);
        emit WalletLock(wallet, guardian, true);
    }

    function unlock(
        address wallet,
        address guardian
        )
        external
        nonReentrant
        onlyFromMetaTxOr(guardian)
        onlyWalletGuardian(wallet, guardian)
        onlyWhenWalletLocked(wallet)
    {
        controller.securityStore().setLock(wallet, 0, guardian);
        emit WalletLock(wallet, guardian, false);
    }

    function getLock(address wallet)
        public
        view
        returns (uint _lock, address _guardian)
    {
        return controller.securityStore().getLock(wallet);
    }

    function isLocked(address wallet)
        public
        view
        returns (bool)
    {
        return controller.securityStore().isLocked(wallet);
    }

    function extractMetaTxSigners(
        address /*wallet*/,
        bytes4  method,
        bytes   memory data
        )
        internal
        view
        override
        returns (address[] memory signers)
    {
        require(
            method == this.lock.selector || method == this.unlock.selector,
            "INVALID_METHOD"
        );
        signers = new address[](1);
        signers[0] = extractAddressFromCallData(data, 1);
    }
}
