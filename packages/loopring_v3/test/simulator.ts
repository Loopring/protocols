import BN = require("bn.js");
import { Bitstream } from "./bitstream";
import * as constants from "./constants";
import { fromFloat, roundToFloatValue } from "./float";
import { logDebug, logInfo } from "./logs";
import {
  AccountLeaf,
  Balance,
  Cancel,
  Deposit,
  DetailedTokenTransfer,
  ExchangeState,
  OrderInfo,
  RingInfo,
  RingSettlementSimulatorReport,
  SimulatorReport,
  TradeHistory,
  WithdrawalRequest
} from "./types";

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
    assert(
      deposit.accountID <= exchangeState.accounts.length,
      "accountID not incremented by 1"
    );
    if (deposit.accountID === exchangeState.accounts.length) {
      // Make sure all tokens exist
      const balances: { [key: number]: Balance } = {};
      for (let i = 0; i < constants.MAX_NUM_TOKENS; i++) {
        balances[i] = {
          balance: new BN(0),
          tradeHistory: {}
        };
      }
      const emptyAccount: AccountLeaf = {
        publicKeyX: "0",
        publicKeyY: "0",
        nonce: 0,
        balances
      };
      newExchangeState.accounts.push(emptyAccount);
    }
    const account = newExchangeState.accounts[deposit.accountID];
    account.balances[deposit.tokenID].balance = account.balances[
      deposit.tokenID
    ].balance.add(deposit.amount);
    if (account.balances[deposit.tokenID].balance.gt(constants.MAX_AMOUNT)) {
      account.balances[deposit.tokenID].balance = constants.MAX_AMOUNT;
    }
    account.publicKeyX = deposit.publicKeyX;
    account.publicKeyY = deposit.publicKeyY;

    const simulatorReport: SimulatorReport = {
      exchangeStateBefore: exchangeState,
      exchangeStateAfter: newExchangeState
    };
    return simulatorReport;
  }

  public onchainWithdraw(
    withdrawal: WithdrawalRequest,
    shutdown: boolean,
    exchangeState: ExchangeState
  ) {
    const newExchangeState = this.copyExchangeState(exchangeState);

    // When a withdrawal is done before the deposit (account creation) we shouldn't
    // do anything. Just leave everything as it is.
    if (withdrawal.accountID < newExchangeState.accounts.length) {
      const account = newExchangeState.accounts[withdrawal.accountID];

      const balance = account.balances[withdrawal.tokenID].balance;
      const amountToWithdrawMin = balance.lt(withdrawal.amount)
        ? balance
        : withdrawal.amount;
      const amountToWithdraw = shutdown ? balance : amountToWithdrawMin;
      const amountWithdrawn = roundToFloatValue(
        amountToWithdraw,
        constants.Float28Encoding
      );

      let amountToSubtract = amountWithdrawn;
      if (shutdown) {
        amountToSubtract = amountToWithdraw;
      }

      // Update balance
      account.balances[withdrawal.tokenID].balance = account.balances[
        withdrawal.tokenID
      ].balance.sub(amountToSubtract);

      if (shutdown) {
        account.publicKeyX = "0";
        account.publicKeyY = "0";
        account.nonce = 0;
        account.balances[withdrawal.tokenID].tradeHistory = {};
      }
    }

    const simulatorReport: SimulatorReport = {
      exchangeStateBefore: exchangeState,
      exchangeStateAfter: newExchangeState
    };
    return simulatorReport;
  }

  public offchainWithdrawFromInputData(
    withdrawal: WithdrawalRequest,
    exchangeState: ExchangeState,
    operatorAccountID: number
  ) {
    const fee = roundToFloatValue(withdrawal.fee, constants.Float16Encoding);

    const account = exchangeState.accounts[withdrawal.accountID];
    let balance = account.balances[withdrawal.tokenID].balance;
    if (withdrawal.tokenID === withdrawal.feeTokenID) {
      balance = balance.sub(fee);
    }
    const amountToWithdraw = balance.lt(withdrawal.amount)
      ? balance
      : withdrawal.amount;
    const amountWithdrawn = roundToFloatValue(
      amountToWithdraw,
      constants.Float28Encoding
    );

    // Update the Merkle tree with the input data
    const newExchangeState = this.offchainWithdraw(
      exchangeState,
      operatorAccountID,
      withdrawal.accountID,
      withdrawal.tokenID,
      amountWithdrawn,
      withdrawal.feeTokenID,
      fee
    );

    const simulatorReport: SimulatorReport = {
      exchangeStateBefore: exchangeState,
      exchangeStateAfter: newExchangeState
    };
    return simulatorReport;
  }

  public offchainWithdrawFromOnchainData(
    bs: Bitstream,
    blockSize: number,
    withdrawalIndex: number,
    exchangeState: ExchangeState
  ) {
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
    const accountIdAndAmountWithdrawn = bs.extractUint48(offset);
    offset += 6;

    offset = onchainDataOffset + 32 + blockSize * onchainDataSize;

    // General data
    const operatorAccountID = bs.extractUint24(offset);
    offset += 3;

    // Jump to the specified withdrawal
    const offchainDataSize = 3;
    offset += withdrawalIndex * offchainDataSize;

    // Extract offchain data
    const feeToken = bs.extractUint8(offset);
    offset += 1;
    const fFee = bs.extractUint16(offset);
    offset += 2;

    // Further extraction of packed data
    const accountID = Math.floor(accountIdAndAmountWithdrawn / 2 ** 28);
    const fAmountWithdrawn = accountIdAndAmountWithdrawn & 0xfffffff;

    // Decode the float values
    const fee = fromFloat(fFee, constants.Float16Encoding);
    const amountWithdrawn = fromFloat(
      fAmountWithdrawn,
      constants.Float28Encoding
    );

    // Update the Merkle tree with the onchain data
    const newExchangeState = this.offchainWithdraw(
      exchangeState,
      operatorAccountID,
      accountID,
      token,
      amountWithdrawn,
      feeToken,
      fee
    );

    return newExchangeState;
  }

  public offchainWithdraw(
    exchangeState: ExchangeState,
    operatorAccountID: number,
    accountID: number,
    tokenID: number,
    amountWithdrawn: BN,
    feeTokenID: number,
    fee: BN
  ) {
    const newExchangeState = this.copyExchangeState(exchangeState);

    const account = newExchangeState.accounts[accountID];

    // Update balanceF
    account.balances[feeTokenID].balance = account.balances[
      feeTokenID
    ].balance.sub(fee);

    // Update balance
    account.balances[tokenID].balance = account.balances[tokenID].balance.sub(
      amountWithdrawn
    );
    account.nonce++;

    // Update operator
    const operator = newExchangeState.accounts[operatorAccountID];
    operator.balances[feeTokenID].balance = operator.balances[
      feeTokenID
    ].balance.add(fee);

    return newExchangeState;
  }

  public cancelOrderFromOnchainData(
    bs: Bitstream,
    cancelIndex: number,
    exchangeState: ExchangeState
  ) {
    let offset = 0;

    // General data
    const exchangeID = bs.extractUint32(offset);
    offset += 4 + 32 + 32 + 32;

    // General data
    const operatorAccountID = bs.extractUint24(offset);
    offset += 3;

    // Jump to the specified order cancellation
    const onchainDataSize = 9;
    offset += cancelIndex * onchainDataSize;

    // Extract onchain data
    const accountIdAndOrderId = bs.extractUint40(offset);
    offset += 5;
    const orderToken = bs.extractUint8(offset);
    offset += 1;
    const feeToken = bs.extractUint8(offset);
    offset += 1;
    const fFee = bs.extractUint16(offset);
    offset += 2;

    // Further extraction of packed data
    const accountID = Math.floor(accountIdAndOrderId / 2 ** 20);
    const orderID = accountIdAndOrderId & 0xfffff;

    // Decode the float values
    const fee = fromFloat(fFee, constants.Float16Encoding);

    // Update the Merkle tree with the onchain data
    const newExchangeState = this.cancelOrder(
      exchangeState,
      operatorAccountID,
      accountID,
      orderToken,
      orderID,
      feeToken,
      fee
    );

    return newExchangeState;
  }

  public cancelOrderFromInputData(
    cancel: Cancel,
    exchangeState: ExchangeState,
    operatorAccountID: number
  ) {
    const fee = roundToFloatValue(cancel.fee, constants.Float16Encoding);

    // Update the Merkle tree with the input data
    const newExchangeState = this.cancelOrder(
      exchangeState,
      operatorAccountID,
      cancel.accountID,
      cancel.orderTokenID,
      cancel.orderID,
      cancel.feeTokenID,
      fee
    );

    const simulatorReport: SimulatorReport = {
      exchangeStateBefore: exchangeState,
      exchangeStateAfter: newExchangeState
    };
    return simulatorReport;
  }

  public cancelOrder(
    exchangeState: ExchangeState,
    operatorAccountID: number,
    accountID: number,
    orderTokenID: number,
    orderID: number,
    feeTokenID: number,
    fee: BN
  ) {
    const newExchangeState = this.copyExchangeState(exchangeState);

    const account = newExchangeState.accounts[accountID];
    const tradeHistorySlot =
      orderID % 2 ** constants.TREE_DEPTH_TRADING_HISTORY;

    // Update balance
    account.balances[feeTokenID].balance = account.balances[
      feeTokenID
    ].balance.sub(fee);
    account.nonce++;

    // Update trade history
    if (!account.balances[orderTokenID].tradeHistory[tradeHistorySlot]) {
      account.balances[orderTokenID].tradeHistory[tradeHistorySlot] = {
        filled: new BN(0),
        cancelled: false,
        orderID: 0
      };
    }
    const tradeHistory =
      account.balances[orderTokenID].tradeHistory[tradeHistorySlot];
    if (tradeHistory.orderID < orderID) {
      tradeHistory.filled = new BN(0);
    }
    tradeHistory.cancelled = true;
    tradeHistory.orderID = orderID;

    // Update operator
    const operator = newExchangeState.accounts[operatorAccountID];
    operator.balances[feeTokenID].balance = operator.balances[
      feeTokenID
    ].balance.add(fee);

    return newExchangeState;
  }

  public settleRingFromOnchainData(
    data: Bitstream,
    ringIndex: number,
    exchangeState: ExchangeState
  ) {
    let offset = 0;

    // General data
    const exchangeID = data.extractUint32(offset);
    offset += 4 + 32 + 32 + 4;
    const protocolFeeTakerBips = data.extractUint8(offset);
    offset += 1;
    const protocolFeeMakerBips = data.extractUint8(offset);
    offset += 1;
    // LabelHash
    offset += 32;
    const operatorAccountID = data.extractUint24(offset);
    offset += 3;

    // Jump to the specified ring
    const ringSize = 20;
    offset += ringIndex * ringSize;

    // Order IDs
    const orderIds = data.extractUint40(offset);
    offset += 5;

    // Accounts
    const accounts = data.extractUint40(offset);
    offset += 5;

    // Order A
    const tokenA = data.extractUint8(offset);
    offset += 1;
    const fFillSA = data.extractUint24(offset);
    offset += 3;
    const orderDataA = data.extractUint8(offset);
    offset += 1;

    // Order B
    const tokenB = data.extractUint8(offset);
    offset += 1;
    const fFillSB = data.extractUint24(offset);
    offset += 3;
    const orderDataB = data.extractUint8(offset);
    offset += 1;

    // Further extraction of packed data
    const orderIdA = Math.floor(orderIds / 2 ** 20);
    const orderIdB = orderIds & 0xfffff;

    const orderOwnerA = Math.floor(accounts / 2 ** 20);
    const orderOwnerB = accounts & 0xfffff;

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
    const fillSA = fromFloat(fFillSA, constants.Float24Encoding);
    const fillSB = fromFloat(fFillSB, constants.Float24Encoding);

    // Update the Merkle tree with the onchain data
    const { newExchangeState, s } = this.settleRing(
      exchangeState,
      protocolFeeTakerBips,
      protocolFeeMakerBips,
      operatorAccountID,
      fillSA,
      fillSB,
      buyA,
      buyB,
      tokenA,
      tokenB,
      orderIdA,
      orderOwnerA,
      feeBipsA,
      rebateBipsA,
      orderIdB,
      orderOwnerB,
      feeBipsB,
      rebateBipsB
    );

    return newExchangeState;
  }

  public settleRingFromInputData(
    ring: RingInfo,
    exchangeState: ExchangeState,
    timestamp: number,
    operatorAccountID: number,
    protocolFeeTakerBips: number,
    protocolFeeMakerBips: number
  ) {
    const fillA = this.getMaxFillAmounts(
      ring.orderA,
      exchangeState.accounts[ring.orderA.accountID]
    );
    const fillB = this.getMaxFillAmounts(
      ring.orderB,
      exchangeState.accounts[ring.orderB.accountID]
    );

    /*console.log("MaxFillA.S: " + fillA.S.toString(10));
    console.log("MaxFillA.B: " + fillA.B.toString(10));
    console.log("MaxFillB.S: " + fillB.S.toString(10));
    console.log("MaxFillB.B: " + fillB.B.toString(10));*/

    let matchResult: MatchResult;
    if (ring.orderA.buy) {
      matchResult = this.match(ring.orderA, fillA, ring.orderB, fillB);
      fillA.S = fillB.B;
    } else {
      matchResult = this.match(ring.orderB, fillB, ring.orderA, fillA);
      fillA.B = fillB.S;
    }
    logDebug("spread:     " + matchResult.spread.toString(10));

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

    // Validate
    this.validateOrder(
      exchangeState,
      ring.orderA,
      ring.orderB,
      false,
      fillA.S,
      fillA.B,
      valid
    );
    this.validateOrder(
      exchangeState,
      ring.orderB,
      ring.orderB,
      true,
      fillB.S,
      fillB.B,
      valid
    );

    const { newExchangeState, s } = this.settleRing(
      exchangeState,
      protocolFeeTakerBips,
      protocolFeeMakerBips,
      operatorAccountID,
      fillA.S,
      fillB.S,
      ring.orderA.buy,
      ring.orderB.buy,
      ring.orderA.tokenIdS,
      ring.orderB.tokenIdS,
      ring.orderA.orderID,
      ring.orderA.accountID,
      ring.orderA.feeBips,
      ring.orderA.rebateBips,
      ring.orderB.orderID,
      ring.orderB.accountID,
      ring.orderB.feeBips,
      ring.orderB.rebateBips
    );

    // Check expected
    if (ring.expected) {
      if (ring.expected.orderA) {
        const filledFraction = ring.orderA.buy
          ? fillA.B.mul(new BN(10000))
              .div(ring.orderA.amountB)
              .toNumber() / 10000
          : fillA.S.mul(new BN(10000))
              .div(ring.orderA.amountS)
              .toNumber() / 10000;
        this.assertAlmostEqual(
          filledFraction,
          ring.expected.orderA.filledFraction,
          "OrderA filled",
          -3
        );
        if (ring.expected.orderA.spread !== undefined) {
          const nSpread = Number(ring.expected.orderA.spread.toString(10));
          this.assertAlmostEqual(
            Number(matchResult.spread.toString(10)),
            nSpread,
            "spread",
            0
          );
        }
      }
      if (ring.expected.orderB) {
        const filledFraction = ring.orderB.buy
          ? fillB.B.mul(new BN(10000))
              .div(ring.orderB.amountB)
              .toNumber() / 10000
          : fillB.S.mul(new BN(10000))
              .div(ring.orderB.amountS)
              .toNumber() / 10000;
        this.assertAlmostEqual(
          filledFraction,
          ring.expected.orderB.filledFraction,
          "OrderB filled",
          -3
        );
      }
    }

    const paymentsA: DetailedTokenTransfer = {
      description: "OwnerA",
      token: 0,
      from: operatorAccountID,
      to: operatorAccountID,
      amount: new BN(0),
      subPayments: []
    };
    const detailedTransfersA = this.getDetailedTransfers(
      operatorAccountID,
      ring,
      ring.orderA,
      ring.orderB,
      fillA.S,
      fillA.B,
      s.feeA
    );
    paymentsA.subPayments.push(...detailedTransfersA);

    const paymentsB: DetailedTokenTransfer = {
      description: "OwnerB",
      token: 0,
      from: operatorAccountID,
      to: operatorAccountID,
      amount: new BN(0),
      subPayments: []
    };
    const detailedTransfersB = this.getDetailedTransfers(
      operatorAccountID,
      ring,
      ring.orderB,
      ring.orderA,
      fillB.S,
      fillB.B,
      s.feeB
    );
    paymentsB.subPayments.push(...detailedTransfersB);

    const paymentsOperator: DetailedTokenTransfer = {
      description: "Operator",
      token: 0,
      from: operatorAccountID,
      to: operatorAccountID,
      amount: new BN(0),
      subPayments: []
    };
    const payRebateA: DetailedTokenTransfer = {
      description: "RebateA",
      token: ring.orderA.tokenIdB,
      from: operatorAccountID,
      to: ring.orderA.accountID,
      amount: s.rebateA,
      subPayments: []
    };
    const payRebateB: DetailedTokenTransfer = {
      description: "RebateB",
      token: ring.orderB.tokenIdB,
      from: operatorAccountID,
      to: ring.orderB.accountID,
      amount: s.rebateB,
      subPayments: []
    };
    const payProtocolFeeA: DetailedTokenTransfer = {
      description: "ProtocolFeeA",
      token: ring.orderA.tokenIdB,
      from: operatorAccountID,
      to: 0,
      amount: s.protocolFeeA,
      subPayments: []
    };
    const payProtocolFeeB: DetailedTokenTransfer = {
      description: "ProtocolFeeB",
      token: ring.orderB.tokenIdB,
      from: operatorAccountID,
      to: 0,
      amount: s.protocolFeeB,
      subPayments: []
    };
    paymentsOperator.subPayments.push(payRebateA);
    paymentsOperator.subPayments.push(payRebateB);
    paymentsOperator.subPayments.push(payProtocolFeeA);
    paymentsOperator.subPayments.push(payProtocolFeeB);

    const detailedTransfers: DetailedTokenTransfer[] = [];
    detailedTransfers.push(paymentsA);
    detailedTransfers.push(paymentsB);
    detailedTransfers.push(paymentsOperator);

    const simulatorReport: RingSettlementSimulatorReport = {
      exchangeStateBefore: exchangeState,
      exchangeStateAfter: newExchangeState,
      detailedTransfers
    };
    return simulatorReport;
  }

  public calculateSettlementValues(
    protocolFeeTakerBips: number,
    protocolFeeMakerBips: number,
    fillSA: BN,
    fillSB: BN,
    feeBipsA: number,
    feeBipsB: number,
    rebateBipsA: number,
    rebateBipsB: number
  ) {
    const fillBA = fillSB;
    const fillBB = fillSA;

    /*console.log("Simulator: ");
    console.log("fillSA: " + fillSA.toString(10));
    console.log("fillBA: " + fillBA.toString(10));
    console.log("fillSB: " + fillSB.toString(10));
    console.log("fillBB: " + fillBB.toString(10));*/

    const [feeA, protocolFeeA, rebateA] = this.calculateFees(
      fillBA,
      protocolFeeTakerBips,
      feeBipsA,
      rebateBipsA
    );

    const [feeB, protocolFeeB, rebateB] = this.calculateFees(
      fillBB,
      protocolFeeMakerBips,
      feeBipsB,
      rebateBipsB
    );

    /*console.log("feeA: " + feeA.toString(10));
    console.log("protocolFeeA: " + protocolFeeA.toString(10));
    console.log("feeB: " + feeB.toString(10));
    console.log("protocolFeeB: " + protocolFeeB.toString(10));*/

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
      rebateB
    };
    return settlementValues;
  }

  public settleRing(
    exchangeState: ExchangeState,
    protocolFeeTakerBips: number,
    protocolFeeMakerBips: number,
    operatorId: number,
    fillSA: BN,
    fillSB: BN,
    buyA: boolean,
    buyB: boolean,
    tokenA: number,
    tokenB: number,
    orderIdA: number,
    accountIdA: number,
    feeBipsA: number,
    rebateBipsA: number,
    orderIdB: number,
    accountIdB: number,
    feeBipsB: number,
    rebateBipsB: number
  ) {
    const s = this.calculateSettlementValues(
      protocolFeeTakerBips,
      protocolFeeMakerBips,
      fillSA,
      fillSB,
      feeBipsA,
      feeBipsB,
      rebateBipsA,
      rebateBipsB
    );

    const newExchangeState = this.copyExchangeState(exchangeState);

    // Update accountA
    const accountA = newExchangeState.accounts[accountIdA];
    accountA.balances[tokenA].balance = accountA.balances[tokenA].balance.sub(
      s.fillSA
    );
    accountA.balances[tokenB].balance = accountA.balances[tokenB].balance.add(
      s.fillBA.sub(s.feeA).add(s.rebateA)
    );

    // Update accountB
    const accountB = newExchangeState.accounts[accountIdB];
    accountB.balances[tokenB].balance = accountB.balances[tokenB].balance.sub(
      s.fillSB
    );
    accountB.balances[tokenA].balance = accountB.balances[tokenA].balance.add(
      s.fillBB.sub(s.feeB).add(s.rebateB)
    );

    // Update trade history A
    {
      const tradeHistorySlotA =
        orderIdA % 2 ** constants.TREE_DEPTH_TRADING_HISTORY;
      const tradeHistoryA =
        accountA.balances[tokenA].tradeHistory[tradeHistorySlotA];
      tradeHistoryA.filled =
        orderIdA > tradeHistoryA.orderID ? new BN(0) : tradeHistoryA.filled;
      tradeHistoryA.filled = tradeHistoryA.filled.add(
        buyA ? s.fillBA : s.fillSA
      );
      tradeHistoryA.cancelled =
        orderIdA > tradeHistoryA.orderID ? false : tradeHistoryA.cancelled;
      tradeHistoryA.orderID =
        orderIdA > tradeHistoryA.orderID ? orderIdA : tradeHistoryA.orderID;
    }
    // Update trade history B
    {
      const tradeHistorySlotB =
        orderIdB % 2 ** constants.TREE_DEPTH_TRADING_HISTORY;
      const tradeHistoryB =
        accountB.balances[tokenB].tradeHistory[tradeHistorySlotB];
      tradeHistoryB.filled =
        orderIdB > tradeHistoryB.orderID ? new BN(0) : tradeHistoryB.filled;
      tradeHistoryB.filled = tradeHistoryB.filled.add(
        buyB ? s.fillBB : s.fillSB
      );
      tradeHistoryB.cancelled =
        orderIdB > tradeHistoryB.orderID ? false : tradeHistoryB.cancelled;
      tradeHistoryB.orderID =
        orderIdB > tradeHistoryB.orderID ? orderIdB : tradeHistoryB.orderID;
    }

    // Update protocol fee recipient
    const protocolFeeAccount = newExchangeState.accounts[0];
    // - Order A
    protocolFeeAccount.balances[tokenB].balance = protocolFeeAccount.balances[
      tokenB
    ].balance.add(s.protocolFeeA);
    // - Order B
    protocolFeeAccount.balances[tokenA].balance = protocolFeeAccount.balances[
      tokenA
    ].balance.add(s.protocolFeeB);

    // Update operator
    const operator = newExchangeState.accounts[operatorId];
    // - FeeA
    operator.balances[tokenB].balance = operator.balances[tokenB].balance
      .add(s.feeA)
      .sub(s.protocolFeeA)
      .sub(s.rebateA);
    // - FeeB
    operator.balances[tokenA].balance = operator.balances[tokenA].balance
      .add(s.feeB)
      .sub(s.protocolFeeB)
      .sub(s.rebateB);

    return { newExchangeState, s };
  }

  private getDetailedTransfers(
    operatorAccountID: number,
    ring: RingInfo,
    order: OrderInfo,
    orderTo: OrderInfo,
    fillAmountS: BN,
    fillAmountB: BN,
    fee: BN
  ) {
    const sell: DetailedTokenTransfer = {
      description: "Sell",
      token: order.tokenIdS,
      from: order.accountID,
      to: orderTo.accountID,
      amount: fillAmountS,
      subPayments: []
    };
    const payFee: DetailedTokenTransfer = {
      description: "Fee@" + order.feeBips + "Bips",
      token: order.tokenIdB,
      from: order.accountID,
      to: operatorAccountID,
      amount: fee,
      subPayments: []
    };

    const detailedTransfers: DetailedTokenTransfer[] = [];
    detailedTransfers.push(sell);
    detailedTransfers.push(payFee);

    return detailedTransfers;
  }

  private validateOrder(
    exchangeState: ExchangeState,
    order: OrderInfo,
    makerOrder: OrderInfo,
    isMakerOrder: boolean,
    fillS: BN,
    fillB: BN,
    valid: boolean
  ) {
    const account = exchangeState.accounts[order.accountID];
    assert(
      account.balances[order.tokenIdS].balance.gte(fillS),
      "can never spend more than balance"
    );

    if (valid) {
      const tradeHistory = this.getTradeHistory(order, account);
      if (tradeHistory.cancelled) {
        assert(
          fillS.isZero(),
          "fillS needS to be 0 when the order is cancelled"
        );
        assert(
          fillB.isZero(),
          "fillB needS to be 0 when the order is cancelled"
        );
      } else {
        if (!fillS.isZero() || !fillB.isZero()) {
          const multiplier = new BN(web3.utils.toWei("1000", "ether"));
          const orderRate = order.amountS.mul(multiplier).div(order.amountB);
          const rate = fillS.mul(multiplier).div(fillB);
          let targetRate: BN;
          if (isMakerOrder) {
            targetRate = makerOrder.amountS
              .mul(multiplier)
              .div(makerOrder.amountB);
          } else {
            targetRate = makerOrder.amountB
              .mul(multiplier)
              .div(makerOrder.amountS);
          }
          assert(
            targetRate
              .mul(new BN(100))
              .sub(rate.mul(new BN(100)))
              .abs()
              .lte(targetRate),
            "fill rate needs to match maker order rate"
          );
          assert(
            rate
              .mul(multiplier)
              .lte(orderRate.mul(multiplier.add(multiplier.div(new BN(100))))),
            "fill rate needs to match or be better than the order rate"
          );
        }
        if (order.buy) {
          assert(
            fillB.lte(order.amountB),
            "can never buy more than specified in the order"
          );
          if (tradeHistory.filled.lte(order.amountB)) {
            assert(
              tradeHistory.filled.add(fillB).lte(order.amountB),
              "can never buy more than specified in the order"
            );
          } else {
            assert(
              fillS.isZero(),
              "fillS needS to be 0 when filled target is reached already"
            );
            assert(
              fillB.isZero(),
              "fillB needS to be 0 when filled target is reached already"
            );
          }
        } else {
          assert(
            fillS.lte(order.amountS),
            "can never sell more than specified in the order"
          );
          if (tradeHistory.filled.lte(order.amountS)) {
            assert(
              tradeHistory.filled.add(fillS).lte(order.amountS),
              "can never buy more than specified in the order"
            );
          } else {
            assert(
              fillS.isZero(),
              "fillS needS to be 0 when filled target is reached already"
            );
            assert(
              fillB.isZero(),
              "fillB needS to be 0 when filled target is reached already"
            );
          }
        }
      }
    } else {
      assert(fillS.isZero(), "fillS needS to be 0 when the trade is invalid");
      assert(fillB.isZero(), "fillB needS to be 0 when the trade is invalid");
    }
  }

  private getTradeHistory(order: OrderInfo, accountData: any) {
    const tradeHistorySlot =
      order.orderID % 2 ** constants.TREE_DEPTH_TRADING_HISTORY;
    let tradeHistory =
      accountData.balances[order.tokenIdS].tradeHistory[tradeHistorySlot];
    if (!tradeHistory) {
      tradeHistory = {
        filled: new BN(0),
        cancelled: false,
        orderID: 0
      };
    }
    // Trade history trimming
    const filled =
      tradeHistory.orderID < order.orderID ? new BN(0) : tradeHistory.filled;
    const cancelled =
      tradeHistory.orderID === order.orderID
        ? tradeHistory.cancelled
        : tradeHistory.orderID < order.orderID
        ? false
        : true;
    return { filled, cancelled };
  }

  private getMaxFillAmounts(order: OrderInfo, accountData: any) {
    const tradeHistory = this.getTradeHistory(order, accountData);
    const balanceS = new BN(accountData.balances[order.tokenIdS].balance);

    let remainingS = new BN(0);
    if (order.buy) {
      const filled = order.amountB.lt(tradeHistory.filled)
        ? order.amountB
        : tradeHistory.filled;
      const remainingB = tradeHistory.cancelled
        ? new BN(0)
        : order.amountB.sub(filled);
      remainingS = remainingB.mul(order.amountS).div(order.amountB);
    } else {
      const filled = order.amountS.lt(tradeHistory.filled)
        ? order.amountS
        : tradeHistory.filled;
      remainingS = tradeHistory.cancelled
        ? new BN(0)
        : order.amountS.sub(filled);
    }
    const fillAmountS = balanceS.lt(remainingS) ? balanceS : remainingS;
    const fillAmountB = fillAmountS.mul(order.amountB).div(order.amountS);
    const fill: Fill = {
      S: fillAmountS,
      B: fillAmountB
    };
    return fill;
  }

  private match(
    takerOrder: OrderInfo,
    takerFill: Fill,
    makerOrder: OrderInfo,
    makerFill: Fill
  ) {
    if (takerFill.B.lt(makerFill.S)) {
      makerFill.S = takerFill.B;
      makerFill.B = makerFill.S.mul(makerOrder.amountB).div(makerOrder.amountS);
    } else {
      takerFill.B = makerFill.S;
      takerFill.S = takerFill.B.mul(takerOrder.amountS).div(takerOrder.amountB);
    }
    const spread = takerFill.S.sub(makerFill.B);
    const matchable = this.ensure(
      takerFill.S.gte(makerFill.B),
      "not matchable"
    );
    const result: MatchResult = {
      spread,
      matchable
    };
    return result;
  }

  private calculateFees(
    fillB: BN,
    protocolFeeBips: number,
    feeBips: number,
    rebateBips: number
  ) {
    const protocolFee = fillB.mul(new BN(protocolFeeBips)).div(new BN(100000));
    const fee = fillB.mul(new BN(feeBips)).div(new BN(10000));
    const rebate = fillB.mul(new BN(rebateBips)).div(new BN(10000));
    return [fee, protocolFee, rebate];
  }

  private checkFillRate(
    amountS: BN,
    amountB: BN,
    fillAmountS: BN,
    fillAmountB: BN
  ) {
    return fillAmountS
      .mul(amountB)
      .mul(new BN(100))
      .lt(fillAmountB.mul(amountS).mul(new BN(101)));
  }

  private checkValid(
    order: OrderInfo,
    fillAmountS: BN,
    fillAmountB: BN,
    timestamp: number
  ) {
    let valid = true;

    valid =
      valid && this.ensure(order.validSince <= timestamp, "order too early");
    valid =
      valid && this.ensure(timestamp <= order.validUntil, "order too late");

    valid =
      valid &&
      this.ensure(
        !(!order.buy && order.allOrNone && fillAmountS.lt(order.amountS)),
        "allOrNone sell"
      );
    valid =
      valid &&
      this.ensure(
        !(order.buy && order.allOrNone && fillAmountB.lt(order.amountB)),
        "allOrNone buy"
      );
    valid =
      valid &&
      this.ensure(
        this.checkFillRate(
          order.amountS,
          order.amountB,
          fillAmountS,
          fillAmountB
        ),
        "invalid fill rate"
      );
    valid = valid && this.ensure(!fillAmountS.eq(0), "no tokens sold");
    valid = valid && this.ensure(!fillAmountB.eq(0), "no tokens bought");

    return valid;
  }

  private copyAccount(account: AccountLeaf) {
    const balances: { [key: number]: Balance } = {};
    for (const tokenID of Object.keys(account.balances)) {
      const balanceValue = account.balances[Number(tokenID)];

      const tradeHistory: { [key: number]: TradeHistory } = {};
      for (const orderID of Object.keys(balanceValue.tradeHistory)) {
        const tradeHistoryValue = balanceValue.tradeHistory[Number(orderID)];
        tradeHistory[Number(orderID)] = {
          filled: tradeHistoryValue.filled,
          cancelled: tradeHistoryValue.cancelled,
          orderID: tradeHistoryValue.orderID
        };
      }
      balances[Number(tokenID)] = {
        balance: balanceValue.balance,
        tradeHistory
      };
    }
    const accountCopy: AccountLeaf = {
      publicKeyX: account.publicKeyX,
      publicKeyY: account.publicKeyY,
      nonce: account.nonce,
      balances
    };
    return accountCopy;
  }

  private copyExchangeState(exchangeState: ExchangeState) {
    const accounts: AccountLeaf[] = [];
    for (
      let accountID = 0;
      accountID < exchangeState.accounts.length;
      accountID++
    ) {
      accounts[accountID] = this.copyAccount(exchangeState.accounts[accountID]);
    }
    const exchangeStateCopy: ExchangeState = {
      accounts
    };
    return exchangeStateCopy;
  }

  private ensure(valid: boolean, description: string) {
    if (!valid) {
      logInfo(description);
    }
    return valid;
  }

  private assertAlmostEqual(
    n1: number,
    n2: number,
    description: string,
    precision: number
  ) {
    // console.log("n1: " + n1);
    // console.log("n2: " + n2);
    // console.log("precision: " + (10 ** precision));
    return assert(Math.abs(n1 - n2) < 10 ** precision, description);
  }
}
