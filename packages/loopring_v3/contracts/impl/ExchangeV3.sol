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
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "./libexchange/ExchangeAccounts.sol";
import "./libexchange/ExchangeAdmins.sol";
import "./libexchange/ExchangeBalances.sol";
import "./libexchange/ExchangeBlocks.sol";
import "./libexchange/ExchangeDeposits.sol";
import "./libexchange/ExchangeGenesis.sol";
import "./libexchange/ExchangeMode.sol";
import "./libexchange/ExchangeTokens.sol";
import "./libexchange/ExchangeWithdrawals.sol";

import "../lib/MathUint.sol";

import "../iface/IExchangeV3.sol";


/// @title An Implementation of IExchangeV3.
/// @dev This contract supports upgradability proxy, therefore its constructor
///      must do NOTHING.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ExchangeV3 is IExchangeV3
{
    bytes32 constant public genesisBlockHash = 0x107018ff4240423a154c81e966fe3216d239fe33f5c30911c2d04799df603c81;

    using MathUint              for uint;
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

    modifier onlyAgentFor(address owner)
    {
        require(isAgent(owner, msg.sender), "UNAUTHORIZED");
        _;
    }

    /// @dev The constructor must do NOTHING to support proxy.
    constructor() public {}

    function version()
        public
        override
        view
        returns (string memory)
    {
        return "3.5.0";
    }

    // -- Initialization --
    function initialize(
        address _loopringAddress,
        address _owner,
        uint    _id,
        address payable _operator,
        bool    _onchainDataAvailability
        )
        external
        override
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

    function setDepositContract(address _depositContract)
        external
        override
        nonReentrant
        onlyOwner
    {
        require(_depositContract != address(0), "ZERO_ADDRESS");
        // Only used for initialization
        require(state.depositContract == IDepositContract(0), "ALREADY_SET");
        state.depositContract = IDepositContract(_depositContract);
    }

    function getDepositContract()
        external
        override
        view
        returns (IDepositContract)
    {
        return state.depositContract;
    }

    // -- Constants --
    function getConstants()
        external
        override
        pure
        returns(uint[14] memory)
    {
        return [
            uint(ExchangeData.SNARK_SCALAR_FIELD()),
            uint(ExchangeData.MAX_OPEN_DEPOSIT_REQUESTS()),
            uint(ExchangeData.MAX_OPEN_WITHDRAWAL_REQUESTS()),
            uint(ExchangeData.MAX_AGE_REQUEST_UNTIL_FORCED()),
            uint(ExchangeData.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE()),
            uint(ExchangeData.MAX_TIME_IN_SHUTDOWN_BASE()),
            uint(ExchangeData.MAX_TIME_IN_SHUTDOWN_DELTA()),
            uint(ExchangeData.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS()),
            uint(ExchangeData.MAX_NUM_TOKENS()),
            uint(ExchangeData.MAX_NUM_ACCOUNTS()),
            uint(ExchangeData.FEE_BLOCK_FINE_START_TIME()),
            uint(ExchangeData.FEE_BLOCK_FINE_MAX_DURATION()),
            uint(ExchangeData.MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED()),
            uint(ExchangeData.GAS_LIMIT_SEND_TOKENS())
        ];
    }

    // -- Mode --
    function isInWithdrawalMode()
        external
        override
        view
        returns (bool)
    {
        return state.isInWithdrawalMode();
    }

    function isShutdown()
        external
        override
        view
        returns (bool)
    {
        return state.isShutdown();
    }

    function isInMaintenance()
        external
        override
        view
        returns (bool)
    {
        return state.isInMaintenance();
    }

    // -- Accounts --
    function getNumAccounts()
        external
        override
        view
        returns (uint)
    {
        return state.accounts.length;
    }

    function getAccount(
        address owner
        )
        external
        override
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
        address owner,
        uint    pubKeyX,
        uint    pubKeyY,
        bytes   calldata permission
        )
        external
        override
        nonReentrant
        payable
        onlyAgentFor(owner)
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        )
    {
        return updateAccountAndDepositInternal(
            owner,
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
        uint[36] calldata accountPath,
        uint[15] calldata balancePath
        )
        external
        override
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
        override
        view
        returns (uint)
    {
        return state.getLRCFeeForRegisteringOneMoreToken();
    }

    function registerToken(
        address tokenAddress
        )
        external
        override
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
        override
        view
        returns (uint16)
    {
        return state.getTokenID(tokenAddress);
    }

    function getTokenAddress(
        uint16 tokenID
        )
        external
        override
        view
        returns (address)
    {
        return state.getTokenAddress(tokenID);
    }

    function disableTokenDeposit(
        address tokenAddress
        )
        external
        override
        nonReentrant
        onlyOwner
    {
        state.disableTokenDeposit(tokenAddress);
    }

    function enableTokenDeposit(
        address tokenAddress
        )
        external
        override
        nonReentrant
        onlyOwner
    {
        state.enableTokenDeposit(tokenAddress);
    }

    // -- Stakes --
    function getExchangeStake()
        external
        override
        view
        returns (uint)
    {
        return state.loopring.getExchangeStake(state.id);
    }

    function withdrawExchangeStake(
        address recipient
        )
        external
        override
        nonReentrant
        onlyOwner
        returns (uint)
    {
        return state.withdrawExchangeStake(recipient);
    }

    function withdrawProtocolFeeStake(
        address recipient,
        uint amount
        )
        external
        override
        nonReentrant
        onlyOwner
    {
        state.loopring.withdrawProtocolFeeStake(state.id, recipient, amount);
    }

    function burnExchangeStake()
        external
        override
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
    function getMerkleRoot()
        external
        override
        view
        returns (bytes32)
    {
        return state.merkleRoot;
    }

    function getBlockHeight()
        external
        override
        view
        returns (uint)
    {
        return state.numBlocksSubmitted;
    }

    function submitBlocks(
        ExchangeData.Block[] calldata blocks,
        address payable feeRecipient
        )
        external
        override
        nonReentrant
        onlyOperator
    {
        state.submitBlocks(
            blocks,
            feeRecipient
        );
    }

    // -- Deposits --
    function getNumDepositRequestsProcessed()
        external
        override
        view
        returns (uint)
    {
        return state.getNumDepositRequestsProcessed();
    }

    function getNumAvailableDepositSlots()
        external
        override
        view
        returns (uint)
    {
        return state.getNumAvailableDepositSlots();
    }

    function getDepositRequest(
        uint index
        )
        external
        override
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
        address owner,
        uint    pubKeyX,
        uint    pubKeyY,
        address token,
        uint96  amount,
        bytes   calldata permission
        )
        external
        override
        nonReentrant
        payable
        onlyAgentFor(owner)
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        )
    {
        return updateAccountAndDepositInternal(
            owner,
            pubKeyX,
            pubKeyY,
            token,
            amount,
            permission
        );
    }

    function deposit(
        address from,
        address to,
        address tokenAddress,
        uint96  amount
        )
        external
        payable
        override
        nonReentrant
        onlyAgentFor(from)
    {
        state.deposit(from, to, tokenAddress, amount, 0);
    }

    // -- Withdrawals --
    function getNumWithdrawalRequestsProcessed()
        external
        override
        view
        returns (uint)
    {
        return state.getNumWithdrawalRequestsProcessed();
    }

    function getNumAvailableWithdrawalSlots()
        external
        override
        view
        returns (uint)
    {
        return state.getNumAvailableWithdrawalSlots();
    }

    function getWithdrawRequest(
        uint index
        )
        external
        override
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
        address owner,
        address token,
        uint96 amount
        )
        external
        override
        nonReentrant
        payable
        onlyAgentFor(owner)
    {
        uint24 accountID = state.getAccountID(owner);
        state.withdraw(accountID, token, amount);
    }

    function withdrawProtocolFees(
        address token
        )
        external
        override
        nonReentrant
        payable
    {
        // Always request the maximum amount so the complete balance is withdrawn
        state.withdraw(0, token, ~uint96(0));
    }

    // We still alow anyone to withdraw these funds for the account owner
    function withdrawFromMerkleTree(
        address  owner,
        address  token,
        uint     pubKeyX,
        uint     pubKeyY,
        uint32   nonce,
        uint96   balance,
        uint     tradeHistoryRoot,
        uint[36] calldata accountPath,
        uint[15] calldata balancePath
        )
        external
        override
        nonReentrant
    {
        state.withdrawFromMerkleTree(
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
        override
        nonReentrant
    {
        state.withdrawFromDepositRequest(depositIdx);
    }

    function withdrawFromApprovedWithdrawal(
        address owner,
        address token
        )
        external
        override
        nonReentrant
    {
        state.withdrawFromApprovedWithdrawal(
            owner,
            token
        );
    }

    function getAmountWithdrawable(
        address owner,
        address token
        )
        external
        override
        view
        returns (uint)
    {
        uint24 accountID = (owner == address(0)) 0 : ? state.getAccountID(owner);
        uint16 tokenID = state.getTokenID(token);
        return state.amountWithdrawable[accountID][tokenID];
    }

    // -- Agents --
    function authorizeAgents(
        address   owner,
        address[] calldata agents,
        bool[]    calldata authorized
        )
        external
        override
        nonReentrant
        onlyAgentFor(owner)
    {
        require(agents.length == authorized.length, "INVALID_DATA");
        for (uint i = 0; i < agents.length; i++) {
            state.agent[owner][agents[i]] = authorized[i];
            emit AgentAuthorized(owner, agents[i], authorized[i]);
        }
    }

    function isAgent(address owner, address agent)
        public
        override
        view
        returns (bool)
    {
        return owner == agent || state.agent[owner][agent];
    }

    function approveOffchainTransfer(
        address from,
        address to,
        address token,
        uint    amount
        )
        external
        override
        nonReentrant
        onlyAgentFor(from)
    {
        uint24 fromID = state.getAccountID(from);
        uint24 toID = state.getAccountID(to);
        uint16 tokenID = state.getTokenID(token);

        state.approvedTransferAmounts[fromID][toID][tokenID] =
            state.approvedTransferAmounts[fromID][toID][tokenID].add(amount);

        emit ConditionalTransferApproved(
            fromID,
            toID,
            tokenID,
            amount
        );
    }

    function getApprovedTransferAmount(
        address from,
        address to,
        address token
        )
        external
        override
        view
        returns (uint)
    {
        uint24 fromAccountID = state.getAccountID(from);
        uint24 toAccountID = state.getAccountID(to);
        uint16 tokenID = state.getTokenID(token);
        return state.approvedTransferAmounts[fromAccountID][toAccountID][tokenID];
    }

    function onchainTransferFrom(
        address from,
        address to,
        address token,
        uint    amount
        )
        external
        override
        nonReentrant
        onlyAgentFor(from)
    {
        state.depositContract.transfer(from, to, token, amount);
    }

    // -- Admins --
    function setOperator(
        address payable _operator
        )
        external
        override
        nonReentrant
        onlyOwner
        returns (address payable)
    {
        return state.setOperator(_operator);
    }

    function getOperator()
        external
        override
        view
        returns (address payable)
    {
        return state.operator;
    }

    function setAddressWhitelist(
        address _addressWhitelist
        )
        external
        override
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
        override
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
        override
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
        override
        nonReentrant
        onlyOwner
    {
        state.startOrContinueMaintenanceMode(durationMinutes);
    }

    function stopMaintenanceMode()
        external
        override
        nonReentrant
        onlyOwner
    {
        state.stopMaintenanceMode();
    }

    function getRemainingDowntime()
        external
        override
        view
        returns (uint)
    {
        return state.getRemainingDowntime();
    }

    function getDowntimeCostLRC(
        uint durationMinutes
        )
        external
        override
        view
        returns (uint costLRC)
    {
        return state.getDowntimeCostLRC(durationMinutes);
    }

    function getTotalTimeInMaintenanceSeconds()
        external
        override
        view
        returns (uint)
    {
        return state.getTotalTimeInMaintenanceSeconds();
    }

    function getExchangeCreationTimestamp()
        external
        override
        view
        returns (uint)
    {
        return state.exchangeCreationTimestamp;
    }

    function shutdown()
        external
        override
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
        override
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
        override
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
        address owner,
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
            owner,
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
        state.deposit(owner, owner, token, amount, additionalFeeETH);
    }
}
