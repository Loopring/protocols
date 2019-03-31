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

/// @title An Implementation of IExchange.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract IExchange30
{
    // -- Events --
    // We need to make sure all events defined in exchange/*.sol
    // are aggregrated here.
    event AccountCreated(
        address owner,
        uint24  id,
        uint    pubKeyX,
        uint    pubKeyY
    );

    event AccountUpdated(
        address owner,
        uint24  id,
        uint    pubKeyX,
        uint    pubKeyY
    );

    event TokenRegistered(
        address token,
        uint16 tokenId
    );

    event OperatorChanged(
        uint exchangeId,
        address oldOperator,
        address newOperator
    );

    event FeesUpdated(
        uint accountCreationFeeETH,
        uint accountUpdateFeeETH,
        uint depositFeeETH,
        uint withdrawalFeeETH
    );

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

    event DepositRequested(
        uint32 depositIdx,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
    );

    event BlockFeeWithdraw(
        uint32 blockIdx,
        uint amount
    );

    event WithdrawalRequested(
        uint32 withdrawalIdx,
        uint24 accountID,
        uint16 tokenID,
        uint96 amount
    );

    event WithdrawalCompleted(
        uint24  accountID,
        uint16  tokenID,
        address to,
        uint96  amount
    );

    // -- Settings --
    function getGlobalSettings()
        public
        pure
        returns (
            uint   DEFAULT_ACCOUNT_PUBLICKEY_X,
            uint   DEFAULT_ACCOUNT_PUBLICKEY_Y,
            uint   DEFAULT_ACCOUNT_SECRETKEY,
            uint32 MAX_PROOF_GENERATION_TIME_IN_SECONDS,
            uint16 MAX_OPEN_REQUESTS,
            uint32 MAX_AGE_REQUEST_UNTIL_FORCED,
            uint32 MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE,
            uint32 TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS,
            uint   MAX_NUM_TOKENS
        );

    // -- Mode --
    function isInWithdrawalMode()
        external
        view
        returns(bool);

    // -- Accounts --
    function getAccount(
        address owner
        )
        external
        view
        returns (
            uint24 accountID,
            uint   pubKeyX,
            uint   pubKeyY
        );

    function createOrUpdateAccount(
        uint pubKeyX,
        uint pubKeyY
        )
        external
        payable
        returns (
            uint24 accountID,
            bool   isAccountNew
        );

    // -- Balances --
    function isAccountBalanceCorrect(
        uint256 merkleRoot,
        uint24  accountID,
        uint16  tokenID,
        uint256 pubKeyX,
        uint256 pubKeyY,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot,
        uint256[24] calldata accountPath,
        uint256[12] calldata balancePath
        )
        external
        returns (bool);

    // -- Tokens --
    function registerToken(
        address tokenAddress
        )
        external
        payable
        returns (uint16 tokenID);

    function getTokenID(
        address tokenAddress
        )
        external
        view
        returns (uint16 tokenID);

    function getTokenAddress(
        uint16 tokenID
        )
        external
        view
        returns (address tokenAddress);

    function disableTokenDeposit(
        address tokenAddress
        )
        external
        payable;

    function enableTokenDeposit(
        address tokenAddress
        )
        external
        payable;

    // -- Stakes --
    function getStake()
        external
        view
        returns (uint);

    // -- Blocks --
    function getBlockHeight()
        external
        view
        returns (uint);

    function commitBlock(
        uint8 blockType,
        uint16 numElements,
        bytes calldata data
        )
        external
        payable;

    function verifyBlock(
        uint blockIdx,
        uint256[8] calldata proof
        )
        external
        payable;

    function revertBlock(
        uint32 blockIdx
        )
        external
        payable;

    // -- Deposits --
    function getFirstUnprocessedDepositRequestIndex()
        external
        view
        returns (uint);

    function getNumAvailableDepositSlots()
        external
        view
        returns (uint);

    function getDepositRequest(
        uint index
        )
        external
        view
        returns (
          bytes32 accumulatedHash,
          uint256 accumulatedFee,
          uint32  timestamp
        );

    function updateAccountAndDeposit(
        uint    pubKeyX,
        uint    pubKeyY,
        address token,
        uint96  amount
        )
        external
        payable
        returns (
            uint24 accountID,
            bool   isAccountNew
        );

    function deposit(
        address token,
        uint96  amount
        )
        external
        payable;

    function depositTo(
        address recipient,
        address tokenAddress,
        uint96  amount
        )
        external
        payable;

    // -- Withdrawals --
    function getFirstUnprocessedWithdrawalRequestIndex()
        external
        view
        returns (uint);

    function getNumAvailableWithdrawalSlots(
        )
        external
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
            uint32 timestamp
        );

    // Set the large value for amount to withdraw the complete balance
    function withdraw(
        address token,
        uint96 amount
        )
        external
        payable;

    function withdrawFromMerkleTree(
        address token,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot,
        uint256[24] calldata accountPath,
        uint256[12] calldata balancePath
        )
        external
        payable;

    // We still alow anyone to withdraw these funds for the account owner
    function withdrawFromMerkleTreeFor(
        address owner,
        address token,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot,
        uint256[24] calldata accountPath,
        uint256[12] calldata balancePath
        )
        external
        payable;

    function withdrawFromDepositRequest(
        uint depositRequestIdx
        )
        external
        payable;

    function withdrawFromApprovedWithdrawal(
        uint blockIdx,
        uint slotIdx
        )
        external
        payable;

    function withdrawBlockFee(
        uint32 blockIdx
        )
        external
        payable
        returns (uint feeAmount);

    function distributeWithdrawals(
        uint blockIdx
        )
        external
        payable;

    // -- Admins --
    function setOperator(
        address payable _operator
        )
        external
        returns (address payable oldOperator);

    function setFees(
        uint _accountCreationFeeETH,
        uint _accountUpdateFeeETH,
        uint _depositFeeETH,
        uint _withdrawalFeeETH
        )
        external;

    function getFees()
        external
        view
        returns (
            uint _accountCreationFeeETH,
            uint _accountUpdateFeeETH,
            uint _depositFeeETH,
            uint _withdrawalFeeETH
        );

    function purchaseDowntime(
        uint durationSeconds
        )
        external
        payable;

    function getRemainingDowntime()
        external
        view
        returns (uint durationSeconds);

    function getDowntimeCostLRC(
        uint durationSeconds
        )
        external
        view
        returns (uint costLRC);
}