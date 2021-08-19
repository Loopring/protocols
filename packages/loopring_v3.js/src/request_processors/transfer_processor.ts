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
  validUntil?: number;
  storageID?: number;
  from?: string;
  to?: string;
  data?: string;
  toTokenID?: number;
}

/**
 * Processes transfer requests.
 */
export class TransferProcessor {
  public static process(
    state: ExchangeState,
    block: BlockContext,
    txData: Bitstream
  ) {
    const transfer = this.extractData(txData);

    const from = state.getAccount(transfer.accountFromID);
    const to = state.getAccount(transfer.accountToID);
    if (transfer.to !== Constants.zeroAddress) {
      to.owner = transfer.to;
    }

    from.getBalance(transfer.tokenID).balance.isub(transfer.amount);
    if (Constants.isNFT(transfer.tokenID)) {
      const nftData = from.getBalance(transfer.tokenID).weightAMM;
      if (from.getBalance(transfer.tokenID).balance.eq(new BN(0))) {
        from.getBalance(transfer.tokenID).weightAMM = new BN(0);
      }
      to.getBalance(transfer.toTokenID).weightAMM = nftData;
    }

    to.getBalance(transfer.toTokenID).balance.iadd(transfer.amount);

    from.getBalance(transfer.feeTokenID).balance.isub(transfer.fee);

    // Nonce
    const storage = from
      .getBalance(transfer.tokenID)
      .getStorage(transfer.storageID);
    storage.storageID = transfer.storageID;
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

    transfer.accountFromID = data.extractUint32(offset);
    offset += 4;
    transfer.accountToID = data.extractUint32(offset);
    offset += 4;
    transfer.tokenID = data.extractUint16(offset);
    offset += 2;
    transfer.amount = fromFloat(
      data.extractUint24(offset),
      Constants.Float24Encoding
    );
    offset += 3;
    transfer.feeTokenID = data.extractUint16(offset);
    offset += 2;
    transfer.fee = fromFloat(
      data.extractUint16(offset),
      Constants.Float16Encoding
    );
    offset += 2;
    transfer.storageID = data.extractUint32(offset);
    offset += 4;
    transfer.to = data.extractAddress(offset);
    offset += 20;
    transfer.from = data.extractAddress(offset);
    offset += 20;
    transfer.toTokenID = data.extractUint16(offset);
    offset += 2;

    transfer.toTokenID =
      transfer.toTokenID !== 0 ? transfer.toTokenID : transfer.tokenID;

    return transfer;
  }
}
