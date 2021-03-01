// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../lib/ERC20.sol";
import "../../../lib/ERC20SafeTransfer.sol";
import "../../../lib/MathUint.sol";
import "../../iface/ExchangeData.sol";
import "./ExchangeMode.sol";


/// @title ExchangeAdmins.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeAdmins
{
    using ERC20SafeTransfer for address;
    using ExchangeMode      for ExchangeData.State;
    using MathUint          for uint;

    event MaxAgeDepositUntilWithdrawableChanged(
        address indexed exchangeAddr,
        uint32          oldValue,
        uint32          newValue
    );

    function setMaxAgeDepositUntilWithdrawable(
        ExchangeData.State storage S,
        uint32 newValue
        )
        public
        returns (uint32 oldValue)
    {
        require(!S.isInWithdrawalMode(), "INVALID_MODE");
        require(
            newValue > 0 &&
            newValue <= ExchangeData.MAX_AGE_DEPOSIT_UNTIL_WITHDRAWABLE_UPPERBOUND,
            "INVALID_VALUE"
        );
        oldValue = S.maxAgeDepositUntilWithdrawable;
        S.maxAgeDepositUntilWithdrawable = newValue;

        emit MaxAgeDepositUntilWithdrawableChanged(
            address(this),
            oldValue,
            newValue
        );
    }

    function withdrawExchangeStake(
        ExchangeData.State storage S,
        address recipient
        )
        public
        returns (uint)
    {
        // Exchange needs to be shutdown
        require(S.isShutdown(), "EXCHANGE_NOT_SHUTDOWN");
        require(!S.isInWithdrawalMode(), "CANNOT_BE_IN_WITHDRAWAL_MODE");

        // Need to remain in shutdown for some time
        require(block.timestamp >= S.shutdownModeStartTime + ExchangeData.MIN_TIME_IN_SHUTDOWN, "TOO_EARLY");

        // Withdraw the complete stake
        uint amount = S.loopring.getExchangeStake(address(this));
        return S.loopring.withdrawExchangeStake(recipient, amount);
    }
}
