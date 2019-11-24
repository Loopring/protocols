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

import "../security/SecurityModule.sol";


/// @title LoopringModule
contract LoopringModule is SecurityModule
{
    bytes4 internal constant LOOPRING_UPDATE_ACCOUNT_AND_DEPOSIT = bytes4(
        keccak256("updateAccountAndDeposit(uint256,uint256,address,uint96,bytes)")
    );

    bytes4 internal constant LOOPRING_DEPOSIT = bytes4(keccak256("deposit(address,uint96)"));
    bytes4 internal constant LOOPRING_WITHDRAW = bytes4(keccak256("withdraw(address,uint96)"));
    bytes4 internal constant LOOPRING_GET_DEPOSIT_SLOTS = bytes4(keccak256("getNumAvailableDepositSlots()"));
    bytes4 internal constant LOOPRING_GET_WITHDRAWAL_SLOTS = bytes4(keccak256("getNumAvailableWithdrawalSlots()"));
}
