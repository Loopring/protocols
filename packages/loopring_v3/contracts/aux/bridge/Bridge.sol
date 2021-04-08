// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/iface/IExchangeV3.sol";
import "../../core/impl/libtransactions/BlockReader.sol";
import "../../core/impl/libtransactions/TransferTransaction.sol";
import "../../core/impl/libtransactions/SignatureVerificationTransaction.sol";
import "../../core/impl/libtransactions/WithdrawTransaction.sol";
import "../../lib/AddressUtil.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/ERC20.sol";
import "../../lib/MathUint.sol";
import "../../lib/MathUint96.sol";
import "../../lib/ReentrancyGuard.sol";
import "../../thirdparty/BytesUtil.sol";
import "../../lib/FloatUtil.sol";

import "./BridgeData.sol";
import "./IBridgeConnector.sol";


/// @title Bridge
contract Bridge is ReentrancyGuard, Claimable
{
    using AddressUtil       for address;
    using AddressUtil       for address payable;
    using BytesUtil         for bytes;
    using BlockReader       for bytes;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using FloatUtil         for uint24;
    using FloatUtil         for uint16;
    using FloatUtil         for uint;

    struct Context
    {
        bytes32 domainSeparator;
        uint32  accountID;
        uint    txsDataPtr;
        uint    txsDataPtrStart;

        address connector;
        uint    totalMinGas;
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
    uint               public constant  MAX_AGE_PENDING_TRANSFERS     = 7 days;
    uint               public constant  MAX_FEE_BIPS                  = 25;     // 0.25%
    uint               public constant  GAS_LIMIT_CHECK_GAS_LIMIT     = 10000;

    IExchangeV3        public immutable exchange;
    uint32             public immutable accountID;
    IDepositContract   public immutable depositContract;
    bytes32            public immutable DOMAIN_SEPARATOR;


    address                                     public exchangeOwner;

    mapping (uint => mapping (bytes32 => uint)) public pendingTransfers;
    mapping (uint    => mapping(uint => bool))  public withdrawn;

    mapping (address => bool)                   public trustedConnectors;

    uint                                        public batchIDGenerator;

    // token -> tokenID
    mapping (address => uint16)                 public cachedTokenIDs;

    // Transfers packed as:
    // - address owner  : 20 bytes
    // - uint96  amount : 12 bytes
    // - uint16  tokenID:  2 bytes
    event Transfers(uint batchID, bytes transfers);

    event BridgeCallSuccess (address connector);
    event BridgeCallFailed  (address connector, string reason);

    event ConnectorTrusted  (address connector, bool trusted);


    event LogCallData(bytes data);

    modifier onlyFromExchangeOwner()
    {
        require(msg.sender == exchangeOwner, "UNAUTHORIZED");
        _;
    }

    constructor(
        IExchangeV3      _exchange,
        uint32           _accountID
        )
    {
        exchange = _exchange;
        accountID = _accountID;

        depositContract = _exchange.getDepositContract();
        exchangeOwner = _exchange.owner();

        DOMAIN_SEPARATOR = EIP712.hash(EIP712.Domain("Bridge", "1.0", address(this)));
    }

    function batchDeposit(
        BridgeTransfer[] memory deposits
        )
        public
        payable
    {
       BridgeTransfer[][] memory _deposits = new BridgeTransfer[][](1);
       _deposits[0] = deposits;
       _batchDeposit(msg.sender,_deposits);
    }

    function _batchDeposit(
        address                   from,
        BridgeTransfer[][] memory deposits
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
        BridgeTransfer memory deposit;
        for (uint n = 0; n < deposits.length; n++) {
            BridgeTransfer[] memory _deposits = deposits[n];
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
        _storeTransfers(transfers);
    }

    function onReceiveTransactions(
        bytes calldata txsData,
        bytes calldata /*callbackData*/
        )
        external
        onlyFromExchangeOwner
    {
        uint txsDataPtr = 23;
        assembly {
            txsDataPtr := sub(add(txsData.offset, txsDataPtr), 32)
        }
        Context memory ctx = Context({
            domainSeparator: DOMAIN_SEPARATOR,
            accountID: accountID,
            txsDataPtr: txsDataPtr,
            txsDataPtrStart: txsDataPtr,
            connector: address(0),
            totalMinGas: 0
        });

        _processTransactions(ctx);

        // Make sure we have consumed exactly the expected number of transactions
        require(txsData.length == ctx.txsDataPtr - ctx.txsDataPtrStart, "INVALID_NUM_TXS");
    }

    // Allows withdrawing from pending transfers that are at least MAX_AGE_PENDING_TRANSFERS old.
    function withdrawFromPendingBatchDeposit(
        uint                            batchID,
        InternalBridgeTransfer[] memory transfers,
        uint[]                   memory indices
        )
        external
        nonReentrant
    {
        bytes memory transfersData = new bytes(transfers.length * 34);
        assembly {
            transfers := add(transfers, 32)
        }

        for (uint i = 0; i < transfers.length; i++) {
            // Pack the transfer data to compare agains batch deposit hash
            address owner = transfers[i].owner;
            uint16 tokenID = transfers[i].tokenID;
            uint96 amount = transfers[i].amount;
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

            _transferOut(
                tokenAddress,
                transfers[idx].amount,
                transfers[idx].owner
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

    function setConnectorTrusted(
        address connector,
        bool    trusted
        )
        external
        onlyOwner
    {
        trustedConnectors[connector] = trusted;
        emit ConnectorTrusted(connector, trusted);
    }

    receive()
        external
        payable
    {}

    // --- Internal functions ---

    function _processTransactions(Context memory ctx)
        internal
    {
        TransferBatch[] calldata transferBatches;
        assembly {
            let offsetToCallbackData := add(4, calldataload(36))

            // transferBatches
            let offset := add(add(offsetToCallbackData, 64), calldataload(add(offsetToCallbackData, 64)))
            transferBatches.length := calldataload(offset)
            transferBatches.offset := add(offset, 32)
        }
        _processTransferBatches(ctx, transferBatches);

        ConnectorCalls[] calldata connectorCalls;
        TokenData[]      calldata tokens;
        assembly {
            let offsetToCallbackData := add(4, calldataload(36))

            // connectorCalls
            let offset := add(add(offsetToCallbackData, 64), calldataload(add(offsetToCallbackData, 96)))
            connectorCalls.length := calldataload(offset)
            connectorCalls.offset := add(offset, 32)

            // tokens
            offset := add(add(offsetToCallbackData, 64), calldataload(add(offsetToCallbackData, 128)))
            tokens.length := calldataload(offset)
            tokens.offset := add(offset, 32)
        }
        _processBridgeCalls(ctx, connectorCalls, tokens);
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
                (uint(ExchangeData.TransactionType.TRANSFER) << 176) | (1 << 168) | (uint(ctx.accountID) << 136) &&
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

    function _processBridgeCalls(
        Context          memory   ctx,
        ConnectorCalls[] calldata connectorCalls,
        TokenData[]      calldata _tokens
        )
        internal
    {
        TokenData[] memory tokens = _tokens;
        uint[] memory totalAmounts = new uint[](tokens.length);

        BridgeTransfer[][] memory deposits = new BridgeTransfer[][](connectorCalls.length);

        // Calls
        for (uint c = 0; c < connectorCalls.length; c++) {
            ConnectorCalls calldata connectorCall = connectorCalls[c];

            // Verify the transactions
            ctx.connector = connectorCall.connector;
            for (uint g = 0; g < connectorCall.groups.length; g++) {
                _processConnectorGroup(
                    ctx,
                    connectorCall.groups[g],
                    tokens,
                    totalAmounts
                );
            }
            // Make sure the gas passed to the connector is at least the sum of all call gas min amounts.
            // So calls basically "buy" a part of the total gas needed to do the batched call,
            // while IBridgeConnector.getMinGasLimit() makes sure the total gas limit makes sense for the
            // amount of work submitted.
            require(connectorCall.gasLimit >= ctx.totalMinGas, "INVALID_TOTAL_MIN_GAS");

            // Call the connector
            deposits[c] = _connectorCall(connectorCall, c);
        }

        // Verify the withdrawals
        for (uint i = 0; i < tokens.length; i++) {
            TokenData memory token = tokens[i];
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
            uint txsDataPtr = ctx.txsDataPtr - 21;
            uint header;
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

        // Do all resulting transfers back from the bridge to the users
        _batchDeposit(address(this), deposits);
    }

    function _processConnectorGroup(
        Context          memory   ctx,
        ConnectorGroup   calldata group,
        TokenData[]      memory   tokens,
        uint[]           memory   totalAmounts
        )
        internal
        view
    {
        CallTransfer memory transfer;
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
                ctx.domainSeparator,
                transfer,
                bridgeCall.maxFee,
                bridgeCall.validUntil,
                bridgeCall.minGas,
                ctx.connector,
                group.groupData,
                bridgeCall.userData
            );
            verifySignatureL2(ctx, bridgeCall.owner, transfer.fromAccountID, txHash);

            uint t = 0;
            while (t < tokens.length && transfer.tokenID != tokens[t].tokenID) {
                t++;
            }
            require(t < tokens.length, "INVALID_INPUT_TOKENS");
            totalAmounts[t] += transfer.amount;

            // Verify the transaction data
            require(
                // txType == ExchangeData.TransactionType.TRANSFER &&
                // transfer.type == 1 &&
                // transfer.fromAccountID == UNKNOWN &&
                // transfer.toAccountID == ctx.accountID &&
                packedData & 0xffff00000000ffffffff00000000000000000000000000 ==
                (uint(ExchangeData.TransactionType.TRANSFER) << 176) | (1 << 168) | (uint(ctx.accountID) << 104) &&
                transfer.fee <= bridgeCall.maxFee &&
                bridgeCall.validUntil == 0 || block.timestamp < bridgeCall.validUntil &&
                bridgeCall.token == tokens[t].token &&
                bridgeCall.amount == transfer.amount,
                "INVALID_BRIDGE_CALL_TRANSFER"
            );

            ctx.totalMinGas += bridgeCall.minGas;
        }
    }

    function _storeTransfers(bytes memory transfers)
        internal
    {
        uint batchID = batchIDGenerator++;

        // Store transfers to distribute at a later time
        bytes32 hash = _hashTransferBatch(transfers);
        require(pendingTransfers[batchID][hash] == 0, "DUPLICATE_BATCH");
        pendingTransfers[batchID][hash] = block.timestamp;

        // Log transfers to do
        emit Transfers(batchID, transfers);
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
        ConnectorCalls calldata connectorCalls,
        uint n
        )
        internal
        returns (BridgeTransfer[] memory transfers)
    {
        require(connectorCalls.connector != address(this), "INVALID_CONNECTOR");

        {
        // Check if the minimum amount of gas required is achieved
        bytes memory txData = _getConnectorGroupsCallData(IBridgeConnector.getMinGasLimit.selector, connectorCalls.groups, n);
        (bool success, bytes memory returnData) = connectorCalls.connector.fastCall(GAS_LIMIT_CHECK_GAS_LIMIT, 0, txData);
        if (success) {
            require(connectorCalls.gasLimit >= abi.decode(returnData, (uint)), "GAS_LIMIT_TOO_LOW");
        } else {
            // If the call failed for some reason just continue.
        }
        }

        require(trustedConnectors[connectorCalls.connector], "ONLY_TRUSTED_CONNECTORS_SUPPORTED");

        {
        bool success = false;
        bytes memory returnData;

        // Execute the logic using a delegate so no extra transfers are needed
        bytes memory txData = _getConnectorGroupsCallData(IBridgeConnector.processCalls.selector, connectorCalls.groups, n);
        (success, returnData) = connectorCalls.connector.fastDelegatecall(connectorCalls.gasLimit, txData);

        if (success) {
            emit BridgeCallSuccess(connectorCalls.connector);
            transfers = abi.decode(returnData, (BridgeTransfer[]));
        } else {
            // If the call failed return funds to all users
            for (uint g = 0; g < connectorCalls.groups.length; g++) {
                ConnectorGroup memory group = connectorCalls.groups[g];
                transfers = new BridgeTransfer[](group.calls.length);
                for (uint i = 0; i < group.calls.length; i++) {
                    transfers[i] = BridgeTransfer({
                        owner: group.calls[i].owner,
                        token:  group.calls[i].token,
                        amount: group.calls[i].amount
                    });
                }
            }

            emit BridgeCallFailed(connectorCalls.connector, string(returnData));
        }
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

    function _transferOut(
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
        return block.timestamp > timestamp + MAX_AGE_PENDING_TRANSFERS;
    }

    function _hashTx(
        bytes32             _DOMAIN_SEPARATOR,
        CallTransfer memory transfer,
        uint                maxFee,
        uint                validUntil,
        uint                minGas,
        address             connector,
        bytes        memory groupData,
        bytes        memory userData
        )
        internal
        pure
        returns (bytes32 h)
    {
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

    function _getConnectorGroupsCallData(
        bytes4 selector,
        ConnectorGroup[] calldata groups,
        uint   n
        )
        internal
        pure
        returns (bytes memory)
    {
        uint offsetToConnectorGroups;
        uint txDataSize = 0;
        assembly {
            // 4 + 32
            let offsetToAuxData := add(4, calldataload(36))
            // jump over length and single parameter offset
            let offsetToConnectorCalls := add(add(offsetToAuxData, 64), calldataload(add(offsetToAuxData, 96)))
            let offsetToEndOfConnectorCalls := add(add(offsetToAuxData, 64), calldataload(add(offsetToAuxData, 128)))
            let offsetToConnectorCall := add(add(offsetToConnectorCalls, 32), calldataload(add(add(offsetToConnectorCalls, 32), mul(n, 32))))
            let offsetToNextConnectorCall := add(add(offsetToConnectorCalls, 32), calldataload(add(add(offsetToConnectorCalls, 32), mul(add(n, 1), 32))))

            offsetToConnectorGroups := sub(groups.offset, 32)

            let numConnectorCalls := calldataload(offsetToConnectorCalls)
            txDataSize := sub(offsetToNextConnectorCall, offsetToConnectorCall)
            if eq(add(n, 1), numConnectorCalls) {
                txDataSize := sub(offsetToEndOfConnectorCalls, offsetToConnectorCall)
            }
        }

        bytes memory txData = new bytes(4 + 32 + txDataSize);
        assembly {
            mstore(add(txData, 32), selector)
            mstore(add(txData, 36), 0x20)
            calldatacopy(add(txData, 68), offsetToConnectorGroups, txDataSize)
        }

        return txData;
    }

    function readTransfer(Context memory ctx)
        internal
        pure
        returns (uint packedData, address to, address from)
    {
        uint txsDataPtr = ctx.txsDataPtr;
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
        // Read the signature verification transaction
        uint txsDataPtr = ctx.txsDataPtr + 2;
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

    function encode(BridgeOperations calldata operations)
        external
        pure
    {}
}
