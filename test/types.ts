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

  stateID?: number;
  walletID?: number;
  orderID?: number;
  accountID?: number;
  dualAuthAccountID?: number;

  tokenIdS?: number;
  tokenIdB?: number;
  tokenIdF?: number;

  allOrNone?: boolean;
  validSince?: number;
  validUntil?: number;
  walletSplitPercentage?: number;
  waiveFeePercentage?: number;

  index?: number;
  balanceS?: BN;
  balanceB?: BN;
  balanceF?: BN;

  [key: string]: any;
}

export interface RingInfo {
  orderA: OrderInfo;
  orderB: OrderInfo;

  minerID?: number;
  minerAccountID?: number;
  fee?: number;
}

export interface RingsInfo {
  rings: RingInfo[];

  publicDataHash?: string;
  timestamp?: number;

  stateID?: number;
  operatorAccountID?: number;
}

export interface Deposit {
  depositBlockIdx: number;
  accountID: number;
  secretKey: string;
  publicKeyX: string;
  publicKeyY: string;
  walletID: number;
  tokenID: number;
  amount: BN;
}

export interface Withdrawal {
  accountID: number;
  tokenID: number;
  amount: BN;
}

export interface Block {
  blockIdx: number;
  filename: string;
}
