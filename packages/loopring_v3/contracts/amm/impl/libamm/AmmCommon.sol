// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;


/// @title LPToken
library AmmCommon
{
    function isAlmostEqual(
        uint96 amount,
        uint96 targetAmount
        )
        public
        pure
        returns (bool)
    {
        if (targetAmount == 0) {
            return amount == 0;
        } else {
            // Max rounding error for a float24 is 2/100000
            uint ratio = (amount * 100000) / targetAmount;
            return (100000 - 2) <= ratio && ratio <= (100000 + 2);
        }
    }
}
