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
        uint _accountCreationFeeETH,
        uint _accountUpdateFeeETH,
        uint _depositFeeETH,
        uint _withdrawalFeeETH
        )
        external
        onlyOperator
    {
        require(_withdrawalFeeETH <= loopring.maxWithdrawalFee(), "TOO_LARGE_AMOUNT");

        accountCreationFeeETH = _accountCreationFeeETH;
        accountUpdateFeeETH = _accountUpdateFeeETH;
        depositFeeETH = _depositFeeETH;
        withdrawalFeeETH = _withdrawalFeeETH;

        emit FeesUpdated(
            accountCreationFeeETH,
            accountUpdateFeeETH,
            depositFeeETH,
            withdrawalFeeETH
        );
    }

    function getFees()
        external
        view
        returns (
            uint _accountCreationFeeETH,
            uint _accountUpdateFeeETH,
            uint _depositFeeETH,
            uint _withdrawalFeeETH
        )
    {
        _accountCreationFeeETH = accountCreationFeeETH;
        _accountUpdateFeeETH = accountUpdateFeeETH;
        _depositFeeETH = depositFeeETH;
        _withdrawalFeeETH = withdrawalFeeETH;
    }

    function purchaseDowntime(
        uint durationSeconds
        )
        external
        onlyOperator
    {
        require(!isInWithdrawalMode(), "INVALID_MODE");

        uint costLRC = getDowntimeCostLRC(durationSeconds);
        if (costLRC > 0) {
           require(
                BurnableERC20(lrcAddress).burnFrom(msg.sender, costLRC),
                "BURN_FAILURE"
            );
        }

        if (now < disableUserRequestsUntil) {
            disableUserRequestsUntil = now;
        }
        disableUserRequestsUntil += durationSeconds;
    }

    function getRemainingDowntime()
        public
        view
        returns (uint duration)
    {
        if (now <= disableUserRequestsUntil) {
            duration = 0;
        } else {
            duration = disableUserRequestsUntil - now;
        }
    }

    function getDowntimeCostLRC(
        uint durationSeconds
        )
        public
        view
        returns (uint)
    {
        require(!isInWithdrawalMode(), "INVALID_MODE");
        return durationSeconds.mul(loopring.downtimePriceLRCPerDay()) / (1 days);
    }
}