// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
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
    bytes32 constant public genesisMerkleRoot = 0x1dacdc3f6863d9db1d903e7285ebf74b61f02d585ccb52ecaeaf97dbb773becf;

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
        bool    _rollupMode
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
            _rollupMode,
            genesisMerkleRoot,
            EIP712.hash(EIP712.Domain("Loopring Protocol", version(), address(this)))
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
            uint(ExchangeData.MAX_OPEN_FORCED_REQUESTS()),
            uint(ExchangeData.MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE()),
            uint(ExchangeData.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS()),
            uint(ExchangeData.MAX_NUM_ACCOUNTS()),
            uint(ExchangeData.MAX_NUM_TOKENS()),
            uint(ExchangeData.MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED()),
            uint(ExchangeData.MIN_TIME_IN_SHUTDOWN()),
            uint(ExchangeData.TX_DATA_AVAILABILITY_SIZE()),
            uint(ExchangeData.MAX_AGE_DEPOSIT_UNTIL_WITHDRAWABLE_UPPERBOUND())
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

    // -- Tokens --

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

    function getProtocolFeeLastWithdrawnTime(
        address tokenAddress
        )
        external
        override
        view
        returns (uint)
    {
        return state.protocolFeeLastWithdrawnTime[tokenAddress];
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
        uint96  amount,
        bytes   calldata auxiliaryData
        )
        external
        payable
        override
        nonReentrant
        onlyAgentFor(from)
    {
        state.deposit(from, to, tokenAddress, amount, auxiliaryData);
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
        ExchangeData.MerkleProof calldata merkleProof
        )
        external
        override
        nonReentrant
    {
        state.withdrawFromMerkleTree(merkleProof);
    }

    function withdrawFromDepositRequest(
        address owner,
        address token,
        uint    index
        )
        external
        override
        nonReentrant
    {
        state.withdrawFromDepositRequest(
            owner,
            token,
            index
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

    function notifyForcedRequestTooOld(
        uint24  accountID,
        address token
        )
        external
        override
        nonReentrant
    {
        uint16 tokenID = state.getTokenID(token);
        ExchangeData.ForcedWithdrawal storage withdrawal = state.pendingForcedWithdrawals[accountID][tokenID];
        require(withdrawal.timestamp != 0, "WITHDRAWAL_NOT_TOO_OLD");

        // Check if the withdrawal has indeed exceeded the time limit
        require(now >= withdrawal.timestamp + ExchangeData.MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE(), "WITHDRAWAL_NOT_TOO_OLD");

        // Enter withdrawal mode
        state.withdrawalModeStartTime = now;

        emit WithdrawalModeActivated(state.withdrawalModeStartTime);
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
        return owner == agent || state.whitelistedAgent[agent] || state.agent[owner][agent];
    }

    function approveOffchainTransfer(
        address from,
        address to,
        address token,
        uint96  amount,
        address feeToken,
        uint96  fee,
        uint    data,
        uint32  nonce
        )
        external
        override
        nonReentrant
        onlyAgentFor(from)
    {
        uint16 tokenID = state.getTokenID(token);
        uint16 feeTokenID = state.getTokenID(feeToken);
        bytes32 transactionHash = TransferTransaction.hash(
            state.DOMAIN_SEPARATOR,
            from,
            to,
            tokenID,
            amount,
            feeTokenID,
            fee,
            data,
            nonce
        );
        state.approvedTx[from][transactionHash] = true;
        emit TransactionApproved(from, transactionHash);
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

    function isTransactionApproved(
        address owner,
        bytes32 transactionHash
        )
        external
        override
        view
        returns (bool)
    {
        return state.approvedTx[owner][transactionHash];
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

    function setMaxAgeDepositUntilWithdrawable(
        uint32 newValue
        )
        external
        override
        onlyOwner
        returns (uint32)
    {
        return state.setMaxAgeDepositUntilWithdrawable(newValue);
    }

    function getMaxAgeDepositUntilWithdrawable()
        external
        override
        view
        returns (uint32)
    {
        return state.maxAgeDepositUntilWithdrawable;
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
        state.shutdownModeStartTime = now;
        emit Shutdown(state.shutdownModeStartTime);
        return true;
    }

    function getProtocolFeeValues()
        external
        override
        view
        returns (
            uint32 syncedAt,
            uint8  takerFeeBips,
            uint8  makerFeeBips,
            uint8  previousTakerFeeBips,
            uint8  previousMakerFeeBips
        )
    {
        syncedAt = state.protocolFeeData.syncedAt;
        takerFeeBips = state.protocolFeeData.takerFeeBips;
        makerFeeBips = state.protocolFeeData.makerFeeBips;
        previousTakerFeeBips = state.protocolFeeData.previousTakerFeeBips;
        previousMakerFeeBips = state.protocolFeeData.previousMakerFeeBips;
    }
}
