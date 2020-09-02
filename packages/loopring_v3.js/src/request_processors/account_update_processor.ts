import BN from "bn.js";
import { Bitstream } from "../bitstream";
import { Constants } from "../constants";
import { EdDSA } from "../eddsa";
import { fromFloat } from "../float";
import { BlockContext, ExchangeState } from "../types";

interface AccountUpdate {
  owner?: string;
  accountID?: number;
  feeTokenID?: number;
  fee?: BN;
  publicKeyX?: string;
  publicKeyY?: string;
  validUntil?: number;
  nonce?: number;
}

/**
 * Processes account update requests.
 */
export class AccountUpdateProcessor {
  public static process(state: ExchangeState, block: BlockContext, txData: Bitstream) {
    const update = AccountUpdateProcessor.extractData(txData);

    const account = state.getAccount(update.accountID);
    account.publicKeyX = update.publicKeyX;
    account.publicKeyY = update.publicKeyY;
    account.nonce++;

    const balance = account.getBalance(update.feeTokenID);
    balance.balance.isub(update.fee);

    const operator = state.getAccount(block.operatorAccountID);
    const balanceO = operator.getBalance(update.feeTokenID);
    balanceO.balance.iadd(update.fee);

    return update;
  }

  public static extractData(data: Bitstream) {
    const update: AccountUpdate = {};
    let offset = 1;

    const updateType = data.extractUint8(offset);
    offset += 1;
    update.owner = data.extractAddress(offset);
    offset += 20;
    update.accountID = data.extractUint32(offset);
    offset += 4;
    update.feeTokenID = data.extractUint16(offset);
    offset += 2;
    update.fee = fromFloat(data.extractUint16(offset), Constants.Float16Encoding);
    offset += 2;
    const publicKey = data.extractData(offset, 32);
    offset += 32;
    update.nonce = data.extractUint32(offset);
    offset += 4;


    // Unpack the public key
    const unpacked = EdDSA.unpack(publicKey);
    update.publicKeyX = unpacked.publicKeyX;
    update.publicKeyY = unpacked.publicKeyY;

    return update;
  }
}
