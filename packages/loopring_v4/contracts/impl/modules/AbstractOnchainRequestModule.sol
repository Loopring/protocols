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

import "../../iface/modules/IAbstractOnchainRequestModule.sol";
import "./AbstractModule.sol";

import "../../lib/AddressUtil.sol";
import "../../lib/MathUint.sol";


/// @title OnchainRequestModule
/// @author Brecht Devos - <brecht@loopring.org>
contract AbstractOnchainRequestModule is AbstractModule, IAbstractOnchainRequestModule
{
    using AddressUtil       for address payable;
    using MathUint          for uint;

    uint public requestPriority;
    uint public maxOpenRequests;

    struct RequestBlock
    {
        // The exchange block index (NOT the request block index)
        uint32 blockIdx;

        // Number of requests processed in the block (<= blockSize)
        uint32 numRequests;

        // The number of onchain deposit requests that have been processed
        // up to and including this block.
        uint32 totalNumRequestsCommitted;

        // Stores whether the fee earned by the operator for processing onchain requests
        // is withdrawn or not.
        bool   blockFeeWithdrawn;

        // Number of withdrawals distributed using `distributeWithdrawals`
        uint32 numWithdrawalsDistributed;

        // The approved withdrawal data. Needs to be stored onchain so this data is available
        // once the block is finalized and the funds can be withdrawn using the info stored
        // in this data.
        // For every withdrawal (there are 'blockSize' withdrawals),
        // stored sequentially after each other:
        //    - Token ID: 1 bytes
        //    - Account ID: 2.5 bytes
        //    - Amount: 3.5 bytes
        bytes  withdrawals;
    }

    Request[] requestChain;
    RequestBlock[] requestBlocks;

    constructor(
        address exchangeAddress,
        address vkProviderAddress,
        uint   _requestPriority,
        uint   _maxOpenRequests
        )
        AbstractModule(exchangeAddress, vkProviderAddress)
        public
    {
        requestPriority = _requestPriority;
        maxOpenRequests = _maxOpenRequests;

        Request memory genesisRequest = Request(
            0,
            0,
            0xFFFFFFFF
        );
        requestChain.push(genesisRequest);

        RequestBlock memory genesisRequestBlock = RequestBlock(
            0,
            0,
            1,
            true,
            0,
            new bytes(0)
        );
        requestBlocks.push(genesisRequestBlock);
    }

    function onRevert(
        uint blockIdx
        )
        external
        onlyExchange
    {
        uint requestBlockIdx = findRightmostCorrespondingRequestBlockIdx(blockIdx);
        if (requestBlockIdx < requestBlocks.length) {
            // Remove all blocks after and including requestBlockIdx
            requestBlocks.length = requestBlockIdx;
        }
    }

    function getStatus()
        external
        view
        returns (bool needsWithdrawalMode, bool hasOpenRequests, uint priority)
    {
        uint totalNumRequestsCommitted = requestBlocks[requestBlocks.length - 1].totalNumRequestsCommitted;
        hasOpenRequests = totalNumRequestsCommitted < requestChain.length;
        if (hasOpenRequests) {
            uint32 requestTimestamp = requestChain[totalNumRequestsCommitted].timestamp;
            needsWithdrawalMode = requestTimestamp < now.sub(MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE);
            priority = requestTimestamp < now.sub(MAX_AGE_REQUEST_UNTIL_FORCED) ? requestPriority : 0;
        }
    }

    function withdrawBlockFee(
        uint requestBlockIdx,
        address payable feeRecipient
        )
        external
        nonReentrant
        onlyExchangeOperator
        returns (uint feeAmountToOperator)
    {
        require(requestBlockIdx < requestBlocks.length, "INVALID_DEPOSITBLOCK_IDX");
        RequestBlock memory requestedBlock = requestBlocks[requestBlockIdx];
        RequestBlock memory previousBlock = requestBlocks[requestBlockIdx - 1];

        require(requestedBlock.blockIdx < exchange.getNumBlocksFinalized(), "BLOCK_NOT_FINALIZED");
        require(requestedBlock.blockFeeWithdrawn == false, "FEE_WITHDRAWN_ALREADY");

        uint feeAmount = 0;
        uint32 lastRequestTimestamp = 0;
        uint startIndex = previousBlock.totalNumRequestsCommitted;
        uint endIndex = requestedBlock.totalNumRequestsCommitted;
        assert(endIndex > startIndex);
        feeAmount = requestChain[endIndex - 1].accumulatedFee.sub(
            requestChain[startIndex - 1].accumulatedFee
        );
        lastRequestTimestamp = requestChain[endIndex - 1].timestamp;

        // Calculate how much of the fee the operator gets for the block
        // If there are many requests than lastRequestTimestamp ~= firstRequestTimestamp so
        // all requests will need to be done in FEE_BLOCK_FINE_START_TIME minutes to get the complete fee.
        // If there are very few requests than lastRequestTimestamp >> firstRequestTimestamp and we don't want
        // to fine the operator for waiting until he can fill a complete block.
        // This is why we use the timestamp of the last request included in the block.
        uint32 blockTimestamp = exchange.getBlock(requestedBlock.blockIdx).timestamp;
        uint32 startTime = lastRequestTimestamp + FEE_BLOCK_FINE_START_TIME;
        uint fine = 0;
        if (blockTimestamp > startTime) {
            fine = feeAmount.mul(blockTimestamp - startTime) / FEE_BLOCK_FINE_MAX_DURATION;
        }
        uint feeAmountToBurn = (fine > feeAmount) ? feeAmount : fine;
        feeAmountToOperator = feeAmount - feeAmountToBurn;

        // Make sure it can't be withdrawn again
        requestedBlock.blockFeeWithdrawn = true;

        // Burn part of the fee by sending it to the protocol fee manager
        loopring.protocolFeeVault().sendETHAndVerify(feeAmountToBurn, gasleft());
        // Transfer the fee to the operator
        feeRecipient.sendETHAndVerify(feeAmountToOperator, gasleft());

        emit BlockFeeWithdrawn(requestBlockIdx, feeAmount);
    }

    function getRequest(
        uint index
        )
        external
        view
        returns (Request memory request)
    {
        require(index < requestChain.length, "INVALID_INDEX");
        request = requestChain[index];
    }

    function getNumRequestsProcessed()
        public
        view
        returns (uint)
    {
        RequestBlock storage currentRequestBlock = requestBlocks[requestBlocks.length - 1];
        return currentRequestBlock.totalNumRequestsCommitted;
    }

    function getNumAvailableSlots()
        public
        view
        returns (uint)
    {
        uint numOpenRequests = requestChain.length - getNumRequestsProcessed();
        return maxOpenRequests - numOpenRequests;
    }

    // Internal functions

    function findRightmostCorrespondingRequestBlockIdx(
        uint blockIdx
        )
        internal
        view
        returns (uint)
    {
        // Binary search the blockIdx in the request blocks
        // Instead of a binary search we _could_ start searching from the end of the request blocks,
        // but that can still end up being a long search. The cost of a binary search is low and predictable.
        // If there's no request block with the given blockIdx, we find the rightmost element.
        // https://en.wikipedia.org/wiki/Binary_search_algorithm#Procedure_for_finding_the_rightmost_element
        uint L = 0;
        uint R = requestBlocks.length;
        while (L < R) {
            uint m = (L + R) / 2;
            if (requestBlocks[m].blockIdx > blockIdx) {
                R = m;
            } else {
                L = m + 1;
            }
        }
        uint requestBlockIdx = L - 1;
        return requestBlockIdx;
    }


}