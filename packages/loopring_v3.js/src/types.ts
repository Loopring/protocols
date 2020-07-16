import BN from "bn.js";
import { Constants } from "./constants";
import { SparseMerkleTree } from "./sparse_merkle_tree";

/**
 * The type of requests handled in a block.
 */
export enum TransactionType {
  NOOP = 0,
  DEPOSIT,
  WITHDRAWAL,
  TRANSFER,
  SPOT_TRADE,
  ACCOUNT_NEW,
  ACCOUNT_UPDATE,
  ACCOUNT_TRANSFER
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
  blockType: number;
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
  blockFee: BN;

  /** The Merkle root of the Merkle tree after doing all requests in the block. */
  merkleRoot: string;

  /** The time the block was submitted. */
  timestamp: number;

  /** The number of requests processed in this block. For on-chain request blocks this can differ from `blockSize`. */
  numRequestsProcessed: number;

  /** The total number of requests that were processed up to, and including, this block. */
  totalNumRequestsProcessed: number;

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

  /** The time this deposit was done on-chain. */
  timestamp: number;

  /** The account this deposit is for. */
  owner: string;
  /** The token that was deposited. */
  token: number;
  /** The amount that was deposited. */
  amount: BN;
  /** The index at the time of deposit. */
  index: BN;
  /** The fee paid for the deposit. */
  fee: BN;

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
export interface SpotTrade {
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
  fromAccountID: number;
  /** The 'to' account for this internal transfer. */
  toAccountID: number;
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
  /** The index when the balance was last accessed. */
  index: BN;
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
  /** The wallet hash. */
  walletHash: string;

  balancesMerkleTree?: SparseMerkleTree;
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
export interface OnchainAccountLeaf {
  /** The ID of the account. */
  accountID: number;
  /** The owner of the account. */
  owner: string;
  /** The public key X of the account. */
  pubKeyX: string;
  /** The public key Y of the account. */
  pubKeyY: string;
  /** The current nonce value of the account. */
  nonce: number;
  /** The wallet hash of the account. */
  walletHash: string;
}
export interface OnchainBalanceLeaf {
  /** The ID of the token. */
  tokenID: number;
  /** The current balance the account has for the requested token. */
  balance: string;
  /** The current index the account has for the requested token. */
  index: string;
  /** The trade history root of the balance leaf. */
  tradeHistoryRoot: string;
}
export interface WithdrawFromMerkleTreeData {
  /** The account leaf. */
  accountLeaf: OnchainAccountLeaf;
  /** The balance leaf. */
  balanceLeaf: OnchainBalanceLeaf;
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

export function power10(x1: BN) {
  const c0 = new BN("10000000000000000000");
  const c1 = new BN("23025850929940459520");
  const c2 = new BN("26509490552391999488");
  const c3 = new BN("20346785922934771712");

  const x2 = x1.mul(x1).div(Constants.INDEX_BASE);
  const x3 = x2.mul(x1).div(Constants.INDEX_BASE);

  const t1 = x1.mul(c1);
  const t2 = x2.mul(c2);
  const t3 = x3.mul(c3);
  return c0.add(t1.add(t2).add(t3).div(Constants.INDEX_BASE));
}

export function applyInterest(balance: BN, oldIndex: BN, newIndex: BN) {
  assert(newIndex.gte(oldIndex), "Invalid balance state");
  const indexDiff = newIndex.sub(oldIndex);
  const multiplier = power10(indexDiff);
  const newBalance = balance.mul(multiplier).div(Constants.INDEX_BASE.mul(new BN(10)));
  return newBalance
}

export class TradeHistoryLeaf implements TradeHistory {
  filled: BN;
  orderID: number;

  constructor() {
    this.filled = new BN(0);
    this.orderID = 0;
  }
}

export class BalanceLeaf implements Balance {
  balance: BN;
  index: BN;
  tradeHistory: { [key: number]: TradeHistoryLeaf };

  tradeHistoryTree?: SparseMerkleTree;

  constructor() {
    this.balance = new BN(0);
    this.index = Constants.INDEX_BASE;
    this.tradeHistory = {};
  }

  public init(
    balance: BN,
    index: BN,
    tradeHistory: { [key: number]: TradeHistoryLeaf }
    ) {
    this.balance = new BN(balance.toString(10));
    this.index = new BN(index.toString(10));
    this.tradeHistory = tradeHistory;
  }

  public getTradeHistory(orderID: number) {
    const address = orderID % 2 ** Constants.BINARY_TREE_DEPTH_TRADING_HISTORY;
    if (this.tradeHistory[address] === undefined) {
      this.tradeHistory[address] = new TradeHistoryLeaf();
    }
    return this.tradeHistory[address];
  }
}

export class AccountLeaf implements Account {
  exchangeId: number;
  accountId: number;

  owner: string;
  publicKeyX: string;
  publicKeyY: string;
  nonce: number;
  walletHash: string;
  balances: { [key: number]: BalanceLeaf };

  balancesMerkleTree?: SparseMerkleTree;

  constructor(accountId: number) {
    this.exchangeId = 0;
    this.accountId = accountId;
    this.owner = Constants.zeroAddress,
    this.publicKeyX = "0";
    this.publicKeyY = "0";
    this.nonce = 0;
    this.walletHash = "0";
    this.balances = {};
  }

  public init(
    owner: string,
    publicKeyX: string,
    publicKeyY: string,
    nonce: number,
    walletHash: string,
    balances: { [key: number]: BalanceLeaf } = {}
    ) {
    this.exchangeId = 0;
    this.accountId = 0;
    this.owner = owner;
    this.publicKeyX = publicKeyX;
    this.publicKeyY = publicKeyY;
    this.nonce = nonce;
    this.walletHash = walletHash;
    this.balances = balances;
  }

  public getBalanceRaw(tokenID: number) {
    if (this.balances[tokenID] === undefined) {
      this.balances[tokenID] = new BalanceLeaf();
    }
    return this.balances[tokenID];
  }

  public getBalance(tokenID: number, index: AccountLeaf) {
    if (this.balances[tokenID] === undefined) {
      this.balances[tokenID] = new BalanceLeaf();
    }
    const newIndex = index.getBalanceRaw(tokenID).index;
    this.balances[tokenID].balance = applyInterest(this.balances[tokenID].balance, this.balances[tokenID].index, newIndex);
    this.balances[tokenID].index = newIndex;
    return this.balances[tokenID];
  }
}

export class ExchangeState {
  exchangeId: number;
  accounts: AccountLeaf[];

  constructor(exchangeId: number, accounts: AccountLeaf[] = []) {
    this.exchangeId = exchangeId;
    this.onchainDataAvailability = true;

    this.accounts = accounts;

    this.accountIdToOwner = {};
    this.ownerToAccountId = {};

    this.deposits = [];
    this.onchainWithdrawals = [];

    this.processedRequests = [];

    // Create the protocol and index accounts
    this.getAccount(1);
  }

  public getAccount(accountID: number) {
    while(accountID >= this.accounts.length) {
      this.accounts.push(new AccountLeaf(this.accounts.length));
    }
    return this.accounts[accountID];
  }

  accountIdToOwner: { [key: number]: string };
  ownerToAccountId: { [key: string]: number };

  deposits: Deposit[];
  onchainWithdrawals: OnchainWithdrawal[];

  processedRequests: any[];

  onchainDataAvailability: boolean;
}

export interface BlockContext {
  protocolFeeTakerBips: number;
  protocolFeeMakerBips: number;
  operatorAccountID: number;
}
