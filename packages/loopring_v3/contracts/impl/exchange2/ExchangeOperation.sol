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

import "../../lib/BurnableERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/NoDefaultFunc.sol";

import "./ExchangeData.sol";
import "./ExchangeMode.sol";

import "../../iface/ILoopringV3.sol";


/// @title ExchangeAccounts.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeOperations
{
    using MathUint          for uint;
    using ERC20SafeTransfer for address;
    using ExchangeMode      for ExchangeData.State;

    event OperatorChanged(
        uint exchangeId,
        address oldOperator,
        address newOperator
    );

    event FeesUpdated(
        uint accountCreationFeeETH,
        uint accountUpdateFeeETH,
        uint depositFeeETH,
        uint withdrawalFeeETH
    );

    function setOperator(
        ExchangeData.State storage S,
        address payable _operator
        )
        public
        returns (address payable oldOperator)
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(address(0) != _operator, "ZERO_ADDRESS");
        oldOperator = S.operator;
        S.operator = _operator;

        emit OperatorChanged(
            S.id,
            oldOperator,
            _operator
        );
    }

    function setFees(
        ExchangeData.State storage S,
        ILoopringV3 loopring,
        uint _accountCreationFeeETH,
        uint _accountUpdateFeeETH,
        uint _depositFeeETH,
        uint _withdrawalFeeETH
        )
        public
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(_withdrawalFeeETH <= loopring.maxWithdrawalFee(), "TOO_LARGE_AMOUNT");

        S.accountCreationFeeETH = _accountCreationFeeETH;
        S.accountUpdateFeeETH = _accountUpdateFeeETH;
        S.depositFeeETH = _depositFeeETH;
        S.withdrawalFeeETH = _withdrawalFeeETH;

        emit FeesUpdated(
            _accountCreationFeeETH,
            _accountUpdateFeeETH,
            _depositFeeETH,
            _withdrawalFeeETH
        );
    }

    function getFees(
        ExchangeData.State storage S
        )
        public
        view
        returns (
            uint _accountCreationFeeETH,
            uint _accountUpdateFeeETH,
            uint _depositFeeETH,
            uint _withdrawalFeeETH
        )
    {
        _accountCreationFeeETH = S.accountCreationFeeETH;
        _accountUpdateFeeETH = S.accountUpdateFeeETH;
        _depositFeeETH = S.depositFeeETH;
        _withdrawalFeeETH = S.withdrawalFeeETH;
    }

    function purchaseDowntime(
        ExchangeData.State storage S,
        ILoopringV3 loopring,
        uint durationSeconds
        )
        public
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");

        uint costLRC = getDowntimeCostLRC(S, loopring, durationSeconds);
        if (costLRC > 0) {
            require(
                BurnableERC20(S.lrcAddress).burnFrom(msg.sender, costLRC),
                "BURN_FAILURE"
            );
        }

        if (now < S.disableUserRequestsUntil) {
            S.disableUserRequestsUntil = now;
        }
        S.disableUserRequestsUntil += durationSeconds;
    }

    function getRemainingDowntime(
        ExchangeData.State storage S
        )
        public
        view
        returns (uint duration)
    {
        if (now <= S.disableUserRequestsUntil || S.isInWithdrawalMode()) {
            duration = 0;
        } else {
            duration = S.disableUserRequestsUntil - now;
        }
    }

    function getDowntimeCostLRC(
        ExchangeData.State storage S,
        ILoopringV3 loopring,
        uint durationSeconds
        )
        public
        view
        returns (uint)
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        return durationSeconds.mul(loopring.downtimePriceLRCPerDay()) / (1 days);
    }
}