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
  shortStorageID?: number;
  storageID?: BN;
  from?: string;
  to?: string;
  data?: string;
}

/**
 * Processes internal transfer requests.
 */
export class TransferProcessor {
  public static process(state: ExchangeState, block: BlockContext, txData: Bitstream) {
    const transfer = this.extractData(txData);

    const from = state.getAccount(transfer.accountFromID);
    const to = state.getAccount(transfer.accountToID);
    if (transfer.to !== Constants.zeroAddress) {
      to.owner = transfer.to;
    }

    from.getBalance(transfer.tokenID).balance.isub(transfer.amount);
    to.getBalance(transfer.tokenID).balance.iadd(transfer.amount);

    from.getBalance(transfer.feeTokenID).balance.isub(transfer.fee);

    // Nonce
    const storageSlot = transfer.shortStorageID & 0b0011111111111111;
    const overwriteSlot = (transfer.shortStorageID & 0b0100000000000000) !== 0;
    const storage = from.getBalance(transfer.tokenID).getStorage(storageSlot);
    if (storage.storageID === 0) {
      storage.storageID = storageSlot;
    }
    if (overwriteSlot) {
      storage.storageID += Constants.NUM_STORAGE_SLOTS;
      storage.data = new BN(0);
    }
    storage.data = new BN(1);

    const operator = state.getAccount(block.operatorAccountID);
    operator.getBalance(transfer.feeTokenID).balance.iadd(transfer.fee);

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
    transfer.shortStorageID = data.extractUint16(offset);
    offset += 2;
    transfer.to = data.extractAddress(offset);
    offset += 20;
    transfer.storageID = data.extractUint64(offset);
    offset += 8;
    transfer.from = data.extractAddress(offset);
    offset += 20;
    transfer.data = data.extractData(offset, 32);
    offset += 32;

    transfer.tokenID = tokenIDs >> 12;
    transfer.feeTokenID = tokenIDs & 0b1111111111;

    return transfer;
  }
}
