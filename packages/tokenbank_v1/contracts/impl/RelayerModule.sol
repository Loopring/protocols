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
        address indexed wallet,
        uint    nonce,
        bytes32 signHash,
        bool    success
    );

    function validateSignatures(
        address wallet,
        bytes   memory data,
        bytes32 signHash,
        bytes   memory signatures)
        internal
        view
        returns (bool);

    function executeSigned(
        bytes   calldata data,
        uint    nonce,
        uint    gasPrice,
        uint    gasLimit,
        address gasToken,
        bytes   calldata extraHash,
        bytes   calldata signatures
        )
        external
    {
        uint startGas = gasleft();
        require(startGas >= gasLimit);

        address wallet = extractWalletAddress(data);
        bytes32 signHash = getSignHash(
            wallet, // from
            address(this),  // to
            0, // value
            data,
            nonce,
            gasPrice,
            gasLimit,
            gasToken,
            extraHash
        );

        require(
            validateSignatures(wallet, data, signHash, signatures),
            "INVALID_SIGNATURES"
        );
        saveExecuted(wallet, nonce, signHash);
        (bool success,) = address(this).call(data);

        // uint gas = startGas - gasleft();

        emit ExecutedSigned(wallet, nonce, signHash, success);
    }

    function lastNonce(address wallet)
        public
        view
        returns (uint)
    {
        return wallets[wallet].nonce;
    }

    function extractWalletAddress(bytes memory data)
        public
        pure
        returns (address wallet)
    {
        require(data.length >= 36, "INVALID_DATA");
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            // data layout: {length:32}{sig:4}{_wallet:32}{...}
            wallet := mload(add(data, 36))
        }
    }

    function getSignHash(
        address from,
        address to,
        uint256 value,
        bytes   memory data,
        uint256 nonce,
        uint256 gasPrice,
        uint256 gasLimit,
        address gasToken,
        bytes   memory extraHash
        )
        public
        pure
        returns (bytes32)
    {
        bytes32 hash = keccak256(abi.encodePacked(
            byte(0x19),
            byte(0),
            from,
            to,
            value,
            keccak256(data),
            nonce,
            gasPrice,
            gasLimit,
            gasToken,
            extraHash
            )
        );

        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }



    /// @dev   Recovers the signer at a given index from a list of concatenated signatures.
    /// @param signHash The signed hash
    /// @param signatures The concatenated signatures.
    /// @param index The index of the signature to recover.
   function recoverSigner(
        bytes32      signHash,
        bytes memory signatures,
        uint         index
        )
        public
        pure
        returns (address)
    {
        uint8 v;
        bytes32 r;
        bytes32 s;
        // we jump 32 (0x20) as the first slot of bytes contains the length
        // we jump 65 (0x41) per signature
        // for v we load 32 bytes ending with v (the first 31 come from s) then apply a mask
        assembly {
            r := mload(add(signatures, add(0x20, mul(0x41, index))))
            s := mload(add(signatures, add(0x40, mul(0x41, index))))
            v := and(mload(add(signatures, add(0x41, mul(0x41, index)))), 0xff)
        }
        require(v == 27 || v == 28);
        return ecrecover(signHash, v, r, s);
    }

    function extractMethod(bytes memory data)
        public
        pure
        returns (bytes4 method)
    {
        require(data.length >= 4, "INVALID_DATA");
        assembly {
            // data layout: {length:32}{sig:4}{_wallet:32}{...}
            method := mload(add(data, 32))
        }
    }

    // ===== Private methods =====

    /// @dev Save the relayed transaction to history.
    ///      This method must throw if the transaction is not unique or the nonce is invalid.
    /// @param wallet The target wallet.
    /// @param nonce The nonce
    /// @param signHash The signed hash of the transaction
    function saveExecuted(
        address wallet,
        uint    nonce,
        bytes32 signHash
        )
        private
    {
        if (nonce == 0) {
            require(!wallets[wallet].executedHash[signHash], "DUPLICIATE_SIGN_HASH");
            wallets[wallet].executedHash[signHash] = true;
        } else {
            require(nonce <= wallets[wallet].nonce, "NONCE_TOO_SMALL");
            uint nonceBlock = (nonce & 0xffffffffffffffffffffffffffffffff00000000000000000000000000000000) >> 128;
            require(nonceBlock <= block.number + BLOCK_BOUND, "NONCE_TOO_LARGE");
            wallets[wallet].nonce = nonce;
        }
    }
}