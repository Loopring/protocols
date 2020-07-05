import BN from "bn.js";
import { Bitstream } from "../bitstream";
import { Constants } from "../constants";
import { Account, Block, Deposit, ExchangeState } from "../types";

/**
 * Processes deposit requests.
 */
export class DepositProcessor {
  public static processBlock(state: ExchangeState, block: Block) {
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

  public static processDeposit(state: ExchangeState, deposit: Deposit) {
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
        balances: {}
      };
      state.accounts.push(newAccount);
    }
    const account = state.accounts[deposit.accountID];
    account.balances[deposit.tokenID] = account.balances[deposit.tokenID] || {
      balance: new BN(0),
      index: new BN(0),
      tradeHistory: {}
    };

    // Update state
    account.balances[deposit.tokenID].balance = account.balances[
      deposit.tokenID
    ].balance.add(deposit.amount);
    if (account.balances[deposit.tokenID].balance.gt(Constants.MAX_AMOUNT)) {
      account.balances[deposit.tokenID].balance = Constants.MAX_AMOUNT;
    }
    account.publicKeyX = deposit.publicKeyX;
    account.publicKeyY = deposit.publicKeyY;
  }
}
