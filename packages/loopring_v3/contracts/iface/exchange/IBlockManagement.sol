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

import "./IAccountManagement.sol";

/// @title An Implementation of IDEX.
/// @author Daniel Wang  - <daniel@loopring.org>
contract IBlockManagement is IAccountManagement
{
    // == Events ==

    event BlockCommitted(
        uint blockIdx,
        bytes32 publicDataHash
    );

    event BlockFinalized(
        uint blockIdx
    );

    event Revert(
        uint blockIdx
    );

    event BlockFeeWithdraw(
        uint32 blockIdx,
        uint amount
    );

    event WithdrawBurned(
        address token,
        uint amount
    );

    event OperatorChanged(
        uint exchangeId,
        address oldOperator,
        address newOperator
    );

    // == Public Constants ==

    uint32  public constant MAX_PROOF_GENERATION_TIME_IN_SECONDS         = 1 hours;

    uint32  public constant MAX_AGE_REQUEST_UNTIL_FORCED                 = /*15 minutes*/ 1 days;     // TESTING
    uint32  public constant MAX_AGE_REQUEST_UNTIL_WITHDRAWMODE           = 1 days;

    uint16  public constant NUM_DEPOSITS_IN_BLOCK                        = 8;
    uint16  public constant NUM_WITHDRAWALS_IN_BLOCK                     = 8;

    uint32  public constant TIMESTAMP_WINDOW_SIZE_IN_SECONDS             = /*1 minutes*/ 1 days;        // TESTING

    // == Public Variables ==

    address payable public operator          = address(0);
    address public exchangeHelperAddress     = address(0);
    address public blockVerifierAddress      = address(0);

    uint    public depositFee       = 0;
    uint    public withdrawFee      = 0;

    // == Private Variables ==

    struct DepositRequest
    {
        uint24 accountID;
        uint16 tokenID;
        uint96 amount;
    }

    struct Request
    {
        bytes32 accumulatedHash;
        uint256 accumulatedFee;
        uint32 timestamp;
    }

    Request[] depositChain;
    DepositRequest[] depositRequests;

    Request[] withdrawChain;

    // == Public Functions ==

    function setFees(
        uint _depositFee,
        uint _withdrawFee
        )
        external;

    function getDepositFee()
        external
        view
        returns (uint);

    function getWithdrawFee()
        external
        view
        returns (uint);

    function commitBlock(
        uint blockType,
        bytes calldata data
        )
        external;

    function verifyBlock(
        uint blockIdx,
        uint256[8] calldata proof
        )
        external;

    function revertBlock(
        uint32 blockIdx
        )
        external;

    function distributeWithdrawals(
        uint blockIdx
        )
        external;

    function withdrawBlockFee(
        uint32 blockIdx
        )
        external
        returns (uint feeAmount);

    function getBlockIdx()
        external
        view
        returns (uint);

    function getNumAvailableDepositSlots()
        public
        view
        returns (uint);

    function getNumAvailableWithdrawSlots()
        public
        view
        returns (uint);

    function isInWithdrawMode()
        public
        view
        returns (bool);

    function withdrawFromMerkleTree(
        address token,
        uint256[24] calldata accountPath,
        uint256[12] calldata balancePath,
        uint32 nonce,
        uint96 balance,
        uint256 tradeHistoryRoot
        )
        external
        returns (bool);

    function withdrawFromMerkleTreeFor(
        address owner,
        address token,
        uint256[24] memory accountPath,
        uint256[12] memory balancePath,
        uint32 nonce,
        uint96 balance,
        uint256 tradeHistoryRoot
        )
        public
        returns (bool);

    function withdrawFromDepositRequest(
        uint depositRequestIdx
        )
        external
        returns (bool);

    function withdrawFromApprovedWithdrawal(
        uint blockIdx,
        uint slotIdx
        )
        external;

    function setOperator(address payable _operator)
        external
        returns (address payable oldOperator);

    function getTotalNumDepositRequests()
        external
        view
        returns (uint);

    function getLastUnprocessedDepositRequestIndex()
        external
        view
        returns (uint);

    function getDepositRequestInfo(
        uint index
        )
        external
        view
        returns (bytes32 accumulatedHash, uint256 accumulatedFee, uint32 timestamp);

    function getTotalNumWithdrawRequests()
        external
        view
        returns (uint);

    function getLastUnprocessedWithdrawRequestIndex()
        external
        view
        returns (uint);

    function getWithdrawRequestInfo(
        uint index
        )
        external
        view
        returns (bytes32 accumulatedHash, uint256 accumulatedFee, uint32 timestamp);
}