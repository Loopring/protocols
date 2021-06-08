// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/ERC20.sol";
import "../../lib/MathUint.sol";
import "../../lib/TransferUtil.sol";
import "./AmmData.sol";


/// @title AmmAssetManagement
library AmmAssetManagement
{
    using TransferUtil      for address;

    function deposit(
        AmmData.State storage S,
        address               token,
        uint96                amount
        )
        public
    {
        if (amount == 0) {
            return;
        }
        uint ethValue = 0;
        if (token == address(0)) {
            ethValue = amount;
        } else {
            ERC20(token).approve(address(S.exchange.getDepositContract()), amount);
        }
        S.exchange.deposit{value: ethValue}(
            address(this),
            address(this),
            token,
            amount,
            new bytes(0)
        );
    }

    function transferOut(
        AmmData.State storage /*S*/,
        address               to,
        address               token,
        uint                  amount
        )
        public
    {
        token.transferOut(to, amount);
    }
}
