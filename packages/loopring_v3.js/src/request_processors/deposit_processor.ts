import BN from "bn.js";
import { Bitstream } from "../bitstream";
import { Constants } from "../constants";
import { Account, BlockContext, ExchangeState } from "../types";

interface Deposit {
  to?: string;
  toAccountID?: number;
  tokenID?: number;
  amount?: BN;
}

/**
 * Processes deposit requests.
 */
export class DepositProcessor {
  public static process(
    state: ExchangeState,
    block: BlockContext,
    txData: Bitstream
  ) {
    const deposit = this.extractData(txData);

    const account = state.getAccount(deposit.toAccountID);
    account.owner = deposit.to;

    const balance = account.getBalance(deposit.tokenID);
    balance.balance.iadd(deposit.amount);

    return deposit;
  }

  public static extractData(data: Bitstream) {
    const deposit: Deposit = {};
    let offset = 1;

    // Read in the deposit data
    deposit.to = data.extractAddress(offset);
    offset += 20;
    deposit.toAccountID = data.extractUint32(offset);
    offset += 4;
    deposit.tokenID = data.extractUint16(offset);
    offset += 2;
    deposit.amount = data.extractUint96(offset);
    offset += 12;

    return deposit;
  }
}
