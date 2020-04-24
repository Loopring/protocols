import BN from "bn.js";
import { SparseMerkleTree } from "./sparse_merkle_tree";

/**
 * The type of requests handled in a block.
 */
export enum BlockType {
  SETTLEMENT = 0,
  DEPOSIT,
  ONCHAIN_WITHDRAWAL,
  OFFCHAIN_WITHDRAWAL,
  ORDER_CANCELLATION,
  INTERNAL_TRANSFER
}

/**
 * The method in which an exchange is created.
 */
export enum ForgeMode {
  AUTO_UPGRADABLE = 0,
  MANUAL_UPGRADABLE,
  PROXIED,
  NATIVE
}

/**
 * A Loopring block.
 */
export interface Block {
  /** The exchange the block was committed on. */
  exchangeId: number;
  /** The block index of the block. */
  blockIdx: number;

  /** The type of requests handled in the block. */
  blockType: BlockType;
  /** The block size (in number of requests). */
  blockSize: number;
  /** The block version. */
  blockVersion: number;
  /** The data for the block. */
  data: string;
  /** The custom data for the block. */
  offchainData: string;

  /** The operator when the block was committed (msg.sender). */
  operator: string;
  /** The sender of the block (tx.origin). Can be different from `operator` when an operator contract is used. */
  origin: string;

  /** The block fee received for this block (in ETH). */
  blockFeeRewarded: BN;
  /** The block fee fined for this block (in ETH). */
  blockFeeFined: BN;

  /** The Merkle root of the Merkle tree after doing all requests in the block. */
  merkleRoot: string;

  /** The time the block was submitted. */
  timestamp: number;

  /** The number of requests processed in this block. For on-chain request blocks this can differ from `blockSize`. */
  numRequestsProcessed: number;

  /** The total number of requests that were processed up to, and including, this block. */
  totalNumRequestsProcessed: number;
  /** The total number of deposits that were processed up to, and including, this block. */
  totalNumDepositsProccesed: number;
  /** The total number of on-chain withdrawal requests that were processed up to, and including, this block. */
  totalNumOnchainWithdrawalsProcessed: number;
  /** The total number of trades that were processed up to, and including, this block. */
  totalNumTradesProccesed: number;
  /** The total number of off-chain withdrawals that were processed up to, and including, this block. */
  totalNumOffchainWithdrawalsProcessed: number;
  /** The total number of order canellations that were processed up to, and including, this block. */
  totalNumOrderCancellationsProcessed: number;
  /** The total number of internal transfers that were processed up to, and including, this block. */
  totalNumOrderInternalTransfersProcessed: number;

  /** The Ethereum transaction in which this block was committed. */
  transactionHash: string;
}

/**
 * A token registered on an exchange.
 */
export interface Token {
  /** The exchange of the token. */
  exchangeId: number;
  /** The tokenID of the token. */
  tokenID: number;
  /** The address of the token contract. */
  address: string;
  /** Whether deposits are enabled/disabled for this token. */
  enabled: boolean;
}

/**
 * A deposit on an exchange.
 */
export interface Deposit {
  /** The exchange this deposit is on. */
  exchangeId: number;
  /** If the request was processed: The block this deposit was pocessed in. */
  blockIdx?: number;
  /** If the request was processed: The request index of this deposit in the processed requests list. */
  requestIdx?: number;

  /** The deposit index (in the queue on-chain). */
  depositIdx: number;
  /** The time this deposit was done on-chain. */
  timestamp: number;

  /** The account this deposit is for. */
  accountID: number;
  /** The token that was deposited. */
  tokenID: number;
  /** The amount that was deposited. */
  amount: BN;
  /** The (new) public key X of the account. */
  publicKeyX: string;
  /** The (new) public key Y of the account. */
  publicKeyY: string;

  /** The Ethereum transaction in which this deposit was done. */
  transactionHash: string;
}

/**
 * An on-chain withdrawal request on an exchange.
 */
export interface OnchainWithdrawal {
  /** The exchange this on-chain withdrawal is on. */
  exchangeId: number;
  /** If the request was processed: The block this on-chain withdrawal was pocessed in. */
  blockIdx?: number;
  /** If the request was processed: The request index of this on-chain withdrawal in the processed requests list (@see getProcessedRequest). */
  requestIdx?: number;

  /** The on-chain withdrawal index (in the queue on-chain, @see getDeposit). */
  withdrawalIdx: number;
  /** The time this on-chain withdrawal was done on-chain. */
  timestamp: number;

  /** The account this on-chain withdrawal is for. */
  accountID: number;
  /** The token that is being withdrawn. */
  tokenID: number;
  /** The amount that was requested to be withdrawn. */
  amountRequested: BN;
  /** If the request was processed: The amount that was actually withdrawn. */
  amountWithdrawn?: BN;

  /** The Ethereum transaction in which this on-chain withdrawal was done. */
  transactionHash: string;
}

/**
 * Trading data for a ring-settlement.
 */
export interface Trade {
  /** The exchange the trade was made on. */
  exchangeId: number;
  /** The block this trade was pocessed in. */
  blockIdx: number;
  /** The request index of this trade in the processed requests list (@see getProcessedRequest). */
  requestIdx: number;

  /** The account of the taker. */
  accountIdA: number;
  /** The orderID of the taker order. */
  orderIdA: number;
  /** Whether the taker order is a buy or sell order. */
  buyA: boolean;
  /** The token the taker order sells. */
  tokenA: number;
  /** The amount of tokens (in tokenS) the taker sells. */
  fillSA: BN;
  /** The fee (in tokenB) paid by the taker. */
  feeA: BN;
  /** The protocol fee that needs to be paid by the operator for the taker. */
  protocolFeeA: BN;
  /** The amount of tokens (in tokenB) the taker receives as rebate. */
  rebateA: BN;

  /** The account of the maker. */
  accountIdB: number;
  /** The orderID of the maker order. */
  orderIdB: number;
  /** Whether the maker order is a buy or sell order. */
  buyB: boolean;
  /** The token the maker order sells. */
  tokenB: number;
  /** The amount of tokens (in tokenS) the maker sells. */
  fillSB: BN;
  /** The fee (in tokenB) paid by the maker. */
  feeB: BN;
  /** The protocol fee that needs to be paid by the operator for the maker. */
  protocolFeeB: BN;
  /** The amount of tokens (in tokenB) the maker receives as rebate. */
  rebateB: BN;
}

/**
 * Off-chain withdrawal data.
 */
export interface OffchainWithdrawal {
  /** The exchange the off-chain withdrawal request was made on. */
  exchangeId: number;
  /** The block this off-chain withdrawal request was pocessed in. */
  blockIdx: number;
  /** The request index of this off-chain withdrawal in the processed requests list (@see getProcessedRequest). */
  requestIdx: number;

  /** The account this withdrawal is for. */
  accountID: number;
  /** The token that is being withdrawn. */
  tokenID: number;
  /** The amount that was actually withdrawn. */
  amountWithdrawn: BN;
  /** The token the fee to the operator is paid in. */
  feeTokenID: number;
  /** The fee paid to the operator. */
  fee: BN;
}

/**
 * Order cancellation data.
 */
export interface OrderCancellation {
  /** The exchange the order cancellation request was made on. */
  exchangeId: number;
  /** The block this order cancellation request was pocessed in. */
  blockIdx: number;
  /** The request index of this oorder cancellation in the processed requests list (@see getProcessedRequest). */
  requestIdx: number;

  /** The account this order cancellation is for. */
  accountID: number;
  /** The tokenS of the order that is being cancelled. */
  orderTokenID: number;
  /** The orderID of the order that is being cancelled. */
  orderID: number;
  /** The token the fee to the operator is paid in. */
  feeTokenID: number;
  /** The fee paid to the operator. */
  fee: BN;
}

/**
 * Internal transfer data.
 */
export interface InternalTransfer {
  /** The exchange the internal transfer request was made on. */
  exchangeId: number;
  /** The block this internal transfer request was pocessed in. */
  blockIdx: number;
  /** The request index of this internal transfer in the processed requests list (@see getProcessedRequest). */
  requestIdx: number;

  /** The 'from' account for this internal transfer. */
  accountFromID: number;
  /** The 'to' account for this internal transfer. */
  accountToID: number;
  /** The token that is being transferred. */
  tokenID: number;
  /** The amount that was actually withdrawn. */
  amount: BN;
  /** The token the fee to the operator is paid in. */
  feeTokenID: number;
  /** The fee paid to the operator. */
  fee: BN;
  /** The type of the transfer. */
  type: number;
}

/**
 * Trade history data.
 */
export interface TradeHistory {
  /** How much the order is filled. */
  filled: BN;
  /** The orderID of the order the trade history is currently stored for. */
  orderID: number;
}

/**
 * Balance data.
 */
export interface Balance {
  /** How amount of tokens the account owner has for a token. */
  balance: BN;
  /** The trade history data. */
  tradeHistory: { [key: number]: TradeHistory };

  tradeHistoryTree?: SparseMerkleTree;
}

/**
 * Account data.
 */
export interface Account {
  /** The exchange the account is on. */
  exchangeId: number;
  /** The account ID of the account. */
  accountId: number;
  /** The owner of the account. */
  owner: string;

  /** The EdDSA public key X of the account (used for signing off-chain messages). */
  publicKeyX: string;
  /** The EdDSA public key Y of the account (used for signing off-chain messages). */
  publicKeyY: string;
  /** The nonce value of the account. */
  nonce: number;
  /** The balance data. */
  balances: { [key: number]: Balance };

  balancesMerkleTree?: SparseMerkleTree;
}

/**
 * Fees charted by the exchange for on-chain requests.
 */
export interface ExchangeFees {
  /** The exchange with these fees. */
  exchangeId: number;

  /** The fee charged (in ETH) for creating an account. */
  accountCreationFeeETH: BN;
  /** The fee charged (in ETH) for updating an account. */
  accountUpdateFeeETH: BN;
  /** The fee charged (in ETH) for depositing. */
  depositFeeETH: BN;
  /** The fee charged (in ETH) for an on-chain withdrawal request. */
  withdrawalFeeETH: BN;
}

/**
 * The protocol fees that need to be paid for trades.
 */
export interface ProtocolFees {
  /** The exchange with these fees. */
  exchangeId: number;

  /** The fee charged (in bips of amount bought) for taker orders. */
  takerFeeBips: number;
  /** The fee charged (in bips of amount bought) for maker orders. */
  makerFeeBips: number;
  /** The previous fee charged (in bips of amount bought) for taker orders. */
  previousTakerFeeBips: number;
  /** The previous fee charged (in bips of amount bought) for maker orders. */
  previousMakerFeeBips: number;
}

/**
 * The data needed to withdraw from the Merkle tree on-chain (@see getWithdrawFromMerkleTreeData)
 */
export interface WithdrawFromMerkleTreeData {
  /** The owner of the account. */
  owner: string;
  /** The token that needs to be withdrawn. */
  token: string;
  /** The public key X of the account. */
  publicKeyX: string;
  /** The public key Y of the account. */
  publicKeyY: string;
  /** The current nonce value of the account. */
  nonce: number;
  /** The current balance the account has for the requested token. */
  balance: BN;
  /** The trade history root of the balance leaf. */
  tradeHistoryRoot: string;
  /** The Merkle proof for the account leaf. */
  accountMerkleProof: string[];
  /** The Merkle proof for the balance leaf. */
  balanceMerkleProof: string[];
}

/**
 * The keypair data for EdDSA.
 */
export interface KeyPair {
  /** The public key X. */
  publicKeyX: string;
  /** The public key Y. */
  publicKeyY: string;
  /** The private key. */
  secretKey: string;
}

/**
 * The signature data for EdDSA.
 */
export interface Signature {
  Rx: string;
  Ry: string;
  s: string;
}

/// Private

export interface ExchangeState {
  exchangeId: number;
  accounts: Account[];

  accountIdToOwner: { [key: number]: string };
  ownerToAccountId: { [key: string]: number };

  deposits: Deposit[];
  onchainWithdrawals: OnchainWithdrawal[];

  processedRequests: any[];

  onchainDataAvailability: boolean;
}
