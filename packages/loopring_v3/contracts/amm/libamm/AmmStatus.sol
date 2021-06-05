// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/iface/IExchangeV3.sol";
import "../../lib/EIP712.sol";
import "./AmmData.sol";
import "./IAmmSharedConfig.sol";


/// @title AmmStatus
library AmmStatus
{
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

        require(config.sharedConfig != address(0), "INVALID_SHARED_CONFIG");
        require(config.tokens.length == config.weights.length, "INVALID_DATA");
        require(config.tokens.length >= 2, "INVALID_DATA");
        require(config.exchange != address(0), "INVALID_EXCHANGE");
        require(S._totalSupply == 0, "POOL_IN_USE");

        IExchangeV3 exchange = IExchangeV3(config.exchange);

        S.feeBips = config.feeBips;
        S.domainSeparator = EIP712.hash(EIP712.Domain(config.poolName, "1.0.0", address(this)));
        S.poolName = config.poolName;
        S.symbol = config.tokenSymbol;
        S.sharedConfig = IAmmSharedConfig(config.sharedConfig);
        S.exchange = exchange;
        S.exchangeOwner = exchange.owner();
        S.exchangeDomainSeparator = exchange.getDomainSeparator();
        S.shutdownTimestamp = 0;
        S.exitMode = false;

        delete S.tokens;
        for (uint i = 0; i < config.tokens.length; i++) {
            address token = config.tokens[i];
            S.tokens.push(AmmData.Token({
                addr: token,
                tokenID: exchange.getTokenID(token),
                weight: config.weights[i]
            }));
        }

        if (S.accountID == 0) { // new pool
            require(config.accountID != 0, "INVALID_ACCOUNT_ID");
            S.accountID = config.accountID;
            S.poolTokenID = exchange.getTokenID(address(this));

            // Mint all liquidity tokens to the pool account on L2
            S.balanceOf[address(this)] = AmmData.POOL_TOKEN_MINTED_SUPPLY;
            S.allowance[address(this)][address(exchange.getDepositContract())] = type(uint256).max;
            exchange.deposit(
                address(this), // from
                address(this), // to
                address(this), // token
                uint96(AmmData.POOL_TOKEN_MINTED_SUPPLY),
                new bytes(0)
            );
        } else {// reused pool
            require(config.accountID == 0, "INCONSISTENT_ACCOUNT_ID");
        }
    }

    // Anyone is able to shut down the pool when requests aren't being processed any more.
    function shutdownByLP(
        AmmData.State storage S,
        address               exitOwner
        )
        public
    {
        if (!S.exchange.isInWithdrawalMode()) {
            uint64 validUntil = S.forcedExit[exitOwner].validUntil;
            require(validUntil > 0 && validUntil < block.timestamp, "INVALID_CHALLENGE");
        }

        _shutdown(S);
    }

    function shutdownByController(
        AmmData.State storage S
        )
        public
    {
        _shutdown(S);
    }

    // Anyone is able to update the cached exchange owner to the current owner.
    function updateExchangeOwnerAndFeeBips(AmmData.State storage S)
        public
    {
        S.exchangeOwner = S.exchange.owner();
        S.feeBips = S.exchange.getAmmFeeBips();
    }

    function _shutdown(
        AmmData.State storage S
        )
        internal
    {
        // If the exchange is in withdrawal mode allow the pool to be shutdown immediately
        if (!S.exchange.isInWithdrawalMode()) {
            uint size = S.tokens.length;

            for (uint i = 0; i < size; i++) {
                S.exchange.forceWithdraw{value: msg.value / size}(
                    address(this),
                    S.tokens[i].addr,
                    S.accountID
                );
            }
        }
        S.shutdownTimestamp = uint64(block.timestamp);
        emit Shutdown(block.timestamp);
    }
}
