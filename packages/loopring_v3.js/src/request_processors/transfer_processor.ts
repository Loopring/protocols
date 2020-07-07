import BN from "bn.js";
import { Bitstream } from "../bitstream";
import { Constants } from "../constants";
import { fromFloat } from "../float";
import { BlockContext, ExchangeState } from "../types";

interface Transfer {
  accountFromID?: number;
  accountToID?: number;
  tokenID?: number;
  amount?: BN;
  feeTokenID?: number;
  fee?: BN;
  nonce?: number;
  from?: string;
  to?: string;
}

/**
 * Processes internal transfer requests.
 */
export class TransferProcessor {
  public static process(state: ExchangeState, block: BlockContext, txData: Bitstream) {
    const transfer = this.extractData(txData);

    const index = state.getAccount(1);

    const from = state.getAccount(transfer.accountFromID);
    const to = state.getAccount(transfer.accountToID);
    to.owner = transfer.to;

    from.getBalance(transfer.tokenID, index).balance.isub(transfer.amount);
    to.getBalance(transfer.tokenID, index).balance.iadd(transfer.amount);

    from.getBalance(transfer.feeTokenID, index).balance.isub(transfer.fee);

    from.nonce++;

    const operator = state.getAccount(block.operatorAccountID);
    operator.getBalance(transfer.feeTokenID, index).balance.iadd(transfer.fee);

    return transfer;
  }

  public static extractData(data: Bitstream) {
    const transfer: Transfer = {};
    let offset = 1;

    // Check that this is a conditional update
    const transferType = data.extractUint8(offset);
    offset += 1;

    transfer.accountFromID = data.extractUint24(offset);
    offset += 3;
    transfer.accountToID = data.extractUint24(offset);
    offset += 3;
    const tokenIDs = data.extractUint24(offset);
    offset += 3;
    transfer.amount = fromFloat(data.extractUint24(offset), Constants.Float24Encoding);
    offset += 3;
    transfer.fee = fromFloat(data.extractUint16(offset), Constants.Float16Encoding);
    offset += 2;
    transfer.nonce = data.extractUint32(offset);
    offset += 4;
    transfer.from = data.extractAddress(offset);
    offset += 20;
    transfer.to = data.extractAddress(offset);
    offset += 20;

    transfer.tokenID = tokenIDs >> 12;
    transfer.feeTokenID = tokenIDs & 0b1111111111;

    return transfer;
  }
}
