import BN = require("bn.js");

export interface OrderInfo {
  // required fields in contract
  owner?: string;
  tokenS: string;
  tokenB: string;
  tokenF?: string;
  amountS: BN;
  amountB: BN;
  amountF?: BN;

  wallet?: string;

  walletID?: number;
  orderID?: number;

  accountS?: number;
  accountB?: number;
  accountF?: number;

  walletSplitPercentage?: number;
  walletF?: number;
  minerF?: number;
  minerS?: number;

  tokenIdS?: number;
  tokenIdB?: number;
  tokenIdF?: number;

  validSince?: number;
  validUntil?: number;

  allOrNone?: boolean;

  waiveFeePercentage?: number;

  stateID?: number;

  index?: number;
  balanceS?: BN;
  balanceB?: BN;
  balanceF?: BN;

  [key: string]: any;
}

export interface RingInfo {
  orderA: OrderInfo;
  orderB: OrderInfo;

  miner?: number;
  fee?: number;
}

export interface RingsInfo {
  rings: RingInfo[];

  publicDataHash?: string;
  timestamp?: number;

  stateID?: number;
  operator?: number;
}

export interface Deposit {
  depositBlockIdx: number;
  accountID: number;
  secretKey: string;
  publicKeyX: string;
  publicKeyY: string;
  walletID: number;
  tokenID: number;
  balance: BN;
}

export interface Withdrawal {
  account: number;
  amount: BN;
}

export interface Block {
  blockIdx: number;
  filename: string;
}
