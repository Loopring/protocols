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
pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "../../lib/MathUint.sol";

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
        result = false;
        // Check if there's a deposit request that's too old
        if (S.numDepositRequestsCommitted < S.depositChain.length) {
            uint32 requestTimestamp = S.depositChain[S.numDepositRequestsCommitted].timestamp;
            result = requestTimestamp < now.sub(ExchangeData.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE());
        }

        // Check if there's a withdrawal request that's too old
        if (result == false && S.numWithdrawalRequestsCommitted < S.withdrawalChain.length) {
            uint32 requestTimestamp = S.withdrawalChain[S.numWithdrawalRequestsCommitted].timestamp;
            result = requestTimestamp < now.sub(ExchangeData.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE());
        }

        // Check if we're longer in a non-initial state while shutdown than allowed
        if (result == false && isShutdown(S) && !isInInitialState(S)) {
            // The max amount of time an exchange can be in shutdown is
            // MAX_TIME_IN_SHUTDOWN_BASE + (accounts.length * MAX_TIME_IN_SHUTDOWN_DELTA)
            uint maxTimeInShutdown = ExchangeData.MAX_TIME_IN_SHUTDOWN_BASE();
            maxTimeInShutdown = maxTimeInShutdown.add(S.accounts.length.mul(ExchangeData.MAX_TIME_IN_SHUTDOWN_DELTA()));
            result = now > S.shutdownStartTime.add(maxTimeInShutdown);
        }
    }

    function isShutdown(
        ExchangeData.State storage S
        )
        internal // inline call
        view
        returns (bool)
    {
        return S.shutdownStartTime > 0;
    }

    function isInMaintenance(
        ExchangeData.State storage S
        )
        internal // inline call
        view
        returns (bool)
    {
        return S.downtimeStart != 0 && getNumDowntimeMinutesLeft(S) > 0;
    }

    function isInInitialState(
        ExchangeData.State storage S
        )
        internal // inline call
        view
        returns (bool)
    {
        return (S.numDepositRequestsCommitted == S.depositChain.length) &&
            (S.merkleRoot == S.genesisMerkleRoot);
    }

    function areUserRequestsEnabled(
        ExchangeData.State storage S
        )
        internal // inline call
        view
        returns (bool)
    {
        // User requests are possible when the exchange is not in maintenance mode,
        // the exchange hasn't been shutdown, and the exchange isn't in withdrawal mode
        return !isInMaintenance(S) && !isShutdown(S) && !isInWithdrawalMode(S);
    }

    function getNumDowntimeMinutesLeft(
        ExchangeData.State storage S
        )
        internal // inline call
        view
        returns (uint)
    {
        if (S.downtimeStart == 0) {
            return S.numDowntimeMinutes;
        } else {
            // Calculate how long (in minutes) the exchange is in maintenance
            uint numDowntimeMinutesUsed = now.sub(S.downtimeStart) / 60;
            if (S.numDowntimeMinutes > numDowntimeMinutesUsed) {
                return S.numDowntimeMinutes.sub(numDowntimeMinutesUsed);
            } else {
                return 0;
            }
        }
    }
}
