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

export interface WithdrawalRequest {
  account: DexAccount;

  tokenID: number;
  amount: BN;

  feeTokenID?: number;
  fee?: BN;

  label?: number;

  withdrawalIdx?: number;
  slotIdx?: number;

  withdrawalFee?: BN;
  signature?: Signature;
  timestamp?: number;
  transactionHash?: string;
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
