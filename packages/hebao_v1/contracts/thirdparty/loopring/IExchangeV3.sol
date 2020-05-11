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
pragma solidity ^0.6.6;


/// @title IExchangeV3
/// @dev This is a partial interface form Loopring3.0's IExchangeV3.sol
///
/// @author Daniel Wang  - <daniel@loopring.org>
interface IExchangeV3
{
    function isInWithdrawalMode()
        external
        view
        returns (bool);

    function isShutdown()
        external
        view
        returns (bool);

    function isInMaintenance()
        external
        view
        returns (bool);

    function getAccount(
        address owner
        )
        external
        view
        returns (
            uint24 accountID,
            uint   pubKeyX,
            uint   pubKeyY
        );

    function createOrUpdateAccount(
        uint  pubKeyX,
        uint  pubKeyY,
        bytes calldata permission
        )
        external
        payable
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        );

    function updateAccountAndDeposit(
        uint    pubKeyX,
        uint    pubKeyY,
        address tokenAddress,
        uint96  amount,
        bytes   calldata permission
        )
        external
        payable
        returns (
            uint24 accountID,
            bool   isAccountNew,
            bool   isAccountUpdated
        );

    function deposit(
        address tokenAddress,
        uint96  amount
        )
        external
        payable;

    function withdraw(
        address tokenAddress,
        uint96  amount
        )
        external
        payable;

    function getFees()
        external
        view
        returns (
            uint _accountCreationFeeETH,
            uint _accountUpdateFeeETH,
            uint _depositFeeETH,
            uint _withdrawalFeeETH
        );

    function getRequestStats()
        external
        view
        returns (
            uint numDepositRequestsProcessed,
            uint numAvailableDepositSlots,
            uint numWithdrawalRequestsProcessed,
            uint numAvailableWithdrawalSlots
        );
}