// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./LPERC20.sol";
import "../aux/access/IBlockReceiver.sol";
import "../aux/transactions/TransactionReader.sol";
import "../thirdparty/BytesUtil.sol";
import "../thirdparty/SafeCast.sol";
import "../core/iface/IAgentRegistry.sol";
import "../core/iface/IExchangeV3.sol";
import "../lib/AddressUtil.sol";
import "../lib/ERC20.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";
import "../lib/MathUint96.sol";
import "../lib/SignatureUtil.sol";

import "../core/impl/libtransactions/AmmUpdateTransaction.sol";
import "../core/impl/libtransactions/DepositTransaction.sol";
import "../core/impl/libtransactions/WithdrawTransaction.sol";

/// @title AmmPool
/// @author Brecht Devos - <brecht@loopring.org>
/// @dev Incomplete AMM pool implementation for demo/testing purposes.
contract AmmPool is LPERC20, IBlockReceiver, IAgent {

    using AddressUtil       for address;
    using AddressUtil       for address payable;
    using BlockReader       for ExchangeData.Block;
    using TransactionReader for ExchangeData.Block;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;
    using SignatureUtil     for bytes32;


    bytes32 constant public POOLJOIN_TYPEHASH = keccak256(
        "PoolJoin(address owner,bool fromLayer2,uint256 minPoolAmountOut,uint256[] maxAmountsIn,uint32[] storageIDs,uint256 validUntil)"
    );

    bytes32 constant public POOLEXIT_TYPEHASH = keccak256(
        "PoolExit(address owner,bool toLayer2,uint256 poolAmountIn,uint256[] minAmountsOut,uint32[] storageIDs,uint256 validUntil)"
    );

    bytes32 constant public WITHDRAW_TYPEHASH = keccak256(
        "Withdraw(address owner,uint256 poolAmount,uint256[] amounts,uint256 validUntil,uint256 nonce)"
    );

    event Deposit(
        address  owner,
        uint     poolAmount,
        uint96[] amounts
    );

    event Withdrawal(
        address   owner,
        uint256[] amounts
    );

    event PoolJoinRequested(
        address  owner,
        bool     fromLayer2,
        uint     minPoolAmountOut,
        uint96[] maxAmountsIn,
        uint     validUntil
    );

    event ExitPoolRequested(
        address  owner,
        bool     toLayer2,
        uint     poolAmountIn,
        uint96[] minAmountsOut
    );

    event LockedUntil(
        address  owner,
        uint     timestamp
    );

    uint public constant BASE = 10 ** 18;
    uint public constant INITIAL_SUPPLY = 100 * BASE;

    uint public constant MAX_AGE_REQUEST_UNTIL_POOL_SHUTDOWN = 7 days;

    uint public constant MIN_TIME_TO_UNLOCK = 1 days;

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

    struct PoolJoin
    {
        address  owner;
        bool     fromLayer2;
        uint     minPoolAmountOut;
        uint96[] maxAmountsIn;
        uint32[] storageIDs;
        uint     validUntil;
    }

    struct PoolExit
    {
        address  owner;
        bool     toLayer2;
        uint     poolAmountIn;
        uint96[] minAmountsOut;
        uint32[] storageIDs;
        uint     validUntil;
    }

    struct PoolTransaction
    {
        PoolTransactionType txType;
        bytes               data;
        bytes               signature;
    }

    struct Token
    {
        address addr;
        uint96  weight;
        uint16  tokenID;
    }

    struct Context
    {
        ExchangeData.Block _block;
        uint     txIdx;
        bytes32  DOMAIN_SEPARATOR;
        bytes32  exchangeDomainSeparator;
        uint96[] ammActualL2Balances;
        uint96[] ammExpectedL2Balances;
        uint     numTransactionsConsumed;
        Token[]  tokens;
    }

    uint8 public feeBips;
    Token[] public tokens;

    // A map of approved transaction hashes to the timestamp it was created
    mapping (bytes32 => uint) approvedTx;

    // A map from an owner to a token to the balance
    mapping (address => mapping (address => uint)) lockedBalance;
    // A map from an owner to the timestamp until all funds of the user are locked
    // A zero value == locked indefinitely.
    mapping (address => uint) lockedUntil;
    // A map from a token to the total balance owned directly by LPs (so NOT owned by the pool itself)
    mapping (address => uint) totalLockedBalance;

    // A map from an address to a nonce.
    mapping(address => uint) public nonces;

    // A map from an owner to if a user is currently exiting using an onchain approval.
    mapping (address => bool) isExiting;

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

        address depositContract = address(exchange.getDepositContract());

        for (uint i = 0; i < _tokens.length; i++) {
            address token = _tokens[i];
            uint16 tokenID = exchange.getTokenID(token);
            tokens.push(Token({
                addr: token,
                tokenID: tokenID,
                weight: _weights[i]
            }));

            ERC20(token).approve(depositContract, ~uint(0));
        }
    }

    /// @param poolAmount The amount of liquidity tokens to deposit
    /// @param amounts The amounts to deposit
    function deposit(uint96 poolAmount, uint96[] calldata amounts)
        external
        payable
        online
    {
        depositInternal(poolAmount, amounts);
    }

    /// @param poolAmount The amount of liquidity tokens to withdraw
    /// @param amounts The amounts to withdraw
    /// @param validUntil When a signature is provided: the `validUntil` of the signature.
    /// @param signature Signature of the operator to allow withdrawals without unlocking
    function withdraw(
        uint   poolAmount,
        uint[] calldata amounts,
        uint   validUntil,
        bytes  calldata signature
        )
        external
    {
        require(amounts.length == tokens.length, "INVALID_DATA");

        // Check if we can withdraw without unlocking
        if (signature.length > 0) {
            require(validUntil >= block.timestamp, 'SIGNATURE_EXPIRED');
            bytes32 withdrawHash = EIP712.hashPacked(
                DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        WITHDRAW_TYPEHASH,
                        msg.sender,
                        poolAmount,
                        keccak256(abi.encodePacked(amounts)),
                        validUntil,
                        nonces[msg.sender]++
                    )
                )
            );
            require(withdrawHash.verifySignature(exchange.owner(), signature), "INVALID_SIGNATURE");
        }

        // Withdraw any outstanding balances for the pool account on the exchange
        /*address[] memory owners = new address[](tokens.length);
        address[] memory tokenAddresses = new address[](tokens.length);

        for (uint i = 0; i < tokens.length; i++) {
            owners[i] = address(this);
            tokenAddresses[i] = tokens[i].addr;
        }
        exchange.withdrawFromApprovedWithdrawals(owners, tokenAddresses);

        // Withdraw
        uint[] memory withdrawn = new uint[](tokens.length + 1);
        for (uint i = 0; i < tokens.length + 1; i++) {
            uint amount = (i < tokens.length) ? amounts[i] : poolAmount;
            address token = (i < tokens.length) ? tokens[i].addr : address(this);
            uint available = (signature.length > 0) ? lockedBalance[token][msg.sender] : availableBalance(token, msg.sender);
            if (amount > available) {
                withdrawn[i] = available;
            } else {
                withdrawn[i] = amount;
            }
            if (withdrawn[i] > 0) {
                lockedBalance[token][msg.sender] = lockedBalance[token][msg.sender].sub(withdrawn[i]);
                withdrawInternal(token, withdrawn[i], msg.sender);
            }
        }

        emit Withdrawal(msg.sender, withdrawn);*/
    }

    // Needs to be able to receive ETH from the exchange contract
    receive() payable external {}

    function availableBalance(address token, address owner)
        public
        view
        returns (uint)
    {
        if (isOnline()) {
            uint until = lockedUntil[owner];
            if (until != 0 && block.timestamp > until) {
                return lockedBalance[token][owner];
            } else {
                return 0;
            }
        } else {
            return lockedBalance[token][owner];
        }
    }

    function isOnline()
        public
        view
        returns (bool)
    {
        return shutdownTimestamp == 0;
    }

    function depositAndJoinPool(
        uint minPoolAmountOut,
        uint96[] calldata maxAmountsIn,
        bool fromLayer2,
        uint validUntil
        )
        external
        online
    {
        depositInternal(0, maxAmountsIn);
        joinPoolInternal(minPoolAmountOut, maxAmountsIn, fromLayer2, validUntil);
    }

    /// @dev Joins the pool using on-chain funds.
    /// @param minPoolAmountOut The minimum number of liquidity tokens that need to be minted for this join.
    /// @param maxAmountsIn The maximum amounts that can be used to mint
    ///                     the specified amount of liquidity tokens.
    function joinPool(
        uint minPoolAmountOut,
        uint96[] calldata maxAmountsIn,
        bool fromLayer2,
        uint validUntil
        )
        external
        online
    {
        joinPoolInternal(minPoolAmountOut, maxAmountsIn, fromLayer2, validUntil);
    }

    /// @dev Joins the pool using on-chain funds.
    /// @param poolAmountIn The number of liquidity tokens that will be burned.
    /// @param minAmountsOut The minimum amounts that need to be withdrawn when burning
    ///                      the specified amount of liquidity tokens.
    function exitPool(uint poolAmountIn, uint96[] calldata minAmountsOut, bool toLayer2)
        external
        online
    {
        require(minAmountsOut.length == tokens.length, "INVALID_DATA");

        // To make the the available liqudity tokens cannot suddenly change
        // we keep track of when onchain exits (which need to be processed) are pending.
        require(isExiting[msg.sender] == false, "ALREADY_EXITING");
        isExiting[msg.sender] = true;

        // Approve the exit
        PoolExit memory exit = PoolExit({
            owner: msg.sender,
            toLayer2: toLayer2,
            poolAmountIn: poolAmountIn,
            minAmountsOut: minAmountsOut,
            storageIDs: new uint32[](0),
            validUntil: 0xffffffff
        });
        bytes32 txHash = hashPoolExit(DOMAIN_SEPARATOR, exit);
        approvedTx[txHash] = block.timestamp;

        emit ExitPoolRequested(msg.sender, toLayer2, poolAmountIn, minAmountsOut);
    }

    function setLockedUntil(uint timestamp)
        public
    {
        if (timestamp > 0) {
            require(timestamp >= block.timestamp + MIN_TIME_TO_UNLOCK, "TOO_SOON");
        }
        lockedUntil[msg.sender] = timestamp;

        emit LockedUntil(msg.sender, timestamp);
    }

    // Anyone is able to shut down the pool when requests aren't being processed any more.
    function shutdown(bytes32 txHash)
        external
        payable
        online
    {
        /*require(
            block.timestamp > approvedTx[txHash] + MAX_AGE_REQUEST_UNTIL_POOL_SHUTDOWN,
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

        shutdownTimestamp = block.timestamp;*/
    }

    // Only used to withdraw from the pool when shutdown.
    // Otherwise LPs should withdraw by doing normal queued exit requests.
    function withdrawFromPoolWhenShutdown(uint poolAmountIn)
        external
        offline
    {
        // Currently commented out to make the contract size smaller...
        /*bool ready = true;
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

        // Withdraw proportionally to the liquidity owned
        uint poolTotal = totalSupply();
        for (uint i = 0; i < tokens.length; i++) {
            address token = tokens[i].addr;

            // Calculate the balance inside the pool
            uint contractBalance;
            if (token == address(0)) {
                contractBalance = address(this).balance;
            } else {
                contractBalance = ERC20(token).balanceOf(address(this));
            }
            uint tokenBalance = contractBalance.sub(totalBalance[token]);

            // Withdraw the part owned
            uint amount = poolAmountIn.mul(tokenBalance) / poolTotal;
            withdrawInternal(token, amount, msg.sender);
        }

        // Burn liquidity tokens
        burn(msg.sender, poolAmountIn);*/
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
            DOMAIN_SEPARATOR: DOMAIN_SEPARATOR,
            exchangeDomainSeparator: exchange.getDomainSeparator(),
            ammActualL2Balances: new uint96[](tokens.length),
            ammExpectedL2Balances: new uint96[](tokens.length),
            numTransactionsConsumed: 0,
            tokens: tokens
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
        for (uint i = 0; i < ctx.tokens.length; i++) {
            if (ctx.ammExpectedL2Balances[i] > ctx.ammActualL2Balances[i]) {
                uint96 amount = ctx.ammExpectedL2Balances[i] - ctx.ammActualL2Balances[i];
                processDeposit(ctx, ctx.tokens[i], amount);
            } else if (ctx.ammActualL2Balances[i] > ctx.ammExpectedL2Balances[i]) {
                uint96 amount = ctx.ammActualL2Balances[i] - ctx.ammExpectedL2Balances[i];
                processWithdrawal(ctx, ctx.tokens[i], amount);
            }
        }

        // The ending AMM updates
        processAmmUpdates(ctx, false);

        return ctx.numTransactionsConsumed;
    }

    function depositInternal(uint poolAmount, uint96[] calldata amounts)
        internal
    {
        require(amounts.length == tokens.length, "INVALID_DATA");
        if (isExiting[msg.sender]) {
            // Q: 这个标记的用途？
            // This could suddenly change the amount of liquidity tokens available, which
            // could change how the operator needs to process the exit.
            require(poolAmount == 0, "CANNOT_DEPOSIT_LIQUIDITY_TOKENS_WHILE_EXITING");
        }

        // Lock up funds inside this contract so we can depend on them being available.
        for (uint i = 0; i < tokens.length + 1; i++) {
            uint amount = (i < tokens.length) ? amounts[i] : poolAmount;
            address token = (i < tokens.length) ? tokens[i].addr : address(this);
            if (token == address(0)) {
                require(msg.value == amount, "INVALID_ETH_DEPOSIT");
            } else {
                token.safeTransferFromAndVerify(msg.sender, address(this), uint(amount));
            }
            lockedBalance[token][msg.sender] = lockedBalance[token][msg.sender].add(amount);
            totalLockedBalance[token] = totalLockedBalance[token].add(amount);
        }

        emit Deposit(msg.sender, poolAmount, amounts);
    }

    function joinPoolInternal(uint minPoolAmountOut, uint96[] calldata maxAmountsIn, bool fromLayer2, uint validUntil)
        internal
    {
        require(maxAmountsIn.length == tokens.length, "INVALID_DATA");

        // Don't check the available funds here, if the operator isn't sure the funds
        // are locked this transaction can simply be dropped.

        // Approve the join
        PoolJoin memory join = PoolJoin({
            owner: msg.sender,
            fromLayer2: fromLayer2,
            minPoolAmountOut: minPoolAmountOut,
            maxAmountsIn: maxAmountsIn,
            storageIDs: new uint32[](0), // Q：这是做什么的？
            validUntil: validUntil
        });
        bytes32 txHash = hashPoolJoin(DOMAIN_SEPARATOR, join);
        approvedTx[txHash] = 0xffffffff;

        emit PoolJoinRequested(msg.sender, fromLayer2, minPoolAmountOut, maxAmountsIn, validUntil);

        // Q: 可以直接在事件里面包含PoolJoin
    }

    function mint(address owner, uint amount)
        internal
    {
        _mint(address(this), amount);
        lockedBalance[address(this)][owner] = lockedBalance[address(this)][owner].add(amount);
    }

    function burn(address owner, uint amount)
        internal
    {
        lockedBalance[address(this)][owner] = lockedBalance[address(this)][owner].sub(amount);
        _burn(address(this), amount);
    }

    function processAmmUpdates(
        Context memory ctx,
        bool   start
        )
        internal
    {
        for (uint i = 0; i < ctx.tokens.length; i++) {
            // Check that the AMM update in the block matches the expected update
            AmmUpdateTransaction.AmmUpdate memory update = ctx._block.readAmmUpdate(ctx.txIdx++);
            require(update.owner == address(this), "INVALID_TX_DATA");
            require(update.accountID == accountID, "INVALID_TX_DATA");
            require(update.tokenID == ctx.tokens[i].tokenID, "INVALID_TX_DATA");
            require(update.feeBips == feeBips, "INVALID_TX_DATA");
            require(update.tokenWeight == (start ? 0 : ctx.tokens[i].weight), "INVALID_TX_DATA");
            // Now approve this AMM update
            update.validUntil = 0xffffffff;
            bytes32 txHash = AmmUpdateTransaction.hashTx(ctx.exchangeDomainSeparator, update);
            exchange.approveTransaction(address(this), txHash);
            ctx.numTransactionsConsumed++;
            if (start) {
                // AMM account balance now available onchain
                ctx.ammActualL2Balances[i] = update.balance;
                ctx.ammExpectedL2Balances[i] = update.balance;
            } else {
                require(ctx.ammExpectedL2Balances[i] == update.balance, "UNEXPECTED_AMM_BALANCE");
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
        authenticatePoolTx(
            join.owner,
            hashPoolJoin(ctx.DOMAIN_SEPARATOR, join),
            signature
        );

        // Check if the requirements are fulfilled
        (bool valid, uint poolAmountOut, uint96[] memory amounts) = validateJoinAmounts(ctx, join);
        if (!valid) {
            return;
        }

        for (uint i = 0; i < ctx.tokens.length; i++) {
            uint96 amount = amounts[i];
            if (join.fromLayer2) {
                TransferTransaction.Transfer memory transfer = ctx._block.readTransfer(ctx.txIdx++);
                require(transfer.from == join.owner, "INVALID_TX_DATA");
                require(transfer.toAccountID == accountID, "INVALID_TX_DATA");
                require(transfer.tokenID == ctx.tokens[i].tokenID, "INVALID_TX_DATA");
                require(isAlmostEqual(transfer.amount, amount), "INVALID_TX_DATA");
                require(transfer.fee == 0, "INVALID_TX_DATA");

                // Replay protection (only necessary when using a signature)
                if (signature.length > 0) {
                    require(transfer.storageID == join.storageIDs[i], "INVALID_TX_DATA");
                }

                // Now approve this transfer
                transfer.validUntil = 0xffffffff;
                bytes32 txHash = TransferTransaction.hashTx(ctx.exchangeDomainSeparator, transfer);
                exchange.approveTransaction(join.owner, txHash);

                ctx.numTransactionsConsumed++;
                // Update the amount to the actual amount transferred (which can have some some small rounding errors)
                amount = transfer.amount;
                // Update the balances in the account
                // Q: 为什么更新这个呢？
                ctx.ammActualL2Balances[i] = ctx.ammActualL2Balances[i].add(amount);
            } else {
                // Make the amount unavailable for withdrawing
                address token = ctx.tokens[i].addr;
                lockedBalance[token][join.owner] = lockedBalance[token][join.owner].sub(amount);
            }
            ctx.ammExpectedL2Balances[i] = ctx.ammExpectedL2Balances[i].add(amount);
        }

        // Mint liquidity tokens
        mint(join.owner, poolAmountOut);
    }

    function validateJoinAmounts(
        Context  memory ctx,
        PoolJoin memory join
        )
        internal
        view
        returns(
            bool /* valid */,
            uint /*poolAmountOut*/,
            uint96[] memory /* amounts */
        )
    {
        // Check if we can still use this join
        uint96[] memory amounts = new uint96[](ctx.tokens.length);
        if (block.timestamp > join.validUntil) {
            return (false, 0, amounts);
        }

        uint poolTotal = totalSupply();
        if (poolTotal == 0) {
            return(true, INITIAL_SUPPLY, join.maxAmountsIn);
        }

        // Calculate the amount of liquidity tokens that should be minted
        uint poolAmountOut = 0;
        bool initialValueSet = false;
        for (uint i = 0; i < ctx.tokens.length; i++) {
            if (ctx.ammExpectedL2Balances[i] > 0) {
                uint amountOut = uint(join.maxAmountsIn[i]).mul(poolTotal) / uint(ctx.ammExpectedL2Balances[i]);
                if (!initialValueSet || amountOut < poolAmountOut) {
                    poolAmountOut = amountOut;
                    initialValueSet = true;
                }
            }
        }

        if (poolAmountOut == 0) {
            return (false, 0, amounts);
        }

        // Calculate the amounts to deposit
        uint ratio = poolAmountOut.mul(BASE) / poolTotal;

        for (uint i = 0; i < ctx.tokens.length; i++) {
            amounts[i] = (ratio.mul(ctx.ammExpectedL2Balances[i]) / BASE).toUint96();
        }

        bool valid = (poolAmountOut >= join.minPoolAmountOut);
        return (valid, poolAmountOut, amounts);
    }

    function processExit(
        Context  memory ctx,
        PoolExit memory exit,
        bytes    memory signature
        )
        internal
    {
        authenticatePoolTx(
            exit.owner,
            hashPoolExit(ctx.DOMAIN_SEPARATOR, exit),
            signature
        );
        if (signature.length == 0) {
            // This is an onchain exit, we're processing it now so stop tracking it.
            isExiting[msg.sender] = false;
        }

        (bool valid, uint96[] memory amounts) = validateExitAmounts(ctx, exit);

        if (valid) {
            burn(exit.owner, exit.poolAmountIn);

            for (uint i = 0; i < ctx.tokens.length; i++) {
                uint96 amount = amounts[i];
                if (exit.toLayer2) {
                    TransferTransaction.Transfer memory transfer = ctx._block.readTransfer(ctx.txIdx++);
                    require(transfer.fromAccountID == accountID, "INVALID_TX_DATA");
                    require(transfer.from == address(this), "INVALID_TX_DATA");
                    require(transfer.to == exit.owner, "INVALID_TX_DATA");
                    require(transfer.tokenID == ctx.tokens[i].tokenID, "INVALID_TX_DATA");
                    require(isAlmostEqual(transfer.amount, amount), "INVALID_TX_DATA");
                    require(transfer.fee == 0, "INVALID_TX_DATA");

                    if (signature.length != 0) {
                        // Replay protection (only necessary when using a signature)
                        require(transfer.storageID == exit.storageIDs[i], "INVALID_TX_DATA");
                    }

                    // Now approve this transfer
                    transfer.validUntil = 0xffffffff;
                    bytes32 txHash = TransferTransaction.hashTx(ctx.exchangeDomainSeparator, transfer);
                    exchange.approveTransaction(address(this), txHash);
                    ctx.numTransactionsConsumed++;
                    // Update the amount to the actual amount transferred (which can have some some small rounding errors)
                    amount = transfer.amount;
                    // Update the balances in the account
                    ctx.ammActualL2Balances[i] = ctx.ammActualL2Balances[i].sub(amount);
                } else {
                    address token = ctx.tokens[i].addr;
                    // Make the amount available for withdrawing
                    lockedBalance[token][exit.owner] = lockedBalance[token][exit.owner].add(amount);
                }
                ctx.ammExpectedL2Balances[i] = ctx.ammExpectedL2Balances[i].sub(amount);
            }
        }
    }

    function validateExitAmounts(
        Context  memory ctx,
        PoolExit memory exit
        )
        internal
        view
        returns(
            bool /* valid */,
            uint96[] memory /* amounts */
        )
    {
        uint96[] memory amounts = new uint96[](ctx.tokens.length);

        // Check if we can still use this exit
        if (block.timestamp > exit.validUntil) {
            return (false, amounts);
        }

        // Check if the user has enough pool tokens
        if (lockedBalance[address(this)][exit.owner] < exit.poolAmountIn) {
            return (false, amounts);
        }

        // Calculate how much will be withdrawn
        uint poolTotal = totalSupply();
        uint ratio = exit.poolAmountIn.mul(BASE) / poolTotal;
        for (uint i = 0; i < ctx.tokens.length; i++) {
            amounts[i] = (ratio.mul(ctx.ammExpectedL2Balances[i]) / BASE).toUint96();
            if (amounts[i] < exit.minAmountsOut[i]) {
                return (false, amounts);
            }
        }

        return (true, amounts);
    }

    function authenticatePoolTx(
        address owner,
        bytes32 poolTxHash,
        bytes   memory signature
        )
        internal
    {
        if (signature.length == 0) {
            require(approvedTx[poolTxHash] != 0, "NOT_APPROVED");
            delete approvedTx[poolTxHash];
        } else {
            require(poolTxHash.verifySignature(owner, signature), "INVALID_SIGNATURE");
        }
    }

    function processDeposit(
        Context memory ctx,
        Token   memory token,
        uint96  amount
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
            ethValue = amount;
        } else {
            address depositContract = address(exchange.getDepositContract());
            uint allowance = ERC20(token.addr).allowance(address(this), depositContract);
            if (allowance < amount) {
                // Approve the deposit transfer
                ERC20(token.addr).approve(depositContract, ~uint(0));
            }
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
        totalLockedBalance[token.addr] = totalLockedBalance[token.addr].sub(amount);
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
        totalLockedBalance[token.addr] = totalLockedBalance[token.addr].add(amount);
    }

    function withdrawInternal(
        address token,
        uint    amount,
        address to
        )
        internal
    {
        if (token == address(0)) {
            to.sendETHAndVerify(amount, gasleft());
        } else {
            token.safeTransferAndVerify(to, amount);
        }
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
                    join.minPoolAmountOut,
                    keccak256(abi.encodePacked(join.maxAmountsIn)),
                    keccak256(abi.encodePacked(join.storageIDs)),
                    join.validUntil
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
                    keccak256(abi.encodePacked(exit.minAmountsOut)),
                    keccak256(abi.encodePacked(exit.storageIDs)),
                    exit.validUntil
                )
            )
        );
    }

    function isAlmostEqual(
        uint96 amount,
        uint96 targetAmount
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
