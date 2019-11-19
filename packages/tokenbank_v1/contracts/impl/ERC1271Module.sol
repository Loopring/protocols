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

import "../thirdparty/ERC1271.sol";

import "../lib/MathUint.sol";
import "../lib/SignatureUtil.sol";

import "../iface/Wallet.sol";

import "./BaseModule.sol";


/// @title ERC1271Module
/// @dev This is the base module for supporting ERC1271.
contract ERC1271Module is BaseModule, ERC1271
{
    using SignatureUtil for bytes32;

    function staticMethods()
        public
        pure
        returns (bytes4[] memory)
    {
        bytes4[] memory methods = new bytes4[](1);
        methods[0] = this.isValidSignature.selector;
        return methods;
    }

    /// @dev This is a static method bound to wallet.
    ///      It checks if the current wallet owner is the data signer.
    function isValidSignature(
        bytes memory _data,
        bytes memory _signature
        )
        public
        view
        returns (bytes4);

    function isSignedByWalletOwner(
        bytes memory _data,
        bytes memory _signature
        )
        internal
        view
        returns (bool)
    {
        return isSignedBy(Wallet(address(this)).owner(), _data, _signature);
    }

    function isSignedBy(
        address      _address,
        bytes memory _data,
        bytes memory _signature
        )
        internal
        pure
        returns (bool)
    {
        if (_address == address(0) || _signature.length != 65) {
            return false;
        }

        bytes32 signHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(_data))
        );

        return signHash.recoverSigner(_signature, 0) == _address;
    }
}
