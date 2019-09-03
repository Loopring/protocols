import BN = require("bn.js");
import { Bitstream } from "../bitstream";
import * as constants from "../constants";
import { fromFloat } from "../float";
import {Account, Block, OnchainWithdrawal, State} from "../types";

export class OnchainWithdrawalProcessor {
  public static processBlock(state: State, block: Block) {
    let offset = 4 + 32 + 32 + 32 + 32;
    const data = new Bitstream(block.data);
    const startIdx = data.extractUint32(offset);
    offset += 4;
    const length = data.extractUint32(offset);
    offset += 4;

    const withdrawals: OnchainWithdrawal[] = [];
    for (let i = 0; i < length; i++) {
      const approvedWitdrawal = data.extractUint56(offset + i * 7);

      const tokenID = Math.floor(approvedWitdrawal / 2 ** 48) & 0xFF;
      const accountID = Math.floor(approvedWitdrawal / 2 ** 28) & 0xFFFFF;
      const amount = fromFloat(approvedWitdrawal & 0xFFFFFFF, constants.Float28Encoding);

      // When a withdrawal is done before the deposit (account creation) we shouldn't
      // do anything. Just leave everything as it is.
      if (accountID < state.accounts.length) {
        const account = state.accounts[accountID];
        account.balances[tokenID] = account.balances[tokenID] || { balance: new BN(0), tradeHistory: {} };

        const balance = account.balances[tokenID].balance;
        const amountToSubtract = state.shutdown ? balance : amount;

        // Update balance
        account.balances[tokenID].balance = account.balances[tokenID].balance.sub(amountToSubtract);

        if (state.shutdown) {
          account.publicKeyX = "0";
          account.publicKeyY = "0";
          account.nonce = 0;
          account.balances[tokenID].tradeHistory = {};
        } else {
          const onchainWithdrawal = state.onchainWithdrawals[startIdx + i];
          onchainWithdrawal.blockIdx = block.blockIdx;
          onchainWithdrawal.requestIdx = state.processedRequests.length + i;
          withdrawals.push(onchainWithdrawal);
        }
      }
    }
    return withdrawals;
  }

  public static revertBlock(state: State, block: Block) {
    const startIdx = block.totalNumRequestsProcessed - 1;
    const endIdx = startIdx - block.numRequestsProcessed;
    for (let i = startIdx; i > endIdx; i--) {
      delete state.processedRequests[i].blockIdx;
      delete state.processedRequests[i].requestIdx;
    }
  }
}