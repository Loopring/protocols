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
import "../../thirdparty/BytesUtil.sol";

import "./BridgeData.sol";
import "./IBridgeConnector.sol";


/// @title Bridge
contract Bridge is Claimable
{
    using AddressUtil       for address;
    using BytesUtil         for bytes;
    using BlockReader       for bytes;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;

    struct Context
    {
        bytes32 domainSeparator;
        uint32  accountID;
        uint    txIdx;
    }

    struct HashAuxData
    {
        address connector;
        bytes groupData;
    }

    bytes32 constant public BRIDGE_CALL_TYPEHASH = keccak256(
        "BridgeCall(address from,address to,uint16 tokenID,uint96 amount,uint16 feeTokenID,uint96 maxFee,uint32 storageID,uint32 minGas,address connector,bytes groupData,bytes userData)"
    );

    uint               public constant  MAX_NUM_TRANSACTIONS_IN_BLOCK = 386;
    uint               public constant  MAX_AGE_PENDING_TRANSFERS     = 7 days;
    uint               public constant  MAX_FEE_BIPS                  = 25;     // 0.25%
    uint               public constant  GAS_LIMIT_CHECK_GAS_LIMIT     = 10000;

    IExchangeV3        public immutable exchange;
    uint32             public immutable accountID;
    IDepositContract   public immutable depositContract;
    bytes32            public immutable DOMAIN_SEPARATOR;


    address                                    public exchangeOwner;

    mapping (bytes32 => uint)                  public pendingTransfers;
    mapping (bytes32 => mapping(uint => bool)) public withdrawn;

    mapping (address => bool)                  public trustedConnectors;

    uint                                       public batchIDGenerator;

    // token -> tokenID
    mapping (address => uint16)                public cachedTokenIDs;

    event Transfers(uint batchID, InternalBridgeTransfer[] transfers);

    event BridgeCallSuccess (bytes32 hash);
    event BridgeCallFailed  (bytes32 hash, string reason);

    event ConnectorTrusted  (address connector, bool trusted);

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
        address                 from,
        BridgeTransfer[] memory deposits
        )
        external
        payable
    {
        require(from == msg.sender, "UNAUTHORIZED");
        // Needs to be possible to do all transfers in a single block
        require(deposits.length <= MAX_NUM_TRANSACTIONS_IN_BLOCK, "MAX_DEPOSITS_EXCEEDED");

        // Transfers to be done
        InternalBridgeTransfer[] memory transfers = new InternalBridgeTransfer[](deposits.length);

        // Worst case scenario all tokens are different
        TokenData[] memory tokens = new TokenData[](deposits.length);
        uint numDistinctTokens = 0;

        // Run over all deposits summing up total amounts per token
        address token = address(-1);
        uint tokenIdx = 0;
        for (uint i = 0; i < deposits.length; i++) {
            if(token != deposits[i].token) {
                token = deposits[i].token;
                tokenIdx = 0;
                while(tokenIdx < numDistinctTokens && tokens[tokenIdx].token != token) {
                    tokenIdx++;
                }
                if (tokenIdx == numDistinctTokens) {
                    tokens[tokenIdx].token = token;
                    tokens[tokenIdx].tokenID = _getTokenID(token);
                    numDistinctTokens++;
                }
            }
            tokens[tokenIdx].amount = tokens[tokenIdx].amount.add(deposits[i].amount);
            deposits[i].token = address(tokens[tokenIdx].tokenID);

            transfers[i].owner = deposits[i].owner;
            transfers[i].tokenID = tokens[tokenIdx].tokenID;
            transfers[i].amount = deposits[i].amount;
        }

        // Do a normal deposit per token
        for(uint i = 0; i < numDistinctTokens; i++) {
            if (tokens[i].token == address(0)) {
                require(tokens[i].amount == msg.value, "INVALID_ETH_DEPOSIT");
            }
            _deposit(from, tokens[i].token, uint96(tokens[i].amount));
        }

        // Store the transfers so they can be processed later
        _storeTransfers(transfers);
    }

    function beforeBlockSubmission(
        bytes memory   txsData,
        bytes calldata callbackData
        )
        external
        onlyFromExchangeOwner
    {
        BridgeOperations memory operations = abi.decode(callbackData, (BridgeOperations));

        Context memory ctx = Context({
            domainSeparator: DOMAIN_SEPARATOR,
            accountID: accountID,
            txIdx: 0
        });

        _processTransfers(ctx, operations.transferOperations, txsData);
        _processCalls(ctx, operations, txsData);

        // Make sure we have consumed exactly the expected number of transactions
        require(txsData.length == ctx.txIdx * ExchangeData.TX_DATA_AVAILABILITY_SIZE, "INVALID_NUM_TXS");
    }

    // Allows withdrawing from pending transfers that are at least MAX_AGE_PENDING_TRANSFERS old.
    function withdrawFromPendingTransfers(
        uint                              batchID,
        InternalBridgeTransfer[] calldata transfers,
        uint[]                   calldata indices
        )
        external
    {
        // Check if withdrawing from these transfers is possible
        bytes32 hash = _hashTransfers(batchID, transfers);
        require(_arePendingTransfersTooOld(hash), "TRANSFERS_NOT_TOO_OLD");

        for (uint i = 0; i < indices.length; i++) {
            uint idx = indices[i];

            require(!withdrawn[hash][idx], "ALREADY_WITHDRAWN");
            withdrawn[hash][idx] = true;

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

    function _processTransfers(
        Context             memory ctx,
        TransferOperation[] memory operations,
        bytes               memory txsData
        )
        internal
    {
        for (uint o = 0; o < operations.length; o++) {
            InternalBridgeTransfer[] memory transfers = operations[o].transfers;

            // Check if these transfers can be processed
            bytes32 hash = _hashTransfers(operations[o].batchID, transfers);
            require(!_arePendingTransfersTooOld(hash), "TRANSFERS_TOO_OLD");

            // Mark transfers as completed
            pendingTransfers[hash] = 0;

            // Verify transfers
            TransferTransaction.Transfer memory transfer;
            for (uint i = 0; i < transfers.length; i++) {
                TransferTransaction.readTx(txsData, ctx.txIdx++ * ExchangeData.TX_DATA_AVAILABILITY_SIZE, transfer);

                uint16 tokenID = transfers[i].tokenID;
                require(
                    transfer.fromAccountID == ctx.accountID &&
                    transfer.to == transfers[i].owner &&
                    transfer.from == address(this) &&
                    transfer.tokenID == tokenID &&
                    transfer.feeTokenID == tokenID &&
                    _isAlmostEqualAmount(transfer.amount, transfers[i].amount) &&
                    transfer.fee <= (uint(transfer.amount).mul(MAX_FEE_BIPS) / 10000),
                    "INVALID_BRIDGE_TRANSFER_TX_DATA"
                );
            }
        }
    }

    function _processCalls(
        Context          memory ctx,
        BridgeOperations memory operations,
        bytes            memory txsData
        )
        internal
    {
        ConnectorCalls[] memory connectorCalls = operations.connectorCalls;
        TokenData[] memory tokens = operations.tokens;

        uint[] memory withdrawalAmounts = new uint[](tokens.length);
        for (uint i = 0; i < tokens.length; i++) {
            withdrawalAmounts[i] = tokens[i].amount;
        }

        // Calls
        TransferTransaction.Transfer memory transfer;
        SignatureVerificationTransaction.SignatureVerification memory verification;
        for (uint c = 0; c < connectorCalls.length; c++) {

            // Verify token data
            require(connectorCalls[c].tokens.length == tokens.length, "INVALID_DATA");
            for (uint i = 0; i < tokens.length; i++) {
                require(tokens[i].token == connectorCalls[c].tokens[i].token, "INVALID_CONNECTOR_TOKEN_DATA");
                tokens[i].amount = tokens[i].amount.sub(connectorCalls[c].tokens[i].amount);
            }

            // Call the connector
            _connectorCall(connectorCalls[c]);

            // Verify the transactions
            for (uint g = 0; g < connectorCalls[c].groups.length; g++) {
                for (uint i = 0; i < connectorCalls[c].groups[g].calls.length; i++) {
                    TransferTransaction.readTx(txsData, ctx.txIdx++ * ExchangeData.TX_DATA_AVAILABILITY_SIZE, transfer);
                    SignatureVerificationTransaction.readTx(txsData, ctx.txIdx++ * ExchangeData.TX_DATA_AVAILABILITY_SIZE, verification);

                    BridgeCall memory call = connectorCalls[c].groups[g].calls[i];

                    // Verify the transaction data
                    require(
                        transfer.toAccountID == ctx.accountID &&
                        transfer.to == address(this) &&
                        transfer.fee <= call.maxFee,
                        "INVALID_COLLECT_TRANSFER"
                    );

                    HashAuxData memory hashAuxData = HashAuxData(
                        connectorCalls[c].connector,
                        connectorCalls[c].groups[g].groupData
                    );

                    bytes32 txHash = _hashTx(
                        ctx.domainSeparator,
                        transfer,
                        call,
                        hashAuxData
                    );

                    // Verify that the hash was signed on L2
                    require(
                        verification.owner == transfer.from &&
                        verification.data == uint(txHash) >> 3,
                        "INVALID_OFFCHAIN_L2_APPROVAL"
                    );

                    connectorCalls[c].totalMinGas = connectorCalls[c].totalMinGas.sub(call.minGas);

                    for (uint t = 0; t < tokens.length; t++) {
                        if (transfer.tokenID == tokens[t].tokenID) {
                            connectorCalls[c].tokens[t].amount = connectorCalls[c].tokens[t].amount.sub(transfer.amount);
                        }
                    }
                }
            }

            // Make sure token amounts passed in match
            for (uint i = 0; i < tokens.length; i++) {
                require(connectorCalls[c].tokens[i].amount == 0, "INVALID_BRIDGE_DATA");
            }

            // Make sure the gas passed to the connector is at least the sum of all call gas min amounts.
            // So calls basically "buy" a part of the total gas needed to do the batched call,
            // while IBridgeConnector.getMinGasLimit() makes sure the total gas limit makes sense for the
            // amount of work submitted.
            require(connectorCalls[c].totalMinGas == 0, "INVALID_TOTAL_MIN_GAS");
        }

        // Verify the withdrawals
        WithdrawTransaction.Withdrawal memory withdrawal;
        for (uint i = 0; i < tokens.length; i++) {
            // Verify token data
            require(
                _getTokenID(tokens[i].token) == tokens[i].tokenID,
                "INVALID_TOKEN_DATA"
            );

            // Verify withdrawal data
            WithdrawTransaction.readTx(txsData, ctx.txIdx++ * ExchangeData.TX_DATA_AVAILABILITY_SIZE, withdrawal);
            bytes20 onchainDataHash = WithdrawTransaction.hashOnchainData(
                0,                  // Withdrawal needs to succeed no matter the gas coast
                address(this),      // Withdraw to this contract first
                new bytes(0)
            );
            require(
                withdrawal.onchainDataHash == onchainDataHash &&
                withdrawal.tokenID == tokens[i].tokenID &&
                withdrawal.amount == withdrawalAmounts[i] &&
                withdrawal.fee == 0,
                "INVALID_BRIDGE_WITHDRAWAL_TX_DATA"
            );

            // Verify all tokens withdrawn were actually transferred into the Bridge
            require(tokens[i].amount == 0, "INVALID_BRIDGE_TOKEN_DATA");
        }
    }

    function _storeTransfers(InternalBridgeTransfer[] memory transfers)
        internal
    {
        uint batchID = batchIDGenerator++;

        // Store transfers to distribute at a later time
        bytes32 hash = _hashTransfers(batchID, transfers);
        require(pendingTransfers[hash] == 0, "DUPLICATE_BATCH");
        pendingTransfers[hash] = block.timestamp;

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
        if(amount > 0) {
            // Do the token transfer directly to the exchange
            uint ethValue = (token == address(0)) ? amount : 0;
            exchange.deposit{value: ethValue}(from, address(this), token, amount, new bytes(0));
        }
    }

    function _connectorCall(ConnectorCalls memory connectorCalls)
        internal
    {
        // Check if the minimum amount of gas required is achieved
        try IBridgeConnector(connectorCalls.connector).getMinGasLimit{gas: GAS_LIMIT_CHECK_GAS_LIMIT}(connectorCalls) returns (uint minGasLimit) {
            require(connectorCalls.gasLimit >= minGasLimit, "GAS_LIMIT_TOO_LOW");
        } catch {
            // If the call failed for some reason just continue.
        }

        // Do the call
        bool success;
        try Bridge(this)._executeConnectorCall(connectorCalls) {
            success = true;
            emit BridgeCallSuccess(keccak256(abi.encode(connectorCalls)));
        } catch Error(string memory reason) {
            success = false;
            emit BridgeCallFailed(keccak256(abi.encode(connectorCalls)), reason);
        } catch {
            success = false;
            emit BridgeCallFailed(keccak256(abi.encode(connectorCalls)), "unknown");
        }

        // If the call failed return funds to all users
        if (!success) {
            for (uint g = 0; g < connectorCalls.groups.length; g++) {
                InternalBridgeTransfer[] memory transfers = new InternalBridgeTransfer[](connectorCalls.groups[g].calls.length);
                for (uint i = 0; i < connectorCalls.groups[g].calls.length; i++) {
                    transfers[i] = InternalBridgeTransfer({
                        owner: connectorCalls.groups[g].calls[i].owner,
                        tokenID:  _getTokenID(connectorCalls.groups[g].calls[i].token),
                        amount: connectorCalls.groups[g].calls[i].amount
                    });
                }
                _storeTransfers(transfers);
            }
        }
    }

    function _executeConnectorCall(ConnectorCalls calldata connectorCalls)
        external
    {
        require(msg.sender == address(this), "UNAUTHORIZED");
        require(connectorCalls.connector != address(this), "INVALID_CONNECTOR");

        bool trusted = trustedConnectors[connectorCalls.connector];

        if (trusted) {
            // Execute the logic using a delegate so no extra transfers are needed

            // Do the delegate call
            bytes memory txData = abi.encodeWithSelector(
                IBridgeConnector.processCalls.selector,
                connectorCalls
            );
            (bool success, bytes memory returnData) = connectorCalls.connector.delegatecall(txData);
            if (!success) {
                assembly { revert(add(returnData, 32), mload(returnData)) }
            }
            // TODO: maybe return transfers here to batch all of them together in a single `deposit` call across all trusted connectors.
        } else {
            // Transfer funds to the external contract with a real call, so the connector doesn't have to be trusted at all.

            // Transfer funds to the connector contract
            uint ethValue = 0;
            for (uint i = 0; i < connectorCalls.tokens.length; i++) {
                if (connectorCalls.tokens[i].amount > 0) {
                    if (connectorCalls.tokens[i].token != address(0)) {
                        connectorCalls.tokens[i].token.safeTransferAndVerify(connectorCalls.connector, connectorCalls.tokens[i].amount);
                    } else {
                        ethValue = ethValue.add(connectorCalls.tokens[i].amount);
                    }
                }
            }

            // Do the call
            IBridgeConnector(connectorCalls.connector).processCalls{value: ethValue, gas: connectorCalls.gasLimit}(connectorCalls);
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

    function _isAlmostEqualAmount(
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
            // But relayer may use float rounding multiple times
            // so the range is expanded to [100000 - 8, 100000 + 0],
            // always rounding down.
            uint ratio = (uint(amount) * 100000) / uint(targetAmount);
            return (100000 - 8) <= ratio && ratio <= (100000 + 0);
        }
    }

    function _hashTransfers(
        uint batchID,
        InternalBridgeTransfer[] memory transfers
        )
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(batchID, transfers));
    }

    function _arePendingTransfersTooOld(bytes32 hash)
        internal
        view
        returns (bool)
    {
        uint timestamp = pendingTransfers[hash];
        require(timestamp != 0, "UNKNOWN_TRANSFERS");
        return block.timestamp > timestamp + MAX_AGE_PENDING_TRANSFERS;
    }

    function _hashTx(
        bytes32                             _DOMAIN_SEPARATOR,
        TransferTransaction.Transfer memory transfer,
        BridgeCall                   memory call,
        HashAuxData                  memory hashAuxData
        )
        internal
        pure
        returns (bytes32)
    {
        return EIP712.hashPacked(
            _DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    BRIDGE_CALL_TYPEHASH,
                    transfer.from,
                    transfer.to,
                    transfer.tokenID,
                    transfer.amount,
                    transfer.feeTokenID,
                    call.maxFee,
                    transfer.storageID,
                    call.minGas,
                    hashAuxData.connector,
                    keccak256(hashAuxData.groupData),
                    keccak256(call.userData)
                )
            )
        );
    }

    function encode(BridgeOperations calldata operations)
        external
        pure
    {}
}
