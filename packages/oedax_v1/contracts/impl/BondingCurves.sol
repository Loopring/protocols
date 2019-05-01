// /*

//   Copyright 2017 Loopring Project Ltd (Loopring Foundation).

//   Licensed under the Apache License, Version 2.0 (the "License");
//   you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at

//   http://www.apache.org/licenses/LICENSE-2.0

//   Unless required by applicable law or agreed to in writing, software
//   distributed under the License is distributed on an "AS IS" BASIS,
//   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and
//   limitations under the License.
// */
// pragma solidity 0.5.7;

// import "../iface/ICurve.sol";

// import "../lib/MathUint.sol";


// /// @title An Implementation of IBondingCurves.
// /// @author Daniel Wang  - <daniel@loopring.org>


// library BondingCurves
// {
//     using MathUint  for uint;
//     using MathUint  for uint32;

//     struct Result
//     {
//         bool bounded;
//         uint actualPrice;
//         uint askPrice;
//         uint bidPrice;
//         uint newAskShift;
//         uint newBidShift;
//         uint additionalAmountAskAllowed;
//         uint additionalAmountBidAllowed;
//         uint timeRemaining;
//     }

//     struct Input
//     {
//         uint    askAmount; // i.e., LRC
//         uint    bidAmount; // i.e., ETH
//         uint    queuedAskAmount;
//         uint    queuedBidAmount;
//         uint    time;
//         uint    askShift;
//         uint    bidShift;
//     }

//     function calculateBonding(
//         ICurve.Instance storage ci,
//         Input memory input
//         )
//         internal
//         view
//         returns (Result memory result)
//     {
//         if (input.askAmount > 0) {
//             result.actualPrice = input.bidAmount.mul(ci.S) / input.askAmount;
//             result.bounded = result.actualPrice >= ci.P / ci.M && result.actualPrice <= ci.P.mul(ci.M);
//         }

//         require(result.bounded || (input.askShift == 0 && input.bidShift == 0), "unbound shift");

//         uint askTime = input.askShift > 0 ? input.time.sub(input.askShift) : input.time;
//         result.newAskShift = input.askShift;
//         result.askPrice = ci.curve.getCurveValue(ci.P, ci.S, ci.M, ci.T, askTime);
//         result.additionalAmountBidAllowed = ~uint256(0); // = uint.MAX

//         uint bidTime = input.bidShift > 0 ? input.time.sub(input.bidShift) : input.time;
//         result.newBidShift = input.bidShift;
//         result.bidPrice = ci.P.mul(ci.P) / ci.S /
//             ci.curve.getCurveValue(ci.P, ci.S, ci.M, ci.T, bidTime);
//         result.additionalAmountBidAllowed = ~uint256(0); // = uint.MAX

//         if (result.bounded) {
//             if (result.actualPrice > result.askPrice) {
//                 uint t = ci.curve.getCurveTime(ci.P, ci.S, ci.M, ci.T, result.actualPrice);
//                 result.newAskShift = askTime.add(input.askShift).sub(t);
//                 result.askPrice = result.actualPrice;
//                 result.additionalAmountBidAllowed = 0;
//             } else {
//               result.additionalAmountBidAllowed = (
//                     input.askAmount.add(input.queuedAskAmount).mul(result.askPrice) / ci.S
//                 ).sub(input.bidAmount);
//             }

//             if (result.actualPrice < result.bidPrice) {
//                 uint v = input.askAmount.mul(ci.P).mul(ci.P) / input.bidAmount;
//                 uint t = ci.curve.getCurveTime(ci.P, ci.S, ci.M, ci.T, v);
//                 result.newAskShift = bidTime.add(input.bidShift).sub(t);
//                 result.bidPrice = result.actualPrice;
//                 result.additionalAmountAskAllowed = 0;
//             } else {
//                 result.additionalAmountAskAllowed = (
//                     input.askAmount.add(input.queuedBidAmount).mul(result.bidPrice) / ci.S
//                 ).sub(input.bidAmount);
//             }
//         }
//     }

// }
