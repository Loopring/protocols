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
        address[] calldata /*signers*/,
        address   newOwner
        )
        external
        nonReentrant
        onlyFromMetaTx
        notWalletOwner(wallet, newOwner)
    {
        require(newOwner != address(0), "ZERO_ADDRESS");


        uint guardianCount = securityStorage.numGuardians(wallet);
        require(guardianCount > 0, "NO_GUARDIANS");

        WalletRecovery storage recovery = wallets[wallet];
        require(recovery.completeAfter == 0, "ALREAY_STARTED");

        recovery.newOwner = newOwner;
        recovery.completeAfter = now + recoveryPeriod;
        recovery.guardianCount = guardianCount;

        securityStorage.setLock(wallet, now + lockPeriod);

        emit RecoveryStarted(wallet, newOwner, recovery.completeAfter);
    }

    function cancelRecovery(
        address   wallet,
        address[] calldata /*signers*/
        )
        external
        nonReentrant
        onlyFromMetaTx
    {
        WalletRecovery storage recovery = wallets[wallet];
        require(recovery.completeAfter > 0, "NOT_STARTED");

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

    function isMetaTxValid(
        address /*signer*/,
        address wallet,
        bytes   memory data,
        bytes32 metaTxHash,
        bytes   memory signatures)
        internal
        view
        returns (bool)
    {
        bytes4 method = extractMethod(data);
        uint requiredSignatures;
        if (method == this.startRecovery.selector) {
            requiredSignatures = 0;
        } else if (method == this.completeRecovery.selector) {
            requiredSignatures = (securityStorage.numGuardians(wallet) + 1) / 2;
        } else  if (method == this.cancelRecovery.selector) {
            requiredSignatures = (wallets[wallet].guardianCount + 1) / 2;
        } else {
            return false;
        }
        if (signatures.length != 65 * requiredSignatures) return false;

        address lastSigner = address(0);
        for (uint i = 0; i < requiredSignatures; i++) {
            address signer = extractSigner(data, i);
            if (signer <= lastSigner) {
                return false;
            }

            lastSigner = signer;
            if (Wallet(wallet).owner() != signer &&
                !securityStorage.isGuardian(wallet, signer)) {
                return false;
            }

            if (!isSignatureValid(signer, metaTxHash, signatures, i)) {
                return false;
            }
        }
        return true;
    }

    function extractSigner(bytes memory data, uint idx)
        private
        pure
        returns (address signer)
    {
        uint start = 36 + 32 * (idx + 1);
        require(data.length >= start, "INVALID_DATA");
        assembly {
            // data layout: {length:32}{sig:4}{_wallet:32}{signer1:32}{signer2:32}{...}
            signer := mload(add(data, start))
        }
    }
}
