import BN from "bn.js";
import { Bitstream } from "../bitstream";
import { Constants } from "../constants";
import { EdDSA } from "../eddsa";
import { fromFloat } from "../float";
import { BlockContext, ExchangeState } from "../types";

interface NewAccount {
  payerAccountID?: number;
  feeTokenID?: number;
  fee?: BN;
  newAccountID?: number;
  newOwner?: string;
  newPublicKeyX?: string;
  newPublicKeyY?: string;
  newWalletHash?: string;
}

/**
 * Processes new account requests.
 */
export class NewAccountProcessor {
  public static process(
    state: ExchangeState,
    block: BlockContext,
    txData: Bitstream
  ) {
    const create = this.extractData(txData);
    const payerAccount = state.getAccount(create.payerAccountID);
    const newAccount = state.getAccount(create.newAccountID);

    newAccount.owner = create.newOwner;
    newAccount.publicKeyX = create.newPublicKeyX;
    newAccount.publicKeyY = create.newPublicKeyY;
    newAccount.walletHash = create.newWalletHash;
    payerAccount.nonce++;

    const balance = payerAccount.getBalance(create.feeTokenID);
    balance.balance.isub(create.fee);

    const operator = state.getAccount(block.operatorAccountID);
    const balanceO = operator.getBalance(create.feeTokenID);
    balanceO.balance.iadd(create.fee);

    return create;
  }

  public static extractData(data: Bitstream) {
    const create: NewAccount = {};
    let offset = 1;

    create.payerAccountID = data.extractUint24(offset);
    offset += 3;
    create.feeTokenID = data.extractUint16(offset);
    offset += 2;
    create.fee = fromFloat(
      data.extractUint16(offset),
      Constants.Float16Encoding
    );
    offset += 2;
    create.newAccountID = data.extractUint24(offset);
    offset += 3;
    create.newOwner = data.extractAddress(offset);
    offset += 20;
    const publicKey = data.extractData(offset, 32);
    offset += 32;
    create.newWalletHash = data.extractUint(offset).toString(10);
    offset += 32;

    // Unpack the public key
    const unpacked = EdDSA.unpack(publicKey);
    create.newPublicKeyX = unpacked.publicKeyX;
    create.newPublicKeyY = unpacked.publicKeyY;

    return create;
  }
}
