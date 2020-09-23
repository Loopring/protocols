// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../AmmData.sol";


/// @title LPToken
library AmmStatus
{
      function isOnline(AmmData.State storage S)
        public
        view
        returns (bool)
    {
        return S.shutdownTimestamp == 0;
    }
}
