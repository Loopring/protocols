import BN = require("bn.js");
import * as constants from "./constants";
import { fromFloat, roundToFloatValue, toFloat } from "./float";
import { Account, Balance, Block, Cancel, CancelBlock, Deposit, DetailedTokenTransfer, OrderInfo,
         Realm, RingInfo, RingSettlementSimulatorReport, SimulatorReport,
         TradeHistory, Wallet, Withdrawal, WithdrawalRequest, WithdrawBlock } from "./types";

export class Simulator {

  public deposit(deposit: Deposit, realm: Realm) {
    const newRealm = this.copyRealm(realm);
    assert(deposit.accountID <= realm.accounts.length, "accountID not incremented by 1");
    if (deposit.accountID === realm.accounts.length) {
      // Make sure all tokens exist
      const balances: {[key: number]: Balance} = {};
      for (let i = 0; i < constants.MAX_NUM_TOKENS; i++) {
        balances[i] = {
          balance: new BN(0),
          tradeHistory: {},
        };
      }
      const emptyAccount: Account = {
        publicKeyX: "0",
        publicKeyY: "0",
        nonce: 0,
        balances,
      };
      newRealm.accounts.push(emptyAccount);
    }
    const account = newRealm.accounts[deposit.accountID];
    account.balances[deposit.tokenID].balance =
      account.balances[deposit.tokenID].balance.add(deposit.amount);
    account.publicKeyX = deposit.publicKeyX;
    account.publicKeyY = deposit.publicKeyY;

    const simulatorReport: SimulatorReport = {
      realmBefore: realm,
      realmAfter: newRealm,
    };
    return simulatorReport;
  }

  public onchainWithdraw(withdrawal: WithdrawalRequest, shutdown: boolean, realm: Realm) {
    const newRealm = this.copyRealm(realm);

    // When a withdrawal is done before the deposit (account creation) we shouldn't
    // do anything. Just leave everything as it is.
    if (withdrawal.accountID < newRealm.accounts.length) {
      const account = newRealm.accounts[withdrawal.accountID];

      const balance = account.balances[withdrawal.tokenID].balance;
      const amountToWithdrawMin = (balance.lt(withdrawal.amount)) ? balance : withdrawal.amount;
      const amountToWithdraw = (shutdown) ? balance : amountToWithdrawMin;
      const amountWithdrawn = roundToFloatValue(amountToWithdraw, constants.Float28Encoding);

      let amountToSubtract = amountWithdrawn;
      if (shutdown) {
        amountToSubtract = amountToWithdraw;
      }

      // Update balance
      account.balances[withdrawal.tokenID].balance =
        account.balances[withdrawal.tokenID].balance.sub(amountToSubtract);

      if (shutdown) {
        account.publicKeyX = "0";
        account.publicKeyY = "0";
        account.nonce = 0;
        account.balances[withdrawal.tokenID].tradeHistory = {};
      }
    }

    const simulatorReport: SimulatorReport = {
      realmBefore: realm,
      realmAfter: newRealm,
    };
    return simulatorReport;
  }

  public offchainWithdraw(withdrawal: WithdrawalRequest, realm: Realm, operatorAccountID: number) {
    const newRealm = this.copyRealm(realm);

    const fee = roundToFloatValue(withdrawal.fee, constants.Float16Encoding);

    const feeToWallet = fee.mul(new BN(withdrawal.walletSplitPercentage)).div(new BN(100));
    const feeToOperator = fee.sub(feeToWallet);

    const account = newRealm.accounts[withdrawal.accountID];

    // Update balanceF
    account.balances[withdrawal.feeTokenID].balance =
      account.balances[withdrawal.feeTokenID].balance.sub(fee);

    const balance = account.balances[withdrawal.tokenID].balance;
    const amountToWithdraw = (balance.lt(withdrawal.amount)) ? balance : withdrawal.amount;
    const amountWithdrawn = roundToFloatValue(amountToWithdraw, constants.Float28Encoding);

    // Update balance
    account.balances[withdrawal.tokenID].balance =
      account.balances[withdrawal.tokenID].balance.sub(amountWithdrawn);
    account.nonce++;

    // Update wallet
    const wallet = newRealm.accounts[withdrawal.walletAccountID];
    wallet.balances[withdrawal.feeTokenID].balance =
      wallet.balances[withdrawal.feeTokenID].balance.add(feeToWallet);

    // Update operator
    const operator = newRealm.accounts[operatorAccountID];
    operator.balances[withdrawal.feeTokenID].balance =
      operator.balances[withdrawal.feeTokenID].balance.add(feeToOperator);

    const simulatorReport: SimulatorReport = {
      realmBefore: realm,
      realmAfter: newRealm,
    };
    return simulatorReport;
  }

  public cancelOrder(cancel: Cancel, realm: Realm, operatorAccountID: number) {
    const newRealm = this.copyRealm(realm);

    const fee = roundToFloatValue(cancel.fee, constants.Float16Encoding);

    const feeToWallet = fee.mul(new BN(cancel.walletSplitPercentage)).div(new BN(100));
    const feeToOperator = fee.sub(feeToWallet);

    const account = newRealm.accounts[cancel.accountID];

    // Update balance
    account.balances[cancel.orderTokenID].balance =
      account.balances[cancel.orderTokenID].balance.sub(fee);
    account.nonce++;

    // Update trade history
    if (!account.balances[cancel.orderTokenID].tradeHistory[cancel.orderID]) {
      account.balances[cancel.orderTokenID].tradeHistory[cancel.orderID] = {
        filled: new BN(0),
        cancelled: false,
        orderID: 0,
      };
    }
    account.balances[cancel.orderTokenID].tradeHistory[cancel.orderID].cancelled = true;

    // Update wallet
    const wallet = newRealm.accounts[cancel.walletAccountID];
    wallet.balances[cancel.feeTokenID].balance =
      wallet.balances[cancel.feeTokenID].balance.add(feeToWallet);

    // Update operator
    const operator = newRealm.accounts[operatorAccountID];
    operator.balances[cancel.feeTokenID].balance =
      operator.balances[cancel.feeTokenID].balance.add(feeToOperator);

    const simulatorReport: SimulatorReport = {
      realmBefore: realm,
      realmAfter: newRealm,
    };
    return simulatorReport;
  }

  public settleRing(ring: RingInfo, realm: Realm, timestamp: number, operatorAccountID: number,
                    protocolFeeTakerBips: number, protocolFeeMakerBips: number) {
    const orderA = ring.orderA;
    const orderB = ring.orderB;

    let [fillAmountSA, fillAmountBA] = this.getMaxFillAmounts(ring.orderA, realm.accounts[ring.orderA.accountID]);
    let [fillAmountSB, fillAmountBB] = this.getMaxFillAmounts(ring.orderB, realm.accounts[ring.orderB.accountID]);

    if (fillAmountBA.lt(fillAmountSB)) {
      fillAmountSB = fillAmountBA;
      fillAmountBB = fillAmountSB.mul(ring.orderB.amountB).div(ring.orderB.amountS);
    } else {
      fillAmountBA = fillAmountSB;
      fillAmountSA = fillAmountBA.mul(ring.orderA.amountS).div(ring.orderA.amountB);
    }
    let spread = fillAmountSA.sub(fillAmountBB);

    // matchable
    let valid = true;
    valid = valid && this.checkValid(ring.orderA, fillAmountSA, fillAmountBA, timestamp);
    valid = valid && this.checkValid(ring.orderB, fillAmountSB, fillAmountBB, timestamp);

    if (!valid) {
      fillAmountSA = new BN(0);
      fillAmountBA = new BN(0);
      fillAmountSB = new BN(0);
      fillAmountBB = new BN(0);
      spread = new BN(0);
    }

    fillAmountSA = roundToFloatValue(fillAmountSA, constants.Float24Encoding);
    fillAmountSB = roundToFloatValue(fillAmountSB, constants.Float24Encoding);
    const aSpread = roundToFloatValue(spread.abs(), constants.Float24Encoding);
    spread = spread.lt(new BN(0)) ? aSpread.neg() : aSpread;
    const ringFee = roundToFloatValue(ring.fee, constants.Float12Encoding);

    fillAmountBA = fillAmountSB;
    fillAmountBB = fillAmountSA.sub(spread);

    const protocolFeeTradeSurplus = (spread.gt(new BN(0))) ?
                                    spread.mul(new BN(protocolFeeTakerBips)).div(new BN(100000)) :
                                    new BN(0);

    console.log("Simulator: ");

    console.log("fillAmountSA: " + fillAmountSA.toString(10));
    console.log("fillAmountBA: " + fillAmountBA.toString(10));

    console.log("fillAmountSB: " + fillAmountSB.toString(10));
    console.log("fillAmountBB: " + fillAmountBB.toString(10));

    console.log("spread: " + spread.toString(10));

    const [feeA, protocolFeeA, walletFeeA, matchingFeeA] = this.calculateFees(
      fillAmountBA,
      protocolFeeTakerBips,
      ring.orderA.feeBips,
      ring.orderA.walletSplitPercentage,
    );

    const [feeB, protocolFeeB, walletFeeB, matchingFeeB] = this.calculateFees(
      fillAmountBB,
      protocolFeeTakerBips,
      ring.orderB.feeBips,
      ring.orderB.walletSplitPercentage,
    );

    console.log("feeA: " + feeA.toString(10));
    console.log("protocolFeeA: " + protocolFeeA.toString(10));
    console.log("walletFeeA: " + walletFeeA.toString(10));
    console.log("matchingFeeA: " + matchingFeeA.toString(10));

    console.log("feeB: " + feeB.toString(10));
    console.log("protocolFeeB: " + protocolFeeB.toString(10));
    console.log("walletFeeB: " + walletFeeB.toString(10));
    console.log("matchingFeeB: " + matchingFeeB.toString(10));

    const newRealm = this.copyRealm(realm);

    // Update accountA
    const accountA = newRealm.accounts[ring.orderA.accountID];
    accountA.balances[ring.orderA.tokenIdS].balance =
      accountA.balances[ring.orderA.tokenIdS].balance.sub(fillAmountSA);
    accountA.balances[ring.orderA.tokenIdB].balance =
      accountA.balances[ring.orderA.tokenIdB].balance.add(fillAmountBA.sub(feeA));

    // Update accountB
    const accountB = newRealm.accounts[ring.orderB.accountID];
    accountB.balances[ring.orderB.tokenIdS].balance =
      accountB.balances[ring.orderB.tokenIdS].balance.sub(fillAmountSB);
    accountB.balances[ring.orderB.tokenIdB].balance =
      accountB.balances[ring.orderB.tokenIdB].balance.add(fillAmountBB.sub(feeB));

    // Update trade history A
    {
      const tradeHistorySlotA = orderA.orderID % (2 ** constants.TREE_DEPTH_TRADING_HISTORY);
      const tradeHistoryA = accountA.balances[orderA.tokenIdS].tradeHistory[tradeHistorySlotA];
      tradeHistoryA.filled = (orderA.orderID > tradeHistoryA.orderID) ? new BN(0) : tradeHistoryA.filled;
      tradeHistoryA.filled = tradeHistoryA.filled.add(fillAmountSA);
      tradeHistoryA.cancelled = (orderA.orderID > tradeHistoryA.orderID) ? false : tradeHistoryA.cancelled;
      tradeHistoryA.orderID = (orderA.orderID > tradeHistoryA.orderID) ? orderA.orderID : tradeHistoryA.orderID;
    }
    // Update trade history B
    {
      const tradeHistorySlotB = orderB.orderID % (2 ** constants.TREE_DEPTH_TRADING_HISTORY);
      const tradeHistoryB = accountB.balances[orderB.tokenIdS].tradeHistory[tradeHistorySlotB];
      tradeHistoryB.filled = (orderB.orderID > tradeHistoryB.orderID) ? new BN(0) : tradeHistoryB.filled;
      tradeHistoryB.filled = tradeHistoryB.filled.add(fillAmountSB);
      tradeHistoryB.cancelled = (orderB.orderID > tradeHistoryB.orderID) ? false : tradeHistoryB.cancelled;
      tradeHistoryB.orderID = (orderB.orderID > tradeHistoryB.orderID) ? orderB.orderID : tradeHistoryB.orderID;
    }

    // Update walletA
    const walletA = newRealm.accounts[ring.orderA.walletAccountID];
    walletA.balances[ring.orderA.tokenIdB].balance =
      walletA.balances[ring.orderA.tokenIdB].balance.add(walletFeeA);

    // Update walletB
    const walletB = newRealm.accounts[ring.orderB.walletAccountID];
    walletB.balances[ring.orderB.tokenIdB].balance =
      walletB.balances[ring.orderB.tokenIdB].balance.add(walletFeeB);

    // Update ringMatcher
    const ringMatcher = newRealm.accounts[ring.minerAccountID];
    // - MatchingFeeA
    ringMatcher.balances[ring.orderA.tokenIdB].balance =
     ringMatcher.balances[ring.orderA.tokenIdB].balance.add(matchingFeeA).sub(protocolFeeA);
    // - MatchingFeeB
    ringMatcher.balances[ring.orderB.tokenIdB].balance =
     ringMatcher.balances[ring.orderB.tokenIdB].balance.add(
       matchingFeeB.sub(protocolFeeB).add(spread.sub(protocolFeeTradeSurplus)),
     );
    // - Operator fee
    ringMatcher.balances[ring.tokenID].balance =
     ringMatcher.balances[ring.tokenID].balance.sub(ringFee);
    // Increase nonce
    ringMatcher.nonce++;

    // Update protocol fee recipient
    const protocolFeeAccount = newRealm.accounts[0];
    // - Order A
    protocolFeeAccount.balances[ring.orderA.tokenIdB].balance =
      protocolFeeAccount.balances[ring.orderA.tokenIdB].balance.add(protocolFeeA);
    // - Order B
    protocolFeeAccount.balances[ring.orderB.tokenIdB].balance =
      protocolFeeAccount.balances[ring.orderB.tokenIdB].balance.add(protocolFeeB.add(protocolFeeTradeSurplus));

    // Update operator
    const operator = newRealm.accounts[operatorAccountID];
    operator.balances[ring.tokenID].balance =
     operator.balances[ring.tokenID].balance.add(ringFee);

    // Check expected
    if (ring.expected) {
      if (ring.expected.orderA) {
        const filledFraction = (fillAmountSA.mul(new BN(10000)).div(ring.orderA.amountS).toNumber() / 10000);
        this.assertAlmostEqual(filledFraction, ring.expected.orderA.filledFraction, "OrderA filled", -3);
        if (ring.expected.orderA.spread !== undefined) {
          const nSpread = Number(ring.expected.orderA.spread.toString(10));
          this.assertAlmostEqual(Number(spread.toString(10)), nSpread, "OrderA spread", 0);
        }
      }
      if (ring.expected.orderB) {
        const filledFraction = (fillAmountSB.mul(new BN(10000)).div(ring.orderB.amountS).toNumber() / 10000);
        this.assertAlmostEqual(filledFraction, ring.expected.orderB.filledFraction, "OrderB filled", -3);
      }
    }

    const detailedTransfersA = this.getDetailedTransfers(
      ring, ring.orderA, ring.orderB,
      fillAmountSA, fillAmountBA, spread,
      feeA, walletFeeA, matchingFeeA,
    );

    const detailedTransfersB = this.getDetailedTransfers(
      ring, ring.orderB, ring.orderA,
      fillAmountSB, fillAmountBB, spread,
      feeB, walletFeeB, matchingFeeB,
    );

    const ringMatcherPayments: DetailedTokenTransfer = {
      description: "Ring-Matcher",
      token: 0,
      from: ring.minerAccountID,
      to: ring.minerAccountID,
      amount: new BN(0),
      subPayments: [],
    };
    const payProtocolFeeA: DetailedTokenTransfer = {
      description: "ProtocolFeeA",
      token: orderA.tokenIdB,
      from: ring.minerAccountID,
      to: 0,
      amount: protocolFeeA,
      subPayments: [],
    };
    const payProtocolFeeB: DetailedTokenTransfer = {
      description: "ProtocolFeeB",
      token: orderB.tokenIdB,
      from: ring.minerAccountID,
      to: 0,
      amount: protocolFeeB,
      subPayments: [],
    };
    const payProtocolFeeTradeSurplus: DetailedTokenTransfer = {
      description: "ProtocolFeeTradeSurplus",
      token: orderA.tokenIdS,
      from: ring.minerAccountID,
      to: 0,
      amount: protocolFeeTradeSurplus,
      subPayments: [],
    };
    const tradeDeficit = spread.gt(new BN(0)) ? new BN(0) : spread.abs();
    const payTradeDeficit: DetailedTokenTransfer = {
      description: "TradeDeficit",
      token: orderA.tokenIdS,
      from: ring.minerAccountID,
      to: orderB.accountID,
      amount: tradeDeficit,
      subPayments: [],
    };
    const operatorFee: DetailedTokenTransfer = {
      description: "OperatorFee",
      token: ring.tokenID,
      from: ring.minerAccountID,
      to: operatorAccountID,
      amount: ringFee,
      subPayments: [],
    };
    ringMatcherPayments.subPayments.push(payProtocolFeeA);
    ringMatcherPayments.subPayments.push(payProtocolFeeB);
    ringMatcherPayments.subPayments.push(payProtocolFeeTradeSurplus);
    ringMatcherPayments.subPayments.push(payTradeDeficit);
    ringMatcherPayments.subPayments.push(operatorFee);

    const detailedTransfers: DetailedTokenTransfer[] = [];
    detailedTransfers.push(...detailedTransfersA);
    detailedTransfers.push(...detailedTransfersB);
    detailedTransfers.push(ringMatcherPayments);

    const simulatorReport: RingSettlementSimulatorReport = {
      realmBefore: realm,
      realmAfter: newRealm,
      detailedTransfers,
    };
    return simulatorReport;
  }

  private getDetailedTransfers(ring: RingInfo, order: OrderInfo, orderTo: OrderInfo,
                               fillAmountS: BN, fillAmountB: BN, spread: BN,
                               totalFee: BN, walletFee: BN, matchingFee: BN) {

    const tradeSurplus = spread.gt(new BN(0)) ? spread : new BN(0);

    const sell: DetailedTokenTransfer = {
      description: "Sell",
      token: order.tokenIdS,
      from: order.accountID,
      to: orderTo.accountID,
      amount: fillAmountS,
      subPayments: [],
    };
    const toBuyer: DetailedTokenTransfer = {
      description: "ToBuyer",
      token: order.tokenIdS,
      from: order.accountID,
      to: orderTo.accountID,
      amount: fillAmountS.sub(tradeSurplus),
      subPayments: [],
    };
    const paySurplus: DetailedTokenTransfer = {
      description: "TradeSurplus",
      token: order.tokenIdS,
      from: order.accountID,
      to: ring.minerAccountID,
      amount: tradeSurplus,
      subPayments: [],
    };
    sell.subPayments.push(toBuyer);
    sell.subPayments.push(paySurplus);

    const fee: DetailedTokenTransfer = {
      description: "Fee@" + order.feeBips + "Bips",
      token: order.tokenIdB,
      from: order.accountID,
      to: 0,
      amount: totalFee,
      subPayments: [],
    };
    const feeWallet: DetailedTokenTransfer = {
      description: "Wallet@" + order.walletSplitPercentage + "%",
      token: order.tokenIdB,
      from: order.accountID,
      to: order.walletAccountID,
      amount: walletFee,
      subPayments: [],
    };
    const feeMatching: DetailedTokenTransfer = {
      description: "Matching@" + (100 - order.walletSplitPercentage) + "%",
      token: order.tokenIdB,
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
    const tradeHistorySlot = order.orderID % (2 ** constants.TREE_DEPTH_TRADING_HISTORY);
    let tradeHistory = accountData.balances[order.tokenIdS].tradeHistory[tradeHistorySlot];
    if (!tradeHistory) {
      tradeHistory = {
        filled: new BN(0),
        cancelled: false,
      };
    }
    // Trade history trimming
    const filled = (tradeHistory.orderID < order.orderID) ? new BN(0) : tradeHistory.filled;
    const cancelled = (tradeHistory.orderID > order.orderID) ? true : tradeHistory.cancelled;

    const balanceS = new BN(accountData.balances[order.tokenIdS].balance);
    const remainingS = cancelled ? new BN(0) : order.amountS.sub(filled);
    const fillAmountS = balanceS.lt(remainingS) ? balanceS : remainingS;

    const fillAmountB = fillAmountS.mul(order.amountB).div(order.amountS);
    return [fillAmountS, fillAmountB];
  }

  private calculateFees(fillB: BN,
                        protocolFeeBips: number, feeBips: number,
                        walletSplitPercentage: number) {
    const protocolFee = fillB.mul(new BN(protocolFeeBips)).div(new BN(100000));
    const fee = fillB.mul(new BN(feeBips)).div(new BN(10000));
    const walletFee = fee.mul(new BN(walletSplitPercentage)).div(new BN(100));
    const matchingFee = fee.sub(walletFee);
    return [fee, protocolFee, walletFee, matchingFee];
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
          orderID: tradeHistoryValue.orderID,
        };
      }
      balances[Number(tokenID)] = {
        balance: balanceValue.balance,
        tradeHistory,
      };
    }
    const accountCopy: Account = {
      publicKeyX: account.publicKeyX,
      publicKeyY: account.publicKeyY,
      nonce: account.nonce,
      balances,
    };
    return accountCopy;
  }

  private copyRealm(realm: Realm) {
    const accounts: Account[] = [];
    for (let accountID = 0; accountID < realm.accounts.length; accountID++) {
      accounts[accountID] = this.copyAccount(realm.accounts[accountID]);
    }
    const realmCopy: Realm = {
      accounts,
    };
    return realmCopy;
  }

  private ensure(valid: boolean, description: string) {
    if (!valid) {
      console.log(description);
    }
    return valid;
  }

  private assertAlmostEqual(n1: number, n2: number, description: string, precision: number) {
    // console.log("n1: " + n1);
    // console.log("n2: " + n2);
    // console.log("precision: " + (10 ** precision));
    return assert(Math.abs(n1 - n2) < (10 ** precision), description);
  }

}
