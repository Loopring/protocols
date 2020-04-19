import BN = require("bn.js");
import { Bitstream, Constants } from "loopringV3.js";
import { fromFloat, roundToFloatValue } from "loopringV3.js";
import { logDebug, logInfo } from "./logs";
import {
  AccountLeaf,
  Balance,
  Deposit,
  DetailedTokenTransfer,
  ExchangeState,
  OrderInfo,
  RingInfo,
  DetailedSimulatorReport,
  SimulatorReport,
  TradeHistory,
  WithdrawalRequest,
  InternalTransferRequest
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
      for (let i = 0; i < Constants.MAX_NUM_TOKENS; i++) {
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
    if (account.balances[deposit.tokenID].balance.gt(Constants.MAX_AMOUNT)) {
      account.balances[deposit.tokenID].balance = Constants.MAX_AMOUNT;
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
        Constants.Float24Encoding
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
    const fee = roundToFloatValue(withdrawal.fee, Constants.Float16Encoding);

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
      Constants.Float24Encoding
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

  public internalTransfer(
    exchangeState: ExchangeState,
    operatorAccountID: number,
    accountFromID: number,
    accountToID: number,
    tokenID: number,
    amountWithdrawn: BN,
    feeTokenID: number,
    fee: BN,
    type: number
  ) {
    const newExchangeState = this.copyExchangeState(exchangeState);

    const accountFrom = newExchangeState.accounts[accountFromID];
    const accountTo = newExchangeState.accounts[accountToID];

    // Update balanceF
    accountFrom.balances[feeTokenID].balance = accountFrom.balances[
      feeTokenID
    ].balance.sub(fee);

    // Update balance from
    accountFrom.balances[tokenID].balance = accountFrom.balances[
      tokenID
    ].balance.sub(amountWithdrawn);
    if (type === 0) {
      accountFrom.nonce++;
    }

    // Update balance to
    accountTo.balances[tokenID].balance = accountTo.balances[
      tokenID
    ].balance.add(amountWithdrawn);

    // Update operator
    const operator = newExchangeState.accounts[operatorAccountID];
    operator.balances[feeTokenID].balance = operator.balances[
      feeTokenID
    ].balance.add(fee);

    return newExchangeState;
  }

  public internalTransferFromInputData(
    transfer: InternalTransferRequest,
    exchangeState: ExchangeState,
    operatorAccountID: number
  ) {
    const fee = roundToFloatValue(transfer.fee, Constants.Float16Encoding);

    const accountFrom = exchangeState.accounts[transfer.accountFromID];
    let balanceFrom = accountFrom.balances[transfer.transTokenID].balance;
    if (transfer.transTokenID === transfer.feeTokenID) {
      balanceFrom = balanceFrom.sub(fee);
    }
    const amountTrans = roundToFloatValue(
      transfer.amount,
      Constants.Float24Encoding
    );

    // Update the Merkle tree with the input data
    const newExchangeState = this.internalTransfer(
      exchangeState,
      operatorAccountID,
      transfer.accountFromID,
      transfer.accountToID,
      transfer.transTokenID,
      amountTrans,
      transfer.feeTokenID,
      fee,
      transfer.type
    );

    const paymentsFrom: DetailedTokenTransfer = {
      description: "From",
      token: 0,
      from: transfer.accountFromID,
      to: operatorAccountID,
      amount: new BN(0),
      subPayments: []
    };
    const payAmount: DetailedTokenTransfer = {
      description: "Amount",
      token: transfer.transTokenID,
      from: transfer.accountFromID,
      to: transfer.accountToID,
      amount: transfer.amount,
      subPayments: []
    };
    const payFee: DetailedTokenTransfer = {
      description: "Fee",
      token: transfer.feeTokenID,
      from: transfer.accountFromID,
      to: operatorAccountID,
      amount: transfer.fee,
      subPayments: []
    };
    paymentsFrom.subPayments.push(payAmount);
    paymentsFrom.subPayments.push(payFee);

    const simulatorReport: DetailedSimulatorReport = {
      exchangeStateBefore: exchangeState,
      exchangeStateAfter: newExchangeState,
      detailedTransfers: [paymentsFrom]
    };
    return simulatorReport;
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

    fillA.S = roundToFloatValue(fillA.S, Constants.Float24Encoding);
    fillB.S = roundToFloatValue(fillB.S, Constants.Float24Encoding);

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

    const simulatorReport: DetailedSimulatorReport = {
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
        orderIdA % 2 ** Constants.TREE_DEPTH_TRADING_HISTORY;
      const tradeHistoryA =
        accountA.balances[tokenA].tradeHistory[tradeHistorySlotA];
      tradeHistoryA.filled =
        orderIdA > tradeHistoryA.orderID ? new BN(0) : tradeHistoryA.filled;
      tradeHistoryA.filled = tradeHistoryA.filled.add(
        buyA ? s.fillBA : s.fillSA
      );
      tradeHistoryA.orderID =
        orderIdA > tradeHistoryA.orderID ? orderIdA : tradeHistoryA.orderID;
    }
    // Update trade history B
    {
      const tradeHistorySlotB =
        orderIdB % 2 ** Constants.TREE_DEPTH_TRADING_HISTORY;
      const tradeHistoryB =
        accountB.balances[tokenB].tradeHistory[tradeHistorySlotB];
      tradeHistoryB.filled =
        orderIdB > tradeHistoryB.orderID ? new BN(0) : tradeHistoryB.filled;
      tradeHistoryB.filled = tradeHistoryB.filled.add(
        buyB ? s.fillBB : s.fillSB
      );
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
      const filled = this.getFilled(order, account);
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
        if (filled.lte(order.amountB)) {
          assert(
            filled.add(fillB).lte(order.amountB),
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
        if (filled.lte(order.amountS)) {
          assert(
            filled.add(fillS).lte(order.amountS),
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
  }

  private getFilled(order: OrderInfo, accountData: any) {
    const numSlots = 2 ** Constants.TREE_DEPTH_TRADING_HISTORY;
    const tradeHistorySlot = order.orderID % numSlots;
    let tradeHistory =
      accountData.balances[order.tokenIdS].tradeHistory[tradeHistorySlot];
    if (!tradeHistory) {
      tradeHistory = {
        filled: new BN(0),
        orderID: 0
      };
    }
    // Trade history trimming
    const tradeHistoryOrderID =
      tradeHistory.orderID === 0 ? tradeHistorySlot : tradeHistory.orderID;
    const filled =
      tradeHistoryOrderID === order.orderID ? tradeHistory.filled : new BN(0);
    return filled;
  }

  private getMaxFillAmounts(order: OrderInfo, accountData: any) {
    const tradeHistoryFilled = this.getFilled(order, accountData);
    const balanceS = new BN(accountData.balances[order.tokenIdS].balance);

    let remainingS = new BN(0);
    if (order.buy) {
      const filled = order.amountB.lt(tradeHistoryFilled)
        ? order.amountB
        : tradeHistoryFilled;
      const remainingB = order.amountB.sub(filled);
      remainingS = remainingB.mul(order.amountS).div(order.amountB);
    } else {
      const filled = order.amountS.lt(tradeHistoryFilled)
        ? order.amountS
        : tradeHistoryFilled;
      remainingS = order.amountS.sub(filled);
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
      .mul(new BN(1000))
      .lte(fillAmountB.mul(amountS).mul(new BN(1001)));
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
