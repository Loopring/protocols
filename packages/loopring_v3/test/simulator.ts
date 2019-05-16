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
    let margin = fillAmountSA.sub(fillAmountBB);

    let valid = true;

    // matchable
    valid = valid && this.ensure(!fillAmountSA.lt(fillAmountBB), "Not matchable");

    valid = valid && this.checkValid(ring.orderA, fillAmountSA, fillAmountBA, timestamp);
    valid = valid && this.checkValid(ring.orderB, fillAmountSB, fillAmountBB, timestamp);

    if (!valid) {
      fillAmountSA = new BN(0);
      fillAmountBA = new BN(0);
      fillAmountSB = new BN(0);
      fillAmountBB = new BN(0);
      margin = new BN(0);
    }

    fillAmountSA = roundToFloatValue(fillAmountSA, constants.Float24Encoding);
    fillAmountSB = roundToFloatValue(fillAmountSB, constants.Float24Encoding);
    margin = roundToFloatValue(margin, constants.Float16Encoding);
    const ringFee = roundToFloatValue(ring.fee, constants.Float12Encoding);

    fillAmountBA = fillAmountSB;
    fillAmountBB = fillAmountSA.sub(margin);

    const protocolFeeMargin = margin.mul(new BN(protocolFeeTakerBips)).div(new BN(10000));

    /*console.log("Simulator: ");

    console.log("fillAmountSA: " + fillAmountSA.toString(10));
    console.log("fillAmountBA: " + fillAmountBA.toString(10));

    console.log("fillAmountSB: " + fillAmountSB.toString(10));
    console.log("fillAmountBB: " + fillAmountBB.toString(10));*/

    const [feeA, protocolFeeA, walletFeeA, matchingFeeA, rebateA] = this.calculateFees(
      fillAmountSA,
      fillAmountBA,
      protocolFeeTakerBips,
      ring.orderA.feeBips,
      ring.orderA.rebateBips,
      ring.orderA.walletSplitPercentage,
    );

    const [feeB, protocolFeeB, walletFeeB, matchingFeeB, rebateB] = this.calculateFees(
      fillAmountSB,
      fillAmountBB,
      protocolFeeTakerBips,
      ring.orderB.feeBips,
      ring.orderB.rebateBips,
      ring.orderB.walletSplitPercentage,
    );

    console.log("feeA: " + feeA.toString(10));
    console.log("protocolFeeA: " + protocolFeeA.toString(10));
    console.log("walletFeeA: " + walletFeeA.toString(10));
    console.log("matchingFeeA: " + matchingFeeA.toString(10));
    console.log("rebateA: " + rebateA.toString(10));

    console.log("feeB: " + feeB.toString(10));
    console.log("protocolFeeB: " + protocolFeeB.toString(10));
    console.log("walletFeeB: " + walletFeeB.toString(10));
    console.log("matchingFeeB: " + matchingFeeB.toString(10));
    console.log("rebateB: " + rebateB.toString(10));

    const newRealm = this.copyRealm(realm);

    // Update accountA
    const accountA = newRealm.accounts[ring.orderA.accountID];
    accountA.balances[ring.orderA.tokenIdS].balance =
      accountA.balances[ring.orderA.tokenIdS].balance.sub(fillAmountSA).add(rebateA);
    accountA.balances[ring.orderA.tokenIdB].balance =
      accountA.balances[ring.orderA.tokenIdB].balance.add(fillAmountBA.sub(feeA));

    // Update accountB
    const accountB = newRealm.accounts[ring.orderB.accountID];
    accountB.balances[ring.orderB.tokenIdS].balance =
      accountB.balances[ring.orderB.tokenIdS].balance.sub(fillAmountSB).add(rebateB);
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
     ringMatcher.balances[ring.orderA.tokenIdB].balance.add(matchingFeeA.sub(rebateB));
    // - MatchingFeeB
    ringMatcher.balances[ring.orderB.tokenIdB].balance =
     ringMatcher.balances[ring.orderB.tokenIdB].balance.add(
       matchingFeeB.add(margin.sub(protocolFeeMargin)).sub(rebateA),
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
      protocolFeeAccount.balances[ring.orderB.tokenIdB].balance.add(protocolFeeB.add(protocolFeeMargin));

    // Update operator
    const operator = newRealm.accounts[operatorAccountID];
    operator.balances[ring.tokenID].balance =
     operator.balances[ring.tokenID].balance.add(ringFee);

    // Check expected
    if (ring.expected) {
      if (ring.expected.orderA) {
        const filledFraction = (fillAmountSA.mul(new BN(10000)).div(ring.orderA.amountS).toNumber() / 10000);
        this.assertAlmostEqual(filledFraction, ring.expected.orderA.filledFraction, "OrderA filled", -3);
        if (ring.expected.orderA.margin !== undefined) {
          const nMargin = Number(ring.expected.orderA.margin.toString(10));
          this.assertAlmostEqual(Number(margin.toString(10)), nMargin, "OrderA margin", 0);
        }
      }
      if (ring.expected.orderB) {
        const filledFraction = (fillAmountSB.mul(new BN(10000)).div(ring.orderB.amountS).toNumber() / 10000);
        this.assertAlmostEqual(filledFraction, ring.expected.orderB.filledFraction, "OrderB filled", -3);
      }
    }

    /*const detailedTransfersA = this.getDetailedTransfers(
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
    );*/

    const operatorFee: DetailedTokenTransfer = {
      description: "OperatorFee",
      token: ring.tokenID,
      from: ring.minerAccountID,
      to: operatorAccountID,
      amount: ringFee,
      subPayments: [],
    };

    const detailedTransfers: DetailedTokenTransfer[] = [];
    /*detailedTransfers.push(...detailedTransfersA);
    detailedTransfers.push(...detailedTransfersB);*/
    detailedTransfers.push(operatorFee);

    const simulatorReport: RingSettlementSimulatorReport = {
      realmBefore: realm,
      realmAfter: newRealm,
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
      description: "Wallet@" + order.walletSplitPercentage + "%",
      token: order.tokenIdF,
      from: order.accountID,
      to: order.walletAccountID,
      amount: walletFee,
      subPayments: [],
    };
    const feeMatching: DetailedTokenTransfer = {
      description: "Matching@" + order.waiveFeePercentage + "%",
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

  private calculateFees(amountS: BN, amountB: BN,
                        protocolFeeBips: number, feeBips: number, rebateBips: number,
                        walletSplitPercentage: number) {
    const rebate = amountS.mul(new BN(rebateBips)).div(new BN(10000));
    const fee = amountB.mul(new BN(feeBips)).div(new BN(10000));
    const protocolFee = amountB.mul(new BN(protocolFeeBips)).div(new BN(100000));
    const spendableFee = fee.sub(protocolFee);
    const walletFee = spendableFee.mul(new BN(walletSplitPercentage)).div(new BN(100));
    const matchingFee = spendableFee.sub(walletFee);
    return [fee, protocolFee, walletFee, matchingFee, rebate];
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
