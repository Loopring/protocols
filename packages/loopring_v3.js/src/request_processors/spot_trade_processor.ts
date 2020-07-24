import BN from "bn.js";
import { Bitstream } from "../bitstream";
import { Constants } from "../constants";
import { fromFloat } from "../float";
import { AccountLeaf, BalanceLeaf, BlockContext, ExchangeState, SpotTrade } from "../types";

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

/**
 * Processes ring settlement requests.
 */
export class SpotTradeProcessor {
  public static process(state: ExchangeState, block: BlockContext, data: Bitstream) {
    let offset = 1;

    // Storage IDs
    const tradeHistoryDataA = data.extractUint16(offset);
    offset += 2;
    const tradeHistoryDataB = data.extractUint16(offset);
    offset += 2;

    // Accounts
    const accountIdA = data.extractUint32(offset);
    offset += 4;
    const accountIdB = data.extractUint32(offset);
    offset += 4;

    // Tokens
    const tokenIds = data.extractUint24(offset);
    offset += 3;
    const tokenA = tokenIds >> 12;
    const tokenB = tokenIds & 0xfff;

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
    const tradeHistorySlotA = tradeHistoryDataA & 0b0011111111111111;
    const overwriteTradeHistorySlotA =
      (tradeHistoryDataA & 0b0100000000000000) !== 0;
    const buyMaskA = orderDataA & 0b10000000;
    const rebateMaskA = orderDataA & 0b01000000;
    const feeOrRebateA = orderDataA & 0b00111111;
    const buyA = buyMaskA > 0;
    const feeBipsA = rebateMaskA > 0 ? 0 : feeOrRebateA;
    const rebateBipsA = rebateMaskA > 0 ? feeOrRebateA : 0;

    const tradeHistorySlotB = tradeHistoryDataB & 0b0011111111111111;
    const overwriteTradeHistorySlotB =
      (tradeHistoryDataB & 0b0100000000000000) !== 0;
    const buyMaskB = orderDataB & 0b10000000;
    const rebateMaskB = orderDataB & 0b01000000;
    const feeOrRebateB = orderDataB & 0b00111111;
    const buyB = buyMaskB > 0;
    const feeBipsB = rebateMaskB > 0 ? 0 : feeOrRebateB;
    const rebateBipsB = rebateMaskB > 0 ? feeOrRebateB : 0;

    // Decode the float values
    const fillSA = fromFloat(fFillSA, Constants.Float24Encoding);
    const fillSB = fromFloat(fFillSB, Constants.Float24Encoding);

    let orderIdA: number = undefined;
    let orderIdB: number = undefined;

    const s = this.calculateSettlementValues(
      block.protocolFeeTakerBips,
      block.protocolFeeMakerBips,
      fillSA,
      fillSB,
      feeBipsA,
      feeBipsB,
      rebateBipsA,
      rebateBipsB
    );

    // Update accountA
    {
      const accountA = state.getAccount(accountIdA);
      accountA.getBalance(tokenA).balance.isub(s.fillSA);
      accountA.getBalance(tokenB).balance.iadd(s.fillBA).isub(s.feeA).iadd(s.rebateA);

      const tradeHistoryA = accountA.getBalance(tokenA).getStorage(tradeHistorySlotA);
      if (tradeHistoryA.storageID === 0) {
        tradeHistoryA.storageID = tradeHistorySlotA;
      }
      if (overwriteTradeHistorySlotA) {
        tradeHistoryA.storageID += Constants.NUM_STORAGE_SLOTS;
        tradeHistoryA.data = new BN(0);
      }
      tradeHistoryA.data.iadd(buyA ? s.fillBA : s.fillSA);
      orderIdA = tradeHistoryA.storageID;
    }
    // Update accountB
    {
      const accountB = state.getAccount(accountIdB);
      accountB.getBalance(tokenB).balance.isub(s.fillSB);
      accountB.getBalance(tokenA).balance.iadd(s.fillBB).isub(s.feeB).iadd(s.rebateB);

      const tradeHistoryB = accountB.getBalance(tokenB).getStorage(tradeHistorySlotB);
      if (tradeHistoryB.storageID === 0) {
        tradeHistoryB.storageID = tradeHistorySlotB;
      }
      if (overwriteTradeHistorySlotB) {
        tradeHistoryB.storageID += Constants.NUM_STORAGE_SLOTS;
        tradeHistoryB.data = new BN(0);
      }
      tradeHistoryB.data.iadd(buyB ? s.fillBB : s.fillSB);
      orderIdB = tradeHistoryB.storageID;
    }

    // Update protocol fee
    const protocol = state.getAccount(0);
    protocol.getBalance(tokenA).balance.iadd(s.protocolFeeB);
    protocol.getBalance(tokenB).balance.iadd(s.protocolFeeA);

    // Update operator
    const operator = state.getAccount(block.operatorAccountID);
    operator.getBalance(tokenA).balance.iadd(s.feeB).isub(s.protocolFeeB).isub(s.rebateB);
    operator.getBalance(tokenB).balance.iadd(s.feeA).isub(s.protocolFeeA).isub(s.rebateA);


    // Create struct
    const trade: SpotTrade = {
      exchangeId: state.exchangeId,
      requestIdx: state.processedRequests.length,
      blockIdx: /*block.blockIdx*/0,

      accountIdA,
      orderIdA,
      buyA,
      tokenA,
      fillSA: s.fillSA,
      feeA: s.feeA,
      protocolFeeA: s.protocolFeeA,
      rebateA: s.rebateA,

      accountIdB,
      orderIdB,
      buyB,
      tokenB,
      fillSB: s.fillSB,
      feeB: s.feeB,
      protocolFeeB: s.protocolFeeB,
      rebateB: s.rebateB
    };

    return trade;
  }

  private static calculateSettlementValues(
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

  private static calculateFees(
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
}
