// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../aux/access/IBlockReceiver.sol";
import "../aux/transactions/TransactionReader.sol";
import "../thirdparty/BytesUtil.sol";
import "../core/iface/IExchangeV3.sol";
import "../lib/AddressUtil.sol";
import "../lib/ERC20.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";
import "../lib/SignatureUtil.sol";

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
    using TransactionReader for ExchangeData.Block;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using SignatureUtil     for bytes32;

    bytes32 constant public POOLJOIN_TYPEHASH = keccak256(
        "PoolJoin(address owner,bool fromLayer2,uint256 poolAmountOut,uint256[] maxAmountsIn)"
    );

    bytes32 constant public POOLEXIT_TYPEHASH = keccak256(
        "PoolExit(address owner,bool toLayer2,uint256 poolAmountIn,uint256[] minAmountsOut)"
    );

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
        bool     toLayer2,
        uint     poolAmountIn,
        uint96[] minAmountsOut
    );

    event QueueItemsProcessed(
        uint numItems
    );

    uint public constant BASE = 10**18;
    uint public constant INITIAL_SUPPLY = 100 * BASE;

    uint public constant MAX_AGE_REQUEST_UNTIL_POOL_SHUTDOWN = 7 days;

    IExchangeV3 public exchange;
    uint32      public accountID;

    bytes32     public DOMAIN_SEPARATOR;

    uint        public shutdownTimestamp = 0;

    enum PoolTransactionType
    {
        NOOP,
        JOIN,
        EXIT
    }

    struct Context
    {
        ExchangeData.Block _block;
        uint    txIdx;
        bytes32 exchangeDomainSeparator;
        uint[]  ammBalancesInAccount;
        uint[]  ammBalances;
        uint    numTransactionsConsumed;
    }

    struct PoolJoin
    {
        address  owner;
        bool     fromLayer2;
        uint     poolAmountOut;
        uint96[] maxAmountsIn;
    }

    struct PoolExit
    {
        address  owner;
        bool     toLayer2;
        uint     poolAmountIn;
        uint96[] minAmountsOut;
    }

    struct PoolTransaction
    {
        PoolTransactionType txType;
        bytes               data;
        bytes               signature;
    }

    struct QueueItem
    {
        uint64              timestamp;
        PoolTransactionType txType;
        bytes32             txHash;
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

    // Liquidity tokens
    uint public poolSupply;
    mapping (address => uint) poolBalance;

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

        DOMAIN_SEPARATOR = EIP712.hash(EIP712.Domain("AMM Pool", "1.0.0", address(this)));

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
            owner: msg.sender,
            fromLayer2: false,
            poolAmountOut: poolAmountOut,
            maxAmountsIn: maxAmountsIn
        });
        queue.push(QueueItem({
            timestamp: uint64(block.timestamp),
            txType: PoolTransactionType.JOIN,
            txHash: hashPoolJoin(DOMAIN_SEPARATOR, join)
        }));

        emit JoinPoolRequested(msg.sender, poolAmountOut, maxAmountsIn);
    }

    function exitPool(uint poolAmountIn, uint96[] calldata minAmountsOut, bool toLayer2)
        external
        online
    {
        require(minAmountsOut.length == tokens.length, "INVALID_DATA");

        // Queue the work
        PoolExit memory exit = PoolExit({
            owner: msg.sender,
            toLayer2: toLayer2,
            poolAmountIn: poolAmountIn,
            minAmountsOut: minAmountsOut
        });
        queue.push(QueueItem({
            timestamp: uint64(block.timestamp),
            txType: PoolTransactionType.EXIT,
            txHash: hashPoolExit(DOMAIN_SEPARATOR, exit)
        }));

        emit ExitPoolRequested(msg.sender, toLayer2, poolAmountIn, minAmountsOut);
    }

    // Anyone is able to shut down the pool when requests aren't being processed any more.
    function shutdown()
        external
        payable
        online
    {
        require(
            block.timestamp > queue[queuePos].timestamp + MAX_AGE_REQUEST_UNTIL_POOL_SHUTDOWN &&
            queue[queuePos].txType != PoolTransactionType.NOOP,
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
    function withdrawFromPoolWhenShutdown(uint /*poolAmountIn*/)
        external
        view
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

            // uint poolBalance = contractBalance.sub(totalBalance[tokens[i].addr]);
            // TODO: withdraw proportional to the pool amount owned
        }
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
        returns (uint)
    {
        PoolTransaction[] memory poolTransactions = abi.decode(auxiliaryData, (PoolTransaction[]));

        // Cache the domain seperator to save on SLOADs each time it is accessed.
        Context memory ctx = Context({
            _block: _block,
            txIdx: txIdx,
            exchangeDomainSeparator: exchange.getDomainSeparator(),
            ammBalancesInAccount: new uint[](tokens.length),
            ammBalances: new uint[](tokens.length),
            numTransactionsConsumed: 0
        });

        BlockReader.BlockHeader memory header = _block.readHeader();
        require(header.exchange == address(exchange), "INVALID_EXCHANGE");

        // The starting AMM updates
        // This also pulls the AMM balances onchain.
        processAmmUpdates(ctx, true);

        // Process all pool transactions
        for (uint n = 0; n < poolTransactions.length; n++) {
            PoolTransaction memory poolTx = poolTransactions[n];
            if (poolTx.txType == PoolTransactionType.JOIN) {
                PoolJoin memory join = abi.decode(poolTx.data, (PoolJoin));
                processJoin(ctx, join, poolTx.signature);
            } else if (poolTx.txType == PoolTransactionType.EXIT) {
                PoolExit memory exit = abi.decode(poolTx.data, (PoolExit));
                processExit(ctx, exit, poolTx.signature);
            }
        }

        // Deposit/Withdraw to/from the AMM account when necessary
        for (uint i = 0; i < tokens.length; i++) {
            if (ctx.ammBalances[i] > ctx.ammBalancesInAccount[i]) {
                uint amount = ctx.ammBalances[i] - ctx.ammBalancesInAccount[i];
                processDeposit(ctx, tokens[i], amount);
            } else if (ctx.ammBalancesInAccount[i] > ctx.ammBalances[i]) {
                uint amount = ctx.ammBalancesInAccount[i] - ctx.ammBalances[i];
                processWithdrawal(ctx, tokens[i], amount);
            }
        }

        // The ending AMM updates
        processAmmUpdates(ctx, false);

        emit QueueItemsProcessed(poolTransactions.length);
        return ctx.numTransactionsConsumed;
    }

    function totalSupply()
        public
        view
        returns (uint256)
    {
        return poolSupply;
    }

    function mint(address owner, uint amount)
        internal
    {
        poolSupply = poolSupply.add(amount);
        poolBalance[owner] = poolBalance[owner].add(amount);
    }

    function burn(address owner, uint amount)
        internal
    {
        poolSupply = poolSupply.sub(amount);
        poolBalance[owner] = poolBalance[owner].sub(amount);
    }

    function processAmmUpdates(
        Context memory ctx,
        bool   start
        )
        internal
    {
        for (uint i = 0; i < tokens.length; i++) {
            // Check that the AMM update in the block matches the expected update
            AmmUpdateTransaction.AmmUpdate memory update = ctx._block.readAmmUpdate(ctx.txIdx++);
            require(update.owner == address(this), "INVALID_TX_DATA");
            require(update.accountID == accountID, "INVALID_TX_DATA");
            require(update.tokenID == tokens[i].tokenID, "INVALID_TX_DATA");
            require(update.feeBips == feeBips, "INVALID_TX_DATA");
            require(update.tokenWeight == (start ? 0 : tokens[i].weight), "INVALID_TX_DATA");
            // Now approve this AMM update
            update.validUntil = 0xffffffff;
            bytes32 txHash = AmmUpdateTransaction.hashTx(ctx.exchangeDomainSeparator, update);
            exchange.approveTransaction(address(this), txHash);
            ctx.numTransactionsConsumed++;
            if (start) {
                // AMM account balance now available onchain
                ctx.ammBalancesInAccount[i] = update.balance;
                ctx.ammBalances[i] = ctx.ammBalancesInAccount[i];
            }
        }
    }

    function processJoin(
        Context  memory ctx,
        PoolJoin memory join,
        bytes    memory signature
        )
        internal
    {
        bytes32 poolTxHash = hashPoolJoin(DOMAIN_SEPARATOR, join);
        if (signature.length == 0) {
            require(queue[queuePos].txHash == poolTxHash, "NOT_APPROVED");
            delete queue[queuePos];
            queuePos++;
        } else {
            require(poolTxHash.verifySignature(join.owner, signature), "INVALID_SIGNATURE");
        }

        uint poolTotal = totalSupply();
        uint ratio = BASE;
        if (poolTotal > 0) {
            ratio = (join.poolAmountOut * BASE) / poolTotal;
        } else {
            // Important for accuracy
            require(join.poolAmountOut == INITIAL_SUPPLY, "INITIAL_SUPPLY_UNEXPECTED");
        }

        for (uint i = 0; i < tokens.length; i++) {
            uint amount = ctx.ammBalances[i] * ratio / BASE;
            if (poolTotal == 0) {
                amount = join.maxAmountsIn[i];
            }
            require(amount <= join.maxAmountsIn[i], "LIMIT_IN");
            if (join.fromLayer2) {
                TransferTransaction.Transfer memory transfer = ctx._block.readTransfer(ctx.txIdx++);
                require(transfer.from == join.owner, "INVALID_TX_DATA");
                require(transfer.toAccountID == accountID, "INVALID_TX_DATA");
                require(transfer.tokenID == tokens[i].tokenID, "INVALID_TX_DATA");
                require(isAlmostEqual(transfer.amount, amount), "INVALID_TX_DATA");
                require(transfer.fee == 0, "INVALID_TX_DATA");
                if (signature.length != 0) {
                    // Now approve this transfer
                    transfer.validUntil = 0xffffffff;
                    bytes32 txHash = TransferTransaction.hashTx(ctx.exchangeDomainSeparator, transfer);
                    exchange.approveTransaction(join.owner, txHash);
                }
                ctx.numTransactionsConsumed++;
                // Update the balances in the account
                ctx.ammBalancesInAccount[i] = ctx.ammBalancesInAccount[i].add(amount);
            } else {
                // Unlock the amount locked for this join
                locked[join.owner][tokens[i].addr] = locked[join.owner][tokens[i].addr].sub(amount);
                // Make the amount unavailable for withdrawing
                balance[join.owner][tokens[i].addr] = balance[join.owner][tokens[i].addr].sub(amount);
            }
            ctx.ammBalances[i] = ctx.ammBalances[i].add(amount);
        }

        // Mint liquidity tokens
        mint(join.owner, join.poolAmountOut);
    }

    function processExit(
        Context  memory ctx,
        PoolExit memory exit,
        bytes    memory signature
        )
        internal
    {
        bytes32 poolTxHash = hashPoolExit(DOMAIN_SEPARATOR, exit);
        if (signature.length == 0) {
            require(queue[queuePos].txHash == poolTxHash, "NOT_APPROVED");
            delete queue[queuePos];
            queuePos++;
        } else {
            require(poolTxHash.verifySignature(exit.owner, signature), "INVALID_SIGNATURE");
        }

        uint poolTotal = totalSupply();
        uint ratio = (exit.poolAmountIn * BASE) / poolTotal;

        for (uint i = 0; i < tokens.length; i++) {
            uint amount = ctx.ammBalances[i] * ratio / BASE;
            require(amount >= exit.minAmountsOut[i], "LIMIT_OUT");
            if (exit.toLayer2) {
                TransferTransaction.Transfer memory transfer = ctx._block.readTransfer(ctx.txIdx++);
                require(transfer.fromAccountID == accountID, "INVALID_TX_DATA");
                require(transfer.from == address(this), "INVALID_TX_DATA");
                require(transfer.to == exit.owner, "INVALID_TX_DATA");
                require(transfer.tokenID == tokens[i].tokenID, "INVALID_TX_DATA");
                require(isAlmostEqual(transfer.amount, amount), "INVALID_TX_DATA");
                require(transfer.fee == 0, "INVALID_TX_DATA");
                // Now approve this transfer
                transfer.validUntil = 0xffffffff;
                bytes32 txHash = TransferTransaction.hashTx(ctx.exchangeDomainSeparator, transfer);
                exchange.approveTransaction(address(this), txHash);
                ctx.numTransactionsConsumed++;
                // Update the balances in the account
                ctx.ammBalancesInAccount[i] = ctx.ammBalancesInAccount[i].sub(amount);
            } else {
                // Make the amount available for withdrawing
                balance[exit.owner][tokens[i].addr] = balance[exit.owner][tokens[i].addr].add(amount);
            }
            ctx.ammBalances[i] = ctx.ammBalances[i].sub(amount);
        }

        // Burn liquidity tokens
        burn(exit.owner, exit.poolAmountIn);
    }

    function processDeposit(
        Context memory ctx,
        Token   memory token,
        uint    amount
        )
        internal
    {
        // Check that the deposit in the block matches the expected deposit
        DepositTransaction.Deposit memory _deposit = ctx._block.readDeposit(ctx.txIdx++);
        require(_deposit.owner == address(this), "INVALID_TX_DATA");
        require(_deposit.accountID == accountID, "INVALID_TX_DATA");
        require(_deposit.tokenID == token.tokenID, "INVALID_TX_DATA");
        require(_deposit.amount == amount, "INVALID_TX_DATA");
        // Now do this deposit
        uint ethValue = 0;
        if (token.addr == address(0)) {
            ethValue = _deposit.amount;
        } else {
            // Approve the deposit transfer
            ERC20(token.addr).approve(address(exchange.getDepositContract()), _deposit.amount);
        }
        exchange.deposit{value: ethValue}(
            _deposit.owner,
            _deposit.owner,
            token.addr,
            uint96(_deposit.amount),
            new bytes(0)
        );
        ctx.numTransactionsConsumed++;
        // Total balance in this contract decreases by the amount deposited
        totalBalance[token.addr] = totalBalance[token.addr].sub(amount);
    }

    function processWithdrawal(
        Context memory ctx,
        Token   memory token,
        uint    amount
        )
        internal
    {
        // Check that the withdrawal in the block matches the expected withdrawal
        WithdrawTransaction.Withdrawal memory withdrawal = ctx._block.readWithdrawal(ctx.txIdx++);
        require(withdrawal.owner == address(this), "INVALID_TX_DATA");
        require(withdrawal.accountID == accountID, "INVALID_TX_DATA");
        require(withdrawal.tokenID == token.tokenID, "INVALID_TX_DATA");
        require(withdrawal.amount == amount, "INVALID_TX_DATA");
        require(withdrawal.feeTokenID == withdrawal.tokenID, "INVALID_TX_DATA");
        require(withdrawal.fee == 0, "INVALID_TX_DATA");
        withdrawal.minGas = 0;
        withdrawal.to = address(this);
        withdrawal.extraData = new bytes(0);
        bytes20 onchainDataHash = WithdrawTransaction.hashOnchainData(
            withdrawal.minGas,
            withdrawal.to,
            withdrawal.extraData
        );
        require(withdrawal.onchainDataHash == onchainDataHash, "INVALID_TX_DATA");
        // Now approve this withdrawal
        withdrawal.validUntil = 0xffffffff;
        bytes32 txHash = WithdrawTransaction.hashTx(ctx.exchangeDomainSeparator, withdrawal);
        exchange.approveTransaction(address(this), txHash);
        ctx.numTransactionsConsumed++;
        // Total balance in this contract increases by the amount withdrawn
        totalBalance[token.addr] = totalBalance[token.addr].add(amount);
    }

    function hashPoolJoin(
        bytes32 _DOMAIN_SEPARATOR,
        PoolJoin memory join
        )
        internal
        pure
        returns (bytes32)
    {
        return EIP712.hashPacked(
            _DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    POOLJOIN_TYPEHASH,
                    join.owner,
                    join.fromLayer2,
                    join.poolAmountOut,
                    keccak256(abi.encodePacked(join.maxAmountsIn))
                )
            )
        );
    }

    function hashPoolExit(
        bytes32 _DOMAIN_SEPARATOR,
        PoolExit memory exit
        )
        internal
        pure
        returns (bytes32)
    {
        return EIP712.hashPacked(
            _DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    POOLEXIT_TYPEHASH,
                    exit.owner,
                    exit.toLayer2,
                    exit.poolAmountIn,
                    keccak256(abi.encodePacked(exit.minAmountsOut))
                )
            )
        );
    }

    function isAlmostEqual(
        uint amount,
        uint targetAmount
        )
        internal
        pure
        returns (bool)
    {
        if (targetAmount == 0) {
            return amount == 0;
        } else {
            // Max rounding error for a float24 is 2/100000
            uint ratio = (amount * 100000) / targetAmount;
            return (100000 - 2) <= ratio && ratio <= (100000 + 2);
        }
    }
}
