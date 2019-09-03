import BN = require("bn.js");
import { Bitstream } from "../bitstream";
import * as constants from "../constants";
import { fromFloat } from "../float";
import {Account, Block, OrderCancellation, State} from "../types";

export class OrderCancellationProcessor {
  public static processBlock(state: State, block: Block) {
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
        const fee = fromFloat(fFee, constants.Float16Encoding);

        // Update the Merkle tree with the onchain data
        this.cancelOrder(
          state,
          operatorAccountID,
          accountID,
          orderTokenID,
          orderID,
          feeTokenID,
          fee,
        );

        const orderCancellation: OrderCancellation = {
          requestIdx: state.processedRequests.length + i,
          blockIdx: block.blockIdx,
          accountID,
          orderTokenID,
          orderID,
          feeTokenID,
          fee,
        };
        orderCancellations.push(orderCancellation);
      }
    } else {
      for (let i = 0; i < block.blockSize; i++) {
        const orderCancellation: OrderCancellation = {
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

  public static revertBlock(state: State, block: Block) {
    // Nothing to do
  }

  private static cancelOrder(
    state: State,
    operatorAccountID: number,
    accountID: number,
    orderTokenID: number,
    orderID: number,
    feeTokenID: number,
    fee: BN
  ) {
    const account = state.accounts[accountID];
    account.balances[orderTokenID] = account.balances[orderTokenID] || { balance: new BN(0), tradeHistory: {} };
    account.balances[feeTokenID] = account.balances[feeTokenID] || { balance: new BN(0), tradeHistory: {} };

    const tradeHistorySlot = orderID % 2 ** constants.TREE_DEPTH_TRADING_HISTORY;

    // Update balance
    account.balances[feeTokenID].balance = account.balances[feeTokenID].balance.sub(fee);
    account.nonce++;

    // Update trade history
    account.balances[orderTokenID].tradeHistory[tradeHistorySlot] = account.balances[orderTokenID].tradeHistory[tradeHistorySlot] || {filled: new BN(0), cancelled: false, orderID: 0};
    const tradeHistory = account.balances[orderTokenID].tradeHistory[tradeHistorySlot];
    if (tradeHistory.orderID < orderID) {
      tradeHistory.filled = new BN(0);
    }
    tradeHistory.cancelled = true;
    tradeHistory.orderID = orderID;

    // Update operator
    const operator = state.accounts[operatorAccountID];
    operator.balances[feeTokenID] = operator.balances[feeTokenID] || { balance: new BN(0), tradeHistory: {} };
    operator.balances[feeTokenID].balance = operator.balances[feeTokenID].balance.add(fee);
  }
}