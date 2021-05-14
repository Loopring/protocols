import BN from "bn.js";
import { Bitstream } from "../bitstream";
import { Constants } from "../constants";
import { fromFloat } from "../float";
import {
  AccountLeaf,
  BalanceLeaf,
  BlockContext,
  ExchangeState,
  SpotTrade
} from "../types";

interface SettlementValues {
  fillSA: BN;
  fillBA: BN;
  feeA: BN;
  protocolFeeA: BN;

  fillSB: BN;
  fillBB: BN;
  feeB: BN;
  protocolFeeB: BN;
}

/**
 * Processes spot trade requests.
 */
export class SpotTradeProcessor {
  public static process(
    state: ExchangeState,
    block: BlockContext,
    data: Bitstream
  ) {
    let offset = 1;

    // Storage IDs
    const storageIdA = data.extractUint32(offset);
    offset += 4;
    const storageIdB = data.extractUint32(offset);
    offset += 4;

    // Accounts
    const accountIdA = data.extractUint32(offset);
    offset += 4;
    const accountIdB = data.extractUint32(offset);
    offset += 4;

    // Tokens
    const tokenA = data.extractUint16(offset);
    offset += 2;
    const tokenB = data.extractUint16(offset);
    offset += 2;

    // Fills
    const fFillSA = data.extractUint24(offset);
    offset += 3;
    const fFillSB = data.extractUint24(offset);
    offset += 3;

    // Order data
    const orderDataA = data.extractUint8(offset);
    offset += 1;
    const orderDataB = data.extractUint8(offset);
    offset += 1;

    // Further extraction of packed data
    const limitMaskA = orderDataA & 0b10000000;
    const feeBipsMultiplierFlagA = orderDataA & 0b01000000;
    const feeBipsA =
      (orderDataA & 0b00111111) *
      (feeBipsMultiplierFlagA ? Constants.FEE_MULTIPLIER : 1);
    const fillAmountBorSA = limitMaskA > 0;

    const limitMaskB = orderDataB & 0b10000000;
    const feeBipsMultiplierFlagB = orderDataB & 0b01000000;
    const feeBipsB =
      (orderDataB & 0b00111111) *
      (feeBipsMultiplierFlagB ? Constants.FEE_MULTIPLIER : 1);
    const fillAmountBorSB = limitMaskB > 0;

    // Decode the float values
    const fillSA = fromFloat(fFillSA, Constants.Float24Encoding);
    const fillSB = fromFloat(fFillSB, Constants.Float24Encoding);

    const s = this.calculateSettlementValues(
      block.protocolFeeTakerBips,
      block.protocolFeeMakerBips,
      fillSA,
      fillSB,
      feeBipsA,
      feeBipsB
    );

    // Update accountA
    {
      const accountA = state.getAccount(accountIdA);
      accountA.getBalance(tokenA).balance.isub(s.fillSA);
      accountA
        .getBalance(tokenB)
        .balance.iadd(s.fillBA)
        .isub(s.feeA);

      // virtual balances
      if (
        accountA.getBalance(tokenA).weightAMM.gt(new BN(0)) ||
        accountA.getBalance(tokenB).weightAMM.gt(new BN(0))
      ) {
        accountA.getBalance(tokenA).weightAMM.isub(s.fillSA);
        accountA.getBalance(tokenB).weightAMM.iadd(s.fillBA);
      }

      const tradeHistoryA = accountA.getBalance(tokenA).getStorage(storageIdA);
      if (tradeHistoryA.storageID !== storageIdA) {
        tradeHistoryA.data = new BN(0);
      }
      tradeHistoryA.storageID = storageIdA;
      tradeHistoryA.data.iadd(fillAmountBorSA ? s.fillBA : s.fillSA);
    }
    // Update accountB
    {
      const accountB = state.getAccount(accountIdB);
      accountB.getBalance(tokenB).balance.isub(s.fillSB);
      accountB
        .getBalance(tokenA)
        .balance.iadd(s.fillBB)
        .isub(s.feeB);

      // virtual balances
      if (
        accountB.getBalance(tokenA).weightAMM.gt(new BN(0)) ||
        accountB.getBalance(tokenB).weightAMM.gt(new BN(0))
      ) {
        accountB.getBalance(tokenB).weightAMM.isub(s.fillBA);
        accountB.getBalance(tokenA).weightAMM.iadd(s.fillSA);
      }

      const tradeHistoryB = accountB.getBalance(tokenB).getStorage(storageIdB);
      if (tradeHistoryB.storageID !== storageIdB) {
        tradeHistoryB.data = new BN(0);
      }
      tradeHistoryB.storageID = storageIdB;
      tradeHistoryB.data.iadd(fillAmountBorSB ? s.fillBB : s.fillSB);
    }

    // Update protocol fee
    const protocol = state.getAccount(0);
    protocol.getBalance(tokenA).balance.iadd(s.protocolFeeB);
    protocol.getBalance(tokenB).balance.iadd(s.protocolFeeA);

    // Update operator
    const operator = state.getAccount(block.operatorAccountID);
    operator
      .getBalance(tokenA)
      .balance.iadd(s.feeB)
      .isub(s.protocolFeeB);
    operator
      .getBalance(tokenB)
      .balance.iadd(s.feeA)
      .isub(s.protocolFeeA);

    // Create struct
    const trade: SpotTrade = {
      exchange: state.exchange,
      requestIdx: state.processedRequests.length,
      blockIdx: /*block.blockIdx*/ 0,

      accountIdA,
      orderIdA: storageIdA,
      fillAmountBorSA,
      tokenA,
      fillSA: s.fillSA,
      feeA: s.feeA,
      protocolFeeA: s.protocolFeeA,

      accountIdB,
      orderIdB: storageIdB,
      fillAmountBorSB,
      tokenB,
      fillSB: s.fillSB,
      feeB: s.feeB,
      protocolFeeB: s.protocolFeeB
    };

    return trade;
  }

  private static calculateSettlementValues(
    protocolFeeTakerBips: number,
    protocolFeeMakerBips: number,
    fillSA: BN,
    fillSB: BN,
    feeBipsA: number,
    feeBipsB: number
  ) {
    const fillBA = fillSB;
    const fillBB = fillSA;
    const [feeA, protocolFeeA] = this.calculateFees(
      fillBA,
      protocolFeeTakerBips,
      feeBipsA
    );

    const [feeB, protocolFeeB] = this.calculateFees(
      fillBB,
      protocolFeeMakerBips,
      feeBipsB
    );

    const settlementValues: SettlementValues = {
      fillSA,
      fillBA,
      feeA,
      protocolFeeA,

      fillSB,
      fillBB,
      feeB,
      protocolFeeB
    };
    return settlementValues;
  }

  private static calculateFees(
    fillB: BN,
    protocolFeeBips: number,
    feeBips: number
  ) {
    const protocolFee = fillB.mul(new BN(protocolFeeBips)).div(new BN(100000));
    const fee = fillB.mul(new BN(feeBips)).div(new BN(10000));
    return [fee, protocolFee];
  }
}
