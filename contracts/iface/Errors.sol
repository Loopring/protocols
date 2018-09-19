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
  string REENTRY                    = "REENTRY";
  string EMPTY_ADDRESS              = "EMPTY_ADDRESS";
  string ZERO_TOKEN_AMOUNT          = "ZERO_TOKEN_AMOUNT";
  string UNAUTHORIZED               = "UNAUTHORIZED";
  string UNIMPLEMENTED              = "UNIMPLEMENTED";
  string INVALID_VALUE              = "INVALID_VALUE";
  string INVALID_ADDRESS            = "INVALID_ADDRESS";
  string INVALID_STATE              = "INVALID_STATE";
  string INVALID_SIG                = "INVALID_SIG";
  string INVALID_SIZE               = "INVALID_SIZE";
  string INVALID_TOKEN_AMOUNT       = "INVALID_TOKEN_AMOUNT";
  string INVALID_INTERCEPTOR        = "INVALID_INTERCEPTOR";
  string INVALID_BROKER             = "INVALID_BROKER";
  string NOT_FOUND                  = "NOT_FOUND";
  string ALREADY_REGISTERED         = "ALREADY_REGISTERED";
  string TRANSFER_FAILURE           = "TRANSFER_FAILURE";
  string WITHDRAWAL_FAILURE         = "WITHDRAWAL_FAILURE";
  string BURN_FAILURE               = "BURN_FAILURE";
  string BURN_RATE_FROZEN           = "BURN_RATE_FROZEN";
  string BURN_RATE_MINIMIZED        = "BURN_RATE_MINIMIZED";
}
