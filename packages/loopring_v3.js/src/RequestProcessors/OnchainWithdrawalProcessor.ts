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

    const shutdown = (length === 0);

    const withdrawals: OnchainWithdrawal[] = [];
    for (let i = 0; i < length; i++) {
      const approvedWitdrawal = data.extractUint56(offset + i * 7);

      const tokenID = Math.floor(approvedWitdrawal / 2 ** 48) & 0xFF;
      const accountID = Math.floor(approvedWitdrawal / 2 ** 28) & 0xFFFFF;
      const amountWithdrawn = fromFloat(approvedWitdrawal & 0xFFFFFFF, constants.Float28Encoding);

      if (!shutdown) {
        const onchainWithdrawal = state.onchainWithdrawals[startIdx + i];
        assert.equal(tokenID, onchainWithdrawal.tokenID, "unexpected tokenID");
        assert.equal(accountID, onchainWithdrawal.accountID, "unexpected accountID");

        onchainWithdrawal.amountWithdrawn = amountWithdrawn;
        onchainWithdrawal.blockIdx = block.blockIdx;
        onchainWithdrawal.requestIdx = state.processedRequests.length + i;
        withdrawals.push(onchainWithdrawal);

        this.processOnchainWithdrawal(state, shutdown, onchainWithdrawal);
      } else {
        const onchainWithdrawal: OnchainWithdrawal = {
          withdrawalIdx: 0,
          timestamp: 0,
          accountID,
          tokenID,
          amountRequested: new BN(0),
          amountWithdrawn,
          transactionHash: constants.zeroAddress,
        };
        this.processOnchainWithdrawal(state, shutdown, onchainWithdrawal);
      }
    }
    return withdrawals;
  }

  public static processOnchainWithdrawal(state: State, shutdown: boolean, onchainWithdrawal: OnchainWithdrawal) {
    // When a withdrawal is done before the deposit (account creation) we shouldn't
    // do anything. Just leave everything as it is.
    if (onchainWithdrawal.accountID < state.accounts.length) {
      const account = state.accounts[onchainWithdrawal.accountID];
      account.balances[onchainWithdrawal.tokenID] = account.balances[onchainWithdrawal.tokenID] || { balance: new BN(0), tradeHistory: {} };

      const balance = account.balances[onchainWithdrawal.tokenID].balance;
      const amountToSubtract = shutdown ? balance : onchainWithdrawal.amountWithdrawn;

      // Update balance
      account.balances[onchainWithdrawal.tokenID].balance = account.balances[onchainWithdrawal.tokenID].balance.sub(amountToSubtract);

      if (shutdown) {
        account.publicKeyX = "0";
        account.publicKeyY = "0";
        account.nonce = 0;
        account.balances[onchainWithdrawal.tokenID].tradeHistory = {};
      }
    }
  }

  public static revertBlock(state: State, block: Block) {
    const startIdx = block.totalNumRequestsProcessed - 1;
    const endIdx = startIdx - block.numRequestsProcessed;
    for (let i = startIdx; i > endIdx; i--) {
      delete state.processedRequests[i].blockIdx;
      delete state.processedRequests[i].requestIdx;
      delete state.processedRequests[i].amountWithdrawn;
    }
  }
}