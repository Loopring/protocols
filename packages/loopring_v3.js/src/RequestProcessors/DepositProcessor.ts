import BN = require("bn.js");
import { Bitstream } from "../bitstream";
import * as constants from "../constants";
import {Account, Block, Deposit, State} from "../types";

export class DepositProcessor {
  public static processBlock(state: State, block: Block) {
    const offset = 4 + 32 + 32 + 32 + 32;
    const data = new Bitstream(block.data);
    const startIdx = data.extractUint32(offset);
    const length = data.extractUint32(offset + 4);

    const deposits: Deposit[] = [];
    for (let i = startIdx; i < startIdx + length; i++) {
      const deposit = state.deposits[i];

      this.processDeposit(state, deposit);

      deposit.blockIdx = block.blockIdx;
      deposit.requestIdx = state.processedRequests.length + i - startIdx;
      deposits.push(deposit);
    }
    return deposits;
  }

  public static processDeposit(state: State, deposit: Deposit) {
    assert(deposit.accountID <= state.accounts.length, "accountID invalid");
    // New account
    if (deposit.accountID === state.accounts.length) {
      const newAccount: Account = {
        exchangeId: state.exchangeId,
        accountId: deposit.accountID,
        owner: state.accountIdToOwner[deposit.accountID],

        publicKeyX: "0",
        publicKeyY: "0",
        nonce: 0,
        balances: {},
      };
      state.accounts.push(newAccount);
    }
    const account = state.accounts[deposit.accountID];
    account.balances[deposit.tokenID] = account.balances[deposit.tokenID] || { balance: new BN(0), tradeHistory: {} };

    // Update state
    account.balances[deposit.tokenID].balance = account.balances[deposit.tokenID].balance.add(deposit.amount);
    if (account.balances[deposit.tokenID].balance.gt(constants.MAX_AMOUNT)) {
      account.balances[deposit.tokenID].balance = constants.MAX_AMOUNT;
    }
    account.publicKeyX = deposit.publicKeyX;
    account.publicKeyY = deposit.publicKeyY;
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