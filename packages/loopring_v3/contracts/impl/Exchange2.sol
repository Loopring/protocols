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

import "../lib/Ownable.sol";

import "../iface/IExchange2.sol";

import "./libexchange/ExchangeAccounts.sol";
import "./libexchange/ExchangeAdmins.sol";
import "./libexchange/ExchangeBalances.sol";
import "./libexchange/ExchangeBlocks.sol";
import "./libexchange/ExchangeData.sol";
import "./libexchange/ExchangeDeposits.sol";
import "./libexchange/ExchangeGenesis.sol";
import "./libexchange/ExchangeMode.sol";
import "./libexchange/ExchangeTokens.sol";
import "./libexchange/ExchangeWithdrawals.sol";


/// @title An Implementation of IExchange.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract Exchange2 is IExchange2, Ownable
{
    using ExchangeAdmins        for ExchangeData.State;
    using ExchangeAccounts      for ExchangeData.State;
    using ExchangeBalances      for ExchangeData.State;
    using ExchangeBlocks        for ExchangeData.State;
    using ExchangeDeposits      for ExchangeData.State;
    using ExchangeGenesis       for ExchangeData.State;
    using ExchangeMode          for ExchangeData.State;
    using ExchangeTokens        for ExchangeData.State;
    using ExchangeWithdrawals   for ExchangeData.State;

    ExchangeData.State public state;
    // -- Constructor --
    constructor(
        uint    _id,
        address _loopringAddress,
        address _owner,
        address payable _operator,
        bool    _onchainDataAvailability
        )
        public
        payable
    {
        require(address(0) != _owner, "ZERO_ADDRESS");
        owner = _owner;

        state.initializeGenesisBlock(
            _id,
            _loopringAddress,
            _operator,
            _onchainDataAvailability
        );
    }

    modifier onlyOperator()
    {
        require(msg.sender == state.operator, "UNAUTHORIZED");
        _;
    }

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
        )
    {
        return (
            ExchangeData.DEFAULT_ACCOUNT_PUBLICKEY_X(),
            ExchangeData.DEFAULT_ACCOUNT_PUBLICKEY_Y(),
            ExchangeData.DEFAULT_ACCOUNT_SECRETKEY(),
            ExchangeData.MAX_PROOF_GENERATION_TIME_IN_SECONDS(),
            ExchangeData.MAX_OPEN_REQUESTS(),
            ExchangeData.MAX_AGE_REQUEST_UNTIL_FORCED(),
            ExchangeData.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE(),
            ExchangeData.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS(),
            ExchangeData.MAX_NUM_TOKENS()
        );
    }

    // -- Mode --
    function isInWithdrawalMode()
        external
        view
        returns (bool result)
    {
        result = state.isInWithdrawalMode();
    }

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
        )
    {
        (accountID, pubKeyX, pubKeyY) = state.getAccount(owner);
    }

    function createOrUpdateAccount(
        uint pubKeyX,
        uint pubKeyY
        )
        external
        payable
        returns (
            uint24 accountID,
            bool   isAccountNew
        )
    {
        (accountID, isAccountNew) = state.createOrUpdateAccount(pubKeyX, pubKeyY);
    }

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
        pure
        returns (bool)
    {
        return ExchangeBalances.isAccountBalanceCorrect(
            merkleRoot,
            accountID,
            tokenID,
            pubKeyX,
            pubKeyY,
            nonce,
            balance,
            tradeHistoryRoot,
            accountPath,
            balancePath
        );
    }

    // -- Tokens --
    function registerToken(
        address tokenAddress
        )
        external
        payable
        onlyOwner
        returns (uint16 tokenID)
    {
        tokenID = state.registerToken(tokenAddress);
    }

    function getTokenID(
        address tokenAddress
        )
        external
        view
        returns (uint16 tokenID)
    {
        tokenID = state.getTokenID(tokenAddress);
    }

    function getTokenAddress(
        uint16 tokenID
        )
        external
        view
        returns (address tokenAddress)
    {
        tokenAddress = state.getTokenAddress(tokenID);
    }

    function disableTokenDeposit(
        address tokenAddress
        )
        external
        payable
        onlyOwner
    {
        state.disableTokenDeposit(tokenAddress);
    }

    function enableTokenDeposit(
        address tokenAddress
        )
        external
        payable
        onlyOwner
    {
        state.enableTokenDeposit(tokenAddress);
    }

    // -- Stakes --
    function getStake()
        external
        view
        returns (uint)
    {
        return state.loopring.getStake(state.id);
    }

    // -- Blocks --
    function getBlockHeight()
        external
        view
        returns (uint)
    {
        return state.blocks.length - 1;
    }

    function commitBlock(
        uint8 blockType,
        uint16 numElements,
        bytes calldata data
        )
        external
        payable
        onlyOperator
    {
        state.commitBlock(blockType, numElements, data);
    }

    function verifyBlock(
        uint blockIdx,
        uint256[8] calldata proof
        )
        external
        payable
        onlyOperator
    {
        state.verifyBlock(blockIdx, proof);
    }

    function revertBlock(
        uint32 blockIdx
        )
        external
    {
        state.revertBlock(blockIdx);
    }

    // -- Deposits --
    function getFirstUnprocessedDepositRequestIndex()
        external
        view
        returns (uint)
    {
        return state.getFirstUnprocessedDepositRequestIndex();
    }

    function getNumAvailableDepositSlots()
        external
        view
        returns (uint)
    {
        return state.getNumAvailableDepositSlots();
    }

    function getDepositRequest(
        uint index
        )
        external
        view
        returns (
          bytes32 accumulatedHash,
          uint256 accumulatedFee,
          uint32  timestamp
        )
    {
        (accumulatedHash, accumulatedFee, timestamp) = state.getDepositRequest(index);
    }

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
        )
    {
        (accountID, isAccountNew) = state.createOrUpdateAccount(pubKeyX, pubKeyY);
        uint additionalFeeETH;
        if (isAccountNew) {
            additionalFeeETH = state.accountCreationFeeETH;
        } else {
            additionalFeeETH = state.accountUpdateFeeETH;
        }
        state.depositTo(msg.sender, token, amount, additionalFeeETH);
    }

    function deposit(
        address token,
        uint96  amount
        )
        external
        payable
    {
        state.depositTo(msg.sender, token, amount, 0);
    }

    function depositTo(
        address recipient,
        address tokenAddress,
        uint96  amount
        )
        external
        payable
    {
        state.depositTo(recipient, tokenAddress, amount, 0);
    }

    // -- Withdrawals --
    function getFirstUnprocessedWithdrawalRequestIndex()
        external
        view
        returns (uint)
    {
        return state.getFirstUnprocessedWithdrawalRequestIndex();
    }

    function getNumAvailableWithdrawalSlots(
        )
        external
        view
        returns (uint)
    {
        return state.getNumAvailableWithdrawalSlots();
    }

    function getWithdrawRequest(
        uint index
        )
        external
        view
        returns (
            bytes32 accumulatedHash,
            uint256 accumulatedFee,
            uint32 timestamp
        )
    {
        (accumulatedHash, accumulatedFee, timestamp) = state.getWithdrawRequest(index);
    }

    // Set the large value for amount to withdraw the complete balance
    function withdraw(
        address token,
        uint96 amount
        )
        external
        payable
    {
        state.withdraw(token, amount);
    }

    function withdrawFromMerkleTree(
        address token,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot,
        uint256[24] calldata accountPath,
        uint256[12] calldata balancePath
        )
        external
        payable
    {
        state.withdrawFromMerkleTreeFor(
            msg.sender,
            token,
            nonce,
            balance,
            tradeHistoryRoot,
            accountPath,
            balancePath
        );
    }

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
        payable
    {
        state.withdrawFromMerkleTreeFor(
            owner,
            token,
            nonce,
            balance,
            tradeHistoryRoot,
            accountPath,
            balancePath
        );
    }

    function withdrawFromDepositRequest(
        uint depositRequestIdx
        )
        external
        payable
    {
        state.withdrawFromDepositRequest(depositRequestIdx);
    }

    function withdrawFromApprovedWithdrawal(
        uint blockIdx,
        uint slotIdx
        )
        external
    {
        state.withdrawFromApprovedWithdrawal(
            blockIdx,
            slotIdx
        );
    }

    function withdrawBlockFee(
        uint32 blockIdx
        )
        external
        payable
        returns (uint feeAmount)
    {
        feeAmount = state.withdrawBlockFee(blockIdx);
    }

    function distributeWithdrawals(
        uint blockIdx
        )
        external
    {
        state.distributeWithdrawals(blockIdx);
    }

    // -- Admins --
    function setOperator(
        address payable _operator
        )
        external
        onlyOwner
        returns (address payable oldOperator)
    {
        oldOperator = state.setOperator(_operator);
    }

    function setFees(
        uint _accountCreationFeeETH,
        uint _accountUpdateFeeETH,
        uint _depositFeeETH,
        uint _withdrawalFeeETH
        )
        external
        onlyOwner
    {
        state.setFees(
            _accountCreationFeeETH,
            _accountUpdateFeeETH,
            _depositFeeETH,
            _withdrawalFeeETH
        );
    }

    function getFees()
        external
        view
        returns (
            uint _accountCreationFeeETH,
            uint _accountUpdateFeeETH,
            uint _depositFeeETH,
            uint _withdrawalFeeETH
        )
    {
        _accountCreationFeeETH = state.accountCreationFeeETH;
        _accountUpdateFeeETH = state.accountUpdateFeeETH;
        _depositFeeETH = state.depositFeeETH;
        _withdrawalFeeETH = state.withdrawalFeeETH;
    }

    function purchaseDowntime(
        uint durationSeconds
        )
        external
        payable
        onlyOwner
    {
        state.purchaseDowntime(durationSeconds);
    }

    function getRemainingDowntime()
        external
        view
        returns (uint durationSeconds)
    {
        durationSeconds = state.getRemainingDowntime();
    }

    function getDowntimeCostLRC(
        uint durationSeconds
        )
        external
        view
        returns (uint costLRC)
    {
        costLRC = state.getDowntimeCostLRC(durationSeconds);
    }
}
