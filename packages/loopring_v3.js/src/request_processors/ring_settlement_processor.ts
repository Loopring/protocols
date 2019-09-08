import BN = require("bn.js");
import { Bitstream } from "../bitstream";
import { Constants } from "../constants";
import { fromFloat } from "../float";
import {Account, Block, ExchangeState, Trade} from "../types";

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

interface Range {
  offset: number;
  length: number;
}

/**
 * Processes ring settlement requests.
 */
export class RingSettlementProcessor {
  public static processBlock(state: ExchangeState, block: Block) {
    let data: Bitstream;
    if (state.onchainDataAvailability) {
      // Reverse circuit transform
      const ringDataStart = 4 + 32 + 32 + 4 + 1 + 1 + 32 + 3;
      const ringData = this.inverseTransformRingSettlementsData(
        "0x" + block.data.slice(2 + 2 * ringDataStart)
      );
      data = new Bitstream(
        block.data.slice(0, 2 + 2 * ringDataStart) + ringData.slice(2)
      );
    } else {
      data = new Bitstream(block.data);
    }

    let offset = 0;

    // General data
    offset += 4 + 32 + 32 + 4;
    const protocolFeeTakerBips = data.extractUint8(offset);
    offset += 1;
    const protocolFeeMakerBips = data.extractUint8(offset);
    offset += 1;
    // LabelHash
    offset += 32;

    const trades: Trade[] = [];
    if (state.onchainDataAvailability) {
      const operatorAccountID = data.extractUint24(offset);
      offset += 3;

      for (let i = 0; i < block.blockSize; i++) {
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

        const accountIdA = Math.floor(accounts / 2 ** 20);
        const accountIdB = accounts & 0xfffff;

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
        const fillSA = fromFloat(fFillSA, Constants.Float24Encoding);
        const fillSB = fromFloat(fFillSB, Constants.Float24Encoding);

        const settlementValues = this.calculateSettlementValues(
          protocolFeeTakerBips,
          protocolFeeMakerBips,
          fillSA,
          fillSB,
          feeBipsA,
          feeBipsB,
          rebateBipsA,
          rebateBipsB
        );

        const trade: Trade = {
          exchangeId: state.exchangeId,
          requestIdx: state.processedRequests.length + i,
          blockIdx: block.blockIdx,

          accountIdA,
          orderIdA,
          buyA,
          tokenA,
          fillSA: settlementValues.fillSA,
          feeA: settlementValues.feeA,
          protocolFeeA: settlementValues.protocolFeeA,
          rebateA: settlementValues.rebateA,

          accountIdB,
          orderIdB,
          buyB,
          tokenB,
          fillSB: settlementValues.fillSB,
          feeB: settlementValues.feeB,
          protocolFeeB: settlementValues.protocolFeeB,
          rebateB: settlementValues.rebateB,
        };
        trades.push(trade);

        this.processRingSettlement(state, operatorAccountID, trade);
      }

      // Update operator nonce
      const operator = state.accounts[operatorAccountID];
      operator.nonce++;
    } else {
      for (let i = 0; i < block.blockSize; i++) {
        const trade: Trade = {
          exchangeId: state.exchangeId,
          requestIdx: state.processedRequests.length + i,
          blockIdx: block.blockIdx,

          accountIdA: 0,
          orderIdA: 0,
          buyA: true,
          tokenA: 0,
          fillSA: new BN(0),
          feeA: new BN(0),
          protocolFeeA: new BN(0),
          rebateA: new BN(0),

          accountIdB: 0,
          orderIdB: 0,
          buyB: true,
          tokenB: 0,
          fillSB: new BN(0),
          feeB: new BN(0),
          protocolFeeB: new BN(0),
          rebateB: new BN(0),
        };
        trades.push(trade);
      }
    }
    return trades;
  }

  private static processRingSettlement(state: ExchangeState, operatorId: number, trade: Trade) {
    // Update accountA
    const accountA = state.accounts[trade.accountIdA];
    accountA.balances[trade.tokenA] = accountA.balances[trade.tokenA] || { balance: new BN(0), tradeHistory: {} };
    accountA.balances[trade.tokenB] = accountA.balances[trade.tokenB] || { balance: new BN(0), tradeHistory: {} };

    accountA.balances[trade.tokenA].balance = accountA.balances[trade.tokenA].balance.sub(trade.fillSA);
    accountA.balances[trade.tokenB].balance = accountA.balances[trade.tokenB].balance.add(trade.fillSB.sub(trade.feeA).add(trade.rebateA));

    // Update accountB
    const accountB = state.accounts[trade.accountIdB];
    accountB.balances[trade.tokenB] = accountB.balances[trade.tokenB] || { balance: new BN(0), tradeHistory: {} };
    accountB.balances[trade.tokenA] = accountB.balances[trade.tokenA] || { balance: new BN(0), tradeHistory: {} };

    accountB.balances[trade.tokenB].balance = accountB.balances[trade.tokenB].balance.sub(trade.fillSB);
    accountB.balances[trade.tokenA].balance = accountB.balances[trade.tokenA].balance.add(trade.fillSA.sub(trade.feeB).add(trade.rebateB));

    // Update trade history A
    {
      const tradeHistorySlotA = trade.orderIdA % 2 ** Constants.TREE_DEPTH_TRADING_HISTORY;
      accountA.balances[trade.tokenA].tradeHistory[tradeHistorySlotA] = accountA.balances[trade.tokenA].tradeHistory[tradeHistorySlotA] || {filled: new BN(0), cancelled: false, orderID: 0};
      const tradeHistoryA = accountA.balances[trade.tokenA].tradeHistory[tradeHistorySlotA];
      tradeHistoryA.filled = trade.orderIdA > tradeHistoryA.orderID ? new BN(0) : tradeHistoryA.filled;
      tradeHistoryA.filled = tradeHistoryA.filled.add(trade.buyA ? trade.fillSB : trade.fillSA);
      tradeHistoryA.cancelled = trade.orderIdA > tradeHistoryA.orderID ? false : tradeHistoryA.cancelled;
      tradeHistoryA.orderID = trade.orderIdA > tradeHistoryA.orderID ? trade.orderIdA : tradeHistoryA.orderID;
    }
    // Update trade history B
    {
      const tradeHistorySlotB = trade.orderIdB % 2 ** Constants.TREE_DEPTH_TRADING_HISTORY;
      accountB.balances[trade.tokenB].tradeHistory[tradeHistorySlotB] = accountB.balances[trade.tokenB].tradeHistory[tradeHistorySlotB] || {filled: new BN(0), cancelled: false, orderID: 0};
      const tradeHistoryB = accountB.balances[trade.tokenB].tradeHistory[tradeHistorySlotB];
      tradeHistoryB.filled = trade.orderIdB > tradeHistoryB.orderID ? new BN(0) : tradeHistoryB.filled;
      tradeHistoryB.filled = tradeHistoryB.filled.add(trade.buyB ? trade.fillSA : trade.fillSB);
      tradeHistoryB.cancelled = trade.orderIdB > tradeHistoryB.orderID ? false : tradeHistoryB.cancelled;
      tradeHistoryB.orderID = trade.orderIdB > tradeHistoryB.orderID ? trade.orderIdB : tradeHistoryB.orderID;
    }

    // Update protocol fee recipient
    const protocolFeeAccount = state.accounts[0];
    protocolFeeAccount.balances[trade.tokenB] = protocolFeeAccount.balances[trade.tokenB] || { balance: new BN(0), tradeHistory: {} };
    protocolFeeAccount.balances[trade.tokenA] = protocolFeeAccount.balances[trade.tokenA] || { balance: new BN(0), tradeHistory: {} };
    // - Order A
    protocolFeeAccount.balances[trade.tokenB].balance = protocolFeeAccount.balances[trade.tokenB].balance.add(trade.protocolFeeA);
    // - Order B
    protocolFeeAccount.balances[trade.tokenA].balance = protocolFeeAccount.balances[trade.tokenA].balance.add(trade.protocolFeeB);

    // Update operator
    const operator = state.accounts[operatorId];
    operator.balances[trade.tokenB] = operator.balances[trade.tokenB] || { balance: new BN(0), tradeHistory: {} };
    operator.balances[trade.tokenA] = operator.balances[trade.tokenA] || { balance: new BN(0), tradeHistory: {} };
    // - FeeA
    operator.balances[trade.tokenB].balance = operator.balances[trade.tokenB].balance.add(trade.feeA).sub(trade.protocolFeeA).sub(trade.rebateA);
    // - FeeB
    operator.balances[trade.tokenA].balance = operator.balances[trade.tokenA].balance.add(trade.feeB).sub(trade.protocolFeeB).sub(trade.rebateB);
  }

  public static revertBlock(state: ExchangeState, block: Block) {
    // Nothing to do
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

  private static inverseTransformRingSettlementsData(input: string) {
    // Inverse Transform
    const transformed = new Bitstream(input);
    const ringSize = 20;
    const numRings = transformed.length() / ringSize;
    const ranges = this.getRingTransformations();
    const compressed = new Bitstream();
    for (let r = 0; r < numRings; r++) {
      let offset = 0;
      let ringData = "00".repeat(ringSize);
      for (const subranges of ranges) {
        let totalRangeLength = 0;
        for (const subrange of subranges) {
          totalRangeLength += subrange.length;
        }
        let partialRangeLength = 0;
        for (const subrange of subranges) {
          const dataPart = transformed.extractData(offset + totalRangeLength * r + partialRangeLength, subrange.length);
          ringData = this.replaceAt(ringData, subrange.offset * 2, dataPart);
          partialRangeLength += subrange.length;
        }
        offset += totalRangeLength * numRings;
      }
      compressed.addHex(ringData);
    }
    return compressed.getData();
  }

  private static getRingTransformations() {
    const ranges: Range[][] = [];
    ranges.push([{ offset: 0, length: 5 }]); // orderA.orderID + orderB.orderID
    ranges.push([{ offset: 5, length: 5 }]); // orderA.accountID + orderB.accountID
    ranges.push([{ offset: 10, length: 1 }, { offset: 15, length: 1 }]); // orderA.tokenS + orderB.tokenS
    ranges.push([{ offset: 11, length: 3 }, { offset: 16, length: 3 }]); // orderA.fillS + orderB.fillS
    ranges.push([{ offset: 14, length: 1 }]); // orderA.data
    ranges.push([{ offset: 19, length: 1 }]); // orderB.data
    return ranges;
  }

  private static replaceAt(data: string, index: number, replacement: string) {
    return (data.substr(0, index) + replacement + data.substr(index + replacement.length));
  }
}