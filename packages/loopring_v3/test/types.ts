import BN = require("bn.js");

export enum BlockState {
  NEW = 0,
  COMMITTED,
  VERIFIED,
}

export enum BlockType {
  RING_SETTLEMENT = 0,
  DEPOSIT,
  ONCHAIN_WITHDRAWAL,
  OFFCHAIN_WITHDRAWAL,
  ORDER_CANCELLATION,
}

export interface KeyPair {
  publicKeyX: string;
  publicKeyY: string;
  secretKey: string;
}

export interface Signature {
  Rx: string;
  Ry: string;
  s: string;
}

export interface OrderInfo {
  owner?: string;
  tokenS?: string;
  tokenB?: string;
  amountS: BN;
  amountB: BN;

  exchangeID?: number;
  accountID?: number;
  orderID?: number;

  dualAuthPublicKeyX?: string;
  dualAuthPublicKeyY?: string;
  dualAuthSecretKey?: string;

  tokenIdS?: number;
  tokenIdB?: number;

  allOrNone?: boolean;
  validSince?: number;
  validUntil?: number;
  maxFeeBips?: number;
  buy?: boolean;

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

export interface RingInfo {
  orderA: OrderInfo;
  orderB: OrderInfo;

  ringMatcherAccountID?: number;
  tokenID?: number;
  fee?: BN;

  expected?: RingExpectation;
}

export interface RingBlock {
  rings: RingInfo[];
  protocolTakerFeeBips?: number;
  protocolMakerFeeBips?: number;

  onchainDataAvailability?: boolean;
  timestamp?: number;
  exchangeID?: number;
  operatorAccountID?: number;

  signature?: Signature;
}

export interface Deposit {
  depositIdx: number;
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

  withdrawalIdx?: number;
  slotIdx?: number;

  withdrawalFee?: BN;

  signature?: Signature;
}

export interface Withdrawal {
  exchangeID: number;
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

  signature?: Signature;
}

export interface CancelBlock {
  cancels: Cancel[];

  onchainDataAvailability?: boolean;

  operatorAccountID?: number;
}

export interface Block {
  blockIdx: number;
  filename: string;
  operatorId: number;
  compressedData: string;
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
  cancelled: boolean;
  orderID: number;
}

export interface Balance {
  balance: BN;
  tradeHistory: {[key: number]: TradeHistory};
}

export interface AccountLeaf {
  publicKeyX: string;
  publicKeyY: string;
  nonce: number;
  balances: {[key: number]: Balance};
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

export interface RingSettlementSimulatorReport {
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
