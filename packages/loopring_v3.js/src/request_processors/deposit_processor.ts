import BN from "bn.js";
import { Bitstream } from "../bitstream";
import { Constants } from "../constants";
import { applyInterest, Account, BlockContext, ExchangeState } from "../types";

interface Deposit {
  owner?: string;
  accountID?: number;
  tokenID?: number;
  amount?: BN;
  index?: BN;
}

/**
 * Processes deposit requests.
 */
export class DepositProcessor {
  public static process(state: ExchangeState, block: BlockContext, txData: Bitstream) {
    const deposit = this.extractData(txData);

    const accountIndex = state.getAccount(1);
    const account = state.getAccount(deposit.accountID);
    account.owner = deposit.owner;

    const newIndex = deposit.index.gt(accountIndex.getBalanceRaw(deposit.tokenID).index)
      ? deposit.index : accountIndex.getBalanceRaw(deposit.tokenID).index;

    const balance = account.getBalanceRaw(deposit.tokenID);
    const newBalance = applyInterest(balance.balance, balance.index, newIndex);
    const newDepositAmount = applyInterest(deposit.amount, deposit.index, newIndex);

    balance.balance = newBalance.add(newDepositAmount);
    balance.index = newIndex;

    accountIndex.getBalanceRaw(deposit.tokenID).index = newIndex;

    return deposit;
  }

  public static extractData(data: Bitstream) {
    const deposit: Deposit = {};
    let offset = 1;

    // Read in the deposit data
    deposit.owner = data.extractAddress(offset);
    offset += 20;
    deposit.accountID = data.extractUint24(offset);
    offset += 3;
    deposit.tokenID = data.extractUint16(offset);
    offset += 2;
    deposit.amount = data.extractUint96(offset);
    offset += 12;
    deposit.index = data.extractUint96(offset);
    offset += 12;

    return deposit;
  }
}
