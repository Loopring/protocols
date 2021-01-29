// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../thirdparty/chi/IChiToken.sol";


contract ChiDiscount
{
    struct ChiConfig
    {
        address gasTokenVault;
        uint    maxToBurn;
        uint    expectedGasRefund;
        uint    calldataCost;
    }

    // See:
    // - https://github.com/1inch-exchange/1inchProtocol/blob/a7781cf9aa1cc2aaa5ccab0d54ecbae1327ca08f/contracts/OneSplitAudit.sol#L343
    // - https://github.com/curvefi/curve-ren-adapter/blob/8c1fbc3fec41ebd79b06984d72ff6ace3198e62d/truffle/contracts/CurveExchangeAdapter.sol#L104
    modifier discountCHI(
        address chiToken,
        ChiConfig calldata config
        )
    {
        uint gasStart = gasleft();

        _;

        if (chiToken == address(0) || config.maxToBurn == 0) return;

        uint gasSpent = 21000 + gasStart - gasleft() + 14154;
        gasSpent += (config.calldataCost == 0) ? 16 * msg.data.length : config.calldataCost;
        uint gasRefundOffset = (config.expectedGasRefund * 2 > gasSpent) ? gasSpent : config.expectedGasRefund * 2;
        uint fullAmountToBurn = (gasSpent - gasRefundOffset) / 41947;
        uint amountToBurn = fullAmountToBurn > config.maxToBurn ? config.maxToBurn : fullAmountToBurn;

        if (amountToBurn == 0) return;

        if (config.gasTokenVault == address(0) || config.gasTokenVault == address(this)) {
            IChiToken(chiToken).freeUpTo(amountToBurn);
        } else {
            IChiToken(chiToken).freeFromUpTo(config.gasTokenVault, amountToBurn);
        }
    }
}
