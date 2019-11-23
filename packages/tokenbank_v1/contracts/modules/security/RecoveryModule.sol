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

import "../../lib/AddressUtil.sol";
import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";

import "../../thirdparty/ERC1271.sol";

import "../../iface/Wallet.sol";

import "./SecurityModule.sol";


/// @title RecoveryModule
contract RecoveryModule is SecurityModule
{

    event RecoveryStarted   (address indexed wallet, address indexed newOwner, uint completeAfter);
    event RecoveryCompleted (address indexed wallet, address indexed newOwner);
    event RecoveryCancelled (address indexed wallet);

    struct WalletRecovery {
        address newOwner;
        uint    completeAfter;
        uint    guardianCount;
    }

    mapping (address => WalletRecovery) public wallets;
    uint public recoveryPeriod;
    uint public lockPeriod;

    constructor(
        SecurityStorage _securityStorage,
        uint _recoveryPeriod,
        uint _lockPeriod
        )
        public
        SecurityModule(_securityStorage)
    {
        // TODO(which should be large?)
        recoveryPeriod = _recoveryPeriod;
        lockPeriod = _lockPeriod;
    }

    function startRecovery(
        address   wallet,
        address[] calldata signers,
        address   newOwner
        )
        external
        nonReentrant
        onlyFromMetaTx
        notWalletOwner(wallet, newOwner)
    {
        require(newOwner != address(0), "ZERO_ADDRESS");

        WalletRecovery storage recovery = wallets[wallet];
        require(recovery.completeAfter == 0, "ALREAY_STARTED");

        uint guardianCount = securityStorage.numGuardians(wallet);
        require(signers.length >=  (guardianCount + 1)/2, "NOT_ENOUGH_SIGNER");
        require(areWalletOwnerOrGuardian(wallet, signers), "UNAUTHORIZED");

        recovery.newOwner = newOwner;
        recovery.completeAfter = now + recoveryPeriod;
        recovery.guardianCount = guardianCount;

        securityStorage.setLock(wallet, now + lockPeriod);

        emit RecoveryStarted(wallet, newOwner, recovery.completeAfter);
    }

    function cancelRecovery(
        address   wallet,
        address[] calldata signers
        )
        external
        nonReentrant
        onlyFromMetaTx
    {
        WalletRecovery storage recovery = wallets[wallet];
        require(recovery.completeAfter > 0, "NOT_STARTED");

        uint guardianCount = wallets[wallet].guardianCount;
        require(signers.length >= (guardianCount + 1) / 2, "NOT_ENOUGH_SIGNER");
        require(areWalletOwnerOrGuardian(wallet, signers), "UNAUTHORIZED");

        delete wallets[wallet];
        securityStorage.setLock(wallet, 0);

        emit RecoveryCancelled(wallet);
    }

    function completeRecovery(address wallet)
        external
        nonReentrant
        onlyFromMetaTx
    {
        WalletRecovery storage recovery = wallets[wallet];
        require(recovery.completeAfter > 0, "NOT_STARTED");
        require(recovery.completeAfter < now, "TWO_EARLY");

        Wallet(wallet).setOwner(recovery.newOwner);

        delete wallets[wallet];
        securityStorage.setLock(wallet, 0);

        emit RecoveryCompleted(wallet, recovery.newOwner);
    }

    function extractMetaTxSigners(
        address /*wallet*/,
        bytes4  method,
        bytes   memory data
        )
        internal
        view
        returns (address[] memory signers)
    {
        require(method == this.startRecovery.selector ||
            method == this.completeRecovery.selector ||
            method == this.cancelRecovery.selector);

        // data layout: {length:32}{sig:4}{_wallet:32}{signer1:32}{signer2:32}{...}
        require((data.length - 68) % 32 == 0, "INVALID_DATA");
        uint numSigners = (data.length - 68) / 32;
        signers = new address[](numSigners);

        address signer;
        for (uint i = 0; i < numSigners; i++) {
            uint start = 68 + 32 * i;
            assembly {signer := mload(add(data, start)) }
            signers[i] = signer;
        }
    }
}
