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

import "./IManagingStakes.sol";


/// @title An Implementation of IDEX.
/// @author Daniel Wang  - <daniel@loopring.org>
contract IManagingOperations is IManagingStakes
{
    function setOperator(
        address payable _operator
        )
        external
        returns (
            address payable oldOperator
        );

    function setFees(
        uint _accountCreationFeeETH,
        uint _accountUpdateFeeETH,
        uint _depositFeeETH,
        uint _withdrawalFeeETH,
        uint _suspensionFeePerDayLRC
        )
        external;

    function getFees()
        external
        view
        returns (
            uint _accountCreationFeeETH,
            uint _accountUpdateFeeETH,
            uint _depositFeeETH,
            uint _withdrawalFeeETH,
            uint _suspensionFeePerDayLRC
        );

    function suspendExchange()
        external;

    function resumeExchange()
        external
        returns (uint burnedLRC);
}