import BN = require("bn.js");

/**
 * The keypair data for EdDSA.
 */
export class KeyPair {
  publicKeyX: string;
  publicKeyY: string;
  secretKey: string;
}

export class DexAccount {
  accountId: number;
  keyPair: KeyPair;
  nonce: number;
}

/**
 * The signature data for EdDSA.
 */
export interface Signature {
  Rx: string;
  Ry: string;
  s: string;
}

export class WithdrawalRequest {
  account: DexAccount;
  token: string;
  tokenId?: number;
  amount: string;
  amountInBN?: BN;
  feeToken: string;
  feeTokenID?: number;
  fee: string;
  feeInBN?: BN;
  label?: number;
  signature?: Signature;
  hash?: string;
}

export class OrderInfo {
  owner: string;
  account: DexAccount;
  exchangeId: number;

  tokenS: string;
  tokenB: string;
  tokenSId: number;
  tokenBId: number;

  amountS: string;
  amountB: string;
  amountSInBN: BN;
  amountBInBN: BN;

  orderId: number;

  label: number;

  allOrNone: boolean;
  validSince: number;
  validUntil: number;
  maxFeeBips: number;
  buy?: boolean;

  feeBips: number;
  rebateBips?: number;

  hash?: string;
  signature?: Signature;

  [key: string]: any;
}
