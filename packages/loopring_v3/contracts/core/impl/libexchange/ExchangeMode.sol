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
    using MathUint      for uint;
    using ExchangeMode  for ExchangeData.State;

    event WithdrawalModeActivated(
        uint timestamp
    );

    event Shutdown(
        uint timestamp
    );

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

    function shutdown(
        ExchangeData.State storage S
        )
        external
        returns (bool success)
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(!S.isShutdown(), "ALREADY_SHUTDOWN");
        S.shutdownModeStartTime = block.timestamp;
        emit Shutdown(S.shutdownModeStartTime);
        return true;
    }

    function notifyForcedRequestTooOld(
        ExchangeData.State storage S,
        uint32 accountID,
        uint16 tokenID
        )
        external
    {
        ExchangeData.ForcedWithdrawal storage withdrawal = S.pendingForcedWithdrawals[accountID][tokenID];
        require(withdrawal.timestamp != 0, "WITHDRAWAL_NOT_TOO_OLD");

        // Check if the withdrawal has indeed exceeded the time limit
        require(block.timestamp >= withdrawal.timestamp + ExchangeData.MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE, "WITHDRAWAL_NOT_TOO_OLD");

        // Enter withdrawal mode
        S.withdrawalModeStartTime = block.timestamp;

        emit WithdrawalModeActivated(S.withdrawalModeStartTime);
    }
}
