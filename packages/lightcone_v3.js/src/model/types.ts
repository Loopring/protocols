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
  nonce?: number;
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
  tokenF: string;
  tokenFId?: number;
  amountF: string;
  amountFInBN?: BN;
  label?: number;
  signature?: Signature;
  hash?: string;
}

export class OrderRequest {
  owner: string;
  accountId: number;
  exchangeId: number;
  keyPair: KeyPair;

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

  allOrNone?: boolean;
  validSince: number;
  validUntil: number;
  maxFeeBips: number;
  buy?: boolean;

  feeBips: number;
  rebateBips?: number;

  hash?: string;
  signatureRx?: string;
  signatureRy?: string;
  signatureS?: string;

  [key: string]: any;
}

// must be cost by circuit -- NOT recommend
export class CancelRequest {
  account: DexAccount;
  orderToken: string;
  orderTokenId?: number;
  orderId: number;
  tokenF: string;
  tokenFId?: number;
  amountF: string;
  amountFInBN?: BN;
  label?: number;
  signature?: Signature;
}

export class GetAPIKeyRequest {
  account: DexAccount;
  signature?: Signature;
}

export class SignAPIKeyRequest {
  accountId: number;
  publicKeyX: string;
  publicKeyY: string;
}

export class FlexCancelRequest {
  account: DexAccount;
  orderHash?: string;
  clientOrderId?: string;
  signature?: Signature;
}

export class SignFlexCancelRequest {
  accountId: number;
  orderHash?: string;
  clientOrderId?: string;
}
