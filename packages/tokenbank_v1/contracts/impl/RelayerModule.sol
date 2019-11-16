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


contract RelayerModule is BaseModule
{
    uint constant public BLOCK_BOUND = 10000;
    struct WalletState {
        uint nonce;
        mapping (bytes32 => bool) executedHash;
    }
    mapping (address => WalletState) public wallets;

    event ExecutedSigned(
        uint    nonce,
        bytes32 signHash,
        bool    success
    );


    /// @dev Checks if the relayed transaction is unique.
    /// @param wallet The target wallet.
    /// @param signHash The signed hash of the transaction
    function saveExecutedHash(
        address wallet,
        bytes32 signHash
        )
        internal
    {
        require(!wallets[wallet].executedHash[signHash], "DUPLICIATE_SIGN_HASH");
        wallets[wallet].executedHash[signHash] = true;
    }

    /// @dev Checks that a nonce has the correct format and is valid.
    /// It must be constructed as nonce = {block number}{timestamp} where each component is 16 bytes.
    /// @param wallet The target wallet.
    /// @param nonce The nonce
    function updateNonce(
        address wallet,
        uint    nonce
        )
        internal
    {
        require(nonce <= wallets[wallet].nonce, "NONCE_TOO_SMALL");
        uint nonceBlock = (nonce & 0xffffffffffffffffffffffffffffffff00000000000000000000000000000000) >> 128;
        require(nonceBlock <= block.number + BLOCK_BOUND, "NONCE_TOO_LARGE");
        wallets[wallet].nonce = nonce;
    }

    function lastNonce(address wallet)
        internal
        view
        returns (uint)
    {
        return wallets[wallet].nonce;
    }

   //  function executeSigned(
   //      address from,
   //      address to,
   //      uint256 value,
   //      bytes   data,
   //      uint    nonce,
   //      uint    gasPrice,
   //      uint    gasLimit,
   //      address gasToken,
   //      bytes   extraHash,
   //      bytes   messageSignatures
   //      )
   //      external
   //  {
   //      uint startGas = gasleft();
   //      require(startGas >= gasLimit);
   //      // require(_nonce == 0 || );

   //      bytes32 signHash = keccak256(
   //          "\x19Ethereum Signed Message:\n32",
   //          keccak256(
   //              byte(0x19),
   //              byte(0),
   //              from,
   //              to,
   //              value,
   //              keccak256(data),
   //              nonce,
   //              gasPrice,
   //              gasLimit,
   //              gasToken,
   //              extraHash
   //              )
   //          );


   //      address signer = recoverSigner(
   //          signHash,
   //          messageSignatures,
   //          0
   //      );

   //      // approveAndCall()

   //      if (gasPrice > 0) {
   //          uint256 gas = 21000 + (startGas - gasleft());
   //          gas  *= _gasPrice;
   //          if (gasToken == address(0)) {
   //              address(msg.sender).transfer(gas);
   //          } else {
   //              ERC20Token(gasToken).transfer(msg.sender, gas);
   //          }
   //      }
   //  }

   //  function requiredSignatures(
   //      address wallet,
   //      bytes memory data
   //      )
   //      returns (uint)
   //      internal
   //      view
   //  {
   //      return 0;
   //  }


   //  function validateSignatures(
   //      wallet wallet,
   //      bytes memory data,
   //      bytes32 signHash,
   //      bytes memory signatures)
   //      internal
   //      view
   //      returns (bool)
   //  {
   //      return true;
   //  }


   //  /// @dev   Recovers the signer at a given index from a list of concatenated signatures.
   //  /// @param signedHash The signed hash
   //  /// @param signatures The concatenated signatures.
   //  /// @param index The index of the signature to recover.
   // function recoverSigner(
   //      bytes32      signHash,
   //      bytes memory signatures,
   //      uint         index
   //      )
   //      internal
   //      pure
   //      returns (address)
   //  {
   //      uint8 v;
   //      bytes32 r;
   //      bytes32 s;
   //      // we jump 32 (0x20) as the first slot of bytes contains the length
   //      // we jump 65 (0x41) per signature
   //      // for v we load 32 bytes ending with v (the first 31 come from s) then apply a mask
   //      assembly {
   //          r := mload(add(signatures, add(0x20, mul(0x41, index))))
   //          s := mload(add(signatures, add(0x40, mul(0x41, index))))
   //          v := and(mload(add(signatures, add(0x41, mul(0x41, index)))), 0xff)
   //      }
   //      require(v == 27 || v == 28);
   //      return ecrecover(_signedHash, v, r, s);
   //  }

   //  function approveAndCall(
   //      bytes32 signHash,
   //      address token,
   //      address to,
   //      uint256 value,
   //      bytes   data
   //  )
   //      internal
   //  {
   //      ERC20Token(token).approve(to, value);
   //      bool result = to.call(data)
   //      emit ExecutedSigned(signHash, result);

   //  }

}