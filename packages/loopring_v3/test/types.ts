import BN = require("bn.js");
import { Signature } from "loopringV3.js";

export enum AuthMethod {
  NONE,
  EDDSA,
  ECDSA,
  APPROVE,
  FORCE
}

export interface OrderInfo {
  owner?: string;
  tokenS?: string;
  tokenB?: string;
  amountS: BN;
  amountB: BN;

  exchange?: string;
  accountID?: number;
  storageID?: number;

  tokenIdS?: number;
  tokenIdB?: number;

  allOrNone?: boolean;
  validSince?: number;
  validUntil?: number;
  maxFeeBips?: number;
  buy?: boolean;
  taker?: string;

  feeBips?: number;
  rebateBips?: number;

  balanceS?: BN;
  balanceB?: BN;

  hash?: string;
  signature?: Signature;

  [key: string]: any;
}

export interface OrderExpectation {
  filledFraction: number;
  spread?: BN;
}

export interface RingExpectation {
  orderA?: OrderExpectation;
  orderB?: OrderExpectation;
}

// Transactions

export interface Noop {
  txType?: "Noop";
}

export interface SpotTrade {
  txType?: "SpotTrade";

  orderA: OrderInfo;
  orderB: OrderInfo;

  tokenID?: number;
  fee?: BN;

  expected?: RingExpectation;
}

export interface Deposit {
  txType?: "Deposit";
  owner: string;
  accountID: number;
  tokenID: number;
  amount: BN;

  fee: BN;
  token: string;
  timestamp?: number;
  transactionHash?: string;
}

export interface AccountUpdate {
  txType?: "AccountUpdate";
  exchange: string;

  type: number;

  owner: string;
  accountID: number;
  nonce: number;
  validUntil: number;

  publicKeyX: string;
  publicKeyY: string;
  feeTokenID: number;
  fee: BN;

  signature?: Signature;
  onchainSignature?: any;
}

export class Transfer {
  txType?: "Transfer";
  exchange: string;

  type: number;

  fromAccountID: number;
  toAccountID: number;

  tokenID: number;
  amount: BN;

  feeTokenID: number;
  fee: BN;

  from: string;
  to: string;

  dualAuthorX: string;
  dualAuthorY: string;
  payerToAccountID: number;
  payerTo: string;
  payeeToAccountID: number;

  storageID: number;
  validUntil: number;

  dualSecretKey?: string;

  signature?: Signature;
  dualSignature?: Signature;

  onchainSignature?: any;
}

export interface WithdrawalRequest {
  txType?: "Withdraw";
  exchange: string;

  type: number;

  owner: string;
  accountID: number;
  nonce: number;
  validUntil: number;
  tokenID: number;
  amount: BN;

  feeTokenID?: number;
  fee?: BN;

  minGas: number;
  gas?: number;

  to?: string;
  extraData?: string;

  onchainDataHash?: string;

  withdrawalFee?: BN;

  signature?: Signature;
  onchainSignature?: any;

  timestamp?: number;
  transactionHash?: string;
}

// Blocks

export interface TxBlock {
  transactions: any[];
  protocolTakerFeeBips?: number;
  protocolMakerFeeBips?: number;

  timestamp?: number;
  exchange?: string;
  operatorAccountID?: number;

  signature?: Signature;
}

export interface Block {
  blockIdx: number;
  filename: string;
  blockType: number;
  blockSize: number;
  blockVersion: number;
  operator: string;
  origin: string;
  operatorId: number;
  merkleRoot: string;
  data: string;
  auxiliaryData: any[];
  offchainData: string;
  compressedData: string;
  publicDataHash: string;
  publicInput: string;
  proof?: string[];
  blockFee?: BN;
  timestamp: number;
  transactionHash: string;
  internalBlock: TxBlock;
  shutdown?: boolean;
}

export interface Account {
  accountID: number;
  owner: string;
  publicKeyX: string;
  publicKeyY: string;
  secretKey: string;
  nonce: number;
}
