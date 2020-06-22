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
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../lib/ERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";

import "../../iface/ExchangeData.sol";
import "./ExchangeMode.sol";


/// @title ExchangeAdmins.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeAdmins
{
    using MathUint          for uint;
    using ERC20SafeTransfer for address;
    using ExchangeMode      for ExchangeData.State;

    event OperatorChanged(
        uint    indexed exchangeId,
        address         oldOperator,
        address         newOperator
    );

    event FeesUpdated(
        uint    indexed exchangeId,
        uint            accountCreationFeeETH,
        uint            accountUpdateFeeETH,
        uint            depositFeeETH,
        uint            withdrawalFeeETH
    );

    function setOperator(
        ExchangeData.State storage S,
        address payable _operator
        )
        external
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
        uint _accountCreationFeeETH,
        uint _accountUpdateFeeETH,
        uint _depositFeeETH,
        uint _withdrawalFeeETH
        )
        external
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(
            _withdrawalFeeETH <= S.loopring.maxWithdrawalFee(),
            "AMOUNT_TOO_LARGE"
        );

        S.accountCreationFeeETH = _accountCreationFeeETH;
        S.accountUpdateFeeETH = _accountUpdateFeeETH;
        S.depositFeeETH = _depositFeeETH;
        S.withdrawalFeeETH = _withdrawalFeeETH;

        emit FeesUpdated(
            S.id,
            _accountCreationFeeETH,
            _accountUpdateFeeETH,
            _depositFeeETH,
            _withdrawalFeeETH
        );
    }

    function withdrawExchangeStake(
        ExchangeData.State storage S,
        address recipient
        )
        external
        returns (uint)
    {
        // Exchange needs to be shutdown
        require(S.isShutdown(), "EXCHANGE_NOT_SHUTDOWN");
        require(!S.isInWithdrawalMode(), "CANNOT_BE_IN_WITHDRAWAL_MODE");

        // Need to remain in shutdown for some time
        require(now >= S.shutdownStartTime + ExchangeData.MIN_TIME_IN_SHUTDOWN(), "NOT_LONG_ENOUGH_IN_SHUTDOWN");

        // Withdraw the complete stake
        uint amount = S.loopring.getExchangeStake(S.id);
        return S.loopring.withdrawExchangeStake(S.id, recipient, amount);
    }
}
