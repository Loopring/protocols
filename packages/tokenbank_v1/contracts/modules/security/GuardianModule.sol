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


/// @title GuardianModule
contract GuardianModule is SecurityModule
{
    using SignatureUtil for bytes32;
    using AddressUtil   for address;

      // the security period
    uint public pendingPeriod;
    // the security window
    uint public confirmPeriod;

    mapping (address => mapping(address => uint)) public pendingAdditions;
    mapping (address => mapping(address => uint)) public pendingRemovals;

    event GuardianAdditionPending   (address indexed wallet, address indexed guardian, uint confirmAfter);
    event GuardianAdded             (address indexed wallet, address indexed guardian);
    event GuardianAdditionCancelled (address indexed wallet, address indexed guardian);

    event GuardianRemovalPending    (address indexed wallet, address indexed guardian, uint confirmAfter);
    event GuardianRemoved           (address indexed wallet, address indexed guardian);
    event GuardianRemovalCancelled  (address indexed wallet, address indexed guardian);

    constructor(
        SecurityStorage _securityStorage,
        uint _pendingPeriod,
        uint _confirmPeriod
        )
        public
        SecurityModule(_securityStorage)
    {
        pendingPeriod = _pendingPeriod;
        confirmPeriod = _confirmPeriod;
    }

    function addGuardian(
        address wallet,
        address guardian
        )
        external
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
        onlyNotWalletGuardian(wallet, guardian)
        onlyNotWalletOwner(wallet, guardian)
    {
        require(guardian != address(0), "ZERO_ADDRESS");
        // Guardians must either be an EOA or a contract with an owner()
        // method that returns an address with a 5000 gas stipend.
        // Note that this test is not meant to be strict and can be bypassed by custom malicious contracts.
        // solium-disable-next-line security/no-low-level-calls
        // (bool success,) = _guardian.call.gas(5000)(abi.encodeWithSignature("owner()"));
        // require(success, "GM: guardian must be EOA or implement owner()");

        if (securityStorage.numGuardians(wallet) == 0) {
            securityStorage.addGuardian(wallet, guardian);
            emit GuardianAdded(wallet, guardian);
        } else {
          uint confirmStart = pendingAdditions[wallet][guardian];
          require(confirmStart == 0 || now > confirmStart + confirmPeriod, "ALREADY_PENDING");
          pendingAdditions[wallet][guardian] = now + pendingPeriod;
          emit GuardianAdditionPending(wallet, guardian, now + pendingPeriod);
        }
    }

    function confirmGuardianAddition(
        address wallet,
        address guardian
        )
        external
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        uint confirmStart = pendingAdditions[wallet][guardian];
        require(confirmStart != 0, "NOT_PENDING");
        require(now > confirmStart && now < confirmStart + confirmPeriod, "EXPIRED");
        securityStorage.addGuardian(wallet, guardian);
        delete pendingAdditions[wallet][guardian];
        emit GuardianAdded(wallet, guardian);
    }

    function cancelGuardianAddition(
        address wallet,
        address guardian
        )
        external
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        uint confirmStart = pendingAdditions[wallet][guardian];
        require(confirmStart > 0, "INVALID_GUARDIAN");
        delete pendingAdditions[wallet][guardian];
        emit GuardianAdditionCancelled(wallet, guardian);
    }

    function revokeGuardian(
        address wallet,
        address guardian
        )
        external
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
        onlyNotWalletGuardian(wallet, guardian)
    {
        // // Guardians must either be an EOA or a contract with an owner()
        // // method that returns an address with a 5000 gas stipend.
        // // Note that this test is not meant to be strict and can be bypassed by custom malicious contracts.
        // // solium-disable-next-line security/no-low-level-calls
        // (bool success,) = _guardian.call.gas(5000)(abi.encodeWithSignature("owner()"));
        // require(success, "GM: guardian must be EOA or implement owner()");

        uint confirmStart = pendingRemovals[wallet][guardian];
        require(confirmStart == 0 || now > confirmStart + confirmPeriod, "ALREADY_PENDING");
        pendingRemovals[wallet][guardian] = now + pendingPeriod;
        emit GuardianRemovalPending(wallet, guardian, now + pendingPeriod);
    }

    function confirmGuardianRemoval(
        address wallet,
        address guardian
        )
        external
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        uint confirmStart = pendingRemovals[wallet][guardian];
        require(confirmStart != 0, "NOT_PENDING");
        require(now > confirmStart && now < confirmStart + confirmPeriod, "EXPIRED");
        securityStorage.removeGuardian(wallet, guardian);
        delete pendingRemovals[wallet][guardian];
        emit GuardianRemoved(wallet, guardian);
    }

    function cancelGuardianRemoval(
        address wallet,
        address guardian
        )
        external
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
    {
        uint confirmStart = pendingRemovals[wallet][guardian];
        require(confirmStart > 0, "INVALID_GUARDIAN");
        delete pendingAdditions[wallet][guardian];
        emit GuardianRemovalCancelled(wallet, guardian);
    }

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
        if (method == this.addGuardian.selector || method == this.revokeGuardian.selector) {
            address owner = Wallet(wallet).owner();
            if (signer != owner) return false;

            if (signer.isContract()) {
                // TODO (daniel): return false in case of error, not throw exception
                return ERC1271(signer).isValidSignature(data, signatures) != ERC1271_MAGICVALUE;
            } else {
                return signatures.length == 65 && metaTxHash.recoverSigner(signatures, 0) == signer;
            }
        }
    }
}
