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


import "../../iface/modules/IAbstractWithdrawalModule.sol";
import "./AbstractOnchainRequestModule.sol";

import "../../iface/IExchangeV3.sol";
import "../../lib/AddressUtil.sol";
import "../../lib/MathUint.sol";


/// @title AbstractWithdrawalModule
/// @author Brecht Devos - <brecht@loopring.org>
contract AbstractWithdrawalModule is AbstractOnchainRequestModule, IAbstractWithdrawalModule
{
    using AddressUtil       for address payable;
    using MathUint          for uint;

    constructor(
        address exchangeAddress,
        address vkProviderAddress,
        uint    requestPriority,
        uint    maxOpenRequests
        )
        AbstractOnchainRequestModule(exchangeAddress, vkProviderAddress, requestPriority, maxOpenRequests)
        public
    {
        // Nothing to do
    }

    function withdrawFromApprovedWithdrawal(
        uint withdrawalBlockIdx,
        uint slotIdx
        )
        external
        nonReentrant
    {
        require(withdrawalBlockIdx < requestBlocks.length, "INVALID_REQUESTBLOCK_IDX");
        RequestBlock storage withdrawalBlock = requestBlocks[withdrawalBlockIdx];
        withdrawFromApprovedWithdrawal(
            withdrawalBlock,
            slotIdx,
            false
        );
    }

    function distributeWithdrawals(
        uint withdrawalBlockIdx,
        uint maxNumWithdrawals
        )
        external
    {
        require(withdrawalBlockIdx < requestBlocks.length, "INVALID_BLOCK_IDX");
        require(maxNumWithdrawals > 0, "INVALID_MAX_NUM_WITHDRAWALS");
        RequestBlock storage withdrawalBlock = requestBlocks[withdrawalBlockIdx];

        // Only allow withdrawing on finalized blocks
        require(withdrawalBlock.blockIdx < exchange.getNumBlocksFinalized(), "BLOCK_NOT_FINALIZED");
        // Check if the withdrawals were already completely distributed
        require(withdrawalBlock.numWithdrawalsDistributed < withdrawalBlock.numRequests, "WITHDRAWALS_ALREADY_DISTRIBUTED");

        // Only allow the operator to distribute withdrawals at first, if he doesn't do it in time
        // anyone can do it and get paid a part of the exchange stake
        bool bOnlyOperator = now < exchange.getBlock(withdrawalBlock.blockIdx).timestamp + MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS;
        if (bOnlyOperator) {
            require(msg.sender == exchange.getOperator(), "UNAUTHORIZED");
        }

        // Calculate the range of withdrawals we'll do
        uint start = withdrawalBlock.numWithdrawalsDistributed;
        uint end = start.add(maxNumWithdrawals);
        if (end > withdrawalBlock.numRequests) {
            end = withdrawalBlock.numRequests;
        }

        // Do the withdrawals
        uint gasLimit = MIN_GAS_TO_DISTRIBUTE_WITHDRAWALS;
        uint totalNumWithdrawn = start;
        while (totalNumWithdrawn < end && gasleft() >= gasLimit) {
            // Don't check the return value here, the withdrawal is allowed to fail.
            // The automatic token disribution by the operator is a best effort only.
            // The account owner can always manually withdraw without any limits.
            withdrawFromApprovedWithdrawal(
                withdrawalBlock,
                totalNumWithdrawn,
                true
            );
            totalNumWithdrawn++;
        }
        withdrawalBlock.numWithdrawalsDistributed = uint16(totalNumWithdrawn);

        // Fine the exchange if the withdrawals are done too late
        if (!bOnlyOperator) {
            // We use the stake of the exchange to punish withdrawals that are distributed too late
            uint numWithdrawn = totalNumWithdrawn.sub(start);
            uint totalFine = loopring.withdrawalFineLRC().mul(numWithdrawn);
            // Burn 50% of the fine, reward the distributer the rest
            uint amountToBurn = totalFine / 2;
            uint amountToDistributer = totalFine - amountToBurn;
            exchange.burnExchangeStake(amountToBurn);
            exchange.withdrawExchangeStake(msg.sender, amountToDistributer);
        }
    }

    // Internal functions

    function withdrawFromApprovedWithdrawal(
        RequestBlock storage withdrawalBlock,
        uint slotIdx,
        bool allowFailure
        )
        internal
        returns (bool success)
    {
        require(slotIdx < withdrawalBlock.numRequests, "INVALID_SLOT_IDX");
        // Only allow withdrawing on finalized blocks
        require(withdrawalBlock.blockIdx < exchange.getNumBlocksFinalized(), "BLOCK_NOT_FINALIZED");

        // Get the withdrawal data from storage for the given slot
        uint[] memory slice = new uint[](2);
        uint slot = (7 * slotIdx) / 32;
        uint offset = (7 * (slotIdx + 1)) - (slot * 32);
        uint sc = 0;
        uint data = 0;
        // Short byte arrays (length <= 31) are stored differently in storage
        if (withdrawalBlock.withdrawals.length >= 32) {
            bytes storage withdrawals = withdrawalBlock.withdrawals;
            uint dataSlot1 = 0;
            uint dataSlot2 = 0;
            assembly {
                // keccak hash to get the contents of the array
                mstore(0x0, withdrawals_slot)
                sc := keccak256(0x0, 0x20)
                dataSlot1 := sload(add(sc, slot))
                dataSlot2 := sload(add(sc, add(slot, 1)))
            }
            // Stitch the data together so we can extract the data in a single uint
            // (withdrawal data is at the LSBs)
            slice[0] = dataSlot1;
            slice[1] = dataSlot2;
            assembly {
                data := mload(add(slice, offset))
            }
        } else {
            bytes memory mWithdrawals = withdrawalBlock.withdrawals;
            assembly {
                data := mload(add(mWithdrawals, offset))
            }
        }

        // Extract the withdrawal data
        uint16 tokenID = uint16((data >> 48) & 0xFF);
        uint24 accountID = uint24((data >> 28) & 0xFFFFF);
        uint amount = (data & 0xFFFFFFF).decodeFloat(28);

        // Transfer the tokens
        if (amount > 0) {
            success = exchange.withdraw(
                accountID,
                tokenID,
                amount,
                allowFailure,
                allowFailure ? GAS_LIMIT_SEND_TOKENS : gasleft()
            );
        } else {
            success = true;
        }

        if (success && amount > 0) {
            // Set everything to 0 for this withdrawal so it cannot be used anymore
            data = data & uint(~((1 << (7 * 8)) - 1));

            // Update the data in storage
            if (withdrawalBlock.withdrawals.length >= 32) {
                assembly {
                    mstore(add(slice, offset), data)
                }
                uint dataSlot1 = slice[0];
                uint dataSlot2 = slice[1];
                assembly {
                    sstore(add(sc, slot), dataSlot1)
                    sstore(add(sc, add(slot, 1)), dataSlot2)
                }
            } else {
                bytes memory mWithdrawals = withdrawalBlock.withdrawals;
                assembly {
                    mstore(add(mWithdrawals, offset), data)
                }
                withdrawalBlock.withdrawals = mWithdrawals;
            }
        }
    }
}