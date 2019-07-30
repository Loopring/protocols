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
pragma solidity 0.5.10;

import "../libexchange/ExchangeData.sol";
import "../libexchange/ExchangeMode.sol";

import "./BaseBlockProcessor.sol";


/// @title OffChainWithdrawalBlock
/// @author Daniel Wang - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
contract OffChainWithdrawalBlock is BaseBlockProcessor
{
    using ExchangeMode for ExchangeData.State;

    bool public supportOffChainDataAvailability = true;

    function processBlock(
        uint8   blockType,
        uint16  blockSize,
        uint8   blockVersion,
        bytes32 publicDataHash,
        bytes32 merkleRootAfter,
        bytes   memory data // decompressed
        )
        public
    {
        uint start = 4 + 32 + 32;
        uint length = 7 * blockSize;

        bytes memory withdrawals;
        assembly {
            withdrawals := add(data, start)
            mstore(withdrawals, length)
        }

        ExchangeData.Block storage prevBlock = state.blocks[state.blocks.length - 1];

        ExchangeData.Block memory newBlock = ExchangeData.Block(
            merkleRootAfter,
            publicDataHash,
            ExchangeData.BlockState.COMMITTED,
            blockType,
            blockSize,
            blockVersion,
            uint32(now),
            prevBlock.numDepositRequestsCommitted,
            prevBlock.numWithdrawalRequestsCommitted,
            false,
            0,
            withdrawals
        );

        state.blocks.push(newBlock);
    }
}


