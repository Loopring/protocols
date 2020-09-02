// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../aux/access/IBlockReceiver.sol";
import "../aux/transactions/BlockReader.sol";
import "../thirdparty/BytesUtil.sol";
import "../core/iface/IExchangeV3.sol";
import "../lib/AddressUtil.sol";
import "../lib/ERC20.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";

import "../core/impl/libtransactions/AmmUpdateTransaction.sol";
import "../core/impl/libtransactions/DepositTransaction.sol";
import "../core/impl/libtransactions/WithdrawTransaction.sol";

/// @title AmmPool
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev Incomplete AMM pool implementation for demo/testing purposes.
contract AmmPool is IBlockReceiver {

    using AddressUtil       for address;
    using AddressUtil       for address payable;
    using BlockReader       for ExchangeData.Block;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;

    event Deposit(
        address  owner,
        uint96[] amounts
    );

    event Withdrawal(
        address  owner,
        uint96[] amounts
    );

    event JoinPoolRequested(
        address  owner,
        uint     poolAmountOut,
        uint96[] maxAmountsIn
    );

    event ExitPoolRequested(
        address  owner,
        uint     poolAmountIn,
        uint96[] minAmountsOut
    );

    uint public constant MAX_AGE_REQUEST_UNTIL_POOL_SHUTDOWN = 7 days;

    IExchangeV3 public exchange;
    uint32      public accountID;

    uint        public shutdownTimestamp = 0;

    struct PoolJoin
    {
        uint poolAmountOut;
        uint96[] maxAmountsIn;
    }

    struct PoolExit
    {
        uint poolAmountIn;
        uint96[] minAmountsOut;
    }

    enum WorkType
    {
        NONE,
        JOIN,
        EXIT
    }

    struct QueueItem
    {
        address  owner;
        uint64   timestamp;
        WorkType workType;
        PoolJoin join;
        PoolExit exit;
    }

    struct Token
    {
        address addr;
        uint96  weight;
        uint16  tokenID;
    }

    uint8 public feeBips;
    Token[] public tokens;

    QueueItem[] public queue;
    uint public queuePos = 0;

    // A map from an owner to a token to the balance
    mapping (address => mapping (address => uint)) balance;
    // A map from an owner to a token to the balance locked
    mapping (address => mapping (address => uint)) locked;
    // A map from a token to the total balance owned directly by LPs (so NOT owned by the pool itself)
    mapping (address => uint) totalBalance;

    modifier onlyExchangeOwner()
    {
        require(msg.sender == exchange.owner(), "UNAUTHORIZED");
        _;
    }

    modifier online()
    {
        require(isOnline(), "NOT_ONLINE");
        _;
    }

    modifier offline()
    {
        require(!isOnline(), "NOT_OFFLINE");
        _;
    }

    function setupPool(
        IExchangeV3        _exchange,
        uint32             _accountID,
        address[] calldata _tokens,
        uint96[]  calldata _weights,
        uint8              _feeBips
        )
        external
    {
        require(tokens.length == 0, "ALREADY_INITIALIZED");
        require(_tokens.length == _weights.length, "INVALID_DATA");
        require(_tokens.length >= 2, "INVALID_DATA");

        exchange = _exchange;
        accountID = _accountID;
        feeBips = _feeBips;
        for (uint i = 0; i < _tokens.length; i++) {
            uint16 tokenID = exchange.getTokenID(_tokens[i]);
            tokens.push(Token({
                addr: _tokens[i],
                tokenID: tokenID,
                weight: _weights[i]
            }));
        }
    }

    function deposit(uint96[] calldata amounts)
        external
        payable
        online
    {
        require(amounts.length == tokens.length, "INVALID_DATA");

        // Deposit the max amounts to this contract so we are sure
        // the amounts are available when the actual deposit to the exchange is done.
        for (uint i = 0; i < tokens.length; i++) {
            address token = tokens[i].addr;
            if (token == address(0)) {
                require(msg.value == amounts[i], "INVALID_ETH_DEPOSIT");
            } else {
                token.safeTransferFromAndVerify(msg.sender, address(this), uint(amounts[i]));
            }
            balance[msg.sender][token] = balance[msg.sender][token].add(amounts[i]);
            totalBalance[token] = totalBalance[token].add(amounts[i]);
        }

        emit Deposit(msg.sender, amounts);
    }

    function withdraw(uint96[] calldata amounts)
        external
        payable
    {
        require(amounts.length == tokens.length, "INVALID_DATA");

        // Withdraw any outstanding balances for the pool account on the exchange
        address[] memory owners = new address[](tokens.length);
        address[] memory tokenAddresses = new address[](tokens.length);
        for (uint i = 0; i < tokens.length; i++) {
            owners[i] = address(this);
            tokenAddresses[i] = tokens[i].addr;
        }
        exchange.withdrawFromApprovedWithdrawals(owners, tokenAddresses);

        // Withdraw
        for (uint i = 0; i < tokens.length; i++) {
            address token = tokens[i].addr;
            require(availableBalance(msg.sender, token) >= amounts[i], "INSUFFICIENT_BALANCE");
            balance[msg.sender][token] = balance[msg.sender][token].sub(amounts[i]);
            if (token == address(0)) {
                msg.sender.sendETHAndVerify(amounts[i], gasleft());
            } else {
                token.safeTransferAndVerify(msg.sender, amounts[i]);
            }
        }

        emit Withdrawal(msg.sender, amounts);
    }

    // Needs to be able to receive ETH from the exchange contract
    receive() payable external {}

    function availableBalance(address owner, address token)
        public
        view
        returns (uint)
    {
        if (isOnline()) {
            return balance[owner][token].sub(locked[owner][token]);
        } else {
            return balance[owner][token];
        }
    }

    function isOnline()
        public
        view
        returns (bool)
    {
        return shutdownTimestamp == 0;
    }

    function joinPool(uint poolAmountOut, uint96[] calldata maxAmountsIn)
        external
        online
    {
        require(maxAmountsIn.length == tokens.length, "INVALID_DATA");

        // Lock the necessary amounts so we're sure they are available when doing the actual deposit
        for (uint i = 0; i < tokens.length; i++) {
            require(availableBalance(msg.sender, tokens[i].addr) >= maxAmountsIn[i], "INSUFFICIENT_BALANCE");
            locked[msg.sender][tokens[i].addr] = locked[msg.sender][tokens[i].addr].add(maxAmountsIn[i]);
        }

        // Queue the work
        PoolJoin memory join = PoolJoin({
            poolAmountOut: poolAmountOut,
            maxAmountsIn: maxAmountsIn
        });
        PoolExit memory exit;
        queue.push(QueueItem({
            owner: msg.sender,
            timestamp: uint64(block.timestamp),
            workType: WorkType.JOIN,
            join: join,
            exit: exit
        }));

        emit JoinPoolRequested(msg.sender, poolAmountOut, maxAmountsIn);
    }

    function exitPool(uint poolAmountIn, uint96[] calldata minAmountsOut)
        external
        online
    {
        require(minAmountsOut.length == tokens.length, "INVALID_DATA");

        // Queue the work
        PoolJoin memory join;
        PoolExit memory exit = PoolExit({
            poolAmountIn: poolAmountIn,
            minAmountsOut: minAmountsOut
        });
        queue.push(QueueItem({
            owner: msg.sender,
            timestamp: uint64(block.timestamp),
            workType: WorkType.EXIT,
            join: join,
            exit: exit
        }));

        emit ExitPoolRequested(msg.sender, poolAmountIn, minAmountsOut);
    }

    // Anyone is able to shut down the pool when requests aren't being processed any more.
    function shutdown()
        external
        payable
        online
    {
        require(
            block.timestamp > queue[queuePos].timestamp + MAX_AGE_REQUEST_UNTIL_POOL_SHUTDOWN &&
            queue[queuePos].workType != WorkType.NONE,
            "REQUEST_NOT_TOO_OLD"
        );

        if (!exchange.isInWithdrawalMode()) {
            for (uint i = 0; i < tokens.length; i++) {
                exchange.forceWithdraw{value: msg.value/tokens.length}(
                    address(this),
                    tokens[i].addr,
                    accountID
                );
            }
        }

        shutdownTimestamp = block.timestamp;
    }

    // Only used to withdraw from the pool when shutdown.
    // Otherwise LPs should withdraw by doing normal queued exit requests.
    function withdrawFromPoolWhenShutdown(uint poolAmountIn)
        external
        offline
    {
        bool ready = true;
        if (exchange.isInWithdrawalMode()) {
            // Check if all tokens were withdrawn using Merkle proofs
            for (uint i = 0; i < tokens.length; i++) {
                ready = ready && !exchange.isWithdrawnInWithdrawalMode(accountID, tokens[i].addr);
            }
        } else {
            // Check if all forced withdrawals are done
            for (uint i = 0; i < tokens.length; i++) {
                ready = ready && !exchange.isForcedWithdrawalPending(accountID, tokens[i].addr);
            }
        }
        // Check that nothing is withdrawable anymore.
        for (uint i = 0; i < tokens.length; i++) {
            ready = ready && (exchange.getAmountWithdrawable(address(this), tokens[i].addr) == 0);
        }
        require(ready, "FUNDS_STILL_IN_EXCHANGE");

        // Use the balances on this contract
        for (uint i = 0; i < tokens.length; i++) {
            uint contractBalance;
            if (tokens[i].addr == address(0)) {
                contractBalance = address(this).balance;
            } else {
                contractBalance = ERC20(tokens[i].addr).balanceOf(address(this));
            }

            uint poolBalance = contractBalance.sub(totalBalance[tokens[i].addr]);
            // TODO: withdraw proportional to the pool amount owned
        }
    }

    struct AuxiliaryData
    {
        uint numItems;
    }

    // Processes work in the queue. Can only be called by the exchange owner
    // before the blocks containing work for this pool are submitted.
    // This just verifies if the work is done correctly and only then approves
    // the L2 transactions that were already included in the block.
    // Uses synchronized logic on L1/L2 to make the onchain logic easy and efficient.
    function beforeBlockSubmitted(
        ExchangeData.Block memory _block,
        uint                      txIdx,
        bytes              memory auxiliaryData
        )
        public
        override
        online
        onlyExchangeOwner
        returns (uint numTransactionsConsumed)
    {
        AuxiliaryData memory auxData = abi.decode(auxiliaryData, (AuxiliaryData));
        bytes32 exchangeDomainSeparator = exchange.getDomainSeparator();

        BlockReader.BlockHeader memory header = _block.readHeader();
        require(header.exchange == address(exchange), "INVALID_EXCHANGE");

        // First always update the AMM parameters, which also pulls the AMM balances onchain
        uint[] memory ammBalancesInAccount = new uint[](tokens.length);
        uint[] memory ammBalances = new uint[](tokens.length);
        for (uint i = 0; i < tokens.length; i++) {
            // Check that the AMM update in the block matches the expected update
            AmmUpdateTransaction.AmmUpdate memory update = _block.readAmmUpdate(txIdx++);
            require(update.owner == address(this), "INVALID_TX_DATA");
            require(update.accountID == accountID, "INVALID_TX_DATA");
            require(update.tokenID == tokens[i].tokenID, "INVALID_TX_DATA");
            require(update.feeBips == feeBips, "INVALID_TX_DATA");
            require(update.tokenWeight == tokens[i].weight, "INVALID_TX_DATA");
            // Now approve this AMM update
            update.validUntil = 0xffffffff;
            bytes32 txHash = AmmUpdateTransaction.hashTx(exchangeDomainSeparator, update);
            exchange.approveTransaction(address(this), txHash);
            numTransactionsConsumed++;
            // AMM account balance now available onchain
            ammBalancesInAccount[i] = update.balance;
            ammBalances[i] = ammBalancesInAccount[i];
        }

        // Process work in the queue
        for (uint n = queuePos; n < queuePos + auxData.numItems; n++) {
            QueueItem memory item = queue[n];
            // TODO: all the necessary pool logic, mint/burn LP tokens,...
            if (item.workType == WorkType.JOIN) {
                PoolJoin memory join = item.join;
                for (uint i = 0; i < tokens.length; i++) {
                    uint amount = join.maxAmountsIn[i];
                    ammBalances[i] = ammBalances[i].add(amount);
                    // Unlock the amount locked for this join
                    locked[item.owner][tokens[i].addr] = locked[item.owner][tokens[i].addr].sub(join.maxAmountsIn[i]);
                    // Make the amount unavailable for withdrawing
                    balance[item.owner][tokens[i].addr] = balance[item.owner][tokens[i].addr].sub(amount);
                }
            } else if (item.workType == WorkType.EXIT) {
                PoolExit memory exit = item.exit;
                for (uint i = 0; i < tokens.length; i++) {
                    uint amount = exit.minAmountsOut[i];
                    ammBalances[i] = ammBalances[i].sub(amount);
                    // Make the amount available for withdrawing
                    balance[item.owner][tokens[i].addr] = balance[item.owner][tokens[i].addr].add(amount);
                }
            }
            // Clean up the queue item to get the gas refund
            delete queue[n];
        }
        queuePos += auxData.numItems;

        // Deposit/Withdraw to/from the AMM account when necessary
        for (uint i = 0; i < tokens.length; i++) {
            if (ammBalances[i] > ammBalancesInAccount[i]) {
                uint amount = ammBalances[i] - ammBalancesInAccount[i];
                // Check that the deposit in the block matches the expected deposit
                DepositTransaction.Deposit memory _deposit = _block.readDeposit(txIdx++);
                require(_deposit.owner == address(this), "INVALID_TX_DATA");
                require(_deposit.accountID == accountID, "INVALID_TX_DATA");
                require(_deposit.tokenID == tokens[i].tokenID, "INVALID_TX_DATA");
                require(_deposit.amount == amount, "INVALID_TX_DATA");
                // Now do this deposit
                uint ethValue = 0;
                if (tokens[i].addr == address(0)) {
                    ethValue = _deposit.amount;
                } else {
                    // Approve the deposit transfer
                    ERC20(tokens[i].addr).approve(address(exchange), _deposit.amount);
                }
                exchange.deposit{value: ethValue}(
                    _deposit.owner,
                    _deposit.owner,
                    tokens[i].addr,
                    uint96(_deposit.amount),
                    new bytes(0)
                );
                numTransactionsConsumed++;
                // Total balance in this contract decreases by the amount deposited
                totalBalance[tokens[i].addr] = totalBalance[tokens[i].addr].sub(amount);
            } else if (ammBalancesInAccount[i] > ammBalances[i]) {
                uint amount = ammBalancesInAccount[i] - ammBalances[i];
                // Check that the withdrawal in the block matches the expected withdrawal
                WithdrawTransaction.Withdrawal memory withdrawal = _block.readWithdrawal(txIdx++);
                require(withdrawal.owner == address(this), "INVALID_TX_DATA");
                require(withdrawal.accountID == accountID, "INVALID_TX_DATA");
                require(withdrawal.tokenID == tokens[i].tokenID, "INVALID_TX_DATA");
                require(withdrawal.amount == amount, "INVALID_TX_DATA");
                require(withdrawal.feeTokenID == withdrawal.tokenID, "INVALID_TX_DATA");
                require(withdrawal.fee == 0, "INVALID_TX_DATA");
                require(withdrawal.to == address(this), "INVALID_TX_DATA");
                require(withdrawal.extraData.length == 0, "INVALID_TX_DATA");
                // Now approve this withdrawal
                withdrawal.validUntil = 0xffffffff;
                bytes32 txHash = WithdrawTransaction.hashTx(exchangeDomainSeparator, withdrawal);
                exchange.approveTransaction(address(this), txHash);
                numTransactionsConsumed++;
                // Total balance in this contract increases by the amount withdrawn
                totalBalance[tokens[i].addr] = totalBalance[tokens[i].addr].add(amount);
            }
        }
    }
}
