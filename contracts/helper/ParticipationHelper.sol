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
pragma solidity 0.4.24;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";

import "../impl/Data.sol";
import "../lib/MathUint.sol";
import "./TaxHelper.sol";


/// @title ParticipationHelper
/// @author Daniel Wang - <daniel@loopring.org>.
library ParticipationHelper {
    using MathUint for uint;
    using TaxHelper for Data.Tax;

    function calculateFeesAndTaxes(
        Data.Participation p,
        Data.Participation prevP,
        Data.Tax tax,
        bool P2P
        )
        internal
        pure
    {
        if (P2P) {
            // Calculate P2P fees
            p.feeAmount = 0;
            if (p.order.wallet != 0x0) {
                p.feeAmountS = p.fillAmountS.mul(1000) / (1000 - p.order.tokenSFeePercentage) - p.fillAmountS;
                p.feeAmountB = p.fillAmountB.mul(p.order.tokenBFeePercentage) / 1000;
            } else {
                p.feeAmountS = 0;
                p.feeAmountB = 0;
            }

            // The taker gets the margin
            p.splitS = 0;
        } else {
            // Calculate matching fees
            p.feeAmount = p.order.feeAmount.mul(p.fillAmountS) / p.order.amountS;
            p.feeAmountS = 0;
            p.feeAmountB = 0;

            // We have to pay with tokenB if the owner can't pay the complete feeAmount in feeToken
            uint feeAmountTax = tax.calculateTax(p.order.feeToken, false, P2P, p.feeAmount);
            uint totalAmountFeeToken = p.feeAmount + feeAmountTax;
            if (p.order.feeToken == p.order.tokenS) {
                totalAmountFeeToken += p.fillAmountS;
            }
            if (totalAmountFeeToken > p.order.spendableFee) {
                p.feeAmountB = p.fillAmountB.mul(p.order.feePercentage) / 1000;
                p.feeAmount = 0;
            }

            // Miner can waive fees for this order. If waiveFeePercentage > 0 this is a simple reduction in fees.
            if (p.order.waiveFeePercentage > 0) {
                p.feeAmount = p.feeAmount.mul(1000 - uint(p.order.waiveFeePercentage)) / 1000;
                p.feeAmountB = p.feeAmountB.mul(1000 - uint(p.order.waiveFeePercentage)) / 1000;
                // fillAmountFeeS is always 0
            } else if (p.order.waiveFeePercentage < 0) {
                // No fees need to be paid by this order
                p.feeAmount = 0;
                p.feeAmountB = 0;
            }

            // The miner/wallet gets the margin
            p.splitS = p.fillAmountS - prevP.fillAmountB;
            p.fillAmountS = prevP.fillAmountB;
        }

        // Calculate consumer taxes. These are applied on top of the calculated fees
        p.taxFee = tax.calculateTax(p.order.feeToken, false, P2P, p.feeAmount);
        p.taxS = tax.calculateTax(p.order.tokenS, false, P2P, p.feeAmountS);
        p.taxB = tax.calculateTax(p.order.tokenB, false, P2P, p.feeAmountB);
    }

    function adjustOrderState(
        Data.Participation p
        )
        internal
        pure
    {
        uint filledAmountS = p.fillAmountS + p.splitS;
        uint totalAmountS = filledAmountS + p.taxS;
        uint totalAmountFee = p.feeAmount + p.taxFee;
        p.order.filledAmountS += filledAmountS;
        p.order.maxAmountS = p.order.maxAmountS.sub(filledAmountS);
        if (p.order.maxAmountS > p.order.spendableS) {
            p.order.maxAmountS = p.order.spendableS;
        }
        // Update spendables
        p.order.spendableS = p.order.spendableS.sub(totalAmountS);
        p.order.spendableFee = p.order.spendableFee.sub(totalAmountFee);
        if (p.order.tokenS == p.order.feeToken) {
            p.order.spendableS = p.order.spendableS.sub(totalAmountFee);
            p.order.spendableFee = p.order.spendableFee.sub(totalAmountS);
        }
    }

}
