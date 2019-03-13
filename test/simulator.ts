import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import childProcess = require("child_process");
import ethUtil = require("ethereumjs-util");
import path = require("path");
import * as pjs from "protocol2-js";
import util = require("util");
import { Account, Balance, Block, Cancel, CancelBlock, DetailedTokenTransfer, OrderInfo,
         RingBlock, RingInfo, RingState, Wallet, Withdrawal, WithdrawalRequest, WithdrawBlock } from "./types";

export class Simulator {

  private state: RingState;

  public settleRing(ring: RingInfo, state: RingState, timestamp: number, operatorAccountID: number) {
    this.state = state;
    let [fillAmountSA, fillAmountBA] = this.getMaxFillAmounts(ring.orderA, state.accountA);
    let [fillAmountSB, fillAmountBB] = this.getMaxFillAmounts(ring.orderB, state.accountB);

    if (fillAmountBA.lt(fillAmountSB)) {
      fillAmountBB = fillAmountSA;
      fillAmountSB = fillAmountBB.mul(ring.orderB.amountS).div(ring.orderB.amountB);
    } else {
      fillAmountBA = fillAmountSB;
      fillAmountSA = fillAmountBA.mul(ring.orderA.amountS).div(ring.orderA.amountB);
    }

    let fillAmountFA = ring.orderA.amountF.mul(fillAmountSA).div(ring.orderA.amountS);
    let fillAmountFB = ring.orderB.amountF.mul(fillAmountSB).div(ring.orderB.amountS);

    let margin = fillAmountSA.sub(fillAmountBB);

    let valid = true;

    // matchable
    valid = valid && !fillAmountSA.lt(fillAmountBB);

    // self-trading
    const balanceF = new BN(state.accountA.balances[ring.orderA.tokenIdF].balance);
    const totalFee = fillAmountFA.add(fillAmountFB);
    if (ring.orderA.accountID === ring.orderB.accountID &&
        ring.orderA.tokenIdF === ring.orderB.tokenIdF &&
        balanceF.lt(totalFee)) {
      valid = false;
    }

    valid = valid && this.checkValid(ring.orderA, fillAmountSA, fillAmountBA, timestamp);
    valid = valid && this.checkValid(ring.orderB, fillAmountSB, fillAmountBB, timestamp);

    if (!valid) {
      fillAmountSA = new BN(0);
      fillAmountBA = new BN(0);
      fillAmountFA = new BN(0);
      fillAmountSB = new BN(0);
      fillAmountBB = new BN(0);
      fillAmountFB = new BN(0);
      margin = new BN(0);
    }

    const burnRateA = 500;
    const burnRateB = 500;

    const [walletFeeA, matchingFeeA, burnFeeA] = this.calculateFees(
      ring.orderA,
      fillAmountFA,
      burnRateA,
      ring.orderA.walletSplitPercentage,
      ring.orderA.waiveFeePercentage,
    );

    const [walletFeeB, matchingFeeB, burnFeeB] = this.calculateFees(
      ring.orderB,
      fillAmountFB,
      burnRateB,
      ring.orderB.walletSplitPercentage,
      ring.orderB.waiveFeePercentage,
    );

    const detailedTransfersA = this.getDetailedTransfers(
      ring, ring.orderA, ring.orderB,
      fillAmountSA, fillAmountBA, fillAmountFA,
      margin,
      walletFeeA, matchingFeeA, burnFeeA,
      burnRateA,
    );

    const detailedTransfersB = this.getDetailedTransfers(
      ring, ring.orderB, ring.orderA,
      fillAmountSB, fillAmountBB, fillAmountFB,
      new BN(0),
      walletFeeB, matchingFeeB, burnFeeB,
      burnRateB,
    );

    const operatorFee: DetailedTokenTransfer = {
      description: "OperatorFee",
      token: ring.tokenID,
      from: ring.minerAccountID,
      to: operatorAccountID,
      amount: ring.fee,
      subPayments: [],
    };

    const detailedTransfers: DetailedTokenTransfer[] = [];
    detailedTransfers.push(...detailedTransfersA);
    detailedTransfers.push(...detailedTransfersB);
    detailedTransfers.push(operatorFee);
    return detailedTransfers;
  }

  private getDetailedTransfers(ring: RingInfo, order: OrderInfo, orderTo: OrderInfo,
                               fillAmountS: BN, fillAmountB: BN, fillAmountF: BN,
                               margin: BN,
                               walletFee: BN, matchingFee: BN, burnFee: BN,
                               burnRate: number) {
    const sell: DetailedTokenTransfer = {
      description: "Sell",
      token: order.tokenIdS,
      from: order.accountID,
      to: orderTo.accountID,
      amount: fillAmountS,
      subPayments: [],
    };
    const buy: DetailedTokenTransfer = {
      description: "ToBuyer",
      token: order.tokenIdS,
      from: order.accountID,
      to: orderTo.accountID,
      amount: fillAmountB,
      subPayments: [],
    };
    const marginP: DetailedTokenTransfer = {
      description: "Margin",
      token: order.tokenIdS,
      from: order.accountID,
      to: ring.minerAccountID,
      amount: margin,
      subPayments: [],
    };
    sell.subPayments.push(buy);
    sell.subPayments.push(marginP);

    const fee: DetailedTokenTransfer = {
      description: "Fee",
      token: order.tokenIdF,
      from: order.accountID,
      to: 0,
      amount: fillAmountF,
      subPayments: [],
    };
    const feeWallet: DetailedTokenTransfer = {
      description: "Wallet@" + order.walletSplitPercentage,
      token: order.tokenIdF,
      from: order.accountID,
      to: order.dualAuthAccountID,
      amount: walletFee,
      subPayments: [],
    };
    const feeMatching: DetailedTokenTransfer = {
      description: "Matching@" + order.waiveFeePercentage,
      token: order.tokenIdF,
      from: order.accountID,
      to: ring.minerAccountID,
      amount: matchingFee,
      subPayments: [],
    };
    const feeBurn: DetailedTokenTransfer = {
      description: "Burn@" + burnRate / 10,
      token: order.tokenIdF,
      from: order.accountID,
      to: 0,
      amount: burnFee,
      subPayments: [],
    };
    fee.subPayments.push(feeWallet);
    fee.subPayments.push(feeMatching);
    fee.subPayments.push(feeBurn);

    const detailedTransfers: DetailedTokenTransfer[] = [];
    detailedTransfers.push(sell);
    detailedTransfers.push(fee);

    return detailedTransfers;
  }

  private getMaxFillAmounts(order: OrderInfo, accountData: any) {
    // console.log(accountData);
    let tradeHistory = accountData.balances[order.tokenIdS].tradeHistory[order.orderID];
    if (!tradeHistory) {
      tradeHistory = {
        filled: new BN(0),
        cancelled: false,
      };
    }

    const balanceS = new BN(accountData.balances[order.tokenIdS].balance);
    const balanceF = new BN(accountData.balances[order.tokenIdF].balance);

    const remainingS = tradeHistory.cancelled ? new BN(0) : order.amountS.sub(tradeHistory.filled);
    let fillAmountS = balanceS.lt(remainingS) ? balanceS : remainingS;

    // Check how much fee needs to be paid. We limit fillAmountS to how much
    // fee the order owner can pay.
    const fillAmountF = order.amountF.mul(fillAmountS).div(order.amountS);

    if (order.tokenIdF === order.tokenIdS && balanceS.lt(fillAmountS.add(fillAmountF))) {
      // Equally divide the available tokens between fillAmountS and fillAmountF
      fillAmountS = balanceS.mul(order.amountS).div(order.amountS.add(order.amountF));
    }
    if (order.tokenIdF !== order.tokenIdS && balanceF.lt(fillAmountF)) {
      // Scale down fillAmountS so the available fillAmountF is sufficient
      fillAmountS = balanceF.mul(order.amountS.div(order.amountF));
    }
    if (order.tokenIdF === order.tokenIdB && order.amountF.lte(order.amountB)) {
      // No rebalancing (because of insufficient balanceF) is ever necessary when amountF <= amountB
      fillAmountS = balanceS.lt(remainingS) ? balanceS : remainingS;
    }

    const fillAmountB = fillAmountS.mul(order.amountB).div(order.amountS);
    return [fillAmountS, fillAmountB];
  }

  private calculateFees(order: OrderInfo, fee: BN, burnRate: number,
                        walletSplitPercentage: number, waiveFeePercentage: number) {
    const walletFee = fee.mul(new BN(walletSplitPercentage)).div(new BN(100));
    const matchingFee = fee.sub(walletFee);

    const walletFeeToBurn = walletFee.mul(new BN(burnRate)).div(new BN(1000));
    const walletFeeToPay = walletFee.sub(walletFeeToBurn);

    const matchingFeeAfterWaiving = matchingFee.mul(new BN(waiveFeePercentage)).div(new BN(100));
    const matchingFeeToBurn = matchingFeeAfterWaiving.mul(new BN(burnRate)).div(new BN(1000));
    const matchingFeeToPay = matchingFeeAfterWaiving.sub(matchingFeeToBurn);

    const feeToBurn = walletFeeToBurn.add(matchingFeeToBurn);

    return [walletFeeToPay, matchingFeeToPay, feeToBurn];
  }

  private hasRoundingError(value: BN, numerator: BN, denominator: BN) {
    const multiplied = value.mul(numerator);
    const remainder = multiplied.mod(denominator);
    // Return true if the rounding error is larger than 1%
    return multiplied.lt(remainder.mul(new BN(100)));
  }

  private checkValid(order: OrderInfo, fillAmountS: BN, fillAmountB: BN, timestamp: number) {
    let valid = true;

    valid = valid && (order.validSince <= timestamp);
    valid = valid && (timestamp <= order.validUntil);

    valid = valid && !(order.allOrNone && (fillAmountS !== order.amountS));
    valid = valid && !this.hasRoundingError(fillAmountS, order.amountB, order.amountS);
    valid = valid && !fillAmountS.eq(0);
    valid = valid && !fillAmountB.eq(0);

    return valid;
  }

}
