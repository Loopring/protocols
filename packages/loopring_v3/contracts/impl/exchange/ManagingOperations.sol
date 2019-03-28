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

import "../../iface/exchange/IManagingOperations.sol";

import "./ManagingStakes.sol";

/// @title An Implementation of IManagingOperations.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ManagingOperations is IManagingOperations, ManagingStakes
{

    function setOperator(
        address payable _operator
        )
        external
        onlyOwner
        returns (address payable oldOperator)
    {
        require(address(0) != _operator, "ZERO_ADDRESS");
        oldOperator = operator;
        operator = _operator;

        emit OperatorChanged(
            id,
            oldOperator,
            operator
        );
    }

    function setFees(
        uint _accountCreationFee,
        uint _accountUpdateFee,
        uint _depositFee,
        uint _withdrawalFee
        )
        external
        onlyOperator
    {
        require(_withdrawalFee <= loopring.maxWithdrawalFee(), "TOO_LARGE_AMOUNT");

        accountCreationFee = _accountCreationFee;
        accountUpdateFee = _accountUpdateFee;
        depositFee = _depositFee;
        withdrawalFee = _withdrawalFee;

        emit FeesUpdated(
            accountCreationFee,
            accountUpdateFee,
            depositFee,
            withdrawalFee
        );
    }

    function getFees()
        external
        view
        returns (
            uint _accountCreationFee,
            uint _accountUpdateFee,
            uint _depositFee,
            uint _withdrawalFee
        )
    {
        _accountCreationFee = accountCreationFee;
        _accountUpdateFee = accountUpdateFee;
        _depositFee = depositFee;
        _withdrawalFee = withdrawalFee;
    }
}