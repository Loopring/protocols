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

import "../../lib/MathUint.sol";

import "./ExchangeData.sol";
import "./ExchangeMaintenance.sol";
import "./ExchangeModules.sol";


/// @title ExchangeStatus.
/// @dev All methods in this lib are internal, therefore, there is no need
///      to deploy this library independently.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
library ExchangeStatus
{
    using ExchangeMaintenance   for ExchangeData.State;
    using ExchangeModules       for ExchangeData.State;
    using MathUint              for uint;

    function isInWithdrawalMode(
        ExchangeData.State storage S
        )
        internal // inline call
        returns (bool result)
    {
        result = S.inWithdrawalMode;

        if (result == false) {
            // Check if we need to go into withdrawal mode for any module.
            (bool needsWithdrawalMode, ) = S.getAggregatedModulesStatus();
            result = result || needsWithdrawalMode;
        }

        // Check if there's an unfinalized block that's too old
        if (result == false) {
            result = isAnyUnfinalizedBlockTooOld(S);
        }

        // Check if we're longer in a non-initial state while shutdown than allowed
        if (result == false && isShutdown(S) && !isInInitialState(S)) {
            // The max amount of time an exchange can be in shutdown is
            // MAX_TIME_IN_SHUTDOWN_BASE + (accounts.length * MAX_TIME_IN_SHUTDOWN_DELTA)
            uint maxTimeInShutdown = ExchangeData.MAX_TIME_IN_SHUTDOWN_BASE();
            maxTimeInShutdown = maxTimeInShutdown.add(S.accounts.length.mul(ExchangeData.MAX_TIME_IN_SHUTDOWN_DELTA()));
            result = now > S.shutdownStartTime.add(maxTimeInShutdown);
        }

        if (result) {
            S.inWithdrawalMode = true;
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
        return S.downtimeStart != 0 && S.getNumDowntimeMinutesLeft() > 0;
    }

    function isInInitialState(
        ExchangeData.State storage S
        )
        internal // inline call
        view
        returns (bool)
    {
        // Check all modules if there are any open requests
        (, bool openRequests) = S.getAggregatedModulesStatus();

        ExchangeData.Block storage firstBlock = S.blocks[0];
        ExchangeData.Block storage lastBlock = S.blocks[S.blocks.length - 1];
        return (S.blocks.length == S.numBlocksFinalized) &&
            !openRequests &&
            (lastBlock.merkleRoot == firstBlock.merkleRoot);
    }

    function areUserRequestsEnabled(
        ExchangeData.State storage S
        )
        internal // inline call
        returns (bool)
    {
        // User requests are possible when the exchange is not in maintenance mode,
        // the exchange hasn't been shutdown, and the exchange isn't in withdrawal mode
        return !isInMaintenance(S) && !isShutdown(S) && !isInWithdrawalMode(S);
    }

    function isAnyUnfinalizedBlockTooOld(
        ExchangeData.State storage S
        )
        internal // inline call
        view
        returns (bool)
    {
        if (S.numBlocksFinalized < S.blocks.length) {
            uint32 blockTimestamp = S.blocks[S.numBlocksFinalized].timestamp;
            return blockTimestamp < now.sub(ExchangeData.MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE());
        } else {
            return false;
        }
    }
}
