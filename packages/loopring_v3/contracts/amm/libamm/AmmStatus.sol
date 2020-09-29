// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./AmmData.sol";
import "../../core/iface/IExchangeV3.sol";
import "../../lib/EIP712.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/ERC20.sol";
import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";


/// @title LPToken
library AmmStatus
{
    using ERC20SafeTransfer for address;
    using MathUint      for uint;
    using SignatureUtil for bytes32;

    event Shutdown(uint timestamp);

    function isOnline(AmmData.State storage S)
        internal
        view
        returns (bool)
    {
        return S.shutdownTimestamp == 0;
    }

    function setupPool(
        AmmData.State      storage  S,
        AmmData.PoolConfig calldata config
        )
        public
    {
        require(
            bytes(config.poolName).length > 0 && bytes(config.tokenSymbol).length > 0,
            "INVALID_NAME_OR_SYMBOL"
        );
        require(config.tokens.length == config.weights.length, "INVALID_DATA");
        require(config.tokens.length >= 2, "INVALID_DATA");
        require(config.exchange != address(0), "INVALID_EXCHANGE");
        require(config.accountID != 0, "INVALID_ACCOUNT_ID");
        require(S.tokens.length == 0, "ALREADY_INITIALIZED");

        IExchangeV3 exchange = IExchangeV3(config.exchange);
        S.exchange = exchange;
        S.accountID = config.accountID;
        S.feeBips = config.feeBips;
        S.domainSeparator = EIP712.hash(EIP712.Domain(config.poolName, "1.0.0", address(this)));

        S.poolName = config.poolName;
        S.symbol = config.tokenSymbol;

        address depositContract = address(exchange.getDepositContract());

        S.tokens.push(AmmData.Token({
            addr: address(this),
            tokenID: exchange.getTokenID(address(this)),
            weight: 0
        }));

        for (uint i = 0; i < config.tokens.length; i++) {
            address token = config.tokens[i];
            S.tokens.push(AmmData.Token({
                addr: token,
                tokenID: exchange.getTokenID(token),
                weight: config.weights[i]
            }));

            ERC20(token).approve(depositContract, uint(-1));
        }
    }

    // Anyone is able to shut down the pool when requests aren't being processed any more.
    function shutdown(
        AmmData.State storage S,
        bytes32               txHash
        )
        public
    {
        require(
            block.timestamp > S.approvedTx[txHash] + AmmData.MAX_AGE_REQUEST_UNTIL_POOL_SHUTDOWN(),
            "REQUEST_NOT_TOO_OLD"
        );

        if (!S.exchange.isInWithdrawalMode()) {
            uint size = S.tokens.length;
            uint32 accountID = S.accountID;
            IExchangeV3 exchange = S.exchange;

            for (uint i = 0; i < size; i++) {
                exchange.forceWithdraw{value: msg.value / size}(
                    address(this),
                    S.tokens[i].addr,
                    accountID
                );
            }
        }

        S.shutdownTimestamp = block.timestamp;
        emit Shutdown(block.timestamp);
    }

    function isLocked(
        AmmData.State storage S,
        address               owner
        )
        internal
        view
        returns (bool)
    {
        if (isOnline(S)) {
            uint since = S.lockedSince[owner];
            uint until = S.lockedUntil[owner];
            return since <= block.timestamp && (block.timestamp <= until || until == 0);
        } else {
            return false;
        }
    }

    function availableBalance(
        AmmData.State storage S,
        address               token,
        address               owner
        )
        internal
        view
        returns (uint)
    {
        return isLocked(S, owner) ? 0 : S.userBalance[token][owner];
    }

    function lockedBalance(
        AmmData.State storage S,
        address               token,
        address               owner
        )
        internal
        view
        returns (uint)
    {
        return S.userBalance[token][owner].sub(availableBalance(S, token, owner));
    }

    function addUserBalance(
        AmmData.State storage S,
        address               token,
        address               owner,
        uint                  amount
        )
        internal
    {
        S.userBalance[token][owner] = S.userBalance[token][owner].add(amount);
        S.totalUserBalance[token] = S.totalUserBalance[token].add(amount);
    }

    function removeUserBalance(
        AmmData.State storage S,
        address               token,
        address               owner,
        uint                  amount
        )
        internal
    {
        S.userBalance[token][owner] = S.userBalance[token][owner].sub(amount);
        S.totalUserBalance[token] = S.totalUserBalance[token].sub(amount);
    }

    function validatePoolTransaction(
        AmmData.State storage S,
        address        owner,
        bytes32        poolTxHash,
        bytes   memory signature
        )
        internal
    {
        if (signature.length == 0) {
            require(S.approvedTx[poolTxHash] != 0, "NOT_APPROVED");
            delete S.approvedTx[poolTxHash];
        } else {
            require(poolTxHash.verifySignature(owner, signature), "INVALID_SIGNATURE");
        }
    }
}
