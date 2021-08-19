import BN from "bn.js";
import { Bitstream } from "../bitstream";
import { Constants } from "../constants";
import { fromFloat } from "../float";
import { BlockContext, ExchangeState } from "../types";

interface Withdrawal {
  type?: number;
  from?: string;
  fromAccountID?: number;
  tokenID?: number;
  amount?: BN;
  feeTokenID?: number;
  fee?: BN;
  to?: string;
  onchainDataHash?: string;
  minGas?: number;
  validUntil?: number;
  storageID?: number;
}

/**
 * Processes withdrawal requests.
 */
export class WithdrawalProcessor {
  public static process(
    state: ExchangeState,
    block: BlockContext,
    txData: Bitstream
  ) {
    const withdrawal = this.extractData(txData);

    const account = state.getAccount(withdrawal.fromAccountID);
    account.getBalance(withdrawal.tokenID).balance.isub(withdrawal.amount);
    account.getBalance(withdrawal.feeTokenID).balance.isub(withdrawal.fee);

    if (
      withdrawal.type === 2 ||
      (Constants.isNFT(withdrawal.tokenID) &&
        account.getBalance(withdrawal.tokenID).balance.eq(new BN(0)))
    ) {
      account.getBalance(withdrawal.tokenID).weightAMM = new BN(0);
    }

    const operator = state.getAccount(block.operatorAccountID);
    operator.getBalance(withdrawal.feeTokenID).balance.iadd(withdrawal.fee);

    if (withdrawal.type === 0 || withdrawal.type === 1) {
      // Nonce
      const storage = account
        .getBalance(withdrawal.tokenID)
        .getStorage(withdrawal.storageID);
      storage.storageID = withdrawal.storageID;
      storage.data = new BN(1);
    }

    return withdrawal;
  }

  public static extractData(data: Bitstream) {
    const withdrawal: Withdrawal = {};
    let offset = 1;

    withdrawal.type = data.extractUint8(offset);
    offset += 1;
    withdrawal.from = data.extractAddress(offset);
    offset += 20;
    withdrawal.fromAccountID = data.extractUint32(offset);
    offset += 4;
    withdrawal.tokenID = data.extractUint16(offset);
    offset += 2;
    withdrawal.amount = data.extractUint96(offset);
    offset += 12;
    withdrawal.feeTokenID = data.extractUint16(offset);
    offset += 2;
    withdrawal.fee = fromFloat(
      data.extractUint16(offset),
      Constants.Float16Encoding
    );
    offset += 2;
    withdrawal.storageID = data.extractUint32(offset);
    offset += 4;
    withdrawal.onchainDataHash = data.extractData(offset, 20);
    offset += 20;

    return withdrawal;
  }
}
