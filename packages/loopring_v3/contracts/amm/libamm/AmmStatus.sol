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
import "../../lib/MathUint96.sol";
import "../../lib/SignatureUtil.sol";


/// @title LPToken
library AmmStatus
{
    using ERC20SafeTransfer for address;
    using MathUint      for uint;
    using MathUint96        for uint96;
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
        S.onchainExitFeeETH = config.onchainExitFeeETH;

        address depositContract = address(exchange.getDepositContract());
        for (uint i = 0; i < config.tokens.length; i++) {
            require(config.weights[i] > 0, "INVALID_TOKEN_WEIGHT");

            address token = config.tokens[i];
            S.tokens.push(AmmData.Token({
                addr: token,
                tokenID: exchange.getTokenID(token),
                weight: config.weights[i]
            }));

            ERC20(token).approve(depositContract, uint(-1));
        }

        // The last token is the pool token
        S.tokens.push(AmmData.Token({
            addr: address(this),
            tokenID: exchange.getTokenID(address(this)),
            weight: 0 // never used
        }));
    }

    // Anyone is able to shut down the pool when requests aren't being processed any more.
    function shutdown(AmmData.State storage S)
        public
    {
        bytes32 firstExitHash = S.exitLocks[S.exitLocksStartIdx].txHash;
        uint validUntil = S.approvedTx[firstExitHash];
        require(validUntil > 0 && validUntil <= block.timestamp, "REQUEST_NOT_TOO_OLD");

        uint size = S.tokens.length;

        // remember the part owned by users collectively
        for (uint i = 0; i < size; i++) {
            address token = S.tokens[i].addr;
            S.withdrawableBeforeShutdown[token] = (token == address(0)) ?
                address(this).balance :
                ERC20(token).balanceOf(address(this));
        }

        if (!S.exchange.isInWithdrawalMode()) {
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

    function checkPoolTxApproval(
        AmmData.State storage S,
        address               owner,
        bytes32               poolTxHash,
        bytes          memory signature
        )
        internal
    {
        if (signature.length == 0) {
            require(S.approvedTx[poolTxHash] > block.timestamp, "INVALID_ONCHAIN_APPROVAL");
            delete S.approvedTx[poolTxHash];
        } else {
            require(poolTxHash.verifySignature(owner, signature), "INVALID_OFFCHAIN_APPROVAL");
        }
    }

    function addUserBalance(
        AmmData.State storage S,
        address               owner,
        address               token,
        uint96                amount
        )
        internal
    {
        S.withdrawable[token][owner] = S.withdrawable[token][owner].add(amount);
    }

    function removeUserBalance(
        AmmData.State storage S,
        address               owner,
        address               token,
        uint96                amount
        )
        internal
    {
        S.withdrawable[token][owner] = S.withdrawable[token][owner].sub(amount);
    }
}
