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

import "./BaseModule.sol";

import "../iface/Wallet.sol";

import "../lib/MathUint.sol";
import "../lib/ERC1271.sol";
import "../lib/SignatureUtil.sol";

/// @title ERC1271Module
/// @dev This is the base module for supporting ERC1271.
contract ERC1271Module is BaseModule, ERC1271
{
    bytes4 constant internal SELECTOR_IS_VALID_SIGNATURE =
        bytes4(keccak256("isValidSignature(bytes,bytes)"));

    function staticMethods()
        public
        pure
        returns (bytes4[] memory)
    {
        bytes4[] memory methods = new bytes4[](1);
        methods[0] = SELECTOR_IS_VALID_SIGNATURE;
        return methods;
    }

    /// @dev This method is expected to be called from a wallet's default function.
    function isValidSignature(
        bytes memory _data,
        bytes memory _signature
        )
        public
        view
        returns (bytes4)
    {
        return isValidSignatureFrom(address(this), _data, _signature);
    }

    function isValidSignatureFrom(
        address      _address,
        bytes memory _data,
        bytes memory _signature
        )
        public
        pure
        returns (bytes4)
    {
        if (_signature.length != 65) {
            return bytes4(0);
        }

        bytes32 signHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            keccak256(_data)
            )
        );

        if (SignatureUtil.recoverSigner(signHash, _signature, 0) != _address) {
            return bytes4(0);
        }

        return MAGICVALUE;
    }
}