import { BigNumber } from "bignumber.js";

// Make sure to keep this in sync with the Multihash smart contract
export enum SignAlgorithm {
  Ethereum = 0,   // Sign with web3.eth_sign
                  // Should be compatible with Trezor now (with latest firmware):
                  // https://github.com/ethereum/go-ethereum/issues/14794#issuecomment-392028942
  EIP712 = 1,     // Sign with web3.eth.signTypedData
                  // EIP712: https://github.com/ethereum/EIPs/blob/master/EIPS/eip-712.md
  None = 255,     // Do not sign
}

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
  allOrNone?: boolean;              // spec value 1 << 6
  sig?: string;                     // spec value 1 << 7
  dualAuthSig?: string;             // spec value 1 << 8;

  // helper field
  maxAmountS?: number;
  maxAmountB?: number;
  fillAmountS?: number;
  fillAmountB?: number;
  fillAmountLrcFee?: number;
  splitS?: number;
  brokerInterceptor?: string;
  valid?: boolean;

  hash?: Buffer;
  delegateContract?: string;
  signAlgorithm?: SignAlgorithm;
  dualAuthSignAlgorithm?: SignAlgorithm;

  index?: number;
  lrcAddress?: string;

  [key: string]: any;
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

  signAlgorithm?: SignAlgorithm;
  hash?: Buffer;
  transactionOrigin?: string;

  [key: string]: any;
}

export interface SimulatorReport {
  ringMinedEvents: RingMinedEvent[];
  transferItems: TransferItem[];
}

export interface TransferItem {
  token: string;
  from: string;
  to: string;
  amount: number;
}

export interface RingMinedEvent {
  ringIndex: BigNumber;
}
