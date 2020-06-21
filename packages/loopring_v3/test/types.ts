import BN = require("bn.js");
import { BlockType, Signature } from "loopringV3.js";

export interface OrderInfo {
  owner?: string;
  tokenS?: string;
  tokenB?: string;
  amountS: BN;
  amountB: BN;

  exchangeID?: number;
  accountID?: number;
  orderID?: number;

  tokenIdS?: number;
  tokenIdB?: number;

  allOrNone?: boolean;
  validSince?: number;
  validUntil?: number;
  maxFeeBips?: number;
  buy?: boolean;

  feeBips?: number;
  rebateBips?: number;

  transferAmountTrade?: BN;
  reduceOnly?: boolean;
  triggerPrice?: BN;

  transferAmount?: BN;
  transferFee?: BN;

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

export interface TxBlock {
  transactions: any[];
  protocolTakerFeeBips?: number;
  protocolMakerFeeBips?: number;

  onchainDataAvailability?: boolean;
  timestamp?: number;
  exchangeID?: number;
  operatorAccountID?: number;

  signature?: Signature;
}

export interface Deposit {
  txType?: "Deposit";
  owner: string;
  accountID: number;
  tokenID: number;
  amount: BN;
  timestamp?: number;
  transactionHash?: string;
}

export interface PublicKeyUpdate {
  txType?: "PublicKeyUpdate";
  owner: string;
  accountID: number;
  nonce: number;
  publicKeyX: string;
  publicKeyY: string;
  feeTokenID: number;
  fee: BN;

  onchainSignature?: any;
}

export class Transfer {
  txType?: "Transfer";

  type: number;

  accountFromID: number;
  accountToID: number;

  transTokenID: number;
  amount: BN;

  feeTokenID: number;
  fee: BN;

  ownerFrom: string;
  ownerTo: string;

  validUntil: number;

  dualAuthorX: string;
  dualAuthorY: string;
  payerAccountToID: number;
  payerOwnerTo: string;
  payeeAccountToID: number;

  nonce: number;

  dualSecretKey?: string;

  signature?: Signature;
  dualSignature?: Signature;
}

export interface WithdrawalRequest {
  txType?: "Withdraw";

  type: number;

  owner: string;
  accountID: number;
  nonce: number;
  tokenID: number;
  amount: BN;

  feeTokenID?: number;
  fee?: BN;

  to: string;

  withdrawalIdx?: number;
  slotIdx?: number;

  withdrawalFee?: BN;

  signature?: Signature;
  onchainSignature?: any;

  timestamp?: number;
  transactionHash?: string;
}

export interface Block {
  blockIdx: number;
  filename: string;
  blockType: BlockType;
  blockSize: number;
  blockVersion: number;
  operator: string;
  origin: string;
  operatorId: number;
  merkleRoot: string;
  data: string;
  auxiliaryData: string;
  offchainData: string;
  compressedData: string;
  publicDataHash: string;
  publicInput: string;
  proof?: string[];
  blockFeeRewarded?: BN;
  blockFeeFined?: BN;
  timestamp: number;
  transactionHash: string;
  shutdown?: boolean;
  internalBlock?: any;
}

export interface Account {
  accountID: number;
  owner: string;
  publicKeyX: string;
  publicKeyY: string;
  secretKey: string;
  nonce: number;
}

export interface TradeHistory {
  filled: BN;
  orderID: number;
}

export interface Balance {
  balance: BN;
  position: BN;
  fundingIndex: BN;
  tradeHistory: { [key: number]: TradeHistory };
}

export interface AccountLeaf {
  publicKeyX: string;
  publicKeyY: string;
  nonce: number;
  balances: { [key: number]: Balance };
}

export interface ExchangeState {
  accounts: AccountLeaf[];
}

export interface DetailedTokenTransfer {
  description: string;
  token: number;
  from: number;
  to: number;
  amount: BN;
  subPayments: DetailedTokenTransfer[];
}

export interface DetailedSimulatorReport {
  exchangeStateBefore: ExchangeState;
  exchangeStateAfter: ExchangeState;
  detailedTransfers: DetailedTokenTransfer[];
}

export interface SimulatorReport {
  exchangeStateBefore: ExchangeState;
  exchangeStateAfter: ExchangeState;
}

export interface DepositInfo {
  owner: string;
  token: string;
  amount: BN;
  fee: BN;
  timestamp: number;
  accountID: number;
  depositIdx: number;
}

