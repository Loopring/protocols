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
pragma solidity 0.5.7;

import "../../lib/BurnableERC20.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/NoDefaultFunc.sol";

import "./ExchangeData.sol";
import "./ExchangeMode.sol";


/// @title ExchangeAccounts.
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
        uint _accountCreationFeeETH,
        uint _accountUpdateFeeETH,
        uint _depositFeeETH,
        uint _withdrawalFeeETH
        )
        public
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

    function purchaseDowntime(
        ExchangeData.State storage S,
        uint durationSeconds
        )
        public
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(!S.isShutdown(), "INVALID_MODE");

        uint costLRC = getDowntimeCostLRC(S, durationSeconds);
        if (costLRC > 0) {
            require(
                BurnableERC20(S.lrcAddress).burnFrom(msg.sender, costLRC),
                "BURN_FAILURE"
            );
        }

        if (now > S.disableUserRequestsUntil) {
            S.disableUserRequestsUntil = now;
        }
        S.disableUserRequestsUntil = S.disableUserRequestsUntil.add(durationSeconds);
    }

    function getRemainingDowntime(
        ExchangeData.State storage S
        )
        public
        view
        returns (uint duration)
    {
        if (S.disableUserRequestsUntil == 0 || now >= S.disableUserRequestsUntil || S.isInWithdrawalMode()) {
            duration = 0;
        } else {
            duration = S.disableUserRequestsUntil - now;
        }
    }

    function getDowntimeCostLRC(
        ExchangeData.State storage S,
        uint durationSeconds
        )
        public
        view
        returns (uint)
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        return durationSeconds
            .mul(S.loopring
            .downtimePriceLRCPerDay()) / (1 days);
    }

    function withdrawStake(
        ExchangeData.State storage S,
        address recipient
        )
        public
        returns (uint)
    {
        ExchangeData.Block storage lastBlock = S.blocks[S.blocks.length - 1];

        // Exchange needs to be shutdown
        require(S.isShutdown(), "EXCHANGE_NOT_SHUTDOWN");
        // Last block needs to be finalized
        require(lastBlock.state == ExchangeData.BlockState.FINALIZED, "BLOCK_NOT_FINALIZED");
        // We also require that all deposit requests are processed
        require(lastBlock.numDepositRequestsCommitted == S.depositChain.length, "DEPOSITS_NOT_PROCESSED");
        // Merkle root needs to be reset to the genesis block
        // (i.e. all balances 0 and all other state reset to default values)
        require(S.isInInitialState(), "MERKLE_ROOT_NOT_REVERTED");

        // Another requirement is that te last block needs to be committed
        // longer than MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS so the exchange can still be fined for not
        // automatically distributing the withdrawals (the fine is paid from the stake)
        require(
            now > lastBlock.timestamp + ExchangeData.MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS(),
            "TOO_EARLY"
        );

        // Withdraw the complete stake
        uint amount = S.loopring.getStake(S.id);
        return S.loopring.withdrawStakeTo(S.id, recipient, amount);
    }
}