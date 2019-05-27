import BN = require("bn.js");
import * as pjs from "protocol2-js";
import * as constants from "./constants";
import { fromFloat, roundToFloatValue, toFloat } from "./float";
import { Account, Balance, Block, Cancel, CancelBlock, Deposit, DetailedTokenTransfer, OrderInfo,
         Realm, RingExpectation, RingInfo, RingSettlementSimulatorReport, SimulatorReport,
         TradeHistory, Wallet, Withdrawal, WithdrawalRequest, WithdrawBlock } from "./types";

interface SettlementValues {
  fillSA: BN;
  fillBA: BN;
  feeA: BN;
  walletFeeA: BN;
  matchingFeeA: BN;
  protocolFeeA: BN;

  fillSB: BN;
  fillBB: BN;
  feeB: BN;
  walletFeeB: BN;
  matchingFeeB: BN;
  protocolFeeB: BN;

  protocolFeeTradeSurplus: BN;
}

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

  public offchainWithdrawFromInputData(withdrawal: WithdrawalRequest, realm: Realm, operatorAccountID: number) {
    const fee = roundToFloatValue(withdrawal.fee, constants.Float16Encoding);

    const account = realm.accounts[withdrawal.accountID];
    let balance = account.balances[withdrawal.tokenID].balance;
    if (withdrawal.tokenID === withdrawal.feeTokenID) {
      balance = balance.sub(fee);
    }
    const amountToWithdraw = (balance.lt(withdrawal.amount)) ? balance : withdrawal.amount;
    const amountWithdrawn = roundToFloatValue(amountToWithdraw, constants.Float28Encoding);

    // Update the Merkle tree with the input data
    const newRealm = this.offchainWithdraw(
      realm,
      operatorAccountID, withdrawal.accountID, withdrawal.walletAccountID,
      withdrawal.tokenID, amountWithdrawn,
      withdrawal.feeTokenID, fee, withdrawal.walletSplitPercentage,
    );

    const simulatorReport: SimulatorReport = {
      realmBefore: realm,
      realmAfter: newRealm,
    };
    return simulatorReport;
  }

  public offchainWithdrawFromOnchainData(bs: pjs.Bitstream, blockSize: number, withdrawalIndex: number, realm: Realm) {
    let offset = 0;

    // General data
    const realmId = bs.extractUint32(offset);
    offset += 4 + 32 + 32;

    const onchainDataOffset = offset;

    // Jump to the specified withdrawal
    const onchainDataSize = 7;
    offset += withdrawalIndex * onchainDataSize;

    // Extract onchain data
    const token = bs.extractUint8(offset);
    offset += 1;
    const accountIdAndAmountWithdrawn = parseInt(bs.extractBytesX(offset, 6).toString("hex"), 16);
    offset += 6;

    offset = onchainDataOffset + blockSize * onchainDataSize;

    // General data
    const operatorAccountID = parseInt(bs.extractBytesX(offset, 3).toString("hex"), 16);
    offset += 3;

    // Jump to the specified withdrawal
    const offchainDataSize = 7;
    offset += withdrawalIndex * offchainDataSize;

    // Extract offchain data
    const walletAccountID = parseInt(bs.extractBytesX(offset, 3).toString("hex"), 16);
    offset += 3;
    const feeToken = bs.extractUint8(offset);
    offset += 1;
    const fFee = bs.extractUint16(offset);
    offset += 2;
    const walletSplitPercentage = bs.extractUint8(offset);
    offset += 1;

    // Further extraction of packed data
    const accountID = Math.floor(accountIdAndAmountWithdrawn / (2 ** 28));
    const fAmountWithdrawn = accountIdAndAmountWithdrawn & 0xFFFFFFF;

    // Decode the float values
    const fee = fromFloat(fFee, constants.Float16Encoding);
    const amountWithdrawn = fromFloat(fAmountWithdrawn, constants.Float28Encoding);

    // Update the Merkle tree with the onchain data
    const newRealm = this.offchainWithdraw(
      realm,
      operatorAccountID, accountID, walletAccountID,
      token, amountWithdrawn,
      feeToken, fee, walletSplitPercentage,
    );

    return newRealm;
  }

  public offchainWithdraw(realm: Realm,
                          operatorAccountID: number, accountID: number, walletAccountID: number,
                          tokenID: number, amountWithdrawn: BN,
                          feeTokenID: number, fee: BN, walletSplitPercentage: number) {
    const newRealm = this.copyRealm(realm);

    const feeToWallet = fee.mul(new BN(walletSplitPercentage)).div(new BN(100));
    const feeToOperator = fee.sub(feeToWallet);

    const account = newRealm.accounts[accountID];

    // Update balanceF
    account.balances[feeTokenID].balance =
      account.balances[feeTokenID].balance.sub(fee);

    // Update balance
    account.balances[tokenID].balance =
      account.balances[tokenID].balance.sub(amountWithdrawn);
    account.nonce++;

    // Update wallet
    const wallet = newRealm.accounts[walletAccountID];
    wallet.balances[feeTokenID].balance =
      wallet.balances[feeTokenID].balance.add(feeToWallet);

    // Update operator
    const operator = newRealm.accounts[operatorAccountID];
    operator.balances[feeTokenID].balance =
      operator.balances[feeTokenID].balance.add(feeToOperator);

    return newRealm;
  }

  public cancelOrderFromOnchainData(bs: pjs.Bitstream, cancelIndex: number, realm: Realm) {
    let offset = 0;

    // General data
    const realmId = bs.extractUint32(offset);
    offset += 4 + 32 + 32;

    // General data
    const operatorAccountID = parseInt(bs.extractBytesX(offset, 3).toString("hex"), 16);
    offset += 3;

    // Jump to the specified withdrawal
    const onchainDataSize = 13;
    offset += cancelIndex * onchainDataSize;

    // Extract onchain data
    const accountIds = parseInt(bs.extractBytesX(offset, 5).toString("hex"), 16);
    offset += 5;
    const orderToken = bs.extractUint8(offset);
    offset += 1;
    const orderID = parseInt(bs.extractBytesX(offset, 3).toString("hex"), 16);
    offset += 3;
    const feeToken = bs.extractUint8(offset);
    offset += 1;
    const fFee = bs.extractUint16(offset);
    offset += 2;
    const walletSplitPercentage = bs.extractUint8(offset);
    offset += 1;

    // Further extraction of packed data
    const accountID = Math.floor(accountIds / (2 ** 20));
    const walletAccountID = accountIds & 0xFFFFF;

    // Decode the float values
    const fee = fromFloat(fFee, constants.Float16Encoding);

    // Update the Merkle tree with the onchain data
    const newRealm = this.cancelOrder(
      realm,
      operatorAccountID, walletAccountID,
      accountID, orderToken, orderID,
      feeToken, fee, walletSplitPercentage,
    );

    return newRealm;
  }

  public cancelOrderFromInputData(cancel: Cancel, realm: Realm, operatorAccountID: number) {
    const fee = roundToFloatValue(cancel.fee, constants.Float16Encoding);

    // Update the Merkle tree with the input data
    const newRealm = this.cancelOrder(
      realm,
      operatorAccountID, cancel.walletAccountID,
      cancel.accountID, cancel.orderTokenID, cancel.orderID,
      cancel.feeTokenID, fee, cancel.walletSplitPercentage,
    );

    const simulatorReport: SimulatorReport = {
      realmBefore: realm,
      realmAfter: newRealm,
    };
    return simulatorReport;
  }

  public cancelOrder(realm: Realm,
                     operatorAccountID: number, walletAccountID: number,
                     accountID: number, orderTokenID: number, orderID: number,
                     feeTokenID: number, fee: BN, walletSplitPercentage: number) {
    const newRealm = this.copyRealm(realm);

    const feeToWallet = fee.mul(new BN(walletSplitPercentage)).div(new BN(100));
    const feeToOperator = fee.sub(feeToWallet);

    const account = newRealm.accounts[accountID];

    // Update balance
    account.balances[orderTokenID].balance =
      account.balances[orderTokenID].balance.sub(fee);
    account.nonce++;

    // Update trade history
    if (!account.balances[orderTokenID].tradeHistory[orderID]) {
      account.balances[orderTokenID].tradeHistory[orderID] = {
        filled: new BN(0),
        cancelled: false,
        orderID: 0,
      };
    }
    account.balances[orderTokenID].tradeHistory[orderID].cancelled = true;

    // Update wallet
    const wallet = newRealm.accounts[walletAccountID];
    wallet.balances[feeTokenID].balance =
      wallet.balances[feeTokenID].balance.add(feeToWallet);

    // Update operator
    const operator = newRealm.accounts[operatorAccountID];
    operator.balances[feeTokenID].balance =
      operator.balances[feeTokenID].balance.add(feeToOperator);

    return newRealm;
  }

  public settleRingFromOnchainData(bs: pjs.Bitstream, ringIndex: number, realm: Realm) {
    let offset = 0;

    // General data
    const realmId = bs.extractUint32(offset);
    offset += 4 + 32 + 32 + 4;
    const protocolFeeTakerBips = bs.extractUint8(offset);
    offset += 1;
    const protocolFeeMakerBips = bs.extractUint8(offset);
    offset += 1;
    const operatorAccountID = parseInt(bs.extractBytesX(offset, 3).toString("hex"), 16);
    offset += 3;

    // Jump to the specified ring
    const ringSize = 35;
    offset += ringIndex * ringSize;

    // Ring data
    const ringMatcherAccountIdAndRingFee = bs.extractUint32(offset);
    offset += 4;
    const feeToken = bs.extractUint8(offset);
    offset += 1;
    const fSpread = parseInt(bs.extractBytesX(offset, 3).toString("hex"), 16);
    offset += 3;

    // Order IDs
    const orderIds = parseInt(bs.extractBytesX(offset, 5).toString("hex"), 16);
    offset += 5;

    // Order A
    const orderAccountsA = parseInt(bs.extractBytesX(offset, 5).toString("hex"), 16);
    offset += 5;
    const tokenA = bs.extractUint8(offset);
    offset += 1;
    const fFillSA = parseInt(bs.extractBytesX(offset, 3).toString("hex"), 16);
    offset += 3;
    const feeBipsA = bs.extractUint8(offset);
    offset += 1;
    let walletSplitPercentageA = bs.extractUint8(offset);
    offset += 1;

    // Order B
    const orderAccountsB = parseInt(bs.extractBytesX(offset, 5).toString("hex"), 16);
    offset += 5;
    const tokenB = bs.extractUint8(offset);
    offset += 1;
    const fFillSB = parseInt(bs.extractBytesX(offset, 3).toString("hex"), 16);
    offset += 3;
    const feeBipsB = bs.extractUint8(offset);
    offset += 1;
    const walletSplitPercentageB = bs.extractUint8(offset);
    offset += 1;

    // Further extraction of packed data
    const ringMatcherID = Math.floor(ringMatcherAccountIdAndRingFee / (2 ** 12));
    const fRingFee = ringMatcherAccountIdAndRingFee & 0xFFF;

    const orderIdA = Math.floor(orderIds / (2 ** 20));
    const orderIdB = orderIds & 0xFFFFF;

    const orderOwnerA = Math.floor(orderAccountsA / (2 ** 20));
    const walletA = orderAccountsA & 0xFFFFF;

    const orderOwnerB = Math.floor(orderAccountsB / (2 ** 20));
    const walletB = orderAccountsB & 0xFFFFF;

    const surplusMask = walletSplitPercentageA & 0b10000000;
    walletSplitPercentageA = walletSplitPercentageA & ~0b10000000;

    // Decode the float values
    const ringFee = fromFloat(fRingFee, constants.Float12Encoding);
    const fillSA = fromFloat(fFillSA, constants.Float24Encoding);
    const fillSB = fromFloat(fFillSB, constants.Float24Encoding);
    let spread = fromFloat(fSpread, constants.Float24Encoding);
    spread = surplusMask > 0 ? spread : spread.neg();

    // Update the Merkle tree with the onchain data
    const {newRealm, s} = this.settleRing(
      realm, protocolFeeTakerBips, protocolFeeMakerBips,
      operatorAccountID, ringMatcherID, feeToken, ringFee,
      fillSA, fillSB, spread, tokenA, tokenB,
      orderIdA, orderOwnerA, walletA, feeBipsA, walletSplitPercentageA,
      orderIdB, orderOwnerB, walletB, feeBipsB, walletSplitPercentageB,
    );

    return newRealm;
  }

  public settleRingFromInputData(ring: RingInfo, realm: Realm, timestamp: number, operatorAccountID: number,
                                 protocolFeeTakerBips: number, protocolFeeMakerBips: number) {
    let [fillSA, fillBA] = this.getMaxFillAmounts(ring.orderA, realm.accounts[ring.orderA.accountID]);
    let [fillSB, fillBB] = this.getMaxFillAmounts(ring.orderB, realm.accounts[ring.orderB.accountID]);

    if (fillBA.lt(fillSB)) {
      fillSB = fillBA;
      fillBB = fillSB.mul(ring.orderB.amountB).div(ring.orderB.amountS);
    } else {
      fillBA = fillSB;
      fillSA = fillBA.mul(ring.orderA.amountS).div(ring.orderA.amountB);
    }
    let spread = fillSA.sub(fillBB);

    // matchable
    let valid = true;
    valid = valid && this.checkValid(ring.orderA, fillSA, fillBA, timestamp);
    valid = valid && this.checkValid(ring.orderB, fillSB, fillBB, timestamp);

    if (!valid) {
      fillSA = new BN(0);
      fillBA = new BN(0);
      fillSB = new BN(0);
      fillBB = new BN(0);
      spread = new BN(0);
    }

    fillSA = roundToFloatValue(fillSA, constants.Float24Encoding);
    fillSB = roundToFloatValue(fillSB, constants.Float24Encoding);
    const aSpread = roundToFloatValue(spread.abs(), constants.Float24Encoding);
    spread = spread.lt(new BN(0)) ? aSpread.neg() : aSpread;
    const ringFee = roundToFloatValue(ring.fee, constants.Float12Encoding);

    const {newRealm, s} = this.settleRing(
      realm, protocolFeeTakerBips, protocolFeeMakerBips,
      operatorAccountID, ring.minerAccountID, ring.tokenID, ringFee,
      fillSA, fillSB, spread, ring.orderA.tokenIdS, ring.orderB.tokenIdS,
      ring.orderA.orderID, ring.orderA.accountID, ring.orderA.walletAccountID,
      ring.orderA.feeBips, ring.orderA.walletSplitPercentage,
      ring.orderB.orderID, ring.orderB.accountID, ring.orderB.walletAccountID,
      ring.orderB.feeBips, ring.orderB.walletSplitPercentage,
    );

    // Check expected
    if (ring.expected) {
      if (ring.expected.orderA) {
        const filledFraction = (fillSA.mul(new BN(10000)).div(ring.orderA.amountS).toNumber() / 10000);
        this.assertAlmostEqual(filledFraction, ring.expected.orderA.filledFraction, "OrderA filled", -3);
        if (ring.expected.orderA.spread !== undefined) {
          const nSpread = Number(ring.expected.orderA.spread.toString(10));
          this.assertAlmostEqual(Number(spread.toString(10)), nSpread, "OrderA spread", 0);
        }
      }
      if (ring.expected.orderB) {
        const filledFraction = (fillSB.mul(new BN(10000)).div(ring.orderB.amountS).toNumber() / 10000);
        this.assertAlmostEqual(filledFraction, ring.expected.orderB.filledFraction, "OrderB filled", -3);
      }
    }

    const detailedTransfersA = this.getDetailedTransfers(
      ring, ring.orderA, ring.orderB,
      fillSA, fillBA, spread,
      s.feeA, s.walletFeeA, s.matchingFeeA,
    );

    const detailedTransfersB = this.getDetailedTransfers(
      ring, ring.orderB, ring.orderA,
      fillSB, fillBB, new BN(0),
      s.feeB, s.walletFeeB, s.matchingFeeB,
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
      token: ring.orderA.tokenIdB,
      from: ring.minerAccountID,
      to: 0,
      amount: s.protocolFeeA,
      subPayments: [],
    };
    const payProtocolFeeB: DetailedTokenTransfer = {
      description: "ProtocolFeeB",
      token: ring.orderB.tokenIdB,
      from: ring.minerAccountID,
      to: 0,
      amount: s.protocolFeeB,
      subPayments: [],
    };
    const payProtocolFeeTradeSurplus: DetailedTokenTransfer = {
      description: "ProtocolFeeTradeSurplus",
      token: ring.orderA.tokenIdS,
      from: ring.minerAccountID,
      to: 0,
      amount: s.protocolFeeTradeSurplus,
      subPayments: [],
    };
    const tradeDeficit = spread.gt(new BN(0)) ? new BN(0) : spread.abs();
    const payTradeDeficit: DetailedTokenTransfer = {
      description: "TradeDeficit",
      token: ring.orderA.tokenIdS,
      from: ring.minerAccountID,
      to: ring.orderB.accountID,
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

  public calculateSettlementValues(protocolFeeTakerBips: number, protocolFeeMakerBips: number,
                                   fillSA: BN, fillSB: BN, spread: BN,
                                   feeBipsA: number, walletSplitPercentageA: number,
                                   feeBipsB: number, walletSplitPercentageB: number) {
    const fillBA = fillSB;
    const fillBB = fillSA.sub(spread);

    const protocolFeeTradeSurplus = (spread.gt(new BN(0))) ?
                                    spread.mul(new BN(protocolFeeTakerBips)).div(new BN(100000)) :
                                    new BN(0);

    console.log("Simulator: ");
    console.log("fillSA: " + fillSA.toString(10));
    console.log("fillBA: " + fillBA.toString(10));
    console.log("fillSB: " + fillSB.toString(10));
    console.log("fillBB: " + fillBB.toString(10));
    console.log("spread: " + spread.toString(10));

    const [feeA, protocolFeeA, walletFeeA, matchingFeeA] = this.calculateFees(
      fillBA,
      protocolFeeTakerBips,
      feeBipsA,
      walletSplitPercentageA,
    );

    const [feeB, protocolFeeB, walletFeeB, matchingFeeB] = this.calculateFees(
      fillBB,
      protocolFeeMakerBips,
      feeBipsB,
      walletSplitPercentageB,
    );

    console.log("feeA: " + feeA.toString(10));
    console.log("protocolFeeA: " + protocolFeeA.toString(10));
    console.log("walletFeeA: " + walletFeeA.toString(10));
    console.log("matchingFeeA: " + matchingFeeA.toString(10));

    console.log("feeB: " + feeB.toString(10));
    console.log("protocolFeeB: " + protocolFeeB.toString(10));
    console.log("walletFeeB: " + walletFeeB.toString(10));
    console.log("matchingFeeB: " + matchingFeeB.toString(10));

    const settlementValues: SettlementValues = {
      fillSA,
      fillBA,
      feeA,
      walletFeeA,
      matchingFeeA,
      protocolFeeA,

      fillSB,
      fillBB,
      feeB,
      walletFeeB,
      matchingFeeB,
      protocolFeeB,

      protocolFeeTradeSurplus,
    };
    return settlementValues;
  }

  public settleRing(realm: Realm, protocolFeeTakerBips: number, protocolFeeMakerBips: number,
                    operatorId: number, ringMatcherId: number, feeToken: number, ringFee: BN,
                    fillSA: BN, fillSB: BN, spread: BN, tokenA: number, tokenB: number,
                    orderIdA: number, accountIdA: number, walletIdA: number,
                    feeBipsA: number, walletSplitPercentageA: number,
                    orderIdB: number, accountIdB: number, walletIdB: number,
                    feeBipsB: number, walletSplitPercentageB: number) {
    const s = this.calculateSettlementValues(
      protocolFeeTakerBips, protocolFeeMakerBips,
      fillSA, fillSB, spread,
      feeBipsA, walletSplitPercentageA,
      feeBipsB, walletSplitPercentageB,
    );

    const newRealm = this.copyRealm(realm);

    // Update accountA
    const accountA = newRealm.accounts[accountIdA];
    accountA.balances[tokenA].balance =
      accountA.balances[tokenA].balance.sub(fillSA);
    accountA.balances[tokenB].balance =
      accountA.balances[tokenB].balance.add(s.fillBA.sub(s.feeA));

    // Update accountB
    const accountB = newRealm.accounts[accountIdB];
    accountB.balances[tokenB].balance =
      accountB.balances[tokenB].balance.sub(fillSB);
    accountB.balances[tokenA].balance =
      accountB.balances[tokenA].balance.add(s.fillBB.sub(s.feeB));

    // Update trade history A
    {
      const tradeHistorySlotA = orderIdA % (2 ** constants.TREE_DEPTH_TRADING_HISTORY);
      const tradeHistoryA = accountA.balances[tokenA].tradeHistory[tradeHistorySlotA];
      tradeHistoryA.filled = (orderIdA > tradeHistoryA.orderID) ? new BN(0) : tradeHistoryA.filled;
      tradeHistoryA.filled = tradeHistoryA.filled.add(fillSA);
      tradeHistoryA.cancelled = (orderIdA > tradeHistoryA.orderID) ? false : tradeHistoryA.cancelled;
      tradeHistoryA.orderID = (orderIdA > tradeHistoryA.orderID) ? orderIdA : tradeHistoryA.orderID;
    }
    // Update trade history B
    {
      const tradeHistorySlotB = orderIdB % (2 ** constants.TREE_DEPTH_TRADING_HISTORY);
      const tradeHistoryB = accountB.balances[tokenB].tradeHistory[tradeHistorySlotB];
      tradeHistoryB.filled = (orderIdB > tradeHistoryB.orderID) ? new BN(0) : tradeHistoryB.filled;
      tradeHistoryB.filled = tradeHistoryB.filled.add(fillSB);
      tradeHistoryB.cancelled = (orderIdB > tradeHistoryB.orderID) ? false : tradeHistoryB.cancelled;
      tradeHistoryB.orderID = (orderIdB > tradeHistoryB.orderID) ? orderIdB : tradeHistoryB.orderID;
    }

    // Update walletA
    const walletA = newRealm.accounts[walletIdA];
    walletA.balances[tokenB].balance =
      walletA.balances[tokenB].balance.add(s.walletFeeA);

    // Update walletB
    const walletB = newRealm.accounts[walletIdB];
    walletB.balances[tokenA].balance =
      walletB.balances[tokenA].balance.add(s.walletFeeB);

    // Update ringMatcher
    const ringMatcher = newRealm.accounts[ringMatcherId];
    // - MatchingFeeA
    ringMatcher.balances[tokenB].balance =
     ringMatcher.balances[tokenB].balance.add(s.matchingFeeA).sub(s.protocolFeeA);
    // - MatchingFeeB
    ringMatcher.balances[tokenA].balance =
     ringMatcher.balances[tokenA].balance.add(
      s.matchingFeeB.sub(s.protocolFeeB).add(spread.sub(s.protocolFeeTradeSurplus)),
     );
    // - Operator fee
    ringMatcher.balances[feeToken].balance =
     ringMatcher.balances[feeToken].balance.sub(ringFee);
    // Increase nonce
    ringMatcher.nonce++;

    // Update protocol fee recipient
    const protocolFeeAccount = newRealm.accounts[0];
    // - Order A
    protocolFeeAccount.balances[tokenB].balance =
      protocolFeeAccount.balances[tokenB].balance.add(s.protocolFeeA);
    // - Order B
    protocolFeeAccount.balances[tokenA].balance =
      protocolFeeAccount.balances[tokenA].balance.add(s.protocolFeeB.add(s.protocolFeeTradeSurplus));

    // Update operator
    const operator = newRealm.accounts[operatorId];
    operator.balances[feeToken].balance =
     operator.balances[feeToken].balance.add(ringFee);

    return {newRealm, s};
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
