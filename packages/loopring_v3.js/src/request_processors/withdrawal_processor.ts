import BN from "bn.js";
import { Bitstream } from "../bitstream";
import { Constants } from "../constants";
import { fromFloat } from "../float";
import { BlockContext, ExchangeState } from "../types";

interface Withdrawal {
  type?: number;
  owner?: string;
  accountID?: number;
  nonce?: number;
  tokenID?: number;
  amount?: BN;
  feeTokenID?: number;
  fee?: BN;
  to?: string;
  dataHash?: string;
  minGas?: number;
}

/**
 * Processes internal transfer requests.
 */
export class WithdrawalProcessor {
  public static process(state: ExchangeState, block: BlockContext, txData: Bitstream) {
    const withdrawal = this.extractData(txData);

    const account = state.getAccount(withdrawal.accountID);
    let amount = withdrawal.amount;
    if (withdrawal.type === 2) {
      amount = account.getBalance(withdrawal.tokenID).balance;
    } else if (withdrawal.type === 3) {
      amount = new BN(0);
    }
    account.getBalance(withdrawal.tokenID).balance.isub(amount);
    account.getBalance(withdrawal.feeTokenID).balance.isub(withdrawal.fee);

    // Special cases when withdrawing from the protocol fee pool.
    // These account balances will have interest accrued.
    if (withdrawal.accountID === 0) {
      state.getAccount(2).getBalance(withdrawal.tokenID);
    } else {
      state.getAccount(0).getBalance(withdrawal.tokenID);
    }

    const operator = state.getAccount(block.operatorAccountID);
    operator.getBalance(withdrawal.feeTokenID).balance.iadd(withdrawal.fee);

    if (withdrawal.type === 0 || withdrawal.type === 1) {
      account.nonce++;
    }

    return withdrawal;
  }

  public static extractData(data: Bitstream) {
    const withdrawal: Withdrawal = {};
    let offset = 1;

    // Check that this is a conditional update
    withdrawal.type = data.extractUint8(offset);
    offset += 1;
    withdrawal.owner = data.extractAddress(offset);
    offset += 20;
    withdrawal.accountID = data.extractUint32(offset);
    offset += 4;
    withdrawal.nonce = data.extractUint32(offset);
    offset += 4;
    const tokenIDs = data.extractUint24(offset);
    offset += 3;
    withdrawal.amount = data.extractUint96(offset);
    offset += 12;
    withdrawal.fee = fromFloat(data.extractUint16(offset), Constants.Float16Encoding);
    offset += 2;
    withdrawal.to = data.extractAddress(offset);
    offset += 20;
    withdrawal.dataHash = data.extractData(offset, 32);
    offset += 32;
    withdrawal.minGas = data.extractUint24(offset);
    offset += 3;

    withdrawal.tokenID = tokenIDs >> 12;
    withdrawal.feeTokenID = tokenIDs & 0b1111111111;

    return withdrawal;
  }
}
