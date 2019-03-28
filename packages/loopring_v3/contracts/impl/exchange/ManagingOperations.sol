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
        uint _withdrawalFeeETH,
        uint _suspensionFeePerDayLRC
        )
        external
        onlyOperator
    {
        require(_withdrawalFeeETH <= loopring.maxWithdrawalFee(), "TOO_LARGE_AMOUNT");

        accountCreationFeeETH = _accountCreationFeeETH;
        accountUpdateFeeETH = _accountUpdateFeeETH;
        depositFeeETH = _depositFeeETH;
        withdrawalFeeETH = _withdrawalFeeETH;
        suspensionFeePerDayLRC = _suspensionFeePerDayLRC;

        emit FeesUpdated(
            accountCreationFeeETH,
            accountUpdateFeeETH,
            depositFeeETH,
            withdrawalFeeETH,
            suspensionFeePerDayLRC
        );
    }

    function getFees()
        external
        view
        returns (
            uint _accountCreationFeeETH,
            uint _accountUpdateFeeETH,
            uint _depositFeeETH,
            uint _withdrawalFeeETH,
            uint _suspensionFeePerDayLRC
        )
    {
        _accountCreationFeeETH = accountCreationFeeETH;
        _accountUpdateFeeETH = accountUpdateFeeETH;
        _depositFeeETH = depositFeeETH;
        _withdrawalFeeETH = withdrawalFeeETH;
        _suspensionFeePerDayLRC = suspensionFeePerDayLRC;
    }

    function suspendExchange()
        external
        onlyOperator
    {
        require(isInNormalMode(), "INVALID_MODE");
        suspendedSince = now;
    }

    function resumeExchange()
        external
        returns (uint burnedLRC)
        onlyOperator
    {
        require(isInSuspensionMode(), "INVALID_MODE");
        uint requiredLRCToBurn = (now - suspendedSince).mul(suspensionFeePerDayLRC) / (1 days);

        if (requiredLRCToBurn > 0) {
            require(requiredLRCToBurn <= loopring.getStake(id), "INSUFFCIENT_LRC_STAKE");
            burnedLRC = loopring.burnStake(id, requiredLRCToBurn);
        }
        suspendedSince = 0;
    }

    function getAdditionLRCRequiredToResumeExchange()
        external
        returns (uint amount)
    {
        require(isInSuspensionMode(), "INVALID_MODE");
        uint requiredLRCToBurn = (now + (5 minutes)- suspendedSince)
            .mul(suspensionFeePerDayLRC) / (1 days);

        uint stakedLRC = loopring.getStake(id);

        if (requiredLRCToBurn > stakedLRC) {
            amount = requiredLRCToBurn - stakedLRC;
        }
    }
}