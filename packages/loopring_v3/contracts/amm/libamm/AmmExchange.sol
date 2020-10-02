// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../aux/transactions/TransactionReader.sol";
import "../../core/impl/libtransactions/TransferTransaction.sol";
import "../../lib/EIP712.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/MathUint96.sol";
import "../../thirdparty/SafeCast.sol";
import "./AmmData.sol";
import "./AmmJoinRequest.sol";
import "./AmmPoolToken.sol";
import "./AmmStatus.sol";
import "./AmmUtil.sol";


/// @title AmmExchange
library AmmExchange
{
    using AmmPoolToken      for AmmData.State;
    using AmmStatus         for AmmData.State;
    using AmmUtil           for uint96;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;
    using TransactionReader for ExchangeData.Block;

    // Withdraw any outstanding balances for the pool account on the exchange
    function withdrawFromApprovedWithdrawals(
        AmmData.State storage S,
        bool                  onlyWithdrawPoolToken
        )
        internal
    {
        uint size = onlyWithdrawPoolToken? 1 : S.tokens.length;
        address[] memory owners = new address[](size);
        address[] memory tokens = new address[](size);

        if (onlyWithdrawPoolToken) {
            owners[0] = address(this);
            tokens[0] = address(this);
        } else {
            for (uint i = 0; i < size; i++) {
                owners[i] = address(this);
                tokens[i] = S.tokens[i].addr;
            }
        }
        S.exchange.withdrawFromApprovedWithdrawals(owners, tokens);
    }
}
