// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../lib/MathUint.sol";
import "../../iface/ExchangeData.sol";


/// @title ExchangeMode.
/// @dev All methods in this lib are internal, therefore, there is no need
///      to deploy this library independently.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
library ExchangeMode
{
    using MathUint  for uint;

    function isInWithdrawalMode(
        ExchangeData.State storage S
        )
        internal // inline call
        view
        returns (bool result)
    {
        result = S.withdrawalModeStartTime > 0;
    }

    function isShutdown(
        ExchangeData.State storage S
        )
        internal // inline call
        view
        returns (bool)
    {
        return S.shutdownModeStartTime > 0;
    }

    function getNumAvailableForcedSlots(
        ExchangeData.State storage S
        )
        internal
        view
        returns (uint)
    {
        return ExchangeData.MAX_OPEN_FORCED_REQUESTS - S.numPendingForcedTransactions;
    }
}
