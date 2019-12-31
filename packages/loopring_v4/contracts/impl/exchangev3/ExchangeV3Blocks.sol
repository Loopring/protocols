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

import "../../iface/exchangev3/IExchangeV3Blocks.sol";
import "../libexchange/ExchangeBlocks.sol";

import "./ExchangeV3Core.sol";


/// @title ExchangeV3Blocks
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ExchangeV3Blocks is IExchangeV3Blocks, ExchangeV3Core
{
    using ExchangeBlocks      for ExchangeData.State;

    function commitBlock(
        bytes32 merkleRoot,
        bytes32 publicDataHash,
        uint32  blockSize,
        uint16  blockVersion
        )
        external
        nonReentrant
        onlyModule
        returns (uint blockIdx)
    {
        return state.commitBlock(
            merkleRoot,
            publicDataHash,
            blockSize,
            blockVersion
        );
    }

    function verifyBlocks(
        uint[] calldata blockIndices,
        uint[] calldata proofs
        )
        external
        nonReentrant
        onlyOperator
    {
        state.verifyBlocks(blockIndices, proofs);
    }

    function revertBlock(
        uint blockIdx
        )
        external
        nonReentrant
        onlyOperator
    {
        state.revertBlock(blockIdx);
    }

    function getPrioritizedExchangeModule(
        address preferredExchangeModule
        )
        public
        view
        returns (address)
    {
        state.getPrioritizedExchangeModule(preferredExchangeModule);
    }

    function getBlockHeight()
        external
        view
        returns (uint)
    {
        return state.blocks.length;
    }

    function getNumBlocksFinalized()
        external
        view
        returns (uint)
    {
        return state.numBlocksFinalized;
    }

    function getBlock(
        uint blockIdx
        )
        external
        view
        returns (ExchangeData.Block memory)
    {
        return state.blocks[blockIdx];
    }

    function getLastBlock()
        external
        view
        returns (ExchangeData.Block memory)
    {
        return state.blocks[state.blocks.length - 1];
    }
}