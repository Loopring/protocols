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

import "./IAbstractModule.sol";


/// @title  IAbstractOnchainRequestModule
/// @author Brecht Devos - <brecht@loopring.org>
contract IAbstractOnchainRequestModule is IAbstractModule
{
    uint public constant MAX_AGE_REQUEST_UNTIL_FORCED = 15 minutes;
    uint public constant MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE = 1 days;

    uint32 public constant FEE_BLOCK_FINE_START_TIME = 5 minutes;
    uint32 public constant FEE_BLOCK_FINE_MAX_DURATION = 30 minutes;

    event BlockFeeWithdrawn(
        uint    indexed blockIdx,
        uint            amount
    );

    // Represents the post-state of an onchain deposit/withdrawal request. We can visualize
    // a deposit request-chain and a withdrawal request-chain, each of which is
    // composed of such Request objects. Please refer to the design doc for more details.
    struct Request
    {
        bytes32 accumulatedHash;
        uint    accumulatedFee;
        uint32  timestamp;
    }

    /// @dev Allows the exchange operator to withdraw the fees he earned by processing the
    ///      deposit and onchain withdrawal requests.
    ///
    ///      This function can only be called by the exchange operator.
    ///
    ///      The block fee can only be withdrawn from finalized blocks
    ///      (i.e. blocks that can never be reverted).
    ///
    /// @param  requestBlockIdx The request block index to withdraw the funds for
    /// @param  feeRecipient The address that receives the block fee
    /// @return feeAmountToOperator The amount of ETH earned in the block and sent to the operator
    function withdrawBlockFee(
        uint requestBlockIdx,
        address payable feeRecipient
        )
        external
        returns (uint feeAmountToOperator);

    /// @dev Gets an item from the request-chain.
    /// @param index The 0-based index of the request
    /// @return The request. See @Request
    function getRequest(
        uint index
        )
        external
        view
        returns (Request memory request);

    /// @dev Returns the index of the first request that wasn't yet included
    ///      in a block. Can be used to check if a request with a given requestIdx
    ///      (as specified in the events) was processed by the operator.
    /// @return The number of processed requests
    function getNumRequestsProcessed()
        public
        view
        returns (uint);

    /// @dev Gets the number of available slots.
    /// @return The number of slots avalable.
    function getNumAvailableSlots()
        public
        view
        returns (uint);
}
