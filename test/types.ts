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

  validSince?: number;
  validUntil?: number;

  index?: number;
  balanceS?: number;
  balanceB?: number;
  balanceF?: number;

  [key: string]: any;
}

export interface RingInfo {
  orderA: OrderInfo;
  orderB: OrderInfo;

  fillS_A?: number;
  fillB_A?: number;
  fillF_A?: number;

  fillS_B?: number;
  fillB_B?: number;
  fillF_B?: number;
}

export interface RingsInfo {
  rings: RingInfo[];

  publicDataHash?: string;
  timestamp?: number;
}

export interface TokenTransfer {
  token: string;
  from: string;
  to: string;
  amount: number;
}
