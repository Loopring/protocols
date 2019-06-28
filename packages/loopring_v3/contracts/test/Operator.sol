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
pragma solidity 0.5.7;

import "../iface/IExchange.sol";


contract Operator {

    IExchange exchange;

    constructor(
        address _exchangeAddress
        )
        public
    {
        exchange = IExchange(_exchangeAddress);
    }

    function commitBlock(
        uint8  blockType,
        uint16 blockSize,
        uint8  blockVersion,
        bytes calldata data,
        bytes calldata offchainData
        )
        external
    {
        exchange.commitBlock(blockType, blockSize, blockVersion, data, offchainData);
    }

    function verifyBlock(
        uint blockIdx,
        uint256[8] calldata proof
        )
        external
    {
        exchange.verifyBlock(blockIdx, proof);
    }

    function revertBlock(
        uint blockIdx
        )
        external
    {
        exchange.revertBlock(blockIdx);
    }

    function withdrawBlockFee(
        uint blockIdx
        )
        external
    {
        exchange.withdrawBlockFee(blockIdx, msg.sender);
    }

    function distributeWithdrawals(
        uint blockIdx,
        uint maxNumWithdrawals
        )
        external
    {
        exchange.distributeWithdrawals(blockIdx, maxNumWithdrawals);
    }
}
