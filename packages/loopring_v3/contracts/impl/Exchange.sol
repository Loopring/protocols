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
contract Exchange is IExchange, Ownable
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
        address payable _loopringAddress,
        address _owner,
        address payable _operator,
        bool    _onchainDataAvailability
        )
        public
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
            uint32 MAX_PROOF_GENERATION_TIME_IN_SECONDS,
            uint16 MAX_OPEN_DEPOSIT_REQUESTS,
            uint16 MAX_OPEN_WITHDRAWAL_REQUESTS,
            uint32 MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE,
            uint32 MAX_AGE_REQUEST_UNTIL_FORCED,
            uint32 MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE,
            uint32 MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS,
            uint32 MAX_TIME_IN_SHUTDOWN_BASE,
            uint32 MAX_TIME_IN_SHUTDOWN_DELTA,
            uint32 TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS,
            uint32 FEE_BLOCK_FINE_START_TIME,
            uint32 FEE_BLOCK_FINE_MAX_DURATION,
            uint   MAX_NUM_TOKENS,
            uint   MAX_NUM_ACCOUNTS
        )
    {
        return (
            ExchangeData.MAX_PROOF_GENERATION_TIME_IN_SECONDS(),
            ExchangeData.MAX_OPEN_DEPOSIT_REQUESTS(),
            ExchangeData.MAX_OPEN_WITHDRAWAL_REQUESTS(),
            ExchangeData.MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE(),
            ExchangeData.MAX_AGE_REQUEST_UNTIL_FORCED(),
            ExchangeData.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE(),
            ExchangeData.MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS(),
            ExchangeData.MAX_TIME_IN_SHUTDOWN_BASE(),
            ExchangeData.MAX_TIME_IN_SHUTDOWN_DELTA(),
            ExchangeData.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS(),
            ExchangeData.FEE_BLOCK_FINE_START_TIME(),
            ExchangeData.FEE_BLOCK_FINE_MAX_DURATION(),
            ExchangeData.MAX_NUM_TOKENS(),
            ExchangeData.MAX_NUM_ACCOUNTS()
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

    function isShutdown()
        external
        view
        returns (bool result)
    {
        result = state.isShutdown();
    }

    // -- Accounts --
    function getNumAccounts()
        external
        view
        returns (uint)
    {
        return state.accounts.length;
    }

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
        (accountID, isAccountNew) = state.createOrUpdateAccount(
            pubKeyX,
            pubKeyY,
            true
        );
    }

    function createFeeRecipientAccount()
        external
        payable
        returns (uint24 accountID)
    {
        accountID = state.createFeeRecipientAccount();

        // We need to create a 0-value Ether deposit so this account will
        // become part of the offchain Merkle tree -- fee recipiient accounts cannot
        // receive further deposits.
        state.depositTo(
            true, // allowFeeRecipientAccount
            msg.sender,
            address(0),
            0,
            state.accountCreationFeeETH
        );
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
        uint256[20] calldata accountPath,
        uint256[8] calldata balancePath
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
    function getLRCFeeForRegisteringOneMoreToken()
        external
        view
        returns (uint feeLRC)
    {
        feeLRC = state.getLRCFeeForRegisteringOneMoreToken();
    }

    function registerToken(
        address tokenAddress
        )
        external
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
        onlyOwner
    {
        state.disableTokenDeposit(tokenAddress);
    }

    function enableTokenDeposit(
        address tokenAddress
        )
        external
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

    function withdrawStake(
        address recipient
        )
        external
        onlyOwner
        returns (uint)
    {
        return state.withdrawStake(recipient);
    }

    function burnStake()
        external
    {
        // Always allow burning the stake when the exchange gets into withdrawal mode for now
        if(state.isInWithdrawalMode()) {
            // Burn the complete stake of the exchange
            state.loopring.burnAllStake(state.id);
        }
    }

    // -- Blocks --
    function getBlockHeight()
        external
        view
        returns (uint)
    {
        return state.blocks.length - 1;
    }

    function getNumBlocksFinalized()
        external
        view
        returns (uint)
    {
        return state.numBlocksFinalized - 1;
    }

    function commitBlock(
        uint8 blockType,
        uint16 numElements,
        bytes calldata data
        )
        external
        onlyOperator
    {
        state.commitBlock(blockType, numElements, data);
    }

    function verifyBlock(
        uint blockIdx,
        uint256[8] calldata proof
        )
        external
        onlyOperator
    {
        state.verifyBlock(blockIdx, proof);
    }

    function revertBlock(
        uint blockIdx
        )
        external
        onlyOperator
    {
        state.revertBlock(blockIdx);
    }

    // -- Deposits --
    function getNumDepositRequestsProcessed()
        external
        view
        returns (uint)
    {
        return state.getNumDepositRequestsProcessed();
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
        (accountID, isAccountNew) = state.createOrUpdateAccount(
            pubKeyX,
            pubKeyY,
            false
        );
        uint additionalFeeETH;
        if (isAccountNew) {
            additionalFeeETH = state.accountCreationFeeETH;
        } else {
            additionalFeeETH = state.accountUpdateFeeETH;
        }
        state.depositTo(
            false, // allowFeeRecipientAccount
            msg.sender,
            token,
            amount,
            additionalFeeETH
        );
    }

    function deposit(
        address token,
        uint96  amount
        )
        external
        payable
    {
        state.depositTo(
            false, // allowFeeRecipientAccount
            msg.sender,
            token,
            amount,
            0
        );
    }

    function depositTo(
        address recipient,
        address tokenAddress,
        uint96  amount
        )
        external
        payable
    {
        state.depositTo(
            false, // allowFeeRecipientAccount
            recipient,
            tokenAddress,
            amount,
            0
        );
    }

    // -- Withdrawals --
    function getNumWithdrawalRequestsProcessed()
        external
        view
        returns (uint)
    {
        return state.getNumWithdrawalRequestsProcessed();
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
        uint    pubKeyX,
        uint    pubKeyY,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot,
        uint256[20] calldata accountPath,
        uint256[8] calldata balancePath
        )
        external
    {
        state.withdrawFromMerkleTreeFor(
            msg.sender,
            token,
            pubKeyX,
            pubKeyY,
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
        uint    pubKeyX,
        uint    pubKeyY,
        uint32  nonce,
        uint96  balance,
        uint256 tradeHistoryRoot,
        uint256[20] calldata accountPath,
        uint256[8] calldata balancePath
        )
        external
    {
        state.withdrawFromMerkleTreeFor(
            owner,
            token,
            pubKeyX,
            pubKeyY,
            nonce,
            balance,
            tradeHistoryRoot,
            accountPath,
            balancePath
        );
    }

    function withdrawFromDepositRequest(
        uint depositIdx
        )
        external
    {
        state.withdrawFromDepositRequest(depositIdx);
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
        uint blockIdx
        )
        external
        onlyOperator
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

    function shutdown()
        external
        onlyOwner
        returns (bool success)
    {
        require(!state.isInWithdrawalMode(), "INVALID_MODE");
        require(!state.isShutdown(), "ALREADY_SHUTDOWN");
        state.shutdownStartTime = now;
        return true;
    }

    function getRequestStats()
        external
        view
        returns(
            uint numDepositRequestsProcessed,
            uint numAvailableDepositSlots,
            uint numWithdrawalRequestsProcessed,
            uint numAvailableWithdrawalSlots
        )
    {
        numDepositRequestsProcessed = state.getNumDepositRequestsProcessed();
        numAvailableDepositSlots = state.getNumAvailableDepositSlots();
        numWithdrawalRequestsProcessed = state.getNumWithdrawalRequestsProcessed();
        numAvailableWithdrawalSlots = state.getNumAvailableWithdrawalSlots();
    }
}
