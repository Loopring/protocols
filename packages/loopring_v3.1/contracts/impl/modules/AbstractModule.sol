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
pragma experimental ABIEncoderV2;

import "../../iface/IDecompressor.sol";
import "../../iface/IExchangeV3.sol";
import "../../iface/modules/IAbstractModule.sol";
import "../../iface/IVerificationKeyProvider.sol";

import "../../lib/BytesUtil.sol";
import "../../lib/MathUint.sol";
import "../../lib/ReentrancyGuard.sol";


/// @title AbstractModule
/// @author Brecht Devos - <brecht@loopring.org>
contract AbstractModule is ReentrancyGuard, IAbstractModule
{
    using BytesUtil         for bytes;

    modifier onlyExchangeOwner()
    {
        require(msg.sender == exchange.owner(), "UNAUTHORIZED");
        _;
    }

    modifier onlyExchangeOperator()
    {
        require(msg.sender == exchange.getOperator(), "UNAUTHORIZED");
        _;
    }

    modifier onlyExchange()
    {
        require(msg.sender == address(exchange), "UNAUTHORIZED");
        _;
    }

    constructor(address exchangeAddress, address vkProviderAddress)
        public
    {
        exchange = IExchangeV3(exchangeAddress);
        loopring = exchange.getProtocol();

        exchangeId = exchangeId;
        onchainDataAvailability = exchange.hasOnchainDataAvailability();

        vkProvider = IVerificationKeyProvider(vkProviderAddress);
    }

    function getVerificationKey(
        CircuitData.Circuit memory circuit
        )
        public
        view
        returns (CircuitData.VerificationKey memory)
    {
        return vkProvider.getVerificationKey(
            circuit
        );
    }

    function isCircuitEnabled(
        CircuitData.Circuit memory circuit
        )
        public
        view
        returns (bool)
    {
        return vkProvider.isCircuitEnabled(
            circuit
        );
    }

    function commitBlock(
        uint32 blockSize,
        uint16 blockVersion,
        bytes  calldata /*data*/,
        bytes  calldata auxiliaryData,
        bytes  calldata /*offchainData*/
        )
        external
        onlyExchangeOperator
    {
        // Decompress the data here so we can extract the data directly from calldata
        bytes4 selector = IDecompressor(0x0).decompress.selector;
        bytes memory decompressed;
        assembly {
          // Calldata layout:
          //   0: selector
          //   4: blockSize
          //  36: blockVersion
          //  68: offset data
          // 100: offset offchainData
          let dataOffset := add(calldataload(68), 4)
          let mode := and(calldataload(add(dataOffset, 1)), 0xFF)
          switch mode
          case 0 {
              // No compression
              let length := sub(calldataload(dataOffset), 1)

              let data := mload(0x40)
              calldatacopy(add(data, 32), add(dataOffset, 33), length)
              mstore(data, length)
              decompressed := data
              mstore(0x40, add(add(decompressed, length), 32))
          }
          case 1 {
              // External contract
              let contractAddress := and(
                calldataload(add(dataOffset, 21)),
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
              let length := sub(calldataload(dataOffset), 21)

              let data := mload(0x40)
              mstore(data, selector)
              mstore(add(data,  4), 32)
              mstore(add(data, 36), length)
              calldatacopy(add(data, 68), add(dataOffset, 53), length)

              let success := staticcall(gas, contractAddress, data, add(68, length), 0x0, 0)
              if eq(success, 0) {
                revert(0, 0)
              }

              returndatacopy(data, 32, sub(returndatasize(), 32))
              decompressed := data
              mstore(0x40, add(add(decompressed, mload(decompressed)), 32))
          }
          default {
              revert(0, 0)
          }
        }
        // Pass the data to the internal commit function
        commitBlockInternal(
            blockSize,
            blockVersion,
            decompressed,
            auxiliaryData
        );
    }

    // Internal functions

    function commitBlockInternal(
        uint32 blockSize,
        uint16 blockVersion,
        bytes  memory data,
        bytes  memory auxiliaryData
        )
        internal
    {
        // Check if the block is supported
        require(
            vkProvider.isCircuitEnabled(
                CircuitData.Circuit(
                    onchainDataAvailability,
                    blockSize,
                    blockVersion
                )
            ),
            "CANNOT_COMMIT_BLOCK"
        );

        // Extract the exchange ID from the data
        uint32 exchangeIdInData = 0;
        assembly {
            exchangeIdInData := and(mload(add(data, 4)), 0xFFFFFFFF)
        }
        require(exchangeIdInData == exchangeId, "INVALID_EXCHANGE_ID");

        // Get the last block
        ExchangeData.Block memory lastBlock = exchange.getLastBlock();

        // Get the old and new Merkle roots
        bytes32 merkleRootBefore;
        bytes32 merkleRootAfter;
        assembly {
            merkleRootBefore := mload(add(data, 36))
            merkleRootAfter := mload(add(data, 68))
        }
        require(merkleRootBefore == lastBlock.merkleRoot, "INVALID_MERKLE_ROOT");
        require(uint256(merkleRootAfter) < ExchangeData.SNARK_SCALAR_FIELD(), "INVALID_MERKLE_ROOT");

        // Hash all the public data to a single value which is used as the input for the circuit
        bytes32 publicDataHash = data.fastSHA256();

        // Commit the block on the exchange
        uint blockIdx = exchange.commitBlock(
            merkleRootAfter,
            publicDataHash,
            blockSize,
            blockVersion
        );

        // Process the block
        processBlock(
            blockSize,
            blockVersion,
            data,
            auxiliaryData,
            uint32(blockIdx)
        );
    }

    // Needs to be implemented by every module
    function processBlock(
        uint32 blockSize,
        uint16 blockVersion,
        bytes  memory data,
        bytes  memory auxiliaryData,
        uint32 blockIdx
        )
        internal;
}