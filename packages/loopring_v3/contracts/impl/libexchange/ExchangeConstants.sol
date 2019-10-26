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

import "./ExchangeData.sol";


/// @title ExchangeConstants
/// @author Daniel Wang  - <daniel@loopring.org>
library ExchangeConstants
{
    /// @dev Returns a list of constants used by the exchange.
    /// @return constants The list of constants in the following order:
    ///         SNARK_SCALAR_FIELD
    ///         MAX_PROOF_GENERATION_TIME_IN_SECONDS
    ///         MAX_GAP_BETWEEN_FINALIZED_AND_VERIFIED_BLOCKS
    ///         MAX_OPEN_DEPOSIT_REQUESTS
    ///         MAX_OPEN_WITHDRAWAL_REQUESTS
    ///         MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE
    ///         MAX_AGE_REQUEST_UNTIL_FORCED
    ///         MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE
    ///         MAX_TIME_IN_SHUTDOWN_BASE
    ///         MAX_TIME_IN_SHUTDOWN_DELTA
    ///         TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS
    ///         MAX_NUM_TOKENS
    ///         MAX_NUM_ACCOUNTS
    ///         MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS
    ///         MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS_SHUTDOWN_MODE
    ///         FEE_BLOCK_FINE_START_TIME
    ///         FEE_BLOCK_FINE_MAX_DURATION
    ///         MIN_GAS_TO_DISTRIBUTE_WITHDRAWALS
    ///         MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED
    ///         GAS_LIMIT_SEND_TOKENS
    function getConstants()
        external
        pure
        returns(uint[20] memory)
    {
        return [
            uint(ExchangeData.SNARK_SCALAR_FIELD()),
            uint(ExchangeData.MAX_PROOF_GENERATION_TIME_IN_SECONDS()),
            uint(ExchangeData.MAX_GAP_BETWEEN_FINALIZED_AND_VERIFIED_BLOCKS()),
            uint(ExchangeData.MAX_OPEN_DEPOSIT_REQUESTS()),
            uint(ExchangeData.MAX_OPEN_WITHDRAWAL_REQUESTS()),
            uint(ExchangeData.MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE()),
            uint(ExchangeData.MAX_AGE_REQUEST_UNTIL_FORCED()),
            uint(ExchangeData.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE()),
            uint(ExchangeData.MAX_TIME_IN_SHUTDOWN_BASE()),
            uint(ExchangeData.MAX_TIME_IN_SHUTDOWN_DELTA()),
            uint(ExchangeData.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS()),
            uint(ExchangeData.MAX_NUM_TOKENS()),
            uint(ExchangeData.MAX_NUM_ACCOUNTS()),
            uint(ExchangeData.MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS()),
            uint(ExchangeData.MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS_SHUTDOWN_MODE()),
            uint(ExchangeData.FEE_BLOCK_FINE_START_TIME()),
            uint(ExchangeData.FEE_BLOCK_FINE_MAX_DURATION()),
            uint(ExchangeData.MIN_GAS_TO_DISTRIBUTE_WITHDRAWALS()),
            uint(ExchangeData.MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED()),
            uint(ExchangeData.GAS_LIMIT_SEND_TOKENS())
        ];
    }

}
