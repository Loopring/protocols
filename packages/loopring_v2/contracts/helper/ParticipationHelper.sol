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

import "../impl/Data.sol";
import "../lib/MathUint.sol";
import "./OrderHelper.sol";


/// @title ParticipationHelper
/// @author Daniel Wang - <daniel@loopring.org>.
library ParticipationHelper {
    using MathUint for uint;
    using OrderHelper for Data.Order;

    function setMaxFillAmounts(
        Data.Participation memory p,
        Data.Context memory ctx
        )
        internal
        view
    {
        uint spendableS = p.order.getSpendableS(ctx);
        uint remainingS = p.order.amountS.sub(p.order.filledAmountS);
        p.fillAmountS = (spendableS < remainingS) ? spendableS : remainingS;

        if (!p.order.P2P) {
            // No need to check the fee balance of the owner if feeToken == tokenB,
            // fillAmountB will be used to pay the fee.
            if (!(p.order.feeToken == p.order.tokenB &&
                  // p.order.owner == p.order.tokenRecipient &&
                  p.order.feeAmount <= p.order.amountB)) {
                // Check how much fee needs to be paid. We limit fillAmountS to how much
                // fee the order owner can pay.
                uint feeAmount = p.order.feeAmount.mul(p.fillAmountS) / p.order.amountS;
                if (feeAmount > 0) {
                    uint spendableFee = p.order.getSpendableFee(ctx);
                    if (p.order.feeToken == p.order.tokenS && p.fillAmountS + feeAmount > spendableS) {
                        assert(spendableFee == spendableS);
                        // Equally divide the available tokens between fillAmountS and feeAmount
                        uint totalAmount = p.order.amountS.add(p.order.feeAmount);
                        p.fillAmountS = spendableS.mul(p.order.amountS) / totalAmount;
                        feeAmount = spendableS.mul(p.order.feeAmount) / totalAmount;
                    } else if (feeAmount > spendableFee) {
                        // Scale down fillAmountS so the available feeAmount is sufficient
                        feeAmount = spendableFee;
                        p.fillAmountS = feeAmount.mul(p.order.amountS) / p.order.feeAmount;
                    }
                }
            }
        }

        p.fillAmountB = p.fillAmountS.mul(p.order.amountB) / p.order.amountS;
    }

    function calculateFees(
        Data.Participation memory p,
        Data.Participation memory prevP,
        Data.Context memory ctx
        )
        internal
        view
        returns (bool)
    {
        if (p.order.P2P) {
            // Calculate P2P fees
            p.feeAmount = 0;
            p.feeAmountS = p.fillAmountS.mul(p.order.tokenSFeePercentage) / ctx.feePercentageBase;
            p.feeAmountB = p.fillAmountB.mul(p.order.tokenBFeePercentage) / ctx.feePercentageBase;
        } else {
            // Calculate matching fees
            p.feeAmountS = 0;
            p.feeAmountB = 0;

            // Use primary token fill ratio to calculate fee
            // if it's a BUY order, use the amount B (tokenB is the primary)
            // if it's a SELL order, use the amount S (tokenS is the primary)
            if (p.order.isBuy()) {
                p.feeAmount = p.order.feeAmount.mul(p.fillAmountB) / p.order.amountB;
            } else {
                p.feeAmount = p.order.feeAmount.mul(p.fillAmountS) / p.order.amountS;
            }

            // If feeToken == tokenB AND owner == tokenRecipient, try to pay using fillAmountB

            if (p.order.feeToken == p.order.tokenB &&
                // p.order.owner == p.order.tokenRecipient &&
                p.fillAmountB >= p.feeAmount) {
                p.feeAmountB = p.feeAmount;
                p.feeAmount = 0;
            }

            if (p.feeAmount > 0) {
                // Make sure we can pay the feeAmount
                uint spendableFee = p.order.getSpendableFee(ctx);
                if (p.feeAmount > spendableFee) {
                    // This normally should not happen, but this is possible when self-trading
                    return false;
                } else {
                    p.order.reserveAmountFee(p.feeAmount);
                }
            }
        }

        if ((p.fillAmountS - p.feeAmountS) >= prevP.fillAmountB) {
            // NOTICE: this line commented as order recipient should receive the margin
            // p.splitS = (p.fillAmountS - p.feeAmountS) - prevP.fillAmountB;

            p.fillAmountS = prevP.fillAmountB + p.feeAmountS;
            return true;
        } else {
            revert('INVALID_FEES');
            return false;
        }
        
    }

    function checkFills(
        Data.Participation memory p
        )
        internal
        pure
        returns (bool valid)
    {
        // NOTICE: deprecated logic, order recipient can get better price as they receive margin
        // Check if the rounding error of the calculated fillAmountB is larger than 1%.
        // If that's the case, this partipation in invalid
        // p.fillAmountB := p.fillAmountS.mul(p.order.amountB) / p.order.amountS
        // valid = !MathUint.hasRoundingError(
        //     p.fillAmountS,
        //     p.order.amountB,
        //     p.order.amountS
        // );

        // We at least need to buy and sell something
        valid = p.fillAmountS > 0;
        valid = valid && p.fillAmountB > 0;

        require(valid, 'INVALID_FILLS');
    }

    function adjustOrderState(
        Data.Participation memory p
        )
        internal
        pure
    {
        // Update filled amount
        p.order.filledAmountS += p.fillAmountS + p.splitS;

        // Update spendables
        uint totalAmountS = p.fillAmountS;
        uint totalAmountFee = p.feeAmount;
        p.order.tokenSpendableS.amount = p.order.tokenSpendableS.amount.sub(totalAmountS);
        p.order.tokenSpendableFee.amount = p.order.tokenSpendableFee.amount.sub(totalAmountFee);
    }

    function revertOrderState(
        Data.Participation memory p
        )
        internal
        pure
    {
        // Revert filled amount
        p.order.filledAmountS = p.order.filledAmountS.sub(p.fillAmountS + p.splitS);

        // We do not revert any spendables. Rings will not get rebalanced so this doesn't matter.
    }

}
