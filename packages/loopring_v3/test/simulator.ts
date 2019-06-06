import BN = require("bn.js");
import * as pjs from "protocol2-js";
import * as constants from "./constants";
import { fromFloat, roundToFloatValue } from "./float";
import { AccountLeaf, Balance, Cancel, Deposit, DetailedTokenTransfer, ExchangeState, OrderInfo,
         RingInfo, RingSettlementSimulatorReport, SimulatorReport,
         TradeHistory, WithdrawalRequest } from "./types";

interface SettlementValues {
  fillSA: BN;
  fillBA: BN;
  feeA: BN;
  protocolFeeA: BN;
  rebateA: BN;

  fillSB: BN;
  fillBB: BN;
  feeB: BN;
  protocolFeeB: BN;
  rebateB: BN;
}

interface Fill {
  S: BN;
  B: BN;
}

interface MatchResult {
  spread: BN;
  matchable: boolean;
}

export class Simulator {

  public deposit(deposit: Deposit, exchangeState: ExchangeState) {
    const newExchangeState = this.copyExchangeState(exchangeState);
    assert(deposit.accountID <= exchangeState.accounts.length, "accountID not incremented by 1");
    if (deposit.accountID === exchangeState.accounts.length) {
      // Make sure all tokens exist
      const balances: {[key: number]: Balance} = {};
      for (let i = 0; i < constants.MAX_NUM_TOKENS; i++) {
        balances[i] = {
          balance: new BN(0),
          tradeHistory: {},
        };
      }
      const emptyAccount: AccountLeaf = {
        publicKeyX: "0",
        publicKeyY: "0",
        nonce: 0,
        balances,
      };
      newExchangeState.accounts.push(emptyAccount);
    }
    const account = newExchangeState.accounts[deposit.accountID];
    account.balances[deposit.tokenID].balance =
      account.balances[deposit.tokenID].balance.add(deposit.amount);
    account.publicKeyX = deposit.publicKeyX;
    account.publicKeyY = deposit.publicKeyY;

    const simulatorReport: SimulatorReport = {
      exchangeStateBefore: exchangeState,
      exchangeStateAfter: newExchangeState,
    };
    return simulatorReport;
  }

  public onchainWithdraw(withdrawal: WithdrawalRequest, shutdown: boolean, exchangeState: ExchangeState) {
    const newExchangeState = this.copyExchangeState(exchangeState);

    // When a withdrawal is done before the deposit (account creation) we shouldn't
    // do anything. Just leave everything as it is.
    if (withdrawal.accountID < newExchangeState.accounts.length) {
      const account = newExchangeState.accounts[withdrawal.accountID];

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
      exchangeStateBefore: exchangeState,
      exchangeStateAfter: newExchangeState,
    };
    return simulatorReport;
  }

  public offchainWithdrawFromInputData(withdrawal: WithdrawalRequest,
                                       exchangeState: ExchangeState, operatorAccountID: number) {
    const fee = roundToFloatValue(withdrawal.fee, constants.Float16Encoding);

    const account = exchangeState.accounts[withdrawal.accountID];
    let balance = account.balances[withdrawal.tokenID].balance;
    if (withdrawal.tokenID === withdrawal.feeTokenID) {
      balance = balance.sub(fee);
    }
    const amountToWithdraw = (balance.lt(withdrawal.amount)) ? balance : withdrawal.amount;
    const amountWithdrawn = roundToFloatValue(amountToWithdraw, constants.Float28Encoding);

    // Update the Merkle tree with the input data
    const newExchangeState = this.offchainWithdraw(
      exchangeState,
      operatorAccountID, withdrawal.accountID, withdrawal.walletAccountID,
      withdrawal.tokenID, amountWithdrawn,
      withdrawal.feeTokenID, fee, withdrawal.walletSplitPercentage,
    );

    const simulatorReport: SimulatorReport = {
      exchangeStateBefore: exchangeState,
      exchangeStateAfter: newExchangeState,
    };
    return simulatorReport;
  }

  public offchainWithdrawFromOnchainData(bs: pjs.Bitstream, blockSize: number,
                                         withdrawalIndex: number, exchangeState: ExchangeState) {
    let offset = 0;

    // General data
    const exchangeID = bs.extractUint32(offset);
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
    const newExchangeState = this.offchainWithdraw(
      exchangeState,
      operatorAccountID, accountID, walletAccountID,
      token, amountWithdrawn,
      feeToken, fee, walletSplitPercentage,
    );

    return newExchangeState;
  }

  public offchainWithdraw(exchangeState: ExchangeState,
                          operatorAccountID: number, accountID: number, walletAccountID: number,
                          tokenID: number, amountWithdrawn: BN,
                          feeTokenID: number, fee: BN, walletSplitPercentage: number) {
    const newExchangeState = this.copyExchangeState(exchangeState);

    const feeToWallet = fee.mul(new BN(walletSplitPercentage)).div(new BN(100));
    const feeToOperator = fee.sub(feeToWallet);

    const account = newExchangeState.accounts[accountID];

    // Update balanceF
    account.balances[feeTokenID].balance =
      account.balances[feeTokenID].balance.sub(fee);

    // Update balance
    account.balances[tokenID].balance =
      account.balances[tokenID].balance.sub(amountWithdrawn);
    account.nonce++;

    // Update wallet
    const wallet = newExchangeState.accounts[walletAccountID];
    wallet.balances[feeTokenID].balance =
      wallet.balances[feeTokenID].balance.add(feeToWallet);

    // Update operator
    const operator = newExchangeState.accounts[operatorAccountID];
    operator.balances[feeTokenID].balance =
      operator.balances[feeTokenID].balance.add(feeToOperator);

    return newExchangeState;
  }

  public cancelOrderFromOnchainData(bs: pjs.Bitstream, cancelIndex: number, exchangeState: ExchangeState) {
    let offset = 0;

    // General data
    const exchangeID = bs.extractUint32(offset);
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
    const newExchangeState = this.cancelOrder(
      exchangeState,
      operatorAccountID, walletAccountID,
      accountID, orderToken, orderID,
      feeToken, fee, walletSplitPercentage,
    );

    return newExchangeState;
  }

  public cancelOrderFromInputData(cancel: Cancel, exchangeState: ExchangeState, operatorAccountID: number) {
    const fee = roundToFloatValue(cancel.fee, constants.Float16Encoding);

    // Update the Merkle tree with the input data
    const newExchangeState = this.cancelOrder(
      exchangeState,
      operatorAccountID, cancel.walletAccountID,
      cancel.accountID, cancel.orderTokenID, cancel.orderID,
      cancel.feeTokenID, fee, cancel.walletSplitPercentage,
    );

    const simulatorReport: SimulatorReport = {
      exchangeStateBefore: exchangeState,
      exchangeStateAfter: newExchangeState,
    };
    return simulatorReport;
  }

  public cancelOrder(exchangeState: ExchangeState,
                     operatorAccountID: number, walletAccountID: number,
                     accountID: number, orderTokenID: number, orderID: number,
                     feeTokenID: number, fee: BN, walletSplitPercentage: number) {
    const newExchangeState = this.copyExchangeState(exchangeState);

    const feeToWallet = fee.mul(new BN(walletSplitPercentage)).div(new BN(100));
    const feeToOperator = fee.sub(feeToWallet);

    const account = newExchangeState.accounts[accountID];

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
    const wallet = newExchangeState.accounts[walletAccountID];
    wallet.balances[feeTokenID].balance =
      wallet.balances[feeTokenID].balance.add(feeToWallet);

    // Update operator
    const operator = newExchangeState.accounts[operatorAccountID];
    operator.balances[feeTokenID].balance =
      operator.balances[feeTokenID].balance.add(feeToOperator);

    return newExchangeState;
  }

  public settleRingFromOnchainData(bs: pjs.Bitstream, ringIndex: number, exchangeState: ExchangeState) {
    let offset = 0;

    // General data
    const exchangeID = bs.extractUint32(offset);
    offset += 4 + 32 + 32 + 4;
    const protocolFeeTakerBips = bs.extractUint8(offset);
    offset += 1;
    const protocolFeeMakerBips = bs.extractUint8(offset);
    offset += 1;
    const operatorAccountID = parseInt(bs.extractBytesX(offset, 3).toString("hex"), 16);
    offset += 3;

    // Jump to the specified ring
    const ringSize = 25;
    offset += ringIndex * ringSize;

    // Ring data
    const ringMatcherAccountIdAndRingFee = bs.extractUint32(offset);
    offset += 4;
    const feeToken = bs.extractUint8(offset);
    offset += 1;

    // Order IDs
    const orderIds = parseInt(bs.extractBytesX(offset, 5).toString("hex"), 16);
    offset += 5;

    // Accounts
    const accounts = parseInt(bs.extractBytesX(offset, 5).toString("hex"), 16);
    offset += 5;

    // Order A
    const tokenA = bs.extractUint8(offset);
    offset += 1;
    const fFillSA = parseInt(bs.extractBytesX(offset, 3).toString("hex"), 16);
    offset += 3;
    const orderDataA = bs.extractUint8(offset);
    offset += 1;

    // Order B
    const tokenB = bs.extractUint8(offset);
    offset += 1;
    const fFillSB = parseInt(bs.extractBytesX(offset, 3).toString("hex"), 16);
    offset += 3;
    const orderDataB = bs.extractUint8(offset);
    offset += 1;

    // Further extraction of packed data
    const ringMatcherID = Math.floor(ringMatcherAccountIdAndRingFee / (2 ** 12));
    const fRingFee = ringMatcherAccountIdAndRingFee & 0xFFF;

    const orderIdA = Math.floor(orderIds / (2 ** 20));
    const orderIdB = orderIds & 0xFFFFF;

    const orderOwnerA = Math.floor(accounts / (2 ** 20));
    const orderOwnerB = accounts & 0xFFFFF;

    const buyMaskA = orderDataA & 0b10000000;
    const rebateMaskA = orderDataA & 0b01000000;
    const feeOrRebateA = orderDataA & 0b00111111;
    const buyA = buyMaskA > 0;
    const feeBipsA = rebateMaskA > 0 ? 0 : feeOrRebateA;
    const rebateBipsA = rebateMaskA > 0 ? feeOrRebateA : 0;

    const buyMaskB = orderDataB & 0b10000000;
    const rebateMaskB = orderDataB & 0b01000000;
    const feeOrRebateB = orderDataB & 0b00111111;
    const buyB = buyMaskB > 0;
    const feeBipsB = rebateMaskB > 0 ? 0 : feeOrRebateB;
    const rebateBipsB = rebateMaskB > 0 ? feeOrRebateB : 0;

    // Decode the float values
    const ringFee = fromFloat(fRingFee, constants.Float12Encoding);
    const fillSA = fromFloat(fFillSA, constants.Float24Encoding);
    const fillSB = fromFloat(fFillSB, constants.Float24Encoding);

    // Update the Merkle tree with the onchain data
    const {newExchangeState, s} = this.settleRing(
      exchangeState, protocolFeeTakerBips, protocolFeeMakerBips,
      operatorAccountID, ringMatcherID, feeToken, ringFee,
      fillSA, fillSB,
      buyA, buyB,
      tokenA, tokenB,
      orderIdA, orderOwnerA, feeBipsA, rebateBipsA,
      orderIdB, orderOwnerB, feeBipsB, rebateBipsB,
    );

    return newExchangeState;
  }

  public settleRingFromInputData(ring: RingInfo, exchangeState: ExchangeState, timestamp: number,
                                 operatorAccountID: number,
                                 protocolFeeTakerBips: number, protocolFeeMakerBips: number) {

    const fillA = this.getMaxFillAmounts(ring.orderA, exchangeState.accounts[ring.orderA.accountID]);
    const fillB = this.getMaxFillAmounts(ring.orderB, exchangeState.accounts[ring.orderB.accountID]);

    console.log("MaxFillA.S: " + fillA.S.toString(10));
    console.log("MaxFillA.B: " + fillA.B.toString(10));
    console.log("MaxFillB.S: " + fillB.S.toString(10));
    console.log("MaxFillB.B: " + fillB.B.toString(10));

    let matchResult: MatchResult;
    if (ring.orderA.buy) {
      matchResult = this.match(ring.orderA, fillA, ring.orderB, fillB);
      fillA.S = fillB.B;
    } else {
      matchResult = this.match(ring.orderB, fillB, ring.orderA, fillA);
      fillA.B = fillB.S;
    }
    console.log("spread:     " + matchResult.spread.toString(10));

    let valid = matchResult.matchable;
    valid = valid && this.checkValid(ring.orderA, fillA.S, fillA.B, timestamp);
    valid = valid && this.checkValid(ring.orderB, fillB.S, fillB.B, timestamp);

    if (!valid) {
      fillA.S = new BN(0);
      fillA.B = new BN(0);
      fillB.S = new BN(0);
      fillB.B = new BN(0);
    }

    fillA.S = roundToFloatValue(fillA.S, constants.Float24Encoding);
    fillB.S = roundToFloatValue(fillB.S, constants.Float24Encoding);
    const ringFee = roundToFloatValue(ring.fee, constants.Float12Encoding);

    const {newExchangeState, s} = this.settleRing(
      exchangeState, protocolFeeTakerBips, protocolFeeMakerBips,
      operatorAccountID, ring.minerAccountID, ring.tokenID, ringFee,
      fillA.S, fillB.S,
      ring.orderA.buy, ring.orderB.buy,
      ring.orderA.tokenIdS, ring.orderB.tokenIdS,
      ring.orderA.orderID, ring.orderA.accountID, ring.orderA.feeBips, ring.orderA.rebateBips,
      ring.orderB.orderID, ring.orderB.accountID, ring.orderB.feeBips, ring.orderB.rebateBips,
    );

    // Check expected
    if (ring.expected) {
      if (ring.expected.orderA) {
        const filledFraction = ring.orderA.buy ?
                               (fillA.B.mul(new BN(10000)).div(ring.orderA.amountB).toNumber() / 10000) :
                               (fillA.S.mul(new BN(10000)).div(ring.orderA.amountS).toNumber() / 10000);
        this.assertAlmostEqual(filledFraction, ring.expected.orderA.filledFraction, "OrderA filled", -3);
        if (ring.expected.orderA.spread !== undefined) {
          const nSpread = Number(ring.expected.orderA.spread.toString(10));
          this.assertAlmostEqual(Number(matchResult.spread.toString(10)), nSpread, "spread", 0);
        }
      }
      if (ring.expected.orderB) {
        const filledFraction = ring.orderB.buy ?
                               (fillB.B.mul(new BN(10000)).div(ring.orderB.amountB).toNumber() / 10000) :
                               (fillB.S.mul(new BN(10000)).div(ring.orderB.amountS).toNumber() / 10000);
        this.assertAlmostEqual(filledFraction, ring.expected.orderB.filledFraction, "OrderB filled", -3);
      }
    }

    const detailedTransfersA = this.getDetailedTransfers(
      ring, ring.orderA, ring.orderB,
      fillA.S, fillA.B, s.feeA,
    );

    const detailedTransfersB = this.getDetailedTransfers(
      ring, ring.orderB, ring.orderA,
      fillB.S, fillB.B, s.feeB,
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
    const payRebateA: DetailedTokenTransfer = {
      description: "RebateA",
      token: ring.orderA.tokenIdB,
      from: ring.minerAccountID,
      to: ring.orderB.accountID,
      amount: s.rebateA,
      subPayments: [],
    };
    const payRebateB: DetailedTokenTransfer = {
      description: "RebateB",
      token: ring.orderB.tokenIdB,
      from: ring.minerAccountID,
      to: ring.orderB.accountID,
      amount: s.rebateB,
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
    ringMatcherPayments.subPayments.push(payRebateA);
    ringMatcherPayments.subPayments.push(payRebateB);
    ringMatcherPayments.subPayments.push(operatorFee);

    const detailedTransfers: DetailedTokenTransfer[] = [];
    detailedTransfers.push(...detailedTransfersA);
    detailedTransfers.push(...detailedTransfersB);
    detailedTransfers.push(ringMatcherPayments);

    const simulatorReport: RingSettlementSimulatorReport = {
      exchangeStateBefore: exchangeState,
      exchangeStateAfter: newExchangeState,
      detailedTransfers,
    };
    return simulatorReport;
  }

  public calculateSettlementValues(protocolFeeTakerBips: number, protocolFeeMakerBips: number,
                                   fillSA: BN, fillSB: BN,
                                   feeBipsA: number, feeBipsB: number,
                                   rebateBipsA: number, rebateBipsB: number) {
    const fillBA = fillSB;
    const fillBB = fillSA;

    console.log("Simulator: ");
    console.log("fillSA: " + fillSA.toString(10));
    console.log("fillBA: " + fillBA.toString(10));
    console.log("fillSB: " + fillSB.toString(10));
    console.log("fillBB: " + fillBB.toString(10));

    const [feeA, protocolFeeA, rebateA] = this.calculateFees(
      fillBA,
      protocolFeeTakerBips,
      feeBipsA,
      rebateBipsA,
    );

    const [feeB, protocolFeeB, rebateB] = this.calculateFees(
      fillBB,
      protocolFeeMakerBips,
      feeBipsB,
      rebateBipsB,
    );

    console.log("feeA: " + feeA.toString(10));
    console.log("protocolFeeA: " + protocolFeeA.toString(10));

    console.log("feeB: " + feeB.toString(10));
    console.log("protocolFeeB: " + protocolFeeB.toString(10));

    const settlementValues: SettlementValues = {
      fillSA,
      fillBA,
      feeA,
      protocolFeeA,
      rebateA,

      fillSB,
      fillBB,
      feeB,
      protocolFeeB,
      rebateB,
    };
    return settlementValues;
  }

  public settleRing(exchangeState: ExchangeState, protocolFeeTakerBips: number, protocolFeeMakerBips: number,
                    operatorId: number, ringMatcherId: number, feeToken: number, ringFee: BN,
                    fillSA: BN, fillSB: BN,
                    buyA: boolean, buyB: boolean,
                    tokenA: number, tokenB: number,
                    orderIdA: number, accountIdA: number, feeBipsA: number, rebateBipsA: number,
                    orderIdB: number, accountIdB: number, feeBipsB: number, rebateBipsB: number) {
    const s = this.calculateSettlementValues(
      protocolFeeTakerBips, protocolFeeMakerBips,
      fillSA, fillSB,
      feeBipsA, feeBipsB,
      rebateBipsA, rebateBipsB,
    );

    const newExchangeState = this.copyExchangeState(exchangeState);

    // Update accountA
    const accountA = newExchangeState.accounts[accountIdA];
    accountA.balances[tokenA].balance =
      accountA.balances[tokenA].balance.sub(s.fillSA);
    accountA.balances[tokenB].balance =
      accountA.balances[tokenB].balance.add(s.fillBA.sub(s.feeA).add(s.rebateA));

    // Update accountB
    const accountB = newExchangeState.accounts[accountIdB];
    accountB.balances[tokenB].balance =
      accountB.balances[tokenB].balance.sub(s.fillSB);
    accountB.balances[tokenA].balance =
      accountB.balances[tokenA].balance.add(s.fillBB.sub(s.feeB).add(s.rebateB));

    // Update trade history A
    {
      const tradeHistorySlotA = orderIdA % (2 ** constants.TREE_DEPTH_TRADING_HISTORY);
      const tradeHistoryA = accountA.balances[tokenA].tradeHistory[tradeHistorySlotA];
      tradeHistoryA.filled = (orderIdA > tradeHistoryA.orderID) ? new BN(0) : tradeHistoryA.filled;
      tradeHistoryA.filled = tradeHistoryA.filled.add(buyA ? s.fillBA : s.fillSA);
      tradeHistoryA.cancelled = (orderIdA > tradeHistoryA.orderID) ? false : tradeHistoryA.cancelled;
      tradeHistoryA.orderID = (orderIdA > tradeHistoryA.orderID) ? orderIdA : tradeHistoryA.orderID;
    }
    // Update trade history B
    {
      const tradeHistorySlotB = orderIdB % (2 ** constants.TREE_DEPTH_TRADING_HISTORY);
      const tradeHistoryB = accountB.balances[tokenB].tradeHistory[tradeHistorySlotB];
      tradeHistoryB.filled = (orderIdB > tradeHistoryB.orderID) ? new BN(0) : tradeHistoryB.filled;
      tradeHistoryB.filled = tradeHistoryB.filled.add(buyB ? s.fillBB : s.fillSB);
      tradeHistoryB.cancelled = (orderIdB > tradeHistoryB.orderID) ? false : tradeHistoryB.cancelled;
      tradeHistoryB.orderID = (orderIdB > tradeHistoryB.orderID) ? orderIdB : tradeHistoryB.orderID;
    }

    // Update ringMatcher
    const ringMatcher = newExchangeState.accounts[ringMatcherId];
    // - FeeA
    ringMatcher.balances[tokenB].balance =
     ringMatcher.balances[tokenB].balance.add(s.feeA).sub(s.protocolFeeA).sub(s.rebateA);
    // - FeeB
    ringMatcher.balances[tokenA].balance =
     ringMatcher.balances[tokenA].balance.add(s.feeB).sub(s.protocolFeeB).sub(s.rebateB);
    // - Operator fee
    ringMatcher.balances[feeToken].balance =
     ringMatcher.balances[feeToken].balance.sub(ringFee);
    // Increase nonce
    ringMatcher.nonce++;

    // Update protocol fee recipient
    const protocolFeeAccount = newExchangeState.accounts[0];
    // - Order A
    protocolFeeAccount.balances[tokenB].balance =
      protocolFeeAccount.balances[tokenB].balance.add(s.protocolFeeA);
    // - Order B
    protocolFeeAccount.balances[tokenA].balance =
      protocolFeeAccount.balances[tokenA].balance.add(s.protocolFeeB);

    // Update operator
    const operator = newExchangeState.accounts[operatorId];
    operator.balances[feeToken].balance =
     operator.balances[feeToken].balance.add(ringFee);

    return {newExchangeState, s};
  }

  private getDetailedTransfers(ring: RingInfo, order: OrderInfo, orderTo: OrderInfo,
                               fillAmountS: BN, fillAmountB: BN, fee: BN) {
    const sell: DetailedTokenTransfer = {
      description: "Sell",
      token: order.tokenIdS,
      from: order.accountID,
      to: orderTo.accountID,
      amount: fillAmountS,
      subPayments: [],
    };
    const payFee: DetailedTokenTransfer = {
      description: "Fee@" + order.feeBips + "Bips",
      token: order.tokenIdB,
      from: order.accountID,
      to: ring.minerAccountID,
      amount: fee,
      subPayments: [],
    };

    const detailedTransfers: DetailedTokenTransfer[] = [];
    detailedTransfers.push(sell);
    detailedTransfers.push(payFee);

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
    let filled = (tradeHistory.orderID < order.orderID) ? new BN(0) : tradeHistory.filled;
    const cancelled = (tradeHistory.orderID > order.orderID) ? true : tradeHistory.cancelled;

    const balanceS = new BN(accountData.balances[order.tokenIdS].balance);

    let remainingS = new BN(0);
    if (order.buy) {
      filled = order.amountB.lt(filled) ? order.amountB : filled;
      const remainingB = cancelled ? new BN(0) : order.amountB.sub(filled);
      remainingS = remainingB.mul(order.amountS).div(order.amountB);
    } else {
      filled = order.amountS.lt(filled) ? order.amountS : filled;
      remainingS = cancelled ? new BN(0) : order.amountS.sub(filled);
    }
    const fillAmountS = balanceS.lt(remainingS) ? balanceS : remainingS;
    const fillAmountB = fillAmountS.mul(order.amountB).div(order.amountS);
    const fill: Fill = {
      S: fillAmountS,
      B: fillAmountB,
    };
    return fill;
  }

  private match(takerOrder: OrderInfo, takerFill: Fill, makerOrder: OrderInfo, makerFill: Fill) {
    if (takerFill.B.lt(makerFill.S)) {
      makerFill.S = takerFill.B;
      makerFill.B = makerFill.S.mul(makerOrder.amountB).div(makerOrder.amountS);
    } else {
      takerFill.B = makerFill.S;
      takerFill.S = takerFill.B.mul(takerOrder.amountS).div(takerOrder.amountB);
    }
    const spread = takerFill.S.sub(makerFill.B);
    const matchable = this.ensure(takerFill.S.gte(makerFill.B), "not matchable");
    const result: MatchResult = {
      spread,
      matchable,
    };
    return result;
  }

  private calculateFees(fillB: BN, protocolFeeBips: number, feeBips: number, rebateBips: number) {
    const protocolFee = fillB.mul(new BN(protocolFeeBips)).div(new BN(100000));
    const fee = fillB.mul(new BN(feeBips)).div(new BN(10000));
    const rebate = fillB.mul(new BN(rebateBips)).div(new BN(10000));
    return [fee, protocolFee, rebate];
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

    valid = valid && this.ensure(!(!order.buy && order.allOrNone && fillAmountS.lt(order.amountS)), "allOrNone sell");
    valid = valid && this.ensure(!(order.buy && order.allOrNone && fillAmountB.lt(order.amountB)), "allOrNone buy");
    valid = valid && this.ensure(!this.hasRoundingError(fillAmountS, order.amountB, order.amountS), "rounding error");
    valid = valid && this.ensure(!fillAmountS.eq(0), "no tokens sold");
    valid = valid && this.ensure(!fillAmountB.eq(0), "no tokens bought");

    return valid;
  }

  private copyAccount(account: AccountLeaf) {
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
    const accountCopy: AccountLeaf = {
      publicKeyX: account.publicKeyX,
      publicKeyY: account.publicKeyY,
      nonce: account.nonce,
      balances,
    };
    return accountCopy;
  }

  private copyExchangeState(exchangeState: ExchangeState) {
    const accounts: AccountLeaf[] = [];
    for (let accountID = 0; accountID < exchangeState.accounts.length; accountID++) {
      accounts[accountID] = this.copyAccount(exchangeState.accounts[accountID]);
    }
    const exchangeStateCopy: ExchangeState = {
      accounts,
    };
    return exchangeStateCopy;
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
