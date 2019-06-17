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

import "../lib/Claimable.sol";
import "../lib/ReentrancyGuard.sol";

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
contract Exchange is IExchange, Claimable, ReentrancyGuard
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

    ExchangeData.State private state;
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

    function isInMaintenance()
        external
        view
        returns (bool result)
    {
        result = state.isInMaintenance();
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
        nonReentrant
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
        nonReentrant
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
        nonReentrant
    {
        state.disableTokenDeposit(tokenAddress);
    }

    function enableTokenDeposit(
        address tokenAddress
        )
        external
        onlyOwner
        nonReentrant
    {
        state.enableTokenDeposit(tokenAddress);
    }

    // -- Stakes --
    function getExchangeStake()
        external
        view
        returns (uint)
    {
        return state.loopring.getExchangeStake(state.id);
    }

    function withdrawExchangeStake(
        address recipient
        )
        external
        onlyOwner
        nonReentrant
        returns (uint)
    {
        return state.withdrawExchangeStake(recipient);
    }

    function withdrawProtocolFeeStake(
        address recipient,
        uint amount
        )
        external
        onlyOwner
        nonReentrant
    {
        state.loopring.withdrawProtocolFeeStake(state.id, recipient, amount);
    }

    function burnExchangeStake()
        external
        nonReentrant
    {
        // Allow burning the complete exchange stake when the exchange gets into withdrawal mode
        if(state.isInWithdrawalMode()) {
            // Burn the complete stake of the exchange
            uint stake = state.loopring.getExchangeStake(state.id);
            state.loopring.burnExchangeStake(state.id, stake);
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

    function getBlock(
        uint blockIdx
        )
        external
        view
        returns (
            bytes32 merkleRoot,
            bytes32 publicDataHash,
            uint8   blockState,
            uint8   blockType,
            uint16  blockSize,
            uint32  timestamp,
            uint32  numDepositRequestsCommitted,
            uint32  numWithdrawalRequestsCommitted,
            bool    blockFeeWithdrawn,
            uint16  numWithdrawalsDistributed
        )
    {
        require(blockIdx < state.blocks.length, "INVALID_BLOCK_IDX");
        ExchangeData.Block storage specifiedBlock = state.blocks[blockIdx];

        merkleRoot = specifiedBlock.merkleRoot;
        publicDataHash = specifiedBlock.publicDataHash;
        blockState = uint8(specifiedBlock.state);
        blockType = uint8(specifiedBlock.blockType);
        blockSize = specifiedBlock.blockSize;
        timestamp = specifiedBlock.timestamp;
        numDepositRequestsCommitted = specifiedBlock.numDepositRequestsCommitted;
        numWithdrawalRequestsCommitted = specifiedBlock.numWithdrawalRequestsCommitted;
        blockFeeWithdrawn = specifiedBlock.blockFeeWithdrawn;
        numWithdrawalsDistributed = specifiedBlock.numWithdrawalsDistributed;
    }

    function commitBlock(
        uint8  blockType,
        uint16 blockSize,
        uint8  blockVersion,
        bytes calldata data,
        bytes calldata offchainData
        )
        external
        onlyOperator
        nonReentrant
    {
        state.commitBlock(blockType, blockSize, blockVersion, data, offchainData);
    }

    function verifyBlock(
        uint blockIdx,
        uint256[8] calldata proof
        )
        external
        onlyOperator
        nonReentrant
    {
        state.verifyBlock(blockIdx, proof);
    }

    function revertBlock(
        uint blockIdx
        )
        external
        onlyOperator
        nonReentrant
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
        nonReentrant
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
        nonReentrant
    {
        state.depositTo(
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
        nonReentrant
    {
        state.depositTo(
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
        nonReentrant
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
        nonReentrant
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
        nonReentrant
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
        nonReentrant
    {
        state.withdrawFromDepositRequest(depositIdx);
    }

    function withdrawFromApprovedWithdrawal(
        uint blockIdx,
        uint slotIdx
        )
        external
        nonReentrant
    {
        require(blockIdx < state.blocks.length, "INVALID_BLOCK_IDX");
        ExchangeData.Block storage withdrawBlock = state.blocks[blockIdx];
        state.withdrawFromApprovedWithdrawal(
            withdrawBlock,
            slotIdx,
            false
        );
    }

    function withdrawBlockFee(
        uint blockIdx,
        address payable feeRecipient
        )
        external
        onlyOperator
        nonReentrant
        returns (uint feeAmount)
    {
        feeAmount = state.withdrawBlockFee(blockIdx, feeRecipient);
    }

    function distributeWithdrawals(
        uint blockIdx,
        uint maxNumWithdrawals
        )
        external
        nonReentrant
    {
        state.distributeWithdrawals(blockIdx, maxNumWithdrawals);
    }

    // -- Admins --
    function setOperator(
        address payable _operator
        )
        external
        onlyOwner
        nonReentrant
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
        nonReentrant
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

    function startOrContinueMaintenanceMode(
        uint durationMinutes
        )
        external
        onlyOwner
        nonReentrant
    {
        state.startOrContinueMaintenanceMode(durationMinutes);
    }

    function stopMaintenanceMode()
        external
        onlyOwner
        nonReentrant
    {
        state.stopMaintenanceMode();
    }

    function getRemainingDowntime()
        external
        view
        returns (uint durationMinutes)
    {
        durationMinutes = state.getRemainingDowntime();
    }

    function getDowntimeCostLRC(
        uint durationMinutes
        )
        external
        view
        returns (uint costLRC)
    {
        costLRC = state.getDowntimeCostLRC(durationMinutes);
    }

    function getTotalTimeInMaintenanceSeconds()
        external
        view
        returns (uint timeSeconds)
    {
        timeSeconds = state.getTotalTimeInMaintenanceSeconds();
    }

    function getExchangeCreationTimestamp()
        external
        view
        returns (uint timestamp)
    {
        timestamp = state.exchangeCreationTimestamp;
    }

    function shutdown()
        external
        onlyOwner
        nonReentrant
        returns (bool success)
    {
        require(!state.isInWithdrawalMode(), "INVALID_MODE");
        require(!state.isShutdown(), "ALREADY_SHUTDOWN");
        state.shutdownStartTime = now;
        emit Shutdown(state.shutdownStartTime);
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

    function getProtocolFeeValues()
        external
        view
        returns (uint32 timestamp,
                 uint8 takerFeeBips, uint8 makerFeeBips,
                 uint8 previousTakerFeeBips, uint8 previousMakerFeeBips)
    {
        timestamp = state.protocolFeeData.timestamp;
        takerFeeBips = state.protocolFeeData.takerFeeBips;
        makerFeeBips = state.protocolFeeData.makerFeeBips;
        previousTakerFeeBips = state.protocolFeeData.previousTakerFeeBips;
        previousMakerFeeBips = state.protocolFeeData.previousMakerFeeBips;
    }
}
