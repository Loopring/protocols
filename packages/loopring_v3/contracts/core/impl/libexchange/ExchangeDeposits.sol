// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../lib/AddressUtil.sol";
import "../../../lib/MathUint96.sol";
import "../../iface/ExchangeData.sol";
import "./ExchangeMode.sol";
import "./ExchangeTokens.sol";


/// @title ExchangeDeposits.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeDeposits
{
    using AddressUtil       for address payable;
    using MathUint96        for uint96;
    using ExchangeMode      for ExchangeData.State;
    using ExchangeTokens    for ExchangeData.State;

    event DepositRequested(
        address from,
        address to,
        address token,
        uint16  tokenId,
        uint96  amount
    );

    function deposit(
        ExchangeData.State storage S,
        address from,
        address to,
        address tokenAddress,
        uint96  amount,                 // can be zero
        bytes   memory extraData,
        bool    isFlashDeposit
        )
        internal  // inline call
    {
        require(to != address(0), "ZERO_ADDRESS");

        // Deposits are still possible when the exchange is being shutdown, or even in withdrawal mode.
        // This is fine because the user can easily withdraw the deposited amounts again.
        // We don't want to make all deposits more expensive just to stop that from happening.

        uint16 tokenID = S.getTokenID(tokenAddress);

        uint96 _amount = amount;
        if (isFlashDeposit) {
            require(msg.value == 0, "ETH_AMOUNT_NOT_ZERO");
            S.flashDepositAmounts[tokenAddress] = S.flashDepositAmounts[tokenAddress].add(amount);
        } else {
            // Transfer the tokens to this contract
            _amount = S.depositContract.deposit{value: msg.value}(
                from,
                tokenAddress,
                amount,
                extraData
            );

            emit DepositRequested(
                from,
                to,
                tokenAddress,
                tokenID,
                _amount
            );
        }

        // Add the amount to the deposit request and reset the time the operator has to process it
        ExchangeData.Deposit memory _deposit = S.pendingDeposits[to][tokenID];
        _deposit.timestamp = uint64(block.timestamp);
        _deposit.amount = _deposit.amount.add(_amount);
        S.pendingDeposits[to][tokenID] = _deposit;
    }

    function repayFlashDeposit(
        ExchangeData.State storage S,
        address from,
        address tokenAddress,
        uint96  amount,
        bytes   memory extraData
        )
        public
    {
        // Make sure the token is registered
        /*uint16 tokenID = */S.getTokenID(tokenAddress);

        // Transfer the tokens to this contract
        uint96 repaid = S.depositContract.deposit{value: msg.value}(
            from,
            tokenAddress,
            amount,
            extraData
        );
        require(repaid > 0, "INVALID_REPAY_AMOUNT");

        // Pay back
        S.flashDepositAmounts[tokenAddress] = S.flashDepositAmounts[tokenAddress].sub(repaid);
    }
}
