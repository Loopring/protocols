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
import "./IBatchDepositor.sol";

/// @title  BatchDepositor implementation
/// @author Brecht Devos - <brecht@loopring.org>
abstract contract BatchDepositor is IBatchDepositor, ReentrancyGuard
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
    event BatchDeposited (uint batchID, bytes transfersData, address from);
    event Withdrawn      (uint batchID);

    struct BatchDeposit
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

    uint               public constant  MAX_NUM_TRANSACTIONS_IN_BLOCK = 386;
    uint               public constant  MAX_AGE_PENDING_DEPOSITS      = 7 days;

    IExchangeV3        public immutable exchange;
    uint32             public immutable accountID;
    IDepositContract   public immutable depositContract;

    mapping (uint => mapping (bytes32 => uint)) public pendingDeposits;
    mapping (uint => mapping(uint => bool))     public withdrawn;
    // token -> tokenID
    mapping (address => uint16)                 public cachedTokenIDs;
    uint                                        public batchIDGenerator;

    constructor(
        IExchangeV3 _exchange,
        uint32      _accountID
        )
    {
        exchange = _exchange;
        accountID = _accountID;
        depositContract = _exchange.getDepositContract();
    }

    function batchDeposit(
        IBatchDepositor.Deposit[] memory deposits
        )
        external
        payable
        override
        nonReentrant
    {
        IBatchDepositor.Deposit[][] memory depositsList = new IBatchDepositor.Deposit[][](1);
        depositsList[0] = deposits;
        _batchDeposit(msg.sender, depositsList);
    }

    // Allows withdrawing from pending deposits that are at least MAX_AGE_PENDING_DEPOSITS old.
    function withdrawFromPendingBatchDeposits(
        uint                  batchID,
        BatchDeposit[] memory deposits,
        uint[]         memory indices
        )
        external
        nonReentrant
    {
        bytes memory transfersData = new bytes(deposits.length * 34);
        assembly {
            transfersData := add(transfersData, 32)
        }

        for (uint i = 0; i < deposits.length; i++) {
            BatchDeposit memory deposit = deposits[i];
            // Pack the transfer data to compare against batch deposit hash
            address  owner = deposit.owner;
            uint16 tokenID = deposit.tokenID;
            uint    amount = deposit.amount;
            assembly {
                mstore(add(transfersData, 2), tokenID)
                mstore(    transfersData    , or(shl(96, owner), amount))
                transfersData := add(transfersData, 34)
            }
        }

        // Get the original deposits ptr back
        uint numDeposits = deposits.length;
        assembly {
            transfersData := sub(transfersData, add(32, mul(34, numDeposits)))
        }

        // Check if withdrawing from these deposits is possible
        bytes32 hash = _hashTransfers(transfersData);
        require(_arePendingDepositsTooOld(batchID, hash), "BATCH_DEPOSITS_STILL_YOUNG");

        for (uint i = 0; i < indices.length; i++) {
            uint idx = indices[i];

            require(!withdrawn[batchID][idx], "ALREADY_WITHDRAWN");
            withdrawn[batchID][idx] = true;

            address tokenAddress = exchange.getTokenAddress(deposits[idx].tokenID);

            tokenAddress.transferOut(
                deposits[idx].owner,
                deposits[idx].amount
            );
        }

        emit Withdrawn(batchID);
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

    // --- Internal functions ---

    function _batchDeposit(
        address                            from,
        IBatchDepositor.Deposit[][] memory depositsList
        )
        internal
    {
        uint totalNumDeposits = 0;
        for (uint i = 0; i < depositsList.length; i++) {
            totalNumDeposits += depositsList[i].length;
        }
        if (totalNumDeposits == 0) {
            return;
        }

        // Needs to be possible to do all transfers in a single block
        require(totalNumDeposits <= MAX_NUM_TRANSACTIONS_IN_BLOCK, "MAX_DEPOSITS_EXCEEDED");

        // Transfers to be done
        bytes memory transfersData = new bytes(totalNumDeposits * 34);
        assembly {
            transfersData := add(transfersData, 32)
        }

        // Worst case scenario all tokens are different
        TokenData[] memory tokens = new TokenData[](totalNumDeposits);
        uint numDistinctTokens = 0;

        // Run over all deposits summing up total amounts per token
        address token = address(-1);
        uint tokenIdx = 0;
        uint16 tokenID;
        IBatchDepositor.Deposit memory deposit;

        for (uint i = 0; i < depositsList.length; i++) {
            IBatchDepositor.Deposit[] memory _deposits = depositsList[i];
            for (uint j = 0; j < _deposits.length; j++) {
                deposit = _deposits[j];
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
                    mstore(add(transfersData, 2), tokenID)
                    mstore(    transfersData    , or(shl(96, mload(deposit)), mload(add(deposit, 64))))
                    transfersData := add(transfersData, 34)
                }
            }
        }

        // Get the original transfers ptr back
        assembly {
            transfersData := sub(transfersData, add(32, mul(34, totalNumDeposits)))
        }

        // Do a normal deposit per token
        for(uint i = 0; i < numDistinctTokens; i++) {
            if (tokens[i].token == address(0)) {
                require(tokens[i].amount == msg.value || from == address(this), "INVALID_ETH_DEPOSIT");
            }
            _deposit(from, tokens[i].token, uint96(tokens[i].amount));
        }

        // Store the transfersData so they can be processed later
        _storeBatchDeposit(transfersData, from);
    }

    function _storeBatchDeposit(
        bytes   memory transfersData,
        address        from
        )
        internal
    {
        uint batchID = batchIDGenerator++;

        // Store transfers to distribute at a later time
        bytes32 hash = _hashTransfers(transfersData);
        require(pendingDeposits[batchID][hash] == 0, "DUPLICATE_BATCH");
        pendingDeposits[batchID][hash] = block.timestamp;

        emit BatchDeposited(batchID, transfersData, from);
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

    function _hashTransfers(bytes memory transfersData)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(transfersData);
    }

    function _arePendingDepositsTooOld(uint batchID, bytes32 hash)
        internal
        view
        returns (bool)
    {
        uint timestamp = pendingDeposits[batchID][hash];
        require(timestamp != 0, "UNKNOWN_TRANSFERS");
        return block.timestamp > timestamp + MAX_AGE_PENDING_DEPOSITS;
    }
}
