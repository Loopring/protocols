// SPDX-License-Identifier: Apache-2.0
/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../iface/ExchangeData.sol";

import "../../lib/AddressUtil.sol";

import "./ExchangeMode.sol";
import "./ExchangeTokens.sol";


/// @title ExchangeDeposits.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeDeposits
{
    using AddressUtil       for address payable;
    using MathUint          for uint;
    using ExchangeMode      for ExchangeData.State;
    using ExchangeTokens    for ExchangeData.State;

    event DepositRequested(
        address indexed owner,
        address indexed token,
        uint96          amount,
        uint96          index,
        uint            fee
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
        require(S.areUserRequestsEnabled(), "USER_REQUEST_SUSPENDED");

        uint16 tokenID = S.getTokenID(tokenAddress);

        // Transfer the tokens to this contract
        (uint amountDeposited, uint tokenIndex, uint fee) = transferDeposit(
            S,
            from,
            tokenAddress,
            amount,
            auxiliaryData
        );

        // Add the amount to the deposit request and reset the time the operator has to process it
        S.pendingDeposits[to][tokenID][tokenIndex].amount += uint96(amountDeposited);
        S.pendingDeposits[to][tokenID][tokenIndex].timestamp = uint32(now);
        S.pendingDeposits[to][tokenID][tokenIndex].fee += uint64(fee);

        emit DepositRequested(
            to,
            tokenAddress,
            uint96(amountDeposited),
            uint96(tokenIndex),
            fee
        );
    }

    function transferDeposit(
        ExchangeData.State storage S,
        address from,
        address tokenAddress,
        uint    amount,
        bytes   memory auxiliaryData
        )
        private
        returns (uint amountDeposited, uint tokenIndex, uint fee)
    {
        uint depositValueETH = 0;
        if (S.depositContract.isETH(tokenAddress)) {
            depositValueETH = amount;
            fee = msg.value.sub(amount);
        } else {
            fee = msg.value;
        }

        // Transfer the tokens to the deposit contract (excluding the ETH fee)
        (amountDeposited, tokenIndex) = S.depositContract.deposit{value: depositValueETH}(from, tokenAddress, amount, auxiliaryData);
    }
}
