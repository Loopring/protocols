import BN = require("bn.js");

export interface OrderInfo {
  // required fields in contract
  owner?: string;
  tokenS: string;
  tokenB: string;
  tokenF?: string;
  amountS: number;
  amountB: number;
  amountF?: number;

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

  index?: number;
  balanceS?: number;
  balanceB?: number;
  balanceF?: number;

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

  operator?: number;
}

export interface Deposit {
  secretKey: string;
  publicKeyX: string;
  publicKeyY: string;
  walletID: number;
  tokenID: number;
  balance: number;
}

export interface Withdrawal {
  account: number;
  amount: number;
}

export interface Block {
  blockIdx: number;
  filename: string;
}
