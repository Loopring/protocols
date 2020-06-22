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
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "./libexchange/ExchangeAdmins.sol";
import "./libexchange/ExchangeBalances.sol";
import "./libexchange/ExchangeBlocks.sol";
import "./libexchange/ExchangeDeposits.sol";
import "./libexchange/ExchangeGenesis.sol";
import "./libexchange/ExchangeMode.sol";
import "./libexchange/ExchangeTokens.sol";
import "./libexchange/ExchangeWithdrawals.sol";

import "../lib/EIP712.sol";
import "../lib/MathUint.sol";

import "../iface/IExchangeV3.sol";


/// @title An Implementation of IExchangeV3.
/// @dev This contract supports upgradability proxy, therefore its constructor
///      must do NOTHING.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ExchangeV3 is IExchangeV3
{
    bytes32 constant public genesisBlockHash = 0x06e87035e6fc38ad207ed1d9d94faa4011e38c30295c09a158e479ca05c5d9f5;

    using MathUint              for uint;
    using ExchangeAdmins        for ExchangeData.State;
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
        return "3.6.0";
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

        state.DOMAIN_SEPARATOR = EIP712.hash(EIP712.Domain("Loopring Protocol", version(), address(this)));

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
        returns(ExchangeData.Constants memory)
    {
        return ExchangeData.Constants(
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
            uint(0)
        );
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

    // -- Balances --
    function isAccountBalanceCorrect(
        uint     merkleRoot,
        address  owner,
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
            owner,
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
        return state.blocks.length;
    }

    function getBlockInfo(uint blockIdx)
        external
        override
        view
        returns (ExchangeData.BlockInfo memory)
    {
        return state.blocks[blockIdx];
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

    function getNumAvailableForcedSlots()
        external
        override
        view
        returns (uint)
    {
        return state.getNumAvailableForcedSlots();
    }

    // -- Deposits --

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
        state.deposit(from, to, tokenAddress, amount);
    }

    // -- Withdrawals --

    function forceWithdraw(
        address owner,
        address token,
        uint24  accountID
        )
        external
        override
        nonReentrant
        payable
        onlyAgentFor(owner)
    {
        state.forceWithdraw(owner, token, accountID);
    }

    function withdrawProtocolFees(
        address token
        )
        external
        override
        nonReentrant
        payable
    {
        state.forceWithdraw(address(0), token, 0);
    }

    // We still alow anyone to withdraw these funds for the account owner
    function withdrawFromMerkleTree(
        uint24   accountID,
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
            accountID,
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
        address owner,
        address token
        )
        external
        override
        nonReentrant
    {
        state.withdrawFromDepositRequest(
            owner,
            token
        );
    }

    function withdrawFromApprovedWithdrawals(
        address[] calldata owners,
        address[] calldata tokens
        )
        external
        override
        nonReentrant
    {
        state.withdrawFromApprovedWithdrawals(
            owners,
            tokens
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
        uint16 tokenID = state.getTokenID(token);
        return state.amountWithdrawable[owner][tokenID];
    }

    function notifyTooLate(
        uint24 accountID,
        address token
        )
        external
        //override
    {
        uint16 tokenID = state.getTokenID(token);
        ExchangeData.ForcedWithdrawal storage withdrawal = state.pendingForcedWithdrawals[accountID][tokenID];

        // Check if the withdrawal has indeed exceeded the time limit
        require(withdrawal.timestamp + ExchangeData.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE() >= now, "WITHDRAWAL_NOT_TOO_OLD");

        // Enter withdrawal mode
        state.withdrawalModeStartTime = now;
    }

    // -- Agents --
    function whitelistAgents(
        address[] calldata agents,
        bool[]    calldata whitelisted
        )
        external
        override
        nonReentrant
        onlyOwner
    {
        require(agents.length == whitelisted.length, "INVALID_DATA");
        for (uint i = 0; i < agents.length; i++) {
            state.whitelistedAgent[agents[i]] = whitelisted[i];
            emit AgentWhitelisted(agents[i], whitelisted[i]);
        }
    }

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
        return owner == agent || state.agent[owner][agent] || state.whitelistedAgent[agent];
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
        // uint16 tokenID = state.getTokenID(token);
        // TODO: Remove or hash the data and call `approveTransaction`.
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

    function approveTransaction(
        address owner,
        bytes32 transactionHash
        )
        external
        override
        nonReentrant
        onlyAgentFor(owner)
    {
        state.approvedTx[owner][transactionHash] = true;
        emit TransactionApproved(owner, transactionHash);
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
}
