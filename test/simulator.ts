import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import childProcess = require("child_process");
import ethUtil = require("ethereumjs-util");
import path = require("path");
import * as pjs from "protocol2-js";
import util = require("util");
import { Account, Balance, Block, Cancel, CancelBlock, DetailedTokenTransfer, OrderInfo,
         RingBlock, RingInfo, RingState, SimulatorReport, TradeHistory, Wallet, Withdrawal,
         WithdrawalRequest, WithdrawBlock } from "./types";

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
    valid = valid && this.ensure(!fillAmountSA.lt(fillAmountBB), "Not matchable");

    // self-trading
    const balanceF = state.accountA.balances[ring.orderA.tokenIdF].balance;
    const totalFee = fillAmountFA.add(fillAmountFB);
    if (ring.orderA.accountID === ring.orderB.accountID &&
        ring.orderA.tokenIdF === ring.orderB.tokenIdF &&
        balanceF.lt(totalFee)) {
      valid = this.ensure(false, "Self-trading impossible");
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

    console.log("Simulator: ");

    console.log("fillAmountSA: " + fillAmountSA.toString(10));
    console.log("fillAmountBA: " + fillAmountBA.toString(10));
    console.log("fillAmountFA: " + fillAmountFA.toString(10));

    console.log("fillAmountSB: " + fillAmountSB.toString(10));
    console.log("fillAmountBB: " + fillAmountBB.toString(10));
    console.log("fillAmountFB: " + fillAmountFB.toString(10));

    const [walletFeeA, matchingFeeA] = this.calculateFees(
      fillAmountFA,
      ring.orderA.walletSplitPercentage,
      ring.orderA.waiveFeePercentage,
    );

    const [walletFeeB, matchingFeeB] = this.calculateFees(
      fillAmountFB,
      ring.orderB.walletSplitPercentage,
      ring.orderB.waiveFeePercentage,
    );

    const newState: RingState = {
      accountA: this.copyAccount(state.accountA),
      accountB: this.copyAccount(state.accountB),
      walletA: this.copyAccount(state.walletA),
      walletB: this.copyAccount(state.walletB),
      feeRecipient: this.copyAccount(state.feeRecipient),
      ringMatcher: this.copyAccount(state.ringMatcher),
      operator: this.copyAccount(state.operator),
    };

    // Check if the order owners are the same
    if (ring.orderA.accountID === ring.orderB.accountID) {
      newState.accountB = newState.accountA;
    }

    // Check if the wallets are the same
    if (ring.orderA.dualAuthAccountID === ring.orderB.dualAuthAccountID) {
      newState.walletB = newState.walletA;
    }

    if (!newState.accountA.balances[ring.orderA.tokenIdS].tradeHistory[ring.orderA.orderID]) {
      newState.accountA.balances[ring.orderA.tokenIdS].tradeHistory[ring.orderA.orderID] = {
        filled: new BN(0),
        cancelled: false,
      };
    }

    if (!newState.accountB.balances[ring.orderB.tokenIdS].tradeHistory[ring.orderB.orderID]) {
      newState.accountB.balances[ring.orderB.tokenIdS].tradeHistory[ring.orderB.orderID] = {
        filled: new BN(0),
        cancelled: false,
      };
    }

    // Update accountA
    newState.accountA.balances[ring.orderA.tokenIdS].balance =
      newState.accountA.balances[ring.orderA.tokenIdS].balance.sub(fillAmountSA);
    newState.accountA.balances[ring.orderA.tokenIdB].balance =
      newState.accountA.balances[ring.orderA.tokenIdB].balance.add(fillAmountBA);
    newState.accountA.balances[ring.orderA.tokenIdF].balance =
      newState.accountA.balances[ring.orderA.tokenIdF].balance.sub(walletFeeA.add(matchingFeeA));

    // Update accountB
    newState.accountB.balances[ring.orderB.tokenIdS].balance =
      newState.accountB.balances[ring.orderB.tokenIdS].balance.sub(fillAmountSB);
    newState.accountB.balances[ring.orderB.tokenIdB].balance =
      newState.accountB.balances[ring.orderB.tokenIdB].balance.add(fillAmountBB);
    newState.accountB.balances[ring.orderB.tokenIdF].balance =
      newState.accountB.balances[ring.orderB.tokenIdF].balance.sub(walletFeeB.add(matchingFeeB));

    // Update trade history A
    newState.accountA.balances[ring.orderA.tokenIdS].tradeHistory[ring.orderA.orderID].filled =
      newState.accountA.balances[ring.orderA.tokenIdS].tradeHistory[ring.orderA.orderID].filled.add(fillAmountSA);
    // Update trade history B
    newState.accountB.balances[ring.orderB.tokenIdS].tradeHistory[ring.orderB.orderID].filled =
      newState.accountB.balances[ring.orderB.tokenIdS].tradeHistory[ring.orderB.orderID].filled.add(fillAmountSB);

    // Update walletA
    newState.walletA.balances[ring.orderA.tokenIdF].balance =
      newState.walletA.balances[ring.orderA.tokenIdF].balance.add(walletFeeA);

    // Update walletB
    newState.walletB.balances[ring.orderB.tokenIdF].balance =
      newState.walletB.balances[ring.orderB.tokenIdF].balance.add(walletFeeB);

    // Update feeRecipient
    // - Matching fee A
    newState.feeRecipient.balances[ring.orderA.tokenIdF].balance =
      newState.feeRecipient.balances[ring.orderA.tokenIdF].balance.add(matchingFeeA);
    // - Matching fee B
    newState.feeRecipient.balances[ring.orderB.tokenIdF].balance =
     newState.feeRecipient.balances[ring.orderB.tokenIdF].balance.add(matchingFeeB);

    // Update ringMatcher
    // - Margin
    newState.ringMatcher.balances[ring.orderA.tokenIdS].balance =
     newState.ringMatcher.balances[ring.orderA.tokenIdS].balance.add(margin);
    // - Operator fee
    newState.ringMatcher.balances[ring.tokenID].balance =
     newState.ringMatcher.balances[ring.tokenID].balance.sub(ring.fee);

    // Update operator
    newState.operator.balances[ring.tokenID].balance =
     newState.operator.balances[ring.tokenID].balance.add(ring.fee);

    const detailedTransfersA = this.getDetailedTransfers(
      ring, ring.orderA, ring.orderB,
      fillAmountSA, fillAmountBA, fillAmountFA,
      margin,
      walletFeeA, matchingFeeA,
    );

    const detailedTransfersB = this.getDetailedTransfers(
      ring, ring.orderB, ring.orderA,
      fillAmountSB, fillAmountBB, fillAmountFB,
      new BN(0),
      walletFeeB, matchingFeeB,
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

    const simulatorReport: SimulatorReport = {
      stateBefore: state,
      stateAfter: newState,
      detailedTransfers,
    };
    return simulatorReport;
  }

  private getDetailedTransfers(ring: RingInfo, order: OrderInfo, orderTo: OrderInfo,
                               fillAmountS: BN, fillAmountB: BN, fillAmountF: BN,
                               margin: BN,
                               walletFee: BN, matchingFee: BN) {
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
      amount: fillAmountS.sub(margin),
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
    fee.subPayments.push(feeWallet);
    fee.subPayments.push(feeMatching);

    const detailedTransfers: DetailedTokenTransfer[] = [];
    detailedTransfers.push(sell);
    detailedTransfers.push(fee);

    return detailedTransfers;
  }

  private getMaxFillAmounts(order: OrderInfo, accountData: any) {
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
      fillAmountS = balanceF.mul(order.amountS).div(order.amountF);
    }
    if (order.tokenIdF === order.tokenIdB && order.amountF.lte(order.amountB)) {
      // No rebalancing (because of insufficient balanceF) is ever necessary when amountF <= amountB
      fillAmountS = balanceS.lt(remainingS) ? balanceS : remainingS;
    }

    const fillAmountB = fillAmountS.mul(order.amountB).div(order.amountS);
    return [fillAmountS, fillAmountB];
  }

  private calculateFees(fee: BN, walletSplitPercentage: number, waiveFeePercentage: number) {
    const walletFee = fee.mul(new BN(walletSplitPercentage)).div(new BN(100));
    const matchingFee = fee.sub(walletFee);
    const matchingFeeAfterWaiving = matchingFee.mul(new BN(waiveFeePercentage)).div(new BN(100));

    return [walletFee, matchingFeeAfterWaiving];
  }

  private hasRoundingError(value: BN, numerator: BN, denominator: BN) {
    const multiplied = value.mul(numerator);
    const remainder = multiplied.mod(denominator);
    // Return true if the rounding error is larger than 1%
    return multiplied.lt(remainder.mul(new BN(100)));
  }

  private checkValid(order: OrderInfo, fillAmountS: BN, fillAmountB: BN, timestamp: number) {
    let valid = true;

    valid = valid && this.ensure(order.validSince <= timestamp, "order too early");
    valid = valid && this.ensure(timestamp <= order.validUntil, "order too late");

    valid = valid && this.ensure(!(order.allOrNone && (!fillAmountS.eq(order.amountS))), "allOrNone invalid");
    valid = valid && this.ensure(!this.hasRoundingError(fillAmountS, order.amountB, order.amountS), "rounding error");
    valid = valid && this.ensure(!fillAmountS.eq(0), "no tokens sold");
    valid = valid && this.ensure(!fillAmountB.eq(0), "no tokens bought");

    return valid;
  }

  private copyAccount(account: Account) {
    const balances: {[key: number]: Balance} = {};
    for (const tokenID of Object.keys(account.balances)) {
      const balanceValue = account.balances[Number(tokenID)];

      const tradeHistory: {[key: number]: TradeHistory} = {};
      for (const orderID of Object.keys(balanceValue.tradeHistory)) {
        const tradeHistoryValue = balanceValue.tradeHistory[Number(orderID)];
        tradeHistory[Number(orderID)] = {
          filled: tradeHistoryValue.filled,
          cancelled: tradeHistoryValue.cancelled,
        };
      }
      balances[Number(tokenID)] = {
        balance: balanceValue.balance,
        tradeHistory,
      };
    }
    const accountCopy: Account = {
      accountID: account.accountID,
      walletID: account.walletID,
      publicKeyX: account.publicKeyX,
      publicKeyY: account.publicKeyY,
      balances,
    };
    return accountCopy;
  }

  private ensure(valid: boolean, description: string) {
    if (!valid) {
      console.log(description);
    }
    return valid;
  }

}
