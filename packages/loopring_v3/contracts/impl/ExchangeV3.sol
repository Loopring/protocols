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

import "../iface/IExchangeV3.sol";


/// @title An Implementation of IExchangeV3.
/// @dev This contract supports upgradability proxy, therefore its constructor
///      must do NOTHING.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ExchangeV3 is IExchangeV3
{
    string  constant public version = "3.1.1";
    bytes32 constant public genesisBlockHash = 0x2b4827daf74c0ab30deb68b1c337dec40579bb3ff45ce9478288e1a2b83a3a01;

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

    modifier onlyOperator()
    {
        require(msg.sender == state.operator, "UNAUTHORIZED");
        _;
    }

    modifier onlyWhenUninitialized()
    {
        require(owner == address(0) && state.id == 0, "INITIALIZED");
        _;
    }

    /// @dev The constructor must do NOTHING to support proxy.
    constructor() public {}

    // -- Initialization --
    function initialize(
        address _loopringAddress,
        address _owner,
        uint    _id,
        address payable _operator,
        bool    _onchainDataAvailability
        )
        external
        nonReentrant
        onlyWhenUninitialized
    {
        require(address(0) != _owner, "ZERO_ADDRESS");
        owner = _owner;

        state.initializeGenesisBlock(
            _id,
            _loopringAddress,
            _operator,
            _onchainDataAvailability,
            genesisBlockHash
        );
    }

    // -- Constants --
    function getConstants()
        external
        pure
        returns(uint[20] memory)
    {
        return [
            uint(ExchangeData.SNARK_SCALAR_FIELD()),
            uint(ExchangeData.MAX_PROOF_GENERATION_TIME_IN_SECONDS()),
            uint(ExchangeData.MAX_GAP_BETWEEN_FINALIZED_AND_VERIFIED_BLOCKS()),
            uint(ExchangeData.MAX_OPEN_DEPOSIT_REQUESTS()),
            uint(ExchangeData.MAX_OPEN_WITHDRAWAL_REQUESTS()),
            uint(ExchangeData.MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE()),
            uint(ExchangeData.MAX_AGE_REQUEST_UNTIL_FORCED()),
            uint(ExchangeData.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE()),
            uint(ExchangeData.MAX_TIME_IN_SHUTDOWN_BASE()),
            uint(ExchangeData.MAX_TIME_IN_SHUTDOWN_DELTA()),
            uint(ExchangeData.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS()),
            uint(ExchangeData.MAX_NUM_TOKENS()),
            uint(ExchangeData.MAX_NUM_ACCOUNTS()),
            uint(ExchangeData.MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS()),
            uint(ExchangeData.MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS_SHUTDOWN_MODE()),
            uint(ExchangeData.FEE_BLOCK_FINE_START_TIME()),
            uint(ExchangeData.FEE_BLOCK_FINE_MAX_DURATION()),
            uint(ExchangeData.MIN_GAS_TO_DISTRIBUTE_WITHDRAWALS()),
            uint(ExchangeData.MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED()),
            uint(ExchangeData.GAS_LIMIT_SEND_TOKENS())
        ];
    }

    // -- Mode --
    function isInWithdrawalMode()
        external
        view
        returns (bool)
    {
        return state.isInWithdrawalMode();
    }

    function isShutdown()
        external
        view
        returns (bool)
    {
        return state.isShutdown();
    }

    function isInMaintenance()
        external
        view
        returns (bool)
    {
        return state.isInMaintenance();
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
        return state.getAccount(owner);
    }

    function createOrUpdateAccount(
        uint  pubKeyX,
        uint  pubKeyY,
        bytes calldata permission
        )
        external
        payable
        nonReentrant
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        )
    {
        return updateAccountAndDepositInternal(
            pubKeyX,
            pubKeyY,
            address(0),
            0,
            permission
        );
    }

    // -- Balances --
    function isAccountBalanceCorrect(
        uint     merkleRoot,
        uint24   accountID,
        uint16   tokenID,
        uint     pubKeyX,
        uint     pubKeyY,
        uint32   nonce,
        uint96   balance,
        uint     tradeHistoryRoot,
        uint[30] calldata accountPath,
        uint[12] calldata balancePath
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
        returns (uint)
    {
        return state.getLRCFeeForRegisteringOneMoreToken();
    }

    function registerToken(
        address tokenAddress
        )
        external
        nonReentrant
        onlyOwner
        returns (uint16)
    {
        return state.registerToken(tokenAddress);
    }

    function getTokenID(
        address tokenAddress
        )
        external
        view
        returns (uint16)
    {
        return state.getTokenID(tokenAddress);
    }

    function getTokenAddress(
        uint16 tokenID
        )
        external
        view
        returns (address)
    {
        return state.getTokenAddress(tokenID);
    }

    function disableTokenDeposit(
        address tokenAddress
        )
        external
        nonReentrant
        onlyOwner
    {
        state.disableTokenDeposit(tokenAddress);
    }

    function enableTokenDeposit(
        address tokenAddress
        )
        external
        nonReentrant
        onlyOwner
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
        nonReentrant
        onlyOwner
        returns (uint)
    {
        return state.withdrawExchangeStake(recipient);
    }

    function withdrawTokenNotOwnedByUsers(
        address tokenAddress
        )
        external
        nonReentrant
        returns(uint amount)
    {
        address payable feeVault = state.loopring.protocolFeeVault();
        require(feeVault != address(0), "ZERO_ADDRESS");
        amount = state.withdrawTokenNotOwnedByUsers(tokenAddress, feeVault);
        emit TokenNotOwnedByUsersWithdrawn(msg.sender, tokenAddress, feeVault, amount);
    }

    function withdrawProtocolFeeStake(
        address recipient,
        uint amount
        )
        external
        nonReentrant
        onlyOwner
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
        bytes  calldata /*data*/,
        bytes  calldata offchainData
        )
        external
        nonReentrant
        onlyOperator
    {
        // Decompress the data here so we can extract the data directly from calldata
        bytes4 selector = IDecompressor(0x0).decompress.selector;
        bytes memory decompressed;
        assembly {
          // Calldata layout:
          //   0: selector
          //   4: blockType
          //  36: blockSize
          //  68: blockVersion
          // 100: offset data
          // 132: offset offchainData
          let dataOffset := add(calldataload(100), 4)
          let mode := and(calldataload(add(dataOffset, 1)), 0xFF)
          switch mode
          case 0 {
              // No compression
              let length := sub(calldataload(dataOffset), 1)

              let data := mload(0x40)
              calldatacopy(add(data, 32), add(dataOffset, 33), length)
              mstore(data, length)
              decompressed := data
              mstore(0x40, add(add(decompressed, length), 32))
          }
          case 1 {
              // External contract
              let contractAddress := and(
                calldataload(add(dataOffset, 21)),
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
              let length := sub(calldataload(dataOffset), 21)

              let data := mload(0x40)
              mstore(data, selector)
              mstore(add(data,  4), 32)
              mstore(add(data, 36), length)
              calldatacopy(add(data, 68), add(dataOffset, 53), length)

              let success := call(gas, contractAddress, 0, data, add(68, length), 0x0, 0)
              if eq(success, 0) {
                revert(0, 0)
              }

              returndatacopy(data, 32, sub(returndatasize(), 32))
              decompressed := data
              mstore(0x40, add(add(decompressed, mload(decompressed)), 32))
          }
          default {
              revert(0, 0)
          }
        }
        state.commitBlock(blockType, blockSize, blockVersion, decompressed, offchainData);
    }

    function verifyBlocks(
        uint[] calldata blockIndices,
        uint[] calldata proofs
        )
        external
        nonReentrant
        onlyOperator
    {
        state.verifyBlocks(blockIndices, proofs);
    }

    function revertBlock(
        uint blockIdx
        )
        external
        nonReentrant
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
          uint    accumulatedFee,
          uint32  timestamp
        )
    {
        return state.getDepositRequest(index);
    }

    function updateAccountAndDeposit(
        uint    pubKeyX,
        uint    pubKeyY,
        address token,
        uint96  amount,
        bytes   calldata permission
        )
        external
        payable
        nonReentrant
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        )
    {
        return updateAccountAndDepositInternal(
            pubKeyX,
            pubKeyY,
            token,
            amount,
            permission
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
        state.depositTo(msg.sender, token, amount, 0);
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
        state.depositTo(recipient, tokenAddress, amount, 0);
    }

    // -- Withdrawals --
    function getNumWithdrawalRequestsProcessed()
        external
        view
        returns (uint)
    {
        return state.getNumWithdrawalRequestsProcessed();
    }

    function getNumAvailableWithdrawalSlots()
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
            uint    accumulatedFee,
            uint32  timestamp
        )
    {
        return state.getWithdrawRequest(index);
    }

    function withdraw(
        address token,
        uint96 amount
        )
        external
        payable
        nonReentrant
    {
        uint24 accountID = state.getAccountID(msg.sender);
        state.withdraw(accountID, token, amount);
    }

    function withdrawProtocolFees(
        address token
        )
        external
        payable
        nonReentrant
    {
        // Always request the maximum amount so the complete balance is withdrawn
        state.withdraw(0, token, ~uint96(0));
    }

    function withdrawFromMerkleTree(
        address  token,
        uint     pubKeyX,
        uint     pubKeyY,
        uint32   nonce,
        uint96   balance,
        uint     tradeHistoryRoot,
        uint[30] calldata accountPath,
        uint[12] calldata balancePath
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
        address  owner,
        address  token,
        uint     pubKeyX,
        uint     pubKeyY,
        uint32   nonce,
        uint96   balance,
        uint     tradeHistoryRoot,
        uint[30] calldata accountPath,
        uint[12] calldata balancePath
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
            blockIdx,
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
        nonReentrant
        onlyOperator
        returns (uint)
    {
        return state.withdrawBlockFee(blockIdx, feeRecipient);
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
        nonReentrant
        onlyOwner
        returns (address payable)
    {
        return state.setOperator(_operator);
    }

    function setAddressWhitelist(
        address _addressWhitelist
        )
        external
        nonReentrant
        onlyOwner
        returns (address)
    {
        return state.setAddressWhitelist(_addressWhitelist);
    }

    function setFees(
        uint _accountCreationFeeETH,
        uint _accountUpdateFeeETH,
        uint _depositFeeETH,
        uint _withdrawalFeeETH
        )
        external
        nonReentrant
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

    function startOrContinueMaintenanceMode(
        uint durationMinutes
        )
        external
        nonReentrant
        onlyOwner
    {
        state.startOrContinueMaintenanceMode(durationMinutes);
    }

    function stopMaintenanceMode()
        external
        nonReentrant
        onlyOwner
    {
        state.stopMaintenanceMode();
    }

    function getRemainingDowntime()
        external
        view
        returns (uint)
    {
        return state.getRemainingDowntime();
    }

    function getDowntimeCostLRC(
        uint durationMinutes
        )
        external
        view
        returns (uint costLRC)
    {
        return state.getDowntimeCostLRC(durationMinutes);
    }

    function getTotalTimeInMaintenanceSeconds()
        external
        view
        returns (uint)
    {
        return state.getTotalTimeInMaintenanceSeconds();
    }

    function getExchangeCreationTimestamp()
        external
        view
        returns (uint)
    {
        return state.exchangeCreationTimestamp;
    }

    function shutdown()
        external
        nonReentrant
        onlyOwner
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
        returns (
            uint32 timestamp,
            uint8  takerFeeBips,
            uint8  makerFeeBips,
            uint8  previousTakerFeeBips,
            uint8  previousMakerFeeBips
        )
    {
        timestamp = state.protocolFeeData.timestamp;
        takerFeeBips = state.protocolFeeData.takerFeeBips;
        makerFeeBips = state.protocolFeeData.makerFeeBips;
        previousTakerFeeBips = state.protocolFeeData.previousTakerFeeBips;
        previousMakerFeeBips = state.protocolFeeData.previousMakerFeeBips;
    }

    // == Internal Functions ==
    function updateAccountAndDepositInternal(
        uint    pubKeyX,
        uint    pubKeyY,
        address token,
        uint96  amount,
        bytes   memory permission
        )
        internal
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        )
    {
        (accountID, isAccountNew, isAccountUpdated) = state.createOrUpdateAccount(
            pubKeyX,
            pubKeyY,
            permission
        );
        uint additionalFeeETH = 0;
        if (isAccountNew) {
            additionalFeeETH = state.accountCreationFeeETH;
        } else if (isAccountUpdated) {
            additionalFeeETH = state.accountUpdateFeeETH;
        }
        state.depositTo(msg.sender, token, amount, additionalFeeETH);
    }
}
