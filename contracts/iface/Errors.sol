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
pragma solidity 0.4.24;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";


/// @title Errors
contract Errors {
    string constant ZERO_VALUE            = "ZERO_VALUE";
    string constant ZERO_ADDRESS          = "ZERO_ADDRESS";
    string constant INVALID_VALUE         = "INVALID_VALUE";
    string constant INVALID_ADDRESS       = "INVALID_ADDRESS";
    string constant INVALID_SIZE          = "INVALID_SIZE";
    string constant INVALID_SIG           = "INVALID_SIG";
    string constant INVALID_STATE         = "INVALID_STATE";
    string constant NOT_FOUND             = "NOT_FOUND";
    string constant ALREADY_EXIST         = "ALREADY_EXIST";
    string constant REENTRY               = "REENTRY";
    string constant UNAUTHORIZED          = "UNAUTHORIZED";
    string constant UNIMPLEMENTED         = "UNIMPLEMENTED";
    string constant TRANSFER_FAILURE      = "TRANSFER_FAILURE";
    string constant WITHDRAWAL_FAILURE    = "WITHDRAWAL_FAILURE";
    string constant BURN_FAILURE          = "BURN_FAILURE";
    string constant BURN_RATE_FROZEN      = "BURN_RATE_FROZEN";
    string constant BURN_RATE_MINIMIZED   = "BURN_RATE_MINIMIZED";
}
