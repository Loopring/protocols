// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../iface/ExchangeData.sol";

import "../../../lib/AddressUtil.sol";

import "./ExchangeMode.sol";
import "./ExchangeTokens.sol";


/// @title ExchangeDeposits.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeDeposits
{
    using AddressUtil       for address payable;
    using MathUint          for uint;
    using MathUint          for uint64;
    using MathUint          for uint96;
    using ExchangeMode      for ExchangeData.State;
    using ExchangeTokens    for ExchangeData.State;

    event DepositRequested(
        address owner,
        address token,
        uint96  amount,
        uint    fee
    );

    function deposit(
        ExchangeData.State storage S,
        address from,
        address to,
        address tokenAddress,
        uint96  amount,                 // can be zero
        bytes   memory auxiliaryData
        )
        internal  // inline call
    {
        require(to != address(0), "ZERO_ADDRESS");

        // Deposits are still possible when the exchange is being shutdown, or even in withdrawal mode.
        // This is fine because the user can easily withdraw the deposited amounts again.
        // We don't want to make all deposits more expensive just to stop that from happening.

        uint16 tokenID = S.getTokenID(tokenAddress);

        // Transfer the tokens to this contract
        (uint96 amountDeposited, uint64 fee) = transferDeposit(
            S,
            from,
            tokenAddress,
            amount,
            auxiliaryData
        );

        // Add the amount to the deposit request and reset the time the operator has to process it
        ExchangeData.Deposit memory _deposit = S.pendingDeposits[to][tokenID];
        _deposit.timestamp = uint32(block.timestamp);
        _deposit.amount = _deposit.amount.add96(amountDeposited);
        _deposit.fee = _deposit.fee.add64(fee);
        S.pendingDeposits[to][tokenID] = _deposit;

        emit DepositRequested(
            to,
            tokenAddress,
            uint96(amountDeposited),
            fee
        );
    }

    function transferDeposit(
        ExchangeData.State storage S,
        address from,
        address tokenAddress,
        uint96  amount,
        bytes   memory auxiliaryData
        )
        private
        returns (
            uint96 amountDeposited,
            uint64 fee
        )
    {
        IDepositContract depositContract = S.depositContract;
        uint depositValueETH = 0;
        if (msg.value > 0 && (tokenAddress == address(0) || depositContract.isETH(tokenAddress))) {
            depositValueETH = amount;
            fee = uint64(msg.value.sub(amount));
        } else {
            fee = uint64(msg.value);
        }

        // Transfer the tokens to the deposit contract (excluding the ETH fee)
        amountDeposited = depositContract.deposit{value: depositValueETH}(
            from,
            tokenAddress,
            amount,
            auxiliaryData
        );
    }
}
