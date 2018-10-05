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

export interface Spendable {
  initialized?: boolean;
  amount?: number;
  reserved?: number;
  index?: number;

  // Testing
  initialAmount?: number;
}

export interface OrderInfo {
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
  dualAuthAddr?: string;            // spec value 1
  broker?: string;                  // spec value 1 << 1
  brokerSpendableS?: Spendable;
  brokerSpendableFee?: Spendable;
  orderInterceptor?: string;        // spec value 1 << 2
  walletAddr?: string;              // spec value 1 << 3
  validUntil?: number;              // spec value 1 << 4
  allOrNone?: boolean;              // spec value 1 << 5
  sig?: string;                     // spec value 1 << 6
  dualAuthSig?: string;             // spec value 1 << 7
  feeToken?: string;                // spec value 1 << 8
  feeAmount?: number;               // spec value 1 << 9
  feePercentage?: number;           // spec value 1 << 10
  waiveFeePercentage?: number;      // spec value 1 << 11
  tokenSFeePercentage?: number;     // spec value 1 << 12
  tokenBFeePercentage?: number;     // spec value 1 << 13
  tokenRecipient?: string;          // spec value 1 << 14
  walletSplitPercentage?: number;   // spec value 1 << 15

  // helper field
  P2P?: boolean;
  filledAmountS?: number;
  fillAmountS?: number;
  fillAmountB?: number;
  fillAmountFee?: number;
  fillAmountFeeS?: number;
  fillAmountFeeB?: number;
  rebateFee?: number;
  rebateS?: number;
  rebateB?: number;
  splitS?: number;
  brokerInterceptor?: string;
  valid?: boolean;

  hash?: Buffer;
  signAlgorithm?: SignAlgorithm;
  dualAuthSignAlgorithm?: SignAlgorithm;

  index?: number;
  balanceS?: number;
  balanceFee?: number;
  onChain?: boolean;

  [key: string]: any;
}

export interface Participation {
  order: OrderInfo;

  // computed fields
  splitS?: number;
  feeAmount?: number;
  feeAmountS?: number;
  feeAmountB?: number;
  rebateFee?: number;
  rebateS?: number;
  rebateB?: number;
  fillAmountS?: number;
  fillAmountB?: number;

  // test fields
  ringSpendableS?: number;
  ringSpendableFee?: number;
}

export interface RingsSubmitParam {
  miningSpec: number;
  orderSpecs: number[];
  ringSpecs: number[][];
  data: Bitstream;
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
  ringMinedEvents: RingMinedEvent[];
  transferItems: TransferItem[];
  feeBalances: { [id: string]: any; };
  filledAmounts: { [hash: string]: number; };
  payments: TransactionPayments;
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
