import BN = require("bn.js");
import { SparseMerkleTree } from "./SparseMerkleTree";

export enum BlockType {
    RING_SETTLEMENT = 0,
    DEPOSIT,
    ONCHAIN_WITHDRAWAL,
    OFFCHAIN_WITHDRAWAL,
    ORDER_CANCELLATION
  }

  export enum BlockState {
    NEW = 0,
    COMMITTED,
    VERIFIED,
    FINALIZED,
  }

  export enum ForgeMode {
    AUTO_UPGRADABLE = 0,
    MANUAL_UPGRADABLE,
    PROXIED,
    NATIVE,
  }

  export interface Block {
    blockIdx: number;

    blockType: BlockType;
    blockSize: number;
    blockVersion: number;
    data: string;
    offchainData: string;

    operator: string;

    blockState: BlockState;

    merkleRoot: string;

    committedTimestamp: number;
    verifiedTimestamp?: number;
    finalizedTimestamp?: number;

    numRequestsProcessed: number;

    totalNumRequestsProcessed: number;
    totalNumDepositsProccesed: number;
    totalNumOnchainWithdrawalsProcessed: number;
    totalNumTradesProccesed: number;
    totalNumOffchainWithdrawalsProcessed: number;
    totalNumOrderCancellationsProcessed: number;

    transactionHash: string;

    valid: boolean;
  }

  export interface Token {
    tokenID: number;
    address: string;
    enabled: boolean;
  }

  export interface Deposit {
    blockIdx?: number;
    requestIdx?: number;

    depositIdx: number;
    timestamp: number;

    accountID: number;
    tokenID: number;
    amount: BN;
    publicKeyX: string;
    publicKeyY: string;

    transactionHash: string;
  }

  export interface OnchainWithdrawal {
    blockIdx?: number;
    requestIdx?: number;

    withdrawalIdx: number;
    timestamp: number;

    accountID: number;
    tokenID: number;
    amountRequested: BN;
    amountWithdrawn?: BN;

    transactionHash: string;
  }

  export interface Trade {
    blockIdx: number;
    requestIdx: number;

    accountIdA: number;
    orderIdA: number;
    buyA: boolean;
    tokenA: number,
    fillSA: BN;
    feeA: BN;
    protocolFeeA: BN;
    rebateA: BN;

    accountIdB: number;
    orderIdB: number;
    buyB: boolean;
    tokenB: number,
    fillSB: BN;
    feeB: BN;
    protocolFeeB: BN;
    rebateB: BN;
  }

  export interface OffchainWithdrawal {
    blockIdx: number;
    requestIdx: number;

    accountID: number;
    tokenID: number;
    amountWithdrawn: BN;
    feeTokenID: number;
    fee: BN;
  }

  export interface OrderCancellation {
    blockIdx: number,
    requestIdx: number,

    accountID: number;
    orderTokenID: number;
    orderID: number;
    feeTokenID: number;
    fee: BN;
  }

  export interface TradeHistory {
    filled: BN;
    cancelled: boolean;
    orderID: number;
  }

  export interface Balance {
    balance: BN;
    tradeHistory: { [key: number]: TradeHistory };

    tradeHistoryTree?: SparseMerkleTree;
  }

  export interface Account {
    accountId: number;
    owner: string;

    publicKeyX: string;
    publicKeyY: string;
    nonce: number;
    balances: { [key: number]: Balance };

    balancesMerkleTree?: SparseMerkleTree;
  }

  export interface WithdrawFromMerkleTreeData {
    owner: string;
    token: string;
    publicKeyX: string;
    publicKeyY: string;
    nonce: number;
    balance: BN;
    tradeHistoryRoot: string;
    accountMerkleProof: string[];
    balanceMerkleProof: string[];
  }

  export interface State {
    accounts: Account[];

    accountIdToOwner: { [key: number]: string };
    ownerToAccountId: { [key: string]: number };

    deposits: Deposit[];
    onchainWithdrawals: OnchainWithdrawal[];

    processedRequests: any[];

    onchainDataAvailability: boolean;
  }
