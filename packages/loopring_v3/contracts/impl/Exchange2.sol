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

import "../iface/IExchange.sol";
import "../iface/ILoopringV3.sol";

import "./exchange2/ExchangeData.sol";
import "./exchange2/ExchangeMode.sol";
import "./exchange2/ExchangeGenesis.sol";
import "./exchange2/ExchangeAccounts.sol";
import "./exchange2/ExchangeTokens.sol";
import "./exchange2/ExchangeBlocks.sol";
import "./exchange2/ExchangeDeposits.sol";
import "./exchange2/ExchangeWithdrawals.sol";
import "./exchange2/ExchangeOperations.sol";


/// @title An Implementation of IExchange.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract Exchange2
{
    using ExchangeMode          for ExchangeData.State;
    using ExchangeGenesis       for ExchangeData.State;
    using ExchangeAccounts      for ExchangeData.State;
    using ExchangeTokens        for ExchangeData.State;
    using ExchangeBlocks        for ExchangeData.State;
    using ExchangeDeposits      for ExchangeData.State;
    using ExchangeWithdrawals   for ExchangeData.State;
    using ExchangeOperations    for ExchangeData.State;

    ExchangeData.State public state;

    // -- Constructor --
    constructor(
        uint    _id,
        address _loopring3Address,
        address _owner,
        address payable _operator
        )
        public
        payable
    {
        state.initializeAndCreateGenesisBlock(
            _id,
            _loopring3Address,
            _owner,
            _operator
        );
    }

    modifier onlyOperator()
    {
        require(msg.sender == state.operator, "UNAUTHORIZED");
        _;
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
        returns (uint24 accountID)
    {
        accountID = state.createOrUpdateAccount(pubKeyX, pubKeyY);
    }

    // -- Tokens --
    function registerToken(
        address tokenAddress
        )
        external
        onlyOperator
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
        onlyOperator
        external
    {
       state.disableTokenDeposit(tokenAddress);
    }

    function enableTokenDeposit(
        address tokenAddress
        )
        onlyOperator
        external
    {
        state.enableTokenDeposit(tokenAddress);
    }

    // -- Stakes --
    function getStake()
        external
        view
        returns (uint)
    {
        return ILoopringV3(state.loopring3Address).getStake(state.id);
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
        uint  blockType,
        bytes calldata data
        )
        external
        onlyOperator
    {
        state.commitBlock(blockType, data);
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
        uint32 blockIdx
        )
        external
        onlyOperator
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
        // TODO
        return 1024;
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

    function deposit(
        uint    pubKeyX,
        uint    pubKeyY,
        address token,
        uint96  amount
        )
        external
        returns (uint24 accountID)
    {
        accountID = state.createOrUpdateAccount(pubKeyX, pubKeyY);
        state.depositTo(msg.sender, token, amount);
    }

    function deposit(
        address token,
        uint96  amount
        )
        external
    {
        state.depositTo(msg.sender, token, amount);
    }

    function depositTo(
        address recipient,
        address tokenAddress,
        uint96  amount
        )
        external
    {
        state.depositTo(recipient, tokenAddress, amount);
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
        returns (uint feeAmount)
    {
        feeAmount = state.withdrawBlockFee(blockIdx);
    }

    function distributeWithdrawals(
        uint blockIdx
        )
        external
        onlyOperator
    {
        state.distributeWithdrawals(blockIdx);
    }

    // -- Operations --

    function setOperator(
        address payable _operator
        )
        external
        //onlyOwner
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
        onlyOperator
        external
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
        onlyOperator
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