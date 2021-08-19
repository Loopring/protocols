import BN = require("bn.js");
import { Signature } from "loopringV3.js";

export enum AuthMethod {
  NONE,
  EDDSA,
  ECDSA,
  APPROVE,
  FORCE,
  DEPOSIT
}

export interface OrderInfo {
  owner?: string;
  tokenS?: string;
  tokenB?: string;
  amountS: BN;
  amountB: BN;

  nftDataB?: string;

  exchange?: string;
  accountID?: number;
  storageID?: number;

  tokenIdS?: number;
  tokenIdB?: number;

  validUntil?: number;
  maxFeeBips?: number;
  fillAmountBorS?: boolean;
  taker?: string;

  feeBips?: number;

  amm?: boolean;

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
  maxFee: BN;
  originalMaxFee?: BN;

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

  toTokenID: number;

  feeTokenID: number;
  fee: BN;
  maxFee: BN;
  originalMaxFee?: BN;

  from: string;
  to: string;

  dualAuthorX: string;
  dualAuthorY: string;
  payerToAccountID: number;
  payerTo: string;
  payeeToAccountID: number;

  storageID: number;
  validUntil: number;

  putAddressesInDA: boolean;

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
  storageID: number;
  validUntil: number;
  tokenID: number;
  amount: BN;

  feeTokenID?: number;
  fee?: BN;
  maxFee: BN;
  originalMaxFee?: BN;

  storeRecipient: boolean;

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

export interface AmmUpdate {
  txType?: "AmmUpdate";
  exchange: string;

  owner: string;
  accountID: number;
  tokenID: number;

  feeBips: number;
  tokenWeight: BN;

  validUntil: number;
  nonce: number;

  onchainSignature?: any;
}

export interface SignatureVerification {
  txType?: "SignatureVerification";
  exchange: string;

  owner: string;
  accountID: number;
  data: string;

  signature?: Signature;
}

export class NftMint {
  txType?: "NftMint";
  exchange: string;

  type: number;

  minterAccountID: number;
  tokenAccountID: number;

  amount: BN;
  nftID: string;
  nftIDHi?: string;
  nftIDLo?: string;

  feeTokenID?: number;
  fee?: BN;
  maxFee?: BN;
  originalMaxFee?: BN;

  storageID?: number;
  validUntil?: number;

  toAccountID: number;
  toTokenID: number;

  minter: string;
  to?: string;

  nftType: number;
  tokenAddress: string;

  nftData?: string;

  creatorFeeBips: number;

  signature?: Signature;
  onchainSignature?: any;
}

export class NftData {
  txType?: "NftData";
  exchange: string;

  type: number;

  accountID: number;
  tokenID: number;

  minterAccountID: number;
  minter: string;

  nftType: number;
  tokenAddress: string;

  nftID: string;
  nftIDHi?: string;
  nftIDLo?: string;

  creatorFeeBips: number;
}

// Blocks

export interface TxBlock {
  transactions: any[];
  ammTransactions: any[];
  protocolTakerFeeBips?: number;
  protocolMakerFeeBips?: number;

  timestamp?: number;
  exchange?: string;
  operatorAccountID?: number;

  signature?: Signature;
}

export interface BlockCallback {
  target: string;
  txIdx: number;
  numTxs: number;
  auxiliaryData: any;
  tx?: any;
}

export interface GasTokenConfig {
  gasTokenVault: string;
  maxToBurn: number;
  expectedGasRefund: number;
  calldataCost: number;
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
  publicDataHash: string;
  publicInput: string;
  proof?: string[];
  blockFee?: BN;
  timestamp: number;
  transactionHash: string;
  internalBlock: TxBlock;
  blockInfoData?: any;
  shutdown?: boolean;
  callbacks?: BlockCallback[];
}

export interface Account {
  accountID: number;
  owner: string;
  publicKeyX: string;
  publicKeyY: string;
  secretKey: string;
  nonce: number;
}
