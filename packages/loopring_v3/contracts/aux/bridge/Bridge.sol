// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/iface/IExchangeV3.sol";
import "../../core/impl/libtransactions/TransferTransaction.sol";
import "../../core/impl/libtransactions/WithdrawTransaction.sol";
import "../../lib/AddressUtil.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/ERC20.sol";
import "../../lib/MathUint.sol";
import "../../lib/MathUint96.sol";
import "../../lib/ReentrancyGuard.sol";
import "../../lib/TransferUtil.sol";

import "./IBridge.sol";


/// @title  Bridge implementation
/// @author Brecht Devos - <brecht@loopring.org>
contract Bridge is IBridge, ReentrancyGuard
{
    using AddressUtil       for address;
    using AddressUtil       for address payable;
    using BytesUtil         for bytes;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using TransferUtil      for address;

    // Transfers packed as:
    // - address owner  : 20 bytes
    // - uint96  amount : 12 bytes
    // - uint16  tokenID:  2 bytes
    event Transfers           (uint batchID, bytes transfers, address from);

    event ConnectorCallResult (address connector, bool success, bytes reason);

    event ConnectorTrusted    (address connector, bool trusted);

    struct InternalBridgeDeposit
    {
        address owner;
        uint16  tokenID;
        uint96  amount;
    }

    struct TokenData
    {
        address token;
        uint16  tokenID;
        uint    amount;
    }

    struct ConnectorCall
    {
        address           connector;
        uint              gasLimit;
        BridgeCallGroup[] groups;
    }

    struct TransferBatch
    {
        uint     batchID;
        uint96[] amounts;
    }

    /*
    struct BridgeOperation
    {
        TransferBatch[]  transferBatches;
        ConnectorCall[]  connectorCalls;
        TokenData[]      tokens;
    }
    */

    struct Context
    {
        TokenData[] tokens;
        uint        tokensOffset;
        uint        txsDataPtr;
        uint        txsDataPtrStart;
    }

    struct CallTransfer
    {
        uint fromAccountID;
        uint tokenID;
        uint amount;
        uint feeTokenID;
        uint fee;
        uint storageID;
        uint packedData;
    }

    bytes32 constant public BRIDGE_CALL_TYPEHASH = keccak256(
        "BridgeCall(uint16 tokenID,uint96 amount,uint16 feeTokenID,uint96 maxFee,uint32 validUntil,uint32 storageID,uint32 minGas,address connector,bytes groupData,bytes userData)"
    );

    uint               public constant  MAX_NUM_TRANSACTIONS_IN_BLOCK = 386;
    uint               public constant  MAX_AGE_PENDING_TRANSFER      = 7 days;
    uint               public constant  MAX_FEE_BIPS                  = 25;     // 0.25%
    uint               public constant  GAS_LIMIT_CHECK_GAS_LIMIT     = 10000;

    IExchangeV3        public immutable exchange;
    uint32             public immutable accountID;
    IDepositContract   public immutable depositContract;
    bytes32            public immutable DOMAIN_SEPARATOR;

    mapping (uint => mapping (bytes32 => uint)) public pendingTransfers;
    mapping (uint => mapping(uint => bool))     public withdrawn;

    mapping (address => bool)                   public trustedConnectors;

    uint                                        public batchIDGenerator;

    // token -> tokenID
    mapping (address => uint16)                 public cachedTokenIDs;

    modifier onlyFromExchangeOwner()
    {
        require(msg.sender == exchange.owner(), "UNAUTHORIZED");
        _;
    }

    constructor(
        IExchangeV3 _exchange,
        uint32      _accountID
        )
    {
        exchange = _exchange;
        accountID = _accountID;

        depositContract = _exchange.getDepositContract();

        DOMAIN_SEPARATOR = EIP712.hash(EIP712.Domain("Bridge", "1.0", address(this)));
    }

    function batchDeposit(
        BridgeDeposit[] memory transfers
        )
        external
        payable
        override
        nonReentrant
    {
        BridgeDeposit[][] memory listOfTransfers = new BridgeDeposit[][](1);
        listOfTransfers[0] = transfers;
        _batchDeposit(msg.sender, listOfTransfers);
    }

    function onReceiveTransactions(
        bytes calldata txsData,
        bytes calldata /*callbackData*/
        )
        external
        override
        onlyFromExchangeOwner
    {
        // Get the offset to txsData in the calldata
        uint txsDataPtr = 0;
        assembly {
            txsDataPtr := sub(add(txsData.offset, txsDataPtr), 32)
        }
        Context memory ctx = Context({
            tokens: new TokenData[](0),
            tokensOffset: 0,
            txsDataPtr: txsDataPtr,
            txsDataPtrStart: txsDataPtr
        });

        _processTransactions(ctx);

        // Make sure we have consumed exactly the expected number of transactions
        require(txsData.length == ctx.txsDataPtr - ctx.txsDataPtrStart, "INVALID_NUM_TXS");
    }

    // Allows withdrawing from pending transfers that are at least MAX_AGE_PENDING_TRANSFER old.
    function withdrawFromPendingBatchDeposit(
        uint                            batchID,
        InternalBridgeDeposit[] memory transfers,
        uint[]                   memory indices
        )
        external
        nonReentrant
    {
        bytes memory transfersData = new bytes(transfers.length * 34);
        assembly {
            transfersData := add(transfersData, 32)
        }

        for (uint i = 0; i < transfers.length; i++) {
            InternalBridgeDeposit memory transfer = transfers[i];
            // Pack the transfer data to compare against batch deposit hash
            address  owner = transfer.owner;
            uint16 tokenID = transfer.tokenID;
            uint    amount = transfer.amount;
            assembly {
                mstore(add(transfersData, 2), tokenID)
                mstore(    transfersData    , or(shl(96, owner), amount))
                transfersData := add(transfersData, 34)
            }
        }

        // Get the original transfers ptr back
        uint numTransfers = transfers.length;
        assembly {
            transfersData := sub(transfersData, add(32, mul(34, numTransfers)))
        }

        // Check if withdrawing from these transfers is possible
        bytes32 hash = _hashTransferBatch(transfersData);
        require(_arePendingTransfersTooOld(batchID, hash), "TRANSFERS_NOT_TOO_OLD");

        for (uint i = 0; i < indices.length; i++) {
            uint idx = indices[i];

            require(!withdrawn[batchID][idx], "ALREADY_WITHDRAWN");
            withdrawn[batchID][idx] = true;

            address tokenAddress = exchange.getTokenAddress(transfers[idx].tokenID);

            tokenAddress.transferOut(
                transfers[idx].owner,
                transfers[idx].amount
            );
        }
    }

    // Can be used to withdraw funds that were already deposited to the bridge,
    // but need to be returned to be able to withdraw from old pending transfers.
    function forceWithdraw(address[] calldata tokens)
        external
        payable
        nonReentrant
    {
        for (uint i = 0; i < tokens.length; i++) {
            exchange.forceWithdraw{value: msg.value / tokens.length}(
                address(this),
                tokens[i],
                accountID
            );
        }
    }

    function trustConnector(
        address connector,
        bool    trusted
        )
        external
        onlyFromExchangeOwner
    {
        trustedConnectors[connector] = trusted;
        emit ConnectorTrusted(connector, trusted);
    }

    receive() external payable {}

    // --- Internal functions ---

    function _batchDeposit(
        address                   from,
        BridgeDeposit[][] memory deposits
        )
        internal
    {
        uint totalNumDeposits = 0;
        for (uint i = 0; i < deposits.length; i++) {
            totalNumDeposits += deposits[i].length;
        }
        if (totalNumDeposits == 0) {
            return;
        }

        // Needs to be possible to do all transfers in a single block
        require(totalNumDeposits <= MAX_NUM_TRANSACTIONS_IN_BLOCK, "MAX_DEPOSITS_EXCEEDED");

        // Transfers to be done
        bytes memory transfers = new bytes(totalNumDeposits * 34);
        assembly {
            transfers := add(transfers, 32)
        }

        // Worst case scenario all tokens are different
        TokenData[] memory tokens = new TokenData[](totalNumDeposits);
        uint numDistinctTokens = 0;

        // Run over all deposits summing up total amounts per token
        address token = address(-1);
        uint tokenIdx = 0;
        uint16 tokenID;
        BridgeDeposit memory deposit;
        for (uint n = 0; n < deposits.length; n++) {
            BridgeDeposit[] memory _deposits = deposits[n];
            for (uint i = 0; i < _deposits.length; i++) {
                deposit = _deposits[i];
                if(token != deposit.token) {
                    token = deposit.token;
                    tokenIdx = 0;
                    while(tokenIdx < numDistinctTokens && tokens[tokenIdx].token != token) {
                        tokenIdx++;
                    }
                    if (tokenIdx == numDistinctTokens) {
                        tokens[tokenIdx].token = token;
                        tokens[tokenIdx].tokenID = _getTokenID(token);
                        numDistinctTokens++;
                    }
                    tokenID = tokens[tokenIdx].tokenID;
                }
                tokens[tokenIdx].amount = tokens[tokenIdx].amount.add(deposit.amount);

                // Pack the transfer data together
                assembly {
                    mstore(add(transfers, 2), tokenID)
                    mstore(    transfers    , or(shl(96, mload(deposit)), mload(add(deposit, 64))))
                    transfers := add(transfers, 34)
                }
            }
        }

        // Get the original transfers ptr back
        assembly {
            transfers := sub(transfers, add(32, mul(34, totalNumDeposits)))
        }

        // Do a normal deposit per token
        for(uint i = 0; i < numDistinctTokens; i++) {
            if (tokens[i].token == address(0)) {
                require(tokens[i].amount == msg.value || from == address(this), "INVALID_ETH_DEPOSIT");
            }
            _deposit(from, tokens[i].token, uint96(tokens[i].amount));
        }

        // Store the transfers so they can be processed later
        _storeTransfers(transfers, from);
    }

    function _processTransactions(Context memory ctx)
        internal
    {
        // abi.decode(callbackData, (BridgeOperation))
        // Get the calldata structs directly from the encoded calldata bytes data
        TransferBatch[] calldata transferBatches;
        ConnectorCall[] calldata connectorCalls;
        TokenData[] calldata tokens;
        uint tokensOffset;
        assembly {
            let offsetToCallbackData := add(68, calldataload(36))
            // transferBatches
            transferBatches.offset := add(add(offsetToCallbackData, 32), calldataload(offsetToCallbackData))
            transferBatches.length := calldataload(sub(transferBatches.offset, 32))

            // connectorCalls
            connectorCalls.offset := add(add(offsetToCallbackData, 32), calldataload(add(offsetToCallbackData, 32)))
            connectorCalls.length := calldataload(sub(connectorCalls.offset, 32))

            // tokens
            tokens.offset := add(add(offsetToCallbackData, 32), calldataload(add(offsetToCallbackData, 64)))
            tokens.length := calldataload(sub(tokens.offset, 32))
            tokensOffset := sub(tokens.offset, 32)
        }
        ctx.tokensOffset = tokensOffset;
        ctx.tokens = tokens;

        _processTransferBatches(ctx, transferBatches);
        _processConnectorCalls(ctx, connectorCalls);
    }

    function _processTransferBatches(
        Context         memory   ctx,
        TransferBatch[] calldata batches
        )
        internal
    {
        for (uint o = 0; o < batches.length; o++) {
            _processTransferBatch(
                ctx,
                batches[o]
            );
        }
    }

    function _processTransferBatch(
        Context       memory   ctx,
        TransferBatch calldata batch
        )
        internal
    {
        uint96[] memory amounts = batch.amounts;

        // Verify transfers
        bytes memory transfers = new bytes(amounts.length * 34);
        assembly {
            transfers := add(transfers, 32)
        }

        for (uint i = 0; i < amounts.length; i++) {
            uint targetAmount = amounts[i];

            (uint packedData, address to, ) = readTransfer(ctx);
            uint tokenID      = (packedData >> 88) & 0xffff;
            uint amount       = (packedData >> 64) & 0xffffff;
            uint fee          = (packedData >> 32) & 0xffff;
            // Decode floats
            amount = (amount & 524287) * (10 ** (amount >> 19));
            fee = (fee & 2047) * (10 ** (fee >> 11));

            // Verify the transaction data
            require(
                // txType == ExchangeData.TransactionType.TRANSFER &&
                // transfer.type == 1 &&
                // transfer.fromAccountID == ctx.accountID &&
                // transfer.toAccountID == UNKNOWN  &&
                packedData & 0xffffffffffff0000000000000000000000000000000000 ==
                (uint(ExchangeData.TransactionType.TRANSFER) << 176) | (1 << 168) | (uint(accountID) << 136) &&
                /*feeTokenID*/(packedData >> 48) & 0xffff == tokenID &&
                fee <= (amount * MAX_FEE_BIPS / 10000) &&
                (100000 - 8) * targetAmount <= 100000 * amount && amount <= targetAmount,
                "INVALID_BRIDGE_TRANSFER_TX_DATA"
            );

            // Pack the transfer data to compare against batch deposit hash
            assembly {
                mstore(add(transfers, 2), tokenID)
                mstore(    transfers    , or(shl(96, to), targetAmount))
                transfers := add(transfers, 34)
            }
        }

        // Get the original transfers ptr back
        assembly {
            transfers := sub(transfers, add(32, mul(34, mload(amounts))))
        }
        // Check if these transfers can be processed
        bytes32 hash = _hashTransferBatch(transfers);
        require(!_arePendingTransfersTooOld(batch.batchID, hash), "TRANSFERS_TOO_OLD");

        // Mark transfers as completed
        delete pendingTransfers[batch.batchID][hash];
    }

    function _processConnectorCalls(
        Context          memory   ctx,
        ConnectorCall[]  calldata connectorCalls
        )
        internal
    {
        // Total amounts transferred to the bridge
        uint[] memory totalAmounts = new uint[](ctx.tokens.length);

        // All resulting deposits from all connector calls
        BridgeDeposit[][] memory transfers = new BridgeDeposit[][](connectorCalls.length);

        // Verify and execute bridge calls
        for (uint c = 0; c < connectorCalls.length; c++) {
            ConnectorCall calldata connectorCall = connectorCalls[c];

            // Verify the transactions
            _processConnectorCall(ctx, connectorCall, totalAmounts);

            // Call the connector
            transfers[c] = _connectorCall(ctx, connectorCall, c, connectorCalls);
        }

        // Verify withdrawals
        _processWithdrawals(ctx, totalAmounts);

        // Do all resulting transfers back from the bridge to the users
        _batchDeposit(address(this), transfers);
    }

    function _processConnectorCall(
        Context          memory   ctx,
        ConnectorCall    calldata connectorCall,
        uint[]           memory   totalAmounts
        )
        internal
        view
    {
        CallTransfer memory transfer;
        uint totalMinGas = 0;
        for (uint g = 0; g < connectorCall.groups.length; g++) {
            BridgeCallGroup calldata group = connectorCall.groups[g];
            for (uint i = 0; i < group.calls.length; i++) {
                BridgeCall calldata bridgeCall = group.calls[i];

                // packedData: txType (1) | type (1) | fromAccountID (4) | toAccountID (4) | tokenID (2) | amount (3) | feeTokenID (2) | fee (2) | storageID (4)
                (uint packedData, , ) = readTransfer(ctx);
                transfer.fromAccountID = (packedData >> 136) & 0xffffffff;
                transfer.tokenID       = (packedData >>  88) & 0xffff;
                transfer.amount        = (packedData >>  64) & 0xffffff;
                transfer.feeTokenID    = (packedData >>  48) & 0xffff;
                transfer.fee           = (packedData >>  32) & 0xffff;
                transfer.storageID     = (packedData       ) & 0xffffffff;

                transfer.amount = (transfer.amount & 524287) * (10 ** (transfer.amount >> 19));
                transfer.fee = (transfer.fee & 2047) * (10 ** (transfer.fee >> 11));

                // Verify that the transaction was approved with an L2 signature
                bytes32 txHash = _hashTx(
                    transfer,
                    bridgeCall.maxFee,
                    bridgeCall.validUntil,
                    bridgeCall.minGas,
                    connectorCall.connector,
                    group.groupData,
                    bridgeCall.userData
                );
                verifySignatureL2(ctx, bridgeCall.owner, transfer.fromAccountID, txHash);

                // Find the token in the tokens list
                uint t = 0;
                while (t < ctx.tokens.length && transfer.tokenID != ctx.tokens[t].tokenID) {
                    t++;
                }
                require(t < ctx.tokens.length, "INVALID_INPUT_TOKENS");
                totalAmounts[t] += transfer.amount;

                // Verify the transaction data
                require(
                    // txType == ExchangeData.TransactionType.TRANSFER &&
                    // transfer.type == 1 &&
                    // transfer.fromAccountID == UNKNOWN &&
                    // transfer.toAccountID == ctx.accountID &&
                    packedData & 0xffff00000000ffffffff00000000000000000000000000 ==
                    (uint(ExchangeData.TransactionType.TRANSFER) << 176) | (1 << 168) | (uint(accountID) << 104) &&
                    transfer.fee <= bridgeCall.maxFee &&
                    bridgeCall.validUntil == 0 || block.timestamp < bridgeCall.validUntil &&
                    bridgeCall.token == ctx.tokens[t].token &&
                    bridgeCall.amount == transfer.amount,
                    "INVALID_BRIDGE_CALL_TRANSFER"
                );

                totalMinGas = totalMinGas.add(bridgeCall.minGas);
            }
        }

        // Make sure the gas passed to the connector is at least the sum of all call gas min amounts.
        // So calls basically "buy" a part of the total gas needed to do the batched call,
        // while IBridgeConnector.getMinGasLimit() makes sure the total gas limit makes sense for the
        // amount of work submitted.
        require(connectorCall.gasLimit >= totalMinGas, "INVALID_TOTAL_MIN_GAS");
    }

    function _processWithdrawals(
        Context memory ctx,
        uint[]  memory totalAmounts
        )
        internal
    {
        // Verify the withdrawals
        for (uint i = 0; i < ctx.tokens.length; i++) {
            TokenData memory token = ctx.tokens[i];
            // Verify token data
            require(
                _getTokenID(token.token) == token.tokenID &&
                token.amount == totalAmounts[i],
                "INVALID_TOKEN_DATA"
            );

            bytes20 onchainDataHash = WithdrawTransaction.hashOnchainData(
                0,                  // Withdrawal needs to succeed no matter the gas coast
                address(this),      // Withdraw to this contract first
                new bytes(0)
            );

            // Verify withdrawal data
            // Start by reading the first 2 bytes into header
            uint txsDataPtr = ctx.txsDataPtr + 2;
            // header: txType (1) | type (1)
            uint header;
            // packedData: tokenID (2) | amount (12) | feeTokenID (2) | fee (2)
            uint packedData;
            bytes20 dataHash;
            assembly {
                header     := calldataload(    txsDataPtr     )
                packedData := calldataload(add(txsDataPtr, 42))
                dataHash   := and(calldataload(add(txsDataPtr, 78)), 0xffffffffffffffffffffffffffffffffffffffff000000000000000000000000)
            }
            require(
                // txType == ExchangeData.TransactionType.WITHDRAWAL &&
                // withdrawal.type == 1 &&
                header & 0xffff == (uint(ExchangeData.TransactionType.WITHDRAWAL) << 8) | 1 &&
                // withdrawal.tokenID == token.tokenID &&
                // withdrawal.amount == token.amount &&
                // withdrawal.fee == 0,
                packedData & 0xffffffffffffffffffffffffffff0000ffff == (uint(token.tokenID) << 128) | (token.amount << 32) &&
                onchainDataHash == dataHash,
                "INVALID_BRIDGE_WITHDRAWAL_TX_DATA"
            );

            ctx.txsDataPtr += ExchangeData.TX_DATA_AVAILABILITY_SIZE;
        }
    }

    function _storeTransfers(
        bytes memory transfers,
        address from
        )
        internal
    {
        uint batchID = batchIDGenerator++;

        // Store transfers to distribute at a later time
        bytes32 hash = _hashTransferBatch(transfers);
        require(pendingTransfers[batchID][hash] == 0, "DUPLICATE_BATCH");
        pendingTransfers[batchID][hash] = block.timestamp;

        // Log transfers to do
        emit Transfers(batchID, transfers, from);
    }

    function _deposit(
        address from,
        address token,
        uint96  amount
        )
        internal
    {
        if (amount == 0) {
            return;
        }

        if (from == address(this) && token != address(0)) {
            ERC20(token).approve(address(depositContract), amount);
        }
        // Do the token transfer directly to the exchange
        uint ethValue = (token == address(0)) ? amount : 0;
        exchange.deposit{value: ethValue}(from, address(this), token, amount, new bytes(0));
    }

    function _connectorCall(
        Context          memory   ctx,
        ConnectorCall    calldata call,
        uint                      n,
        ConnectorCall[]  calldata allCalls
        )
        internal
        returns (BridgeDeposit[] memory transfers)
    {
        require(call.connector != address(this), "INVALID_CONNECTOR");
        require(trustedConnectors[call.connector], "ONLY_TRUSTED_CONNECTORS_SUPPORTED");

        // Check if the minimum amount of gas required is achieved
        bytes memory txData = _getConnectorCallData(ctx, IBridgeConnector.getMinGasLimit.selector, allCalls, n);
        (bool success, bytes memory returnData) = call.connector.fastCall(GAS_LIMIT_CHECK_GAS_LIMIT, 0, txData);
        if (success) {
            require(call.gasLimit >= abi.decode(returnData, (uint)), "GAS_LIMIT_TOO_LOW");
        } else {
            // If the call failed for some reason just continue.
        }

        // Execute the logic using a delegate so no extra transfers are needed
        txData = _getConnectorCallData(ctx,IBridgeConnector.processCalls.selector, allCalls, n);
        (success, returnData) = call.connector.fastDelegatecall(call.gasLimit, txData);

        if (success) {
            emit ConnectorCallResult(call.connector, true, "");
            transfers = abi.decode(returnData, (BridgeDeposit[]));
        } else {
            // If the call failed return funds to all users
            uint totalNumCalls = 0;
            for (uint g = 0; g < call.groups.length; g++) {
                totalNumCalls += call.groups[g].calls.length;
            }
            transfers = new BridgeDeposit[](totalNumCalls);
            uint txIdx = 0;
            for (uint g = 0; g < call.groups.length; g++) {
                BridgeCallGroup memory group = call.groups[g];
                for (uint i = 0; i < group.calls.length; i++) {
                    BridgeCall memory bridgeCall = group.calls[i];
                    transfers[txIdx++] = BridgeDeposit({
                        owner: bridgeCall.owner,
                        token:  bridgeCall.token,
                        amount: bridgeCall.amount
                    });
                }
            }
            assert(txIdx == totalNumCalls);
            emit ConnectorCallResult(call.connector, false, returnData);
        }
    }

    // Returns the tokenID for the given token address.
    // Instead of querying the exchange each time, the tokenID
    // is automatically cached inside this contract to save gas.
    function _getTokenID(address tokenAddress)
        internal
        returns (uint16 cachedTokenID)
    {
        if (tokenAddress == address(0)) {
            cachedTokenID = 0;
        } else {
            cachedTokenID = cachedTokenIDs[tokenAddress];
            if (cachedTokenID == 0) {
                cachedTokenID = exchange.getTokenID(tokenAddress);
                cachedTokenIDs[tokenAddress] = cachedTokenID;
            }
        }
    }

    function _hashTransferBatch(
        bytes memory transfers
        )
        internal
        pure
        returns (bytes32)
    {
        return keccak256(transfers);
    }

    function _arePendingTransfersTooOld(uint batchID, bytes32 hash)
        internal
        view
        returns (bool)
    {
        uint timestamp = pendingTransfers[batchID][hash];
        require(timestamp != 0, "UNKNOWN_TRANSFERS");
        return block.timestamp > timestamp + MAX_AGE_PENDING_TRANSFER;
    }

    function _hashTx(
        CallTransfer memory transfer,
        uint                maxFee,
        uint                validUntil,
        uint                minGas,
        address             connector,
        bytes        memory groupData,
        bytes        memory userData
        )
        internal
        view
        returns (bytes32 h)
    {
        bytes32 _DOMAIN_SEPARATOR = DOMAIN_SEPARATOR;
        uint tokenID = transfer.tokenID;
        uint amount = transfer.amount;
        uint feeTokenID = transfer.feeTokenID;
        uint storageID = transfer.storageID;

        /*return EIP712.hashPacked(
            _DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    BRIDGE_CALL_TYPEHASH,
                    tokenID,
                    amount,
                    feeTokenID,
                    storageID,
                    minGas,
                    connector,
                    keccak256(groupData),
                    keccak256(userData)
                )
            )
        );*/
        bytes32 typeHash = BRIDGE_CALL_TYPEHASH;
        assembly {
            let data := mload(0x40)
            mstore(    data      , typeHash)
            mstore(add(data,  32), tokenID)
            mstore(add(data,  64), amount)
            mstore(add(data,  96), feeTokenID)
            mstore(add(data, 128), maxFee)
            mstore(add(data, 160), validUntil)
            mstore(add(data, 192), storageID)
            mstore(add(data, 224), minGas)
            mstore(add(data, 256), connector)
            mstore(add(data, 288), keccak256(add(groupData, 32), mload(groupData)))
            mstore(add(data, 320), keccak256(add(userData , 32), mload(userData)))
            let p := keccak256(data, 352)
            mstore(data, "\x19\x01")
            mstore(add(data,  2), _DOMAIN_SEPARATOR)
            mstore(add(data, 34), p)
            h := keccak256(data, 66)
        }
    }

    function _getConnectorCallData(
        Context memory            ctx,
        bytes4                    selector,
        ConnectorCall[]  calldata calls,
        uint                      n
        )
        internal
        pure
        returns (bytes memory)
    {
        // Position in the calldata to start copying
        uint offsetToGroups;
        BridgeCallGroup[] calldata groups = calls[n].groups;
        assembly {
            offsetToGroups := sub(groups.offset, 32)
        }

        // Amount of bytes that need to be copied.
        // Found by either using the offset to the next connector call or (for the last call)
        // using the offset of the data after all calls (which is the tokens array).
        uint txDataSize = 0;
        if (n + 1 < calls.length) {
            uint offsetToCall;
            uint offsetToNextCall;
            assembly {
                offsetToCall := calldataload(add(calls.offset, mul(add(n, 0), 32)))
                offsetToNextCall := calldataload(add(calls.offset, mul(add(n, 1), 32)))
            }
            txDataSize = offsetToNextCall.sub(offsetToCall);
        } else {
            txDataSize = ctx.tokensOffset.sub(offsetToGroups);
        }

        // Create the calldata for the call
        bytes memory txData = new bytes(4 + 32 + txDataSize);
        assembly {
            mstore(add(txData, 32), selector)
            mstore(add(txData, 36), 0x20)
            calldatacopy(add(txData, 68), offsetToGroups, txDataSize)
        }

        return txData;
    }

    function readTransfer(Context memory ctx)
        internal
        pure
        returns (uint packedData, address to, address from)
    {
        // TransferTransaction.readTx(txsData, ctx.txIdx++ * ExchangeData.TX_DATA_AVAILABILITY_SIZE, transfer);

        // Start by reading the first 23 bytes into packedData
        uint txsDataPtr = ctx.txsDataPtr + 23;
        // packedData: txType (1) | type (1) | fromAccountID (4) | toAccountID (4) | tokenID (2) | amount (3) | feeTokenID (2) | fee (2) | storageID (4)
        assembly {
            packedData := calldataload(txsDataPtr)
            to := and(calldataload(add(txsDataPtr, 20)), 0xffffffffffffffffffffffffffffffffffffffff)
            from := and(calldataload(add(txsDataPtr, 40)), 0xffffffffffffffffffffffffffffffffffffffff)
        }
        ctx.txsDataPtr += ExchangeData.TX_DATA_AVAILABILITY_SIZE;
    }

    function verifySignatureL2(
        Context memory ctx,
        address        owner,
        uint           _accountID,
        bytes32        txHash
        )
        internal
        pure
    {
        /*
        // Read the signature verification transaction
        SignatureVerificationTransaction.SignatureVerification memory verification;
        SignatureVerificationTransaction.readTx(txsData, ctx.txIdx++ * ExchangeData.TX_DATA_AVAILABILITY_SIZE, verification);

        // Verify that the hash was signed on L2
        require(
            verification.owner == owner &&
            verification.accountID == ctx.accountID &&
            verification.data == uint(txHash) >> 3,
            "INVALID_OFFCHAIN_L2_APPROVAL"
        );
        */

        // Read the signature verification transaction
        // Start by reading the first 25 bytes into packedDate
        uint txsDataPtr = ctx.txsDataPtr + 25;
        // packedData: txType (1) | owner (20) | accountID (4)
        uint packedData;
        uint data;
        assembly {
            packedData := calldataload(txsDataPtr)
            data := calldataload(add(txsDataPtr, 32))
        }

        // Verify that the hash was signed on L2
        require(
            packedData & 0xffffffffffffffffffffffffffffffffffffffffffffffffff ==
            (uint(ExchangeData.TransactionType.SIGNATURE_VERIFICATION) << 192) | ((uint(owner) & 0x00ffffffffffffffffffffffffffffffffffffffff) << 32) | _accountID &&
            data == uint(txHash) >> 3,
            "INVALID_OFFCHAIN_L2_APPROVAL"
        );

        ctx.txsDataPtr += ExchangeData.TX_DATA_AVAILABILITY_SIZE;
    }

    /*
    function encode(BridgeOperation calldata operation)
        external
        pure
    {}
    */
}
