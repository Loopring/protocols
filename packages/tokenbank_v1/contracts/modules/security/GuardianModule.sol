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

    mapping (address => mapping(address => uint)) private additionPending;
    mapping (address => mapping(address => uint)) private revokationPending;

    event GuardianAdditionPending(address indexed wallet, address indexed guardian, uint256 executeAfter);
    event GuardianRevokationPending(address indexed wallet, address indexed guardian, uint256 executeAfter);
    event GuardianAdditionCancelled(address indexed wallet, address indexed guardian);
    event GuardianRevokationCancelled(address indexed wallet, address indexed guardian);
    event GuardianAdded(address indexed wallet, address indexed guardian);
    event GuardianRevoked(address indexed wallet, address indexed guardian);

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
          uint pendingTime = additionPending[wallet][guardian];
          require(pendingTime == 0 || now > pendingTime + securityWindow, "ALREADY_PENDING");
          additionPending[wallet][guardian] = now + securityPeriod;
          emit GuardianAdditionPending(wallet, guardian, now + securityPeriod);
        }
    }

    function revokeGuardian(address wallet, address guardian)
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

        uint pendingTime = revokationPending[wallet][guardian];
        require(pendingTime == 0 || now > pendingTime + securityWindow, "ALREADY_PENDING");
        revokationPending[wallet][guardian] = now + securityPeriod;
        emit GuardianRevokationPending(wallet, guardian, now + securityPeriod);
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
