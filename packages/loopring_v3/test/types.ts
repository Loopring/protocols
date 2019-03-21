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

  stateID?: number;
  accountID?: number;
  orderID?: number;
  walletID?: number;
  dualAuthAccountID?: number;

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
  tokenId?: number;
  fee?: BN;

  expected?: RingExpectation;
}

export interface RingBlock {
  rings: RingInfo[];

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
  tokenId: number;
  amount: BN;
}

export interface WithdrawalRequest {
  accountID: number;
  tokenId: number;
  amount: BN;

  dualAuthAccountID: number;
  feeTokenID: number;
  fee: BN;
  walletSplitPercentage: number;

  withdrawBlockIdx?: number;
}

export interface Withdrawal {
  stateID: number;
  blockIdx: number;
  withdrawalIdx: number;
}

export interface WithdrawBlock {
  withdrawals: WithdrawalRequest[];

  operatorAccountID?: number;
}

export interface Cancel {
  accountID: number;
  orderTokenID: number;
  orderID: number;
  dualAuthAccountID: number;
  feeTokenID: number;
  fee: BN;
  walletSplitPercentage: number;
}

export interface CancelBlock {
  cancels: Cancel[];

  operatorAccountID?: number;
}

export interface Block {
  blockIdx: number;
  filename: string;
  operator: Operator;
}

export interface Operator {
  owner: string;
  operatorID: number;
  accountID: number;
}

export interface Wallet {
  owner: string;
  walletID: number;
  walletAccountID: number;
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
  accountID: number;
  walletID: number;
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
  accountID: number;
  depositBlockIdx: number;
  slotIdx: number;
}
