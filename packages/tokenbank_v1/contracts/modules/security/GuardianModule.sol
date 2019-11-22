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
    uint public securityPeriod;
    // the security window
    uint public securityWindow;

    constructor(
        SecurityStorage _securityStorage,
        uint _securityPeriod,
        uint _securityWindow
        )
        public
        SecurityModule(_securityStorage)
    {
        securityPeriod = _securityPeriod;
        securityWindow = _securityWindow;
    }

    function addGuardian(address wallet, address guardian)
        external
        onlyMetaTxOrWalletOwner(wallet)
        onlyWhenUnlocked(wallet)
    {
        // require(!isOwner(_wallet, _guardian), "GM: target guardian cannot be owner");
        // require(!isGuardian(_wallet, _guardian), "GM: target is already a guardian");
        // // Guardians must either be an EOA or a contract with an owner()
        // // method that returns an address with a 5000 gas stipend.
        // // Note that this test is not meant to be strict and can be bypassed by custom malicious contracts.
        // // solium-disable-next-line security/no-low-level-calls
        // (bool success,) = _guardian.call.gas(5000)(abi.encodeWithSignature("owner()"));
        // require(success, "GM: guardian must be EOA or implement owner()");
        // if(guardianStorage.guardianCount(_wallet) == 0) {
        //     guardianStorage.addGuardian(_wallet, _guardian);
        //     emit GuardianAdded(address(_wallet), _guardian);
        // } else {
        //     bytes32 id = keccak256(abi.encodePacked(address(_wallet), _guardian, "addition"));
        //     GuardianManagerConfig storage config = configs[address(_wallet)];
        //     require(
        //         config.pending[id] == 0 || now > config.pending[id] + securityWindow,
        //         "GM: addition of target as guardian is already pending");
        //     config.pending[id] = now + securityPeriod;
        //     emit GuardianAdditionRequested(address(_wallet), _guardian, now + securityPeriod);
        // }
    }


    function revokeGuardian(address wallet, address guardian)
        external
        onlyMetaTxOrWalletOwner(wallet)
        onlyWhenUnlocked(wallet)
    {
        // require(!isOwner(_wallet, _guardian), "GM: target guardian cannot be owner");
        // require(!isGuardian(_wallet, _guardian), "GM: target is already a guardian");
        // // Guardians must either be an EOA or a contract with an owner()
        // // method that returns an address with a 5000 gas stipend.
        // // Note that this test is not meant to be strict and can be bypassed by custom malicious contracts.
        // // solium-disable-next-line security/no-low-level-calls
        // (bool success,) = _guardian.call.gas(5000)(abi.encodeWithSignature("owner()"));
        // require(success, "GM: guardian must be EOA or implement owner()");
        // if(guardianStorage.guardianCount(_wallet) == 0) {
        //     guardianStorage.addGuardian(_wallet, _guardian);
        //     emit GuardianAdded(address(_wallet), _guardian);
        // } else {
        //     bytes32 id = keccak256(abi.encodePacked(address(_wallet), _guardian, "addition"));
        //     GuardianManagerConfig storage config = configs[address(_wallet)];
        //     require(
        //         config.pending[id] == 0 || now > config.pending[id] + securityWindow,
        //         "GM: addition of target as guardian is already pending");
        //     config.pending[id] = now + securityPeriod;
        //     emit GuardianAdditionRequested(address(_wallet), _guardian, now + securityPeriod);
        // }
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
