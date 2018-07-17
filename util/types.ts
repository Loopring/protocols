import { BigNumber } from "bignumber.js";

export interface OrderInfo {
  // required fields in contract
  owner?: string;
  tokenS: string;
  tokenB: string;
  amountS: number;
  amountB: number;
  lrcFee?: number;

  // optional fields
  dualAuthAddr?: string;            // spec value 1
  broker?: string;                  // spec value 1 << 1
  orderInterceptor?: string;        // spec value 1 << 2
  walletAddr?: string;              // spec value 1 << 3
  validSince?: number;              // spec value 1 << 4
  validUntil?: number;              // spec value 1 << 5
  buyNoMoreThanAmountB?: boolean;   // spec value 1 << 6
  allOrNone?: boolean;              // spec value 1 << 7
  sig?: string;                     // spec value 1 << 8
  dualAuthSig?: string;             // spec value 1 << 9

  // helper field
  scaledAmountS?: number;
  scaledAmountB?: number;
  fillAmountS?: number;
  orderHashHex?: string;
  v?: number;
  r?: string;
  s?: string;

  index?: number;
  delegateContract?: string;
}

export interface RingsSubmitParam {
  miningSpec: number;
  orderSpecs: number[];
  ringSpecs: number[][];
  addressList: string[];
  uintList: BigNumber[];
  bytesList: string[];
}

export interface RingsInfo {
  description?: string;
  feeRecipient?: string; // spec value: 1
  miner?: string;        // spec value: 1 << 1
  sig?: string;          // spec value: 1 << 2
  rings: number[][];
  orders: OrderInfo[];
}
