import BN = require("bn.js");

export interface OrderInfo {
  // required fields in contract
  owner?: string;
  tokenS?: string;
  tokenB?: string;
  tokenF?: string;
  amountS: BN;
  amountB: BN;
  amountF?: BN;

  realmID?: number;
  accountID?: number;
  orderID?: number;
  walletAccountID?: number;

  dualAuthPublicKeyX?: string;
  dualAuthPublicKeyY?: string;
  dualAuthSecretKey?: string;

  tokenIdS?: number;
  tokenIdB?: number;
  tokenIdF?: number;

  allOrNone?: boolean;
  validSince?: number;
  validUntil?: number;
  walletSplitPercentage?: number;
  waiveFeePercentage?: number;

  balanceS?: BN;
  balanceB?: BN;
  balanceF?: BN;

  [key: string]: any;
}

export interface OrderExpectation {
  filledFraction: number;
  margin?: BN;
}

export interface RingExpectation {
  orderA?: OrderExpectation;
  orderB?: OrderExpectation;
}

export interface RingInfo {
  orderA: OrderInfo;
  orderB: OrderInfo;

  minerAccountID?: number;
  feeRecipientAccountID?: number;
  tokenID?: number;
  fee?: BN;

  expected?: RingExpectation;
}

export interface RingBlock {
  rings: RingInfo[];

  onchainDataAvailability?: boolean;
  timestamp?: number;
  realmID?: number;
  operatorAccountID?: number;
}

export interface Deposit {
  depositBlockIdx: number;
  accountID: number;
  secretKey: string;
  publicKeyX: string;
  publicKeyY: string;
  tokenID: number;
  amount: BN;
}

export interface DepositBlock {
  deposits: Deposit[];

  onchainDataAvailability?: boolean;
  startHash: BN;
  startIndex: number;
  count: number;
}

export interface WithdrawalRequest {
  accountID: number;
  tokenID: number;
  amount: BN;

  walletAccountID: number;
  feeTokenID: number;
  fee: BN;
  walletSplitPercentage: number;

  withdrawBlockIdx?: number;
  slotIdx?: number;
}

export interface Withdrawal {
  realmID: number;
  blockIdx: number;
  withdrawalIdx: number;
}

export interface WithdrawBlock {
  withdrawals: WithdrawalRequest[];

  onchainDataAvailability?: boolean;

  operatorAccountID?: number;

  startHash: BN;
  startIndex: number;
  count: number;
}

export interface Cancel {
  accountID: number;
  orderTokenID: number;
  orderID: number;
  walletAccountID: number;
  feeTokenID: number;
  fee: BN;
  walletSplitPercentage: number;
}

export interface CancelBlock {
  cancels: Cancel[];

  onchainDataAvailability?: boolean;

  operatorAccountID?: number;
}

export interface Block {
  blockIdx: number;
  filename: string;
  operator: Operator;
}

export interface Operator {
  owner: string;
  accountID: number;
}

export interface Wallet {
  owner: string;
  walletAccountID: number;
}

export interface TradeHistory {
  filled: BN;
  cancelled: boolean;
  orderID: number;
}

export interface Balance {
  balance: BN;
  tradeHistory: {[key: number]: TradeHistory};
}

export interface Account {
  accountID: number;
  publicKeyX: string;
  publicKeyY: string;
  nonce: number;
  balances: {[key: number]: Balance};
}

export interface Realm {
  accounts: {[key: number]: Account};
}

export interface DetailedTokenTransfer {
  description: string;
  token: number;
  from: number;
  to: number;
  amount: BN;
  subPayments: DetailedTokenTransfer[];
}

export interface SimulatorTradeReport {
  realmBefore: Realm;
  realmAfter: Realm;
  detailedTransfers: DetailedTokenTransfer[];
}

export interface SimulatorDepositReport {
  realmBefore: Realm;
  realmAfter: Realm;
}

export interface SimulatorWithdrawReport {
  realmBefore: Realm;
  realmAfter: Realm;
}

export interface DepositInfo {
  accountID: number;
  depositBlockIdx: number;
  slotIdx: number;
  depositIdx: number;
}
