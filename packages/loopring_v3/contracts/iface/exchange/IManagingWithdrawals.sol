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
pragma solidity 0.5.2;

import "./IManagingDeposits.sol";


/// @title IManagingWithdrawals
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
contract IManagingWithdrawals is IManagingDeposits
{
    function getFirstUnprocessedWithdrawalRequestIndex()
        external
        view
        returns (uint);

    // TODO(brecht): not implemented yet
    function getNumAvailableWithdrawalSlots()
        public
        view
        returns (uint);

    function getWithdrawRequest(
        uint index
        )
        external
        view
        returns (
            bytes32 accumulatedHash,
            uint256 accumulatedFee,
            uint32  timestamp
        );

    function withdraw(
        address token,
        uint96 amount
        )
        external
        payable;

/*
    function withdrawFromMerkleTree(
        address token,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot,
        uint256[24] calldata accountPath,
        uint256[12] calldata balancePath
        )
        external;

    function withdrawFromMerkleTreeFor(
        address owner,
        address token,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot,
        uint256[24] memory accountPath,
        uint256[12] memory balancePath
        )
        public;

    function withdrawFromDepositRequest(
        uint depositRequestIdx
        )
        external;

    function withdrawFromApprovedWithdrawal(
        uint blockIdx,
        uint slotIdx
        )
        external;
*/

    function withdrawBlockFee(
        uint32 blockIdx
        )
        external
        returns (uint feeAmount);

    function distributeWithdrawals(
        uint blockIdx
        )
        external;

}