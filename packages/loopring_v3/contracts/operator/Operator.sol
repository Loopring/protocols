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

import "../lib/Ownable.sol";

import "../iface/IExchange.sol";

/// @title Operator
/// @author Daniel Wang  - <daniel@loopring.org>
contract Operator is Ownable
{
    address  exchange;

    function commitBlock(
        uint8 blockType,
        uint16 blockSize,
        bytes calldata data
        )
        onlyOwner
        external
        returns (bytes32 merkleRootAfter)
    {
       return IExchange(exchange).commitBlock(blockType, blockSize, data);
    }

    function verifyBlock(
        uint blockIdx,
        uint256[8] calldata proof
        )
        external
        onlyOwner
    {
        IExchange(exchange).verifyBlock(blockIdx, proof);
    }

    function revertBlock(
        uint blockIdx
        )
        external
        onlyOwner
    {
        IExchange(exchange).revertBlock(blockIdx);
    }

    function withdrawBlockFee(
        uint blockIdx,
        address payable feeRecipient
        )
        external
        onlyOwner
        returns (uint feeAmount)
    {
        return IExchange(exchange).withdrawBlockFee(blockIdx, feeRecipient);
    }

    /// @dev Make a withdrawal request onchain.
    function withdraw(
        address token,
        uint96 amount
        )
        external
        payable
        onlyOwner
    {
        IExchange(exchange).withdraw(token, amount);
    }

    /// @dev Withdrawal the tokens/ether held in this contract.
    function withdrawTo(
        address token,
        uint96 amount
        )
        external
        payable
        onlyOwner
    {
        // TODO(dongw): defaults to withdrawing to msg.sender.
    }
}