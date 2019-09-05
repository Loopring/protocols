import BN = require("bn.js");
import { Bitstream } from "../bitstream";
import { Constants } from "../constants";
import { fromFloat } from "../float";
import {Account, Block, OrderCancellation, ExchangeState} from "../types";

export class OrderCancellationProcessor {
  public static processBlock(state: ExchangeState, block: Block) {
    const data = new Bitstream(block.data);
    let offset = 4 + 32 + 32 + 32;

    const orderCancellations: OrderCancellation[] = [];
    if (state.onchainDataAvailability) {
      // General data
      const operatorAccountID = data.extractUint24(offset);
      offset += 3;

      // Jump to the specified withdrawal
      const onchainDataSize = 9;

      const startOffset = offset;
      for (let i = 0; i < block.blockSize; i++) {
        offset = startOffset + i * onchainDataSize;

        // Extract onchain data
        const accountIdAndOrderId = data.extractUint40(offset);
        offset += 5;
        const orderTokenID = data.extractUint8(offset);
        offset += 1;
        const feeTokenID = data.extractUint8(offset);
        offset += 1;
        const fFee = data.extractUint16(offset);
        offset += 2;

        // Further extraction of packed data
        const accountID = Math.floor(accountIdAndOrderId / 2 ** 20);
        const orderID = accountIdAndOrderId & 0xfffff;

        // Decode the float values
        const fee = fromFloat(fFee, Constants.Float16Encoding);

        const orderCancellation: OrderCancellation = {
          exchangeId: state.exchangeId,
          requestIdx: state.processedRequests.length + i,
          blockIdx: block.blockIdx,
          accountID,
          orderTokenID,
          orderID,
          feeTokenID,
          fee,
        };
        orderCancellations.push(orderCancellation);

        this.processOrderCancellation(state, operatorAccountID, orderCancellation);
      }
    } else {
      for (let i = 0; i < block.blockSize; i++) {
        const orderCancellation: OrderCancellation = {
          exchangeId: state.exchangeId,
          requestIdx: state.processedRequests.length + i,
          blockIdx: block.blockIdx,
          accountID: 0,
          orderTokenID: 0,
          orderID: 0,
          feeTokenID: 0,
          fee: new BN(0),
        };
        orderCancellations.push(orderCancellation);
      }
    }
    return orderCancellations;
  }

  public static processOrderCancellation(state: ExchangeState, operatorAccountID: number, orderCancellation: OrderCancellation) {
    const account = state.accounts[orderCancellation.accountID];
    account.balances[orderCancellation.orderTokenID] = account.balances[orderCancellation.orderTokenID] || { balance: new BN(0), tradeHistory: {} };
    account.balances[orderCancellation.feeTokenID] = account.balances[orderCancellation.feeTokenID] || { balance: new BN(0), tradeHistory: {} };

    const tradeHistorySlot = orderCancellation.orderID % 2 ** Constants.TREE_DEPTH_TRADING_HISTORY;

    // Update balance
    account.balances[orderCancellation.feeTokenID].balance = account.balances[orderCancellation.feeTokenID].balance.sub(orderCancellation.fee);
    account.nonce++;

    // Update trade history
    account.balances[orderCancellation.orderTokenID].tradeHistory[tradeHistorySlot] =
      account.balances[orderCancellation.orderTokenID].tradeHistory[tradeHistorySlot] ||
      {filled: new BN(0), cancelled: false, orderID: 0};
    const tradeHistory = account.balances[orderCancellation.orderTokenID].tradeHistory[tradeHistorySlot];
    if (tradeHistory.orderID < orderCancellation.orderID) {
      tradeHistory.filled = new BN(0);
    }
    tradeHistory.cancelled = true;
    tradeHistory.orderID = orderCancellation.orderID;

    // Update operator
    const operator = state.accounts[operatorAccountID];
    operator.balances[orderCancellation.feeTokenID] = operator.balances[orderCancellation.feeTokenID] || { balance: new BN(0), tradeHistory: {} };
    operator.balances[orderCancellation.feeTokenID].balance = operator.balances[orderCancellation.feeTokenID].balance.add(orderCancellation.fee);
  }

  public static revertBlock(state: ExchangeState, block: Block) {
    // Nothing to do
  }
}