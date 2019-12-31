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

import "./IAbstractOnchainRequestModule.sol";


/// @title  IAbstractWithdrawalModule
/// @author Brecht Devos - <brecht@loopring.org>
contract IAbstractWithdrawalModule is IAbstractOnchainRequestModule
{
    uint public constant MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS = 2 hours;
    uint public constant MIN_GAS_TO_DISTRIBUTE_WITHDRAWALS = 60000;
    uint public constant GAS_LIMIT_SEND_TOKENS = 30000;

    /// @dev Allows withdrawing funds after a withdrawal request (either onchain
    ///      or offchain) was committed in a block by the operator.
    ///
    ///      Can be called by anyone. The withdrawn tokens will be sent to
    ///      the owner of the account they were withdrawn out.
    ///
    ///      Normally it should not be needed for users to call this manually.
    ///      Funds from withdrawal requests will be sent to the account owner
    ///      by the operator in distributeWithdrawals. The user can however
    ///      choose to withdraw earlier if he wants, or will need to call this
    ///      manually if nobody calls distributeWithdrawals.
    ///
    ///      Funds can only be withdrawn from requests processed in a
    ///      finalized block (i.e. a block that can never be reverted).
    ///
    /// @param  withdrawalBlockIdx The request block the withdrawal requests
    ///                            were committed in.
    /// @param  slotIdx The index in the list of withdrawals that were processed
    ///                 by the operator. It is not possible for users to know
    ///                 what this index will be for their withdrawal request.
    function withdrawFromApprovedWithdrawal(
        uint withdrawalBlockIdx,
        uint slotIdx
        )
        external;

    /// @dev Distributes the funds to the account owners after their withdrawal
    ///      requests were processed by the operator.
    ///
    ///      Needs to be called by the operator after submitting a block processing
    ///      withdrawal requests (either onchain or offchain requests) after the block
    ///      is finalized and before the block is MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS seconds old.
    ///
    ///      If the operator fails to do so anyone will be able to call this function
    ///      and the stake of the exchange will be used to reward the caller of this function.
    ///      The amount of staked LRC withdrawn is calculated as follows:
    ///
    ///      totalFine = withdrawalFineLRC * numWithdrawalRequestsInBlock
    ///      The caller of the function will be rewarded half this amount,
    ///      the other half is burned.
    ///
    ///      Only withdrawals processed in finalized blocks can be distributed.
    ///
    ///      The withdrawals can be done in multiple transactions because the token transfers
    ///      are more expensive than committing and proving a block, so it's possible more
    ///      withdrawals requests are processed in a block than can be distributed
    ///      in an Ethereum block.
    ///      This function will automatically stop distributing the withdrawals when the amount
    ///      of gas left is less than MIN_GAS_TO_DISTRIBUTE_WITHDRAWALS.
    ///      So there are 2 ways to  limit the number of withdrawals:
    ///          - using the maxNumWithdrawals parameter
    ///          - limiting the amount of gas in the transaction
    ///
    /// @param  withdrawalBlockIdx The request block index to distribute the funds
    ///         from the withdrawal requests for.
    /// @param  maxNumWithdrawals The max number of withdrawals to distribute. Can be lower than the
    ///         number of withdrawal requests processed in the block. Withdrawals are distributed
    ///         in the same order the withdrawal requests were processed in the block.
    ///         If the withdrawals are done in multiple parts we always start from the
    ///         first withdrawal that was not yet distributed.
    function distributeWithdrawals(
        uint withdrawalBlockIdx,
        uint maxNumWithdrawals
        )
        external;
}
