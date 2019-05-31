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
import "../lib/ERC20SafeTransfer.sol";

import "../iface/IExchange.sol";

/// @title Operator
/// @author Daniel Wang  - <daniel@loopring.org>
/// @dev An operator base contract that does not do any fancy work.
contract Operator is Ownable
{
    using ERC20SafeTransfer for address;

    address public exchange;

    // -- Constructor --
    constructor(
        address _exchange
        )
        public
    {
        require(address(0) != _exchange, "ZERO_ADDRESS");
        exchange = _exchange;
        owner = msg.sender;
    }

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

    /// @dev Forward the call to the DEX.
    function verifyBlock(
        uint blockIdx,
        uint256[8] calldata proof
        )
        external
        onlyOwner
    {
        IExchange(exchange).verifyBlock(blockIdx, proof);
    }

    /// @dev Forward the call to the DEX.
    function revertBlock(
        uint blockIdx
        )
        external
        onlyOwner
    {
        IExchange(exchange).revertBlock(blockIdx);
    }

    /// @dev Forward the call to the DEX.
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

    /// @dev Forward the call to the DEX.
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

    /// @dev Forward the call to the DEX.
    function deposit(
        address token,
        uint96  amount
        )
        external
        payable
    {
        IExchange(exchange).deposit(token, amount);
    }

    /// @dev Withdraw tokens/ether held in this contract to a designated address.
    function drain(
        address payable recipient,
        address         token,
        uint96          amount
        )
        external
        payable
        onlyOwner
    {
        require(address(0) != recipient, "ZERO_ADDRESS");
        if (token == address(0x0)) {
            // ETH
            recipient.transfer(amount);
        } else {
            // ERC20 token
            require(token.safeTransfer(recipient, amount), "TRANSFER_FAILURE");
        }
    }
}