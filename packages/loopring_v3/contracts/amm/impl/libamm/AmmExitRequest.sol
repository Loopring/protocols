// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../AmmData.sol";
import "../../../lib/EIP712.sol";
import "../../../lib/ERC20SafeTransfer.sol";
import "../../../lib/MathUint.sol";
import "../../../lib/MathUint96.sol";
import "../../../thirdparty/SafeCast.sol";
// import "../../../core/impl/libtransactions/AmmUpdateTransaction.sol";
// import "../../../core/impl/libtransactions/DepositTransaction.sol";
// import "../../../core/impl/libtransactions/WithdrawTransaction.sol";

/// @title AmmExitRequest
library AmmExitRequest
{
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;

    event LockedUntil(
        address  owner,
        uint     timestamp
    );

    function setLockedUntil(
        AmmData.State storage S,
        uint                  timestamp
        )
        external
    {
        // TODO
        // if (timestamp > 0) {
        //     require(timestamp >= block.timestamp + AmmData.MIN_TIME_TO_UNLOCK(), "TOO_SOON");
        // }
        S.lockedUntil[msg.sender] = timestamp;

        emit LockedUntil(msg.sender, timestamp);
    }
}
