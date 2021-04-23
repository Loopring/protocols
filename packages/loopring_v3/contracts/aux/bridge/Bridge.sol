// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/iface/IExchangeV3.sol";
import "../../core/impl/libtransactions/TransferTransaction.sol";
import "../../core/impl/libtransactions/WithdrawTransaction.sol";
import "../../lib/AddressUtil.sol";
import "../../lib/Claimable.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/ERC20.sol";
import "../../lib/MathUint.sol";
import "../../lib/MathUint96.sol";
import "../../lib/TransferUtil.sol";
import "./BatchDepositor.sol";
import "./IBridge.sol";

/// @title  Bridge implementation
/// @author Brecht Devos - <brecht@loopring.org>
contract Bridge is IBridge, BatchDepositor, Claimable
{
    using AddressUtil       for address;
    using AddressUtil       for address payable;
    using BytesUtil         for bytes;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using TransferUtil      for address;

    enum CheckGasResult {
        SUCCESS,
        QUERY_FAILED,
        CHECK_FAILED
    }

    event ConnectorTransacted (address connector, CheckGasResult check, bool success, bytes reason);
    event ConnectorTrusted    (address connector, bool trusted);

    struct DepositBatch
    {
        uint     batchID;
        uint96[] amounts;
    }

    struct ConnectorCall
    {
        address            connector;
        uint               gasLimit;
        ConnectorTxGroup[] txGroups;
    }

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

    // This struct can be used for packing data into bytes
    struct BridgeOperation
    {
        DepositBatch[]  batches;
        ConnectorCall[] calls;
        TokenData[]     tokens;
    }

    bytes32 constant public CONNECTOR_TX_TYPEHASH = keccak256(
        "ConnectorTx(uint16 tokenID,uint96 amount,uint16 feeTokenID,uint96 maxFee,uint32 validUntil,uint32 storageID,uint32 minGas,address connector,bytes groupData,bytes userData)"
    );

    uint    public constant  MAX_FEE_BIPS              = 25;     // 0.25%
    uint    public constant  GAS_LIMIT_CHECK_GAS_LIMIT = 10000;

    bytes32 public immutable DOMAIN_SEPARATOR;

    mapping (address => bool) public trustedConnectors;

    modifier onlyFromExchangeOwner()
    {
        require(msg.sender == exchange.owner(), "UNAUTHORIZED");
        _;
    }

    constructor(
        IExchangeV3 _exchange,
        uint32      _accountID
        )
        Claimable()
        BatchDepositor(_exchange, _accountID)
    {
        DOMAIN_SEPARATOR = EIP712.hash(EIP712.Domain("Bridge", "1.0", address(this)));
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

    function trustConnector(
        address connector,
        bool    trusted
        )
        external
        onlyOwner
    {
        trustedConnectors[connector] = trusted;
        emit ConnectorTrusted(connector, trusted);
    }

    receive() external payable {}

    // --- Internal functions ---

    function _processTransactions(Context memory ctx)
        internal
    {
        // abi.decode(callbackData, (BridgeOperation))
        // Get the calldata structs directly from the encoded calldata bytes data
        DepositBatch[]  calldata batches;
        ConnectorCall[] calldata calls;
        TokenData[]     calldata tokens;
        uint tokensOffset;

        assembly {
            let offsetToCallbackData := add(68, calldataload(36))
            // batches
            batches.offset := add(add(offsetToCallbackData, 32), calldataload(offsetToCallbackData))
            batches.length := calldataload(sub(batches.offset, 32))

            // calls
            calls.offset := add(add(offsetToCallbackData, 32), calldataload(add(offsetToCallbackData, 32)))
            calls.length := calldataload(sub(calls.offset, 32))

            // tokens
            tokens.offset := add(add(offsetToCallbackData, 32), calldataload(add(offsetToCallbackData, 64)))
            tokens.length := calldataload(sub(tokens.offset, 32))
            tokensOffset := sub(tokens.offset, 32)
        }

        ctx.tokensOffset = tokensOffset;
        ctx.tokens = tokens;

        // Now process both:
        // - previously done batch deposits
        // - connector calls
        // Note that both are unrelated to each other. It's possible to only process
        // batch deposits and no connector calls, or no batch deposits and only connector calls.
        // The connector calls can generate a new batch deposit request which will need
        // to be handled in a future block.
        // A CEX/L2 -> L2 mass migration would only use the batch deposit functionality.

        /* Batch deposits */

        // Process previously requested L1->L2 batch deposits
        // (originating from external batchDeposit() calls or from previous connector calls).
        _processDepositBatches(ctx, batches);

        /* Connector calls */

        // Process L2 transfers from users to the Bridge, then withdraw tokens
        // to L1 to interact with connectors,
        uint[]                      memory totalAmounts;
        IBatchDepositor.Deposit[][] memory depositsList;
        (totalAmounts, depositsList) = _processConnectorCalls(ctx, calls);

        // Verify withdrawals
        _verifyWithdrawals(ctx, totalAmounts);

        // Do a new batch deposit that resulted from the connectors that were just called.
        _batchDeposit(address(this), depositsList);
    }

    function _processDepositBatches(
        Context        memory   ctx,
        DepositBatch[] calldata batches
        )
        internal
    {
        for (uint i = 0; i < batches.length; i++) {
            _processDepositBatch(ctx, batches[i]);
        }
    }

    function _processDepositBatch(
        Context      memory   ctx,
        DepositBatch calldata batch
        )
        internal
    {
        uint96[] memory amounts = batch.amounts;

        // Verify transfers
        bytes memory transfersData = new bytes(amounts.length * 34);
        assembly {
            transfersData := add(transfersData, 32)
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
            uint value = (uint(ExchangeData.TransactionType.TRANSFER) << 176) |
                (1 << 168) |
                (uint(accountID) << 136);

            require(
                // txType == ExchangeData.TransactionType.TRANSFER &&
                // transfer.type == 1 &&
                // transfer.fromAccountID == ctx.accountID &&
                // transfer.toAccountID == UNKNOWN  &&
                packedData & 0xffffffffffff0000000000000000000000000000000000 == value &&
                (packedData >> 48) & 0xffff == tokenID && // feeTokenID
                fee <= (amount * MAX_FEE_BIPS / 10000) &&
                (100000 - 8) * targetAmount <= 100000 * amount &&
                amount <= targetAmount,
                "INVALID_BRIDGE_TRANSFER_TX_DATA"
            );

            // Pack the transfer data to compare against batch deposit hash
            assembly {
                mstore(add(transfersData, 2), tokenID)
                mstore(    transfersData    , or(shl(96, to), targetAmount))
                transfersData := add(transfersData, 34)
            }
        }

        // Get the original transfersData ptr back
        assembly {
            transfersData := sub(transfersData, add(32, mul(34, mload(amounts))))
        }
        // Check if these transfers can be processed
        bytes32 hash = _hashTransfers(transfersData);
        require(!_arePendingDepositsTooOld(batch.batchID, hash), "BATCH_DEPOSITS_TOO_OLD");

        // Mark transfers as completed
        delete pendingDeposits[batch.batchID][hash];
    }

    function _processConnectorCalls(
        Context          memory   ctx,
        ConnectorCall[]  calldata calls
        )
        internal
        returns(
            uint[]                      memory totalAmounts,
            IBatchDepositor.Deposit[][] memory depositsList
        )
    {
        // Total amounts transferred to the bridge
        totalAmounts = new uint[](ctx.tokens.length);

        // All resulting deposits from all connector calls
        depositsList = new IBatchDepositor.Deposit[][](calls.length);

        // Verify and execute bridge calls
        for (uint i = 0; i < calls.length; i++) {
            ConnectorCall calldata call = calls[i];

            // Verify the transactions
            _verifyInboundTransfers(ctx, call, totalAmounts);

            // Call the connector
            depositsList[i] = _transactConnector(ctx, call, i, calls);
        }
    }

    function _verifyInboundTransfers(
        Context          memory   ctx,
        ConnectorCall    calldata call,
        uint[]           memory   totalAmounts
        )
        internal
        view
    {
        CallTransfer memory transfer;
        uint totalMinGas = 0;
        for (uint i = 0; i < call.txGroups.length; i++) {
            ConnectorTxGroup calldata txGroup = call.txGroups[i];
            for (uint j = 0; j < txGroup.transactions.length; j++) {
                ConnectorTx calldata connectorTx = txGroup.transactions[j];

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
                bytes32 txHash = _hashConnectorTx(
                    transfer,
                    connectorTx.maxFee,
                    connectorTx.validUntil,
                    connectorTx.minGas,
                    call.connector,
                    txGroup.groupData,
                    connectorTx.userData
                );
                verifySignatureL2(ctx, connectorTx.owner, transfer.fromAccountID, txHash);

                // Find the token in the tokens list
                uint k = 0;
                while (k < ctx.tokens.length && transfer.tokenID != ctx.tokens[k].tokenID) {
                    k++;
                }
                require(k < ctx.tokens.length, "INVALID_INPUT_TOKENS");
                totalAmounts[k] += transfer.amount;

                // Verify the transaction data
                require(
                    // txType == ExchangeData.TransactionType.TRANSFER &&
                    // transfer.type == 1 &&
                    // transfer.fromAccountID == UNKNOWN &&
                    // transfer.toAccountID == ctx.accountID &&
                    packedData & 0xffff00000000ffffffff00000000000000000000000000 ==
                    (uint(ExchangeData.TransactionType.TRANSFER) << 176) | (1 << 168) | (uint(accountID) << 104) &&
                    transfer.fee <= connectorTx.maxFee &&
                    connectorTx.validUntil == 0 || block.timestamp < connectorTx.validUntil &&
                    connectorTx.token == ctx.tokens[k].token &&
                    connectorTx.amount == transfer.amount,
                    "INVALID_BRIDGE_CALL_TRANSFER"
                );

                totalMinGas = totalMinGas.add(connectorTx.minGas);
            }
        }

        // Make sure the gas passed to the connector is at least the sum of all transaction gas min amounts.
        // So connector txs basically "buy" a part of the total gas needed to do the batched call,
        // while IBridgeConnector.getMinGasLimit() makes sure the total gas limit makes sense for the
        // amount of work submitted.
        require(call.gasLimit >= totalMinGas, "INVALID_TOTAL_MIN_GAS");
    }

    function _verifyWithdrawals(
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

    function _transactConnector(
        Context          memory   ctx,
        ConnectorCall    calldata call,
        uint                      n,
        ConnectorCall[]  calldata calls
        )
        internal
        returns (IBatchDepositor.Deposit[] memory deposits)
    {
        require(call.connector != address(this), "INVALID_CONNECTOR");
        require(trustedConnectors[call.connector], "ONLY_TRUSTED_CONNECTORS_SUPPORTED");

        // Check if the minimum amount of gas required is achieved
        bytes memory txData = _getDataForConnectorTxs(
            ctx,
            IBridgeConnector.getMinGasLimit.selector,
            calls,
            n
        );
        (bool success, bytes memory returnData) = call.connector.fastCall(
            GAS_LIMIT_CHECK_GAS_LIMIT,
            0,
            txData
        );

        CheckGasResult checkResult;
        if (!success) {
            checkResult = CheckGasResult.QUERY_FAILED;
        } else if (call.gasLimit < abi.decode(returnData, (uint))) {
            checkResult = CheckGasResult.CHECK_FAILED;
        } else {
            checkResult = CheckGasResult.SUCCESS;
        }

        // Regardless the gas check result, we always attemp to call the connector
        // without being willing to fail due to gas check failure.
        //
        // Execute the logic using a delegatecall so no extra L1 transfers are needed
        txData = _getDataForConnectorTxs(
            ctx,IBridgeConnector.processTransactions.selector,
            calls,
            n
        );
        (success, returnData) = call.connector.fastDelegatecall(call.gasLimit, txData);

        if (success) {
            deposits = abi.decode(returnData, (IBatchDepositor.Deposit[]));
        } else {
            // If the call failed return funds to all users
            uint totalNumCalls = 0;
            for (uint i = 0; i < call.txGroups.length; i++) {
                totalNumCalls += call.txGroups[i].transactions.length;
            }
            deposits = new IBatchDepositor.Deposit[](totalNumCalls);
            uint txIdx = 0;
            for (uint i = 0; i < call.txGroups.length; i++) {
                ConnectorTxGroup memory txGroup = call.txGroups[i];
                for (uint j = 0; j < txGroup.transactions.length; j++) {
                    ConnectorTx memory connectorTx = txGroup.transactions[j];
                    deposits[txIdx++] = IBatchDepositor.Deposit({
                        owner:  connectorTx.owner,
                        token:  connectorTx.token,
                        amount: connectorTx.amount
                    });
                }
            }
            assert(txIdx == totalNumCalls);
        }

        emit ConnectorTransacted(
            call.connector,
            checkResult,
            success,
            returnData
        );
    }

    function _hashConnectorTx(
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
                    CONNECTOR_TX_TYPEHASH,
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
        bytes32 typeHash = CONNECTOR_TX_TYPEHASH;
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

    function _getDataForConnectorTxs(
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
        ConnectorTxGroup[] calldata txGroups = calls[n].txGroups;
        assembly {
            offsetToGroups := sub(txGroups.offset, 32)
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
        uint value = (uint(ExchangeData.TransactionType.SIGNATURE_VERIFICATION) << 192) |
            ((uint(owner) & 0x00ffffffffffffffffffffffffffffffffffffffff) << 32) |
            _accountID;

        require(
            packedData & 0xffffffffffffffffffffffffffffffffffffffffffffffffff == value &&
            data == uint(txHash) >> 3,
            "INVALID_OFFCHAIN_L2_APPROVAL"
        );

        ctx.txsDataPtr += ExchangeData.TX_DATA_AVAILABILITY_SIZE;
    }
}
