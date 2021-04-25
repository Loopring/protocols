// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/ReentrancyGuard.sol";
import "../../lib/TransferUtil.sol";
import "../../thirdparty/proxies/OwnedUpgradabilityProxy.sol";
import "../iface/IAgentRegistry.sol";
import "../iface/IExchangeV3.sol";
import "../iface/IBlockVerifier.sol";
import "./libexchange/ExchangeAdmins.sol";
import "./libexchange/ExchangeBalances.sol";
import "./libexchange/ExchangeBlocks.sol";
import "./libexchange/ExchangeDeposits.sol";
import "./libexchange/ExchangeGenesis.sol";
import "./libexchange/ExchangeMode.sol";
import "./libexchange/ExchangeTokens.sol";
import "./libexchange/ExchangeWithdrawals.sol";
import "./libtransactions/TransferTransaction.sol";


/// @title An Implementation of IExchangeV3.
/// @dev This contract supports upgradability proxy, therefore its constructor
///      must do NOTHING.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ExchangeV3 is IExchangeV3, ReentrancyGuard
{
    using MathUint              for uint;
    using TransferUtil          for address;
    using ExchangeAdmins        for ExchangeData.State;
    using ExchangeBalances      for ExchangeData.State;
    using ExchangeBlocks        for ExchangeData.State;
    using ExchangeDeposits      for ExchangeData.State;
    using ExchangeGenesis       for ExchangeData.State;
    using ExchangeMode          for ExchangeData.State;
    using ExchangeTokens        for ExchangeData.State;
    using ExchangeWithdrawals   for ExchangeData.State;

    ExchangeData.State private state;

    modifier onlyWhenUninitialized()
    {
        require(
            state.loopringAddr == address(0) && state.merkleRoot == bytes32(0),
            "INITIALIZED"
        );
        _;
    }

    modifier onlyFromUserOrAgent(address owner)
    {
        require(isUserOrAgent(owner), "UNAUTHORIZED");
        _;
    }

    /// @dev The constructor must do NOTHING to support proxy.
    constructor() {}

    function version()
        public
        pure
        returns (string memory)
    {
        return "3.7.0";
    }

    function domainSeparator()
        public
        view
        returns (bytes32)
    {
        return state.DOMAIN_SEPARATOR;
    }

    // -- Initialization --
    function initialize(
        address _loopring,
        address _owner,
        bytes32 _genesisMerkleRoot
        )
        external
        override
        nonReentrant
        onlyWhenUninitialized
    {
        require(address(0) != _owner, "ZERO_ADDRESS");
        owner = _owner;
        state.loopringAddr = _loopring;
        state.ammFeeBips = 20;

        state.initializeGenesisBlock(
            _loopring,
            _genesisMerkleRoot,
            EIP712.hash(EIP712.Domain("Loopring Protocol", version(), address(this)))
        );
    }

    function setAgentRegistry(address _agentRegistry)
        external
        override
        nonReentrant
        onlyOwner
    {
        require(_agentRegistry != address(0), "ZERO_ADDRESS");
        require(state.agentRegistry == IAgentRegistry(0), "ALREADY_SET");
        state.agentRegistry = IAgentRegistry(_agentRegistry);
    }

    function refreshBlockVerifier()
        external
        override
        nonReentrant
        onlyOwner
    {
        require(state.loopring.blockVerifierAddress() != address(0), "ZERO_ADDRESS");
        state.blockVerifier = IBlockVerifier(state.loopring.blockVerifierAddress());
    }

    function getAgentRegistry()
        external
        override
        view
        returns (IAgentRegistry)
    {
        return state.agentRegistry;
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

    function withdrawExchangeFees(
        address token,
        address recipient
        )
        external
        override
        nonReentrant
        onlyOwner
    {
        require(recipient != address(0), "INVALID_ADDRESS");

        uint amount = token.selfBalance();
        token.transferOut(recipient, amount);
    }

    function isUserOrAgent(address owner)
        public
        view
        returns (bool)
    {
         return owner == msg.sender ||
            state.agentRegistry != IAgentRegistry(address(0)) &&
            state.agentRegistry.isAgent(owner, msg.sender);
    }

    // -- Constants --
    function getConstants()
        external
        override
        pure
        returns(ExchangeData.Constants memory)
    {
        return ExchangeData.Constants(
            uint(ExchangeData.SNARK_SCALAR_FIELD),
            uint(ExchangeData.MAX_OPEN_FORCED_REQUESTS),
            uint(ExchangeData.MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE),
            uint(ExchangeData.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS),
            uint(ExchangeData.MAX_NUM_ACCOUNTS),
            uint(ExchangeData.MAX_NUM_TOKENS),
            uint(ExchangeData.MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED),
            uint(ExchangeData.MIN_TIME_IN_SHUTDOWN),
            uint(ExchangeData.TX_DATA_AVAILABILITY_SIZE),
            uint(ExchangeData.MAX_AGE_DEPOSIT_UNTIL_WITHDRAWABLE_UPPERBOUND)
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
        return state.loopring.getExchangeStake(address(this));
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
        if (state.isInWithdrawalMode()) {
            // Burn the complete stake of the exchange
            uint stake = state.loopring.getExchangeStake(address(this));
            state.loopring.burnExchangeStake(stake);
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
        return state.numBlocks;
    }

    function getBlockInfo(uint blockIdx)
        external
        override
        view
        returns (ExchangeData.BlockInfo memory)
    {
        return state.blocks[blockIdx];
    }

    function submitBlocks(ExchangeData.Block[] calldata blocks)
        external
        override
        nonReentrant
        onlyOwner
    {
        state.submitBlocks(blocks);
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
        bytes   calldata extraData
        )
        external
        payable
        override
        nonReentrant
        onlyFromUserOrAgent(from)
    {
        state.deposit(from, to, tokenAddress, amount, extraData, false);
    }

    function getPendingDepositAmount(
        address owner,
        address tokenAddress
        )
        external
        override
        view
        returns (uint96)
    {
        uint16 tokenID = state.getTokenID(tokenAddress);
        return state.pendingDeposits[owner][tokenID].amount;
    }

    function flashDeposit(
        ExchangeData.FlashDeposit[] calldata flashDeposits
        )
        external
        override
        nonReentrant
        onlyOwner
    {
        for (uint i = 0; i < flashDeposits.length; i++) {
            state.deposit(
                flashDeposits[i].to,
                flashDeposits[i].to,
                flashDeposits[i].token,
                flashDeposits[i].amount,
                new bytes(0),
                true
            );
        }
    }

    function repayFlashDeposit(
        address from,
        address tokenAddress,
        uint96  amount,
        bytes   calldata extraData
        )
        external
        payable
        override
        nonReentrant
    {
        state.repayFlashDeposit(from, tokenAddress, amount, extraData);
    }

    function getFlashDepositAmount(
        address tokenAddress
        )
        external
        override
        view
        returns (uint96)
    {
        return state.flashDepositAmounts[tokenAddress];
    }

    function verifyFlashDepositsRepaid(
        ExchangeData.FlashDeposit[] calldata flashDeposits
        )
        external
        override
        view
    {
        for (uint i = 0; i < flashDeposits.length; i++) {
            require(
                state.flashDepositAmounts[flashDeposits[i].token] == 0,
                "FLASH_DEPOSIT_NOT_REPAID"
            );
        }
    }

    // -- Withdrawals --

    function forceWithdraw(
        address owner,
        address token,
        uint32  accountID
        )
        external
        override
        nonReentrant
        payable
        onlyFromUserOrAgent(owner)
    {
        state.forceWithdraw(owner, token, accountID);
    }

    function isForcedWithdrawalPending(
        uint32  accountID,
        address token
        )
        external
        override
        view
        returns (bool)
    {
        uint16 tokenID = state.getTokenID(token);
        return state.pendingForcedWithdrawals[accountID][tokenID].timestamp != 0;
    }

    function withdrawProtocolFees(
        address token
        )
        external
        override
        nonReentrant
        payable
    {
        state.forceWithdraw(address(0), token, ExchangeData.ACCOUNTID_PROTOCOLFEE);
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

    function isWithdrawnInWithdrawalMode(
        uint32  accountID,
        address token
        )
        external
        override
        view
        returns (bool)
    {
        uint16 tokenID = state.getTokenID(token);
        return state.withdrawnInWithdrawMode[accountID][tokenID];
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

    function notifyForcedRequestTooOld(
        uint32  accountID,
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
        require(block.timestamp >= withdrawal.timestamp + ExchangeData.MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE, "WITHDRAWAL_NOT_TOO_OLD");

        // Enter withdrawal mode
        state.withdrawalModeStartTime = block.timestamp;

        emit WithdrawalModeActivated(state.withdrawalModeStartTime);
    }

    function setWithdrawalRecipient(
        address from,
        address to,
        address token,
        uint96  amount,
        uint32  storageID,
        address newRecipient
        )
        external
        override
        nonReentrant
        onlyFromUserOrAgent(from)
    {
        require(newRecipient != address(0), "INVALID_DATA");
        uint16 tokenID = state.getTokenID(token);
        require(state.withdrawalRecipient[from][to][tokenID][amount][storageID] == address(0), "CANNOT_OVERRIDE_RECIPIENT_ADDRESS");
        state.withdrawalRecipient[from][to][tokenID][amount][storageID] = newRecipient;
    }

    function getWithdrawalRecipient(
        address from,
        address to,
        address token,
        uint96  amount,
        uint32  storageID
        )
        external
        override
        view
        returns (address)
    {
        uint16 tokenID = state.getTokenID(token);
        return state.withdrawalRecipient[from][to][tokenID][amount][storageID];
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
        onlyFromUserOrAgent(from)
    {
        require(state.allowOnchainTransferFrom, "NOT_ALLOWED");
        state.depositContract.transfer(from, to, token, amount);
    }

    function approveTransaction(
        address owner,
        bytes32 transactionHash
        )
        external
        override
        nonReentrant
        onlyFromUserOrAgent(owner)
    {
        state.approvedTx[owner][transactionHash] = true;
        emit TransactionApproved(owner, transactionHash);
    }

    function approveTransactions(
        address[] calldata owners,
        bytes32[] calldata transactionHashes
        )
        external
        override
        nonReentrant
    {
        require(owners.length == transactionHashes.length, "INVALID_DATA");
        require(state.agentRegistry.isAgent(owners, msg.sender), "UNAUTHORIZED");
        for (uint i = 0; i < owners.length; i++) {
            state.approvedTx[owners[i]][transactionHashes[i]] = true;
        }
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

    function getDomainSeparator()
        external
        override
        view
        returns (bytes32)
    {
        return state.DOMAIN_SEPARATOR;
    }

    // -- Admins --
    function setMaxAgeDepositUntilWithdrawable(
        uint32 newValue
        )
        external
        override
        nonReentrant
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

    function shutdown()
        external
        override
        nonReentrant
        onlyOwner
        returns (bool success)
    {
        require(!state.isInWithdrawalMode(), "INVALID_MODE");
        require(!state.isShutdown(), "ALREADY_SHUTDOWN");
        state.shutdownModeStartTime = block.timestamp;
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

    function setAmmFeeBips(uint8 _feeBips)
        external
        override
        nonReentrant
        onlyOwner
    {
        require(_feeBips <= 200, "INVALID_VALUE");
        state.ammFeeBips = _feeBips;
    }

    function getAmmFeeBips()
        external
        override
        view
        returns (uint8)
    {
        return state.ammFeeBips;
    }

    function setAllowOnchainTransferFrom(bool value)
        external
        nonReentrant
        onlyOwner
    {
        require(state.allowOnchainTransferFrom != value, "SAME_VALUE");
        state.allowOnchainTransferFrom = value;
    }
}
