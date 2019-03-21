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

  stateId?: number;
  accountId?: number;
  orderId?: number;
  walletId?: number;
  dualAuthAccountId?: number;

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

  minerAccountId?: number;
  feeRecipientAccountId?: number;
  tokenId?: number;
  fee?: BN;

  expected?: RingExpectation;
}

export interface RingBlock {
  rings: RingInfo[];

  timestamp?: number;
  stateId?: number;
  operatorAccountId?: number;
}

export interface Deposit {
  depositBlockIdx: number;
  accountId: number;
  secretKey: string;
  publicKeyX: string;
  publicKeyY: string;
  walletId: number;
  tokenId: number;
  amount: BN;
}

export interface WithdrawalRequest {
  accountId: number;
  tokenId: number;
  amount: BN;

  dualAuthAccountId: number;
  feeTokenID: number;
  fee: BN;
  walletSplitPercentage: number;

  withdrawBlockIdx?: number;
}

export interface Withdrawal {
  stateId: number;
  blockIdx: number;
  withdrawalIdx: number;
}

export interface WithdrawBlock {
  withdrawals: WithdrawalRequest[];

  operatorAccountId?: number;
}

export interface Cancel {
  accountId: number;
  orderTokenID: number;
  orderId: number;
  dualAuthAccountId: number;
  feeTokenID: number;
  fee: BN;
  walletSplitPercentage: number;
}

export interface CancelBlock {
  cancels: Cancel[];

  operatorAccountId?: number;
}

export interface Block {
  blockIdx: number;
  filename: string;
  operator: Operator;
}

export interface Operator {
  owner: string;
  operatorID: number;
  accountId: number;
}

export interface Wallet {
  owner: string;
  walletId: number;
  walletAccountId: number;
}

export interface TradeHistory {
  filled: BN;
  cancelled: boolean;
}

export interface Balance {
  balance: BN;
  tradeHistory: {[key: number]: TradeHistory};
}

export interface Account {
  accountId: number;
  walletId: number;
  publicKeyX: string;
  publicKeyY: string;
  nonce: number;
  balances: {[key: number]: Balance};
}

export interface State {
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
  stateBefore: State;
  stateAfter: State;
  detailedTransfers: DetailedTokenTransfer[];
}

export interface SimulatorDepositReport {
  stateBefore: State;
  stateAfter: State;
}

export interface DepositInfo {
  accountId: number;
  depositBlockIdx: number;
  slotIdx: number;
}
