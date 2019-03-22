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
pragma solidity 0.5.2;


/// @title Errors
contract Errors
{
    string constant ZERO_VALUE                         = "ZERO_VALUE";
    string constant ZERO_ADDRESS                       = "ZERO_ADDRESS";

    string constant INVALID_VALUE                      = "INVALID_VALUE";
    string constant INVALID_ADDRESS                    = "INVALID_ADDRESS";
    string constant INVALID_SIZE                       = "INVALID_SIZE";
    string constant INVALID_STATE                      = "INVALID_STATE";
    string constant INVALID_TOKEN_ID                   = "INVALID_TOKEN_ID";
    string constant INVALID_PROOF                      = "INVALID_PROOF";

    string constant NOT_FOUND                          = "NOT_FOUND";
    string constant ALREADY_EXIST                      = "ALREADY_EXIST";
    string constant REENTRY                            = "REENTRY";
    string constant UNAUTHORIZED                       = "UNAUTHORIZED";
    string constant UNIMPLEMENTED                      = "UNIMPLEMENTED";
    string constant UNSUPPORTED                        = "UNSUPPORTED";
    string constant TRANSFER_FAILURE                   = "TRANSFER_FAILURE";
    string constant WITHDRAWAL_FAILURE                 = "WITHDRAWAL_FAILURE";
    string constant BURN_FAILURE                       = "BURN_FAILURE";
    string constant BURN_RATE_FROZEN                   = "BURN_RATE_FROZEN";
    string constant BURN_RATE_MINIMIZED                = "BURN_RATE_MINIMIZED";
    string constant TOKEN_REGISTRY_FULL                = "TOKEN_REGISTRY_FULL";

    string constant INVALID_TIMESTAMP                  = "INVALID_TIMESTAMP";
    string constant INVALID_MERKLE_ROOT                = "INVALID_MERKLE_ROOT";
    string constant INVALID_MERKLE_TREE_DATA           = "INVALID_MERKLE_TREE_DATA";
    string constant INVALID_BLOCK_STATE                = "INVALID_BLOCK_STATE";
    string constant INVALID_ACCOUNT_ID                 = "INVALID_ACCOUNT_ID";
    string constant INVALID_WALLET_ID                  = "INVALID_WALLET_ID";
    string constant INVALID_STATE_ID                   = "INVALID_STATE_ID";
    string constant INVALID_OPERATOR_ID                = "INVALID_OPERATOR_ID";
    string constant INVALID_SLOT_IDX                   = "INVALID_SLOT_IDX";
    string constant INVALID_BLOCK_IDX                  = "INVALID_BLOCK_IDX";

    string constant TOO_MANY_ACCOUNTS                  = "TOO_MANY_ACCOUNTS";
    string constant TOO_MANY_WALLETS                   = "TOO_MANY_WALLETS";
    string constant TOO_MANY_OPERATORS                 = "TOO_MANY_OPERATORS";
    string constant TOO_MANY_ACTIVE_OPERATORS          = "TOO_MANY_ACTIVE_OPERATORS";
    string constant TOO_EARLY_TO_WITHDRAW              = "TOO_EARLY_TO_WITHDRAW";
    string constant TOO_LARGE_AMOUNT                   = "TOO_LARGE_AMOUNT";
    string constant TOO_LATE_PROOF                     = "TOO_LATE_PROOF";

    string constant PREV_BLOCK_NOT_FINALIZED           = "PREV_BLOCK_NOT_FINALIZED";
    string constant BLOCK_NOT_FINALIZED                = "BLOCK_NOT_FINALIZED";
    string constant NOT_IN_WITHDRAW_MODE               = "NOT_IN_WITHDRAW_MODE";
    string constant IN_WITHDRAW_MODE                   = "IN_WITHDRAW_MODE";

    string constant BLOCK_HAS_NO_OPERATOR_FEE          = "BLOCK_HAS_NO_OPERATOR_FEE";

    string constant BLOCK_COMMITTED_ALREADY            = "BLOCK_COMMITTED_ALREADY";
    string constant BLOCK_VERIFIED_ALREADY             = "BLOCK_VERIFIED_ALREADY";
    string constant OPERATOR_UNREGISTERED_ALREADY      = "OPERATOR_UNREGISTERED_ALREADY";
    string constant WITHDRAWN_ALREADY                  = "WITHDRAWN_ALREADY";
    string constant FEE_WITHDRAWN_ALREADY              = "FEE_WITHDRAWN_ALREADY";
    string constant OPERATOR_STILL_REGISTERED          = "OPERATOR_STILL_REGISTERED";

    string constant CANNOT_COMMIT_BLOCK_YET            = "CANNOT_COMMIT_BLOCK_YET";
    string constant BLOCK_COMMIT_FORCED                = "BLOCK_COMMIT_FORCED";
    string constant BLOCK_FULL                         = "BLOCK_FULL";
    string constant INSUFFICIENT_FUND                  = "INSUFFICIENT_FUND";
    string constant INVALID_WALLET_ID_CHANGE           = "INVALID_WALLET_ID_CHANGE";
    string constant NO_ACTIVE_OPERATORS                = "NO_ACTIVE_OPERATORS";

}
