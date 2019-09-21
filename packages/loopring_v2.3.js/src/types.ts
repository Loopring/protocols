import { BigNumber } from "bignumber.js";
import { Bitstream } from "./bitstream";

// Make sure to keep this in sync with the Multihash smart contract
export enum SignAlgorithm {
  Ethereum = 0,   // Sign with web3.eth_sign
                  // Should be compatible with Trezor now (with latest firmware):
                  // https://github.com/ethereum/go-ethereum/issues/14794#issuecomment-392028942
  EIP712 = 1,     // Sign with web3.eth.signTypedData
                  // EIP712: https://github.com/ethereum/EIPs/blob/master/EIPS/eip-712.md
  None = 255,     // Do not sign
}

export enum TokenType {
  ERC20 = 0,
  COUNT = 1,
}

export interface Spendable {
  initialized?: boolean;
  amount?: BigNumber;
  reserved?: BigNumber;
  index?: number;

  // Testing
  initialAmount?: BigNumber;
}

export interface OrderInfo {
  version?: number;

  // required fields in contract
  owner?: string;
  tokenS: string;
  tokenB: string;
  amountS: number;
  amountB: number;
  validSince?: number;
  tokenSpendableS?: Spendable;
  tokenSpendableFee?: Spendable;

  // optional fields
  dualAuthAddr?: string;
  broker?: string;
  brokerSpendableS?: Spendable;
  brokerSpendableFee?: Spendable;
  orderInterceptor?: string;
  walletAddr?: string;
  validUntil?: number;
  allOrNone?: boolean;
  sig?: string;
  dualAuthSig?: string;
  feeToken?: string;
  feeAmount?: number;
  waiveFeePercentage?: number;
  tokenSFeePercentage?: number;
  tokenBFeePercentage?: number;
  tokenRecipient?: string;
  walletSplitPercentage?: number;

  tokenTypeS?: TokenType;
  tokenTypeB?: TokenType;
  tokenTypeFee?: TokenType;
  trancheS?: string;
  trancheB?: string;
  transferDataS?: string;

  // helper field
  P2P?: boolean;
  filledAmountS?: BigNumber;
  brokerInterceptor?: string;
  valid?: boolean;

  hash?: Buffer;
  signAlgorithm?: SignAlgorithm;
  dualAuthSignAlgorithm?: SignAlgorithm;
  dualAuthPrivateKey?: string;

  index?: number;
  balanceS?: number;
  balanceFee?: number;
  balanceB?: number;
  onChain?: boolean;
  signerPrivateKey?: string;

  [key: string]: any;
}

export interface Participation {
  order: OrderInfo;

  // computed fields
  splitS: BigNumber;
  feeAmount: BigNumber;
  feeAmountS: BigNumber;
  feeAmountB: BigNumber;
  rebateFee: BigNumber;
  rebateS: BigNumber;
  rebateB: BigNumber;
  fillAmountS: BigNumber;
  fillAmountB: BigNumber;

  // test fields
  ringSpendableS: BigNumber;
  ringSpendableFee: BigNumber;
}

export interface RingsSubmitParam {
  ringSpecs: number[][];
  data: Bitstream;
  tables: Bitstream;
}

export interface OrderExpectation {
  filledFraction: number;
  payMatchingFeeUsingAmountB?: boolean;
  P2P?: boolean;
  margin?: number;
}

export interface RingExpectation {
  fail?: boolean;
  orders?: OrderExpectation[];
}

export interface TransactionExpectation {
  revert?: boolean;
  revertMessage?: string;
  rings?: RingExpectation[];
  decimalsPrecision?: number;
}

export interface RingsInfo {
  description?: string;
  feeRecipient?: string;
  miner?: string;
  sig?: string;
  rings: number[][];
  orders: OrderInfo[];

  signAlgorithm?: SignAlgorithm;
  signerPrivateKey?: string;
  hash?: Buffer;
  transactionOrigin?: string;

  expected?: TransactionExpectation;

  [key: string]: any;
}

export interface DetailedTokenTransfer {
  description: string;
  token: string;
  from: string;
  to: string;
  amount: number;
  subPayments: DetailedTokenTransfer[];
}

export interface OrderPayments {
  payments: DetailedTokenTransfer[];
}

export interface RingPayments {
  orders: OrderPayments[];
}

export interface TransactionPayments {
  rings: RingPayments[];
}

export interface SimulatorReport {
  reverted: boolean;
  revertMessage?: string;
  ringMinedEvents: RingMinedEvent[];
  invalidRingEvents: InvalidRingEvent[];
  transferItems: TransferItem[];
  feeBalancesBefore: { [id: string]: any; };
  feeBalancesAfter: { [id: string]: any; };
  filledAmountsBefore: { [hash: string]: BigNumber; };
  filledAmountsAfter: { [hash: string]: BigNumber; };
  balancesBefore: { [id: string]: any; };
  balancesAfter: { [id: string]: any; };
  payments: TransactionPayments;
}

export interface TransferItem {
  token: string;
  from: string;
  to: string;
  amount: BigNumber;
}

export interface Fill {
  orderHash: string;
  owner: string;
  tokenS: string;
  amountS: BigNumber;
  split: BigNumber;
  feeAmount: BigNumber;
  feeAmountS: BigNumber;
  feeAmountB: BigNumber;
}

export interface RingMinedEvent {
  ringIndex: BigNumber;
  ringHash: string;
  feeRecipient: string;
  fills: Fill[];
}

export interface InvalidRingEvent {
  ringHash: string;
}
