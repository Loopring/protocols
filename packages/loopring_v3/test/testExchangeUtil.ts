import BN = require("bn.js");
import childProcess = require("child_process");
import fs = require("fs");
import path = require("path");
import http = require("http");
import { performance } from "perf_hooks";
import { SHA256 } from "sha2";
import { Artifacts } from "../util/Artifacts";
import { SignatureType, sign, verifySignature } from "../util/Signature";
import {
  Bitstream,
  BlockType,
  calculateCalldataCost,
  compress,
  compressLZ,
  decompressLZ,
  CompressionType,
  Constants,
  EdDSA,
  Explorer,
  roundToFloatValue,
  toFloat,
  TransactionType,
  Poseidon,
  WithdrawFromMerkleTreeData
} from "loopringV3.js";
import { Context } from "./context";
import { expectThrow } from "./expectThrow";
import { doDebugLogging, logDebug, logInfo } from "./logs";
import * as sigUtil from "eth-sig-util";
import { Simulator, AccountLeaf } from "./simulator";
import { ExchangeTestContext } from "./testExchangeContext";
import {
  Account,
  AuthMethod,
  Block,
  Deposit,
  Transfer,
  Noop,
  OrderInfo,
  TxBlock,
  AccountUpdate,
  SpotTrade,
  WithdrawalRequest,
  NewAccount,
  Wallet,
  OwnerChange
} from "./types";

type TxType =
  | Noop
  | SpotTrade
  | Transfer
  | WithdrawalRequest
  | Deposit
  | AccountUpdate
  | NewAccount
  | OwnerChange;

// JSON replacer function for BN values
function replacer(name: any, val: any) {
  if (
    name === "balance" ||
    name === "amountS" ||
    name === "amountB" ||
    name === "amount" ||
    name === "fee" ||
    name === "startHash" ||
    name === "minPrice" ||
    name === "maxPrice" ||
    name === "minMarginFraction" ||
    name === "fundingIndex" ||
    name === "transferAmountTrade" ||
    name === "triggerPrice" ||
    name === "transferAmount" ||
    name === "transferFee" ||
    name === "index"
  ) {
    return new BN(val, 16).toString(10);
  } else if (
    name === "owner" ||
    name === "newOwner" ||
    name === "from" ||
    name === "to" ||
    name === "payerTo" ||
    name === "to" ||
    name === "exchange"
  ) {
    return new BN(val.slice(2), 16).toString(10);
  } else {
    return val;
  }
}

export interface TransferOptions {
  authMethod?: AuthMethod;
  useDualAuthoring?: boolean;
  secretKnown?: boolean;
  amountToDeposit?: BN;
  feeToDeposit?: BN;
  transferToNew?: boolean;
  signer?: string;
}

export interface WithdrawOptions {
  authMethod?: AuthMethod;
  to?: string;
  minGas?: number;
  gas?: number;
  data?: string;
  signer?: string;
}

export interface NewAccountOptions {
  authMethod?: AuthMethod;
}

export interface AccountUpdateOptions {
  authMethod?: AuthMethod;
}

export interface OwnerChangeOptions {
  authMethod?: AuthMethod;
  walletCalldata?: string;
}

export interface OnchainBlock {
  blockType: number;
  blockSize: number;
  blockVersion: number;
  data: any;
  proof: any;
  storeDataHashOnchain: boolean;
  auxiliaryData?: any;
  offchainData?: any;
}

export interface AuxiliaryData {
  txIndex: number;
  txAuxiliaryData?: any;
}

export namespace AccountUpdateUtils {
  export function toTypedData(
    update: AccountUpdate,
    verifyingContract: string
  ) {
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" }
        ],
        AccountUpdate: [
          { name: "owner", type: "address" },
          { name: "accountID", type: "uint24" },
          { name: "nonce", type: "uint32" },
          { name: "publicKey", type: "uint256" },
          { name: "walletHash", type: "uint256" },
          { name: "feeTokenID", type: "uint16" },
          { name: "fee", type: "uint256" }
        ]
      },
      primaryType: "AccountUpdate",
      domain: {
        name: "Loopring Protocol",
        version: "3.6.0",
        chainId: new BN(/*await web3.eth.net.getId()*/ 1),
        verifyingContract
      },
      message: {
        owner: update.owner,
        accountID: update.accountID,
        nonce: update.nonce,
        publicKey: new BN(EdDSA.pack(update.publicKeyX, update.publicKeyY), 16),
        walletHash: new BN(update.walletHash),
        feeTokenID: update.feeTokenID,
        fee: update.fee
      }
    };
    return typedData;
  }

  export function getHash(update: AccountUpdate, verifyingContract: string) {
    const typedData = this.toTypedData(update, verifyingContract);
    return sigUtil.TypedDataUtils.sign(typedData);
  }

  export function sign(keyPair: any, update: AccountUpdate) {
    // Calculate hash
    const hasher = Poseidon.createHash(9, 6, 53);
    const inputs = [
      update.exchange,
      update.accountID,
      update.feeTokenID,
      update.fee,
      update.publicKeyX,
      update.publicKeyY,
      update.walletHash,
      update.nonce
    ];
    const hash = hasher(inputs).toString(10);

    // Create signature
    const signature = EdDSA.sign(keyPair.secretKey, hash);

    // Verify signature
    const success = EdDSA.verify(hash, signature, [
      keyPair.publicKeyX,
      keyPair.publicKeyY
    ]);
    assert(success, "Failed to verify signature");

    return signature;
  }
}

export namespace WithdrawalUtils {
  export function toTypedData(
    withdrawal: WithdrawalRequest,
    verifyingContract: string
  ) {
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" }
        ],
        Withdrawal: [
          { name: "owner", type: "address" },
          { name: "accountID", type: "uint24" },
          { name: "nonce", type: "uint32" },
          { name: "tokenID", type: "uint16" },
          { name: "amount", type: "uint256" },
          { name: "feeTokenID", type: "uint16" },
          { name: "fee", type: "uint256" },
          { name: "to", type: "address" },
          { name: "dataHash", type: "bytes32" },
          { name: "minGas", type: "uint24" }
        ]
      },
      primaryType: "Withdrawal",
      domain: {
        name: "Loopring Protocol",
        version: "3.6.0",
        chainId: new BN(/*await web3.eth.net.getId()*/ 1),
        verifyingContract
      },
      message: {
        owner: withdrawal.owner,
        accountID: withdrawal.accountID,
        nonce: withdrawal.nonce,
        tokenID: withdrawal.tokenID,
        amount: withdrawal.amount,
        feeTokenID: withdrawal.feeTokenID,
        fee: withdrawal.fee,
        to: withdrawal.to,
        dataHash: "0x" + new BN(withdrawal.dataHash).toString(16),
        minGas: withdrawal.minGas
      }
    };
    return typedData;
  }

  export function getHash(
    withdrawal: WithdrawalRequest,
    verifyingContract: string
  ) {
    const typedData = this.toTypedData(withdrawal, verifyingContract);
    return sigUtil.TypedDataUtils.sign(typedData);
  }

  export function sign(keyPair: any, withdrawal: WithdrawalRequest) {
    // Calculate hash
    const hasher = Poseidon.createHash(11, 6, 53);
    const inputs = [
      withdrawal.exchange,
      withdrawal.accountID,
      withdrawal.tokenID,
      withdrawal.amount,
      withdrawal.feeTokenID,
      withdrawal.fee,
      withdrawal.to,
      withdrawal.dataHash,
      withdrawal.minGas,
      withdrawal.nonce
    ];
    const hash = hasher(inputs).toString(10);

    // Create signature
    withdrawal.signature = EdDSA.sign(keyPair.secretKey, hash);

    // Verify signature
    const success = EdDSA.verify(hash, withdrawal.signature, [
      keyPair.publicKeyX,
      keyPair.publicKeyY
    ]);
    assert(success, "Failed to verify signature");
  }
}

export namespace TransferUtils {
  export function toTypedData(transfer: Transfer, verifyingContract: string) {
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" }
        ],
        Transfer: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "tokenID", type: "uint16" },
          { name: "amount", type: "uint256" },
          { name: "feeTokenID", type: "uint16" },
          { name: "fee", type: "uint256" },
          { name: "data", type: "uint256" },
          { name: "nonce", type: "uint32" }
        ]
      },
      primaryType: "Transfer",
      domain: {
        name: "Loopring Protocol",
        version: "3.6.0",
        chainId: new BN(/*await web3.eth.net.getId()*/ 1),
        verifyingContract
      },
      message: {
        from: transfer.from,
        to: transfer.to,
        tokenID: transfer.tokenID,
        amount: transfer.amount,
        feeTokenID: transfer.feeTokenID,
        fee: transfer.fee,
        data: transfer.data,
        nonce: transfer.nonce
      }
    };
    return typedData;
  }

  export function getHash(transfer: Transfer, verifyingContract: string) {
    const typedData = this.toTypedData(transfer, verifyingContract);
    return sigUtil.TypedDataUtils.sign(typedData);
  }

  export function sign(keyPair: any, transfer: Transfer, payer: boolean) {
    // Calculate hash
    const hasher = Poseidon.createHash(14, 6, 53);
    const inputs = [
      transfer.exchange,
      transfer.fromAccountID,
      payer ? transfer.payerToAccountID : transfer.toAccountID,
      transfer.tokenID,
      transfer.amount,
      transfer.feeTokenID,
      transfer.fee,
      transfer.validUntil,
      payer ? transfer.payerTo : transfer.to,
      transfer.dualAuthorX,
      transfer.dualAuthorY,
      transfer.data,
      transfer.nonce
    ];
    const hash = hasher(inputs).toString(10);

    // Create signature
    const signature = EdDSA.sign(keyPair.secretKey, hash);

    // Verify signature
    const success = EdDSA.verify(hash, signature, [
      keyPair.publicKeyX,
      keyPair.publicKeyY
    ]);
    assert(success, "Failed to verify signature");

    return signature;
  }
}

export namespace WalletUtils {
  export function toTypedDataStatelessWallet(
    wallet: Wallet,
    verifyingContract: string
  ) {
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" }
        ],
        Guardian: [
          { name: "addr", type: "address" },
          { name: "group", type: "uint256" }
        ],
        StatelessWallet: [
          { name: "accountID", type: "uint24" },
          { name: "guardians", type: "Guardian[]" },
          { name: "inheritor", type: "address" },
          { name: "inheritableSince", type: "uint256" }
        ]
      },
      primaryType: "StatelessWallet" as const,
      domain: {
        name: "Loopring Stateless Wallet",
        version: "1.0",
        chainId: new BN(/*await web3.eth.net.getId()*/ 1),
        verifyingContract
      },
      message: {
        accountID: wallet.accountID,
        guardians: wallet.guardians,
        inheritor: wallet.inheritor,
        inheritableSince: wallet.inheritableSince
      }
    };
    return typedData;
  }

  export function toTypedDataWallet(
    statelessWallet: string,
    walletDataHash: string,
    verifyingContract: string
  ) {
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" }
        ],
        Wallet: [
          { name: "statelessWallet", type: "address" },
          { name: "walletDataHash", type: "bytes32" }
        ]
      },
      primaryType: "Wallet" as const,
      domain: {
        name: "Loopring Protocol",
        version: "3.6.0",
        chainId: new BN(/*await web3.eth.net.getId()*/ 1),
        verifyingContract
      },
      message: {
        statelessWallet,
        walletDataHash
      }
    };
    return typedData;
  }

  export function getWalletHash(wallet: Wallet, verifyingContract: string) {
    const typedData = this.toTypedDataStatelessWallet(
      wallet,
      verifyingContract
    );
    return sigUtil.TypedDataUtils.sign(typedData);
  }

  export function getHash(
    wallet: Wallet,
    statelessWallet: string,
    verifyingContract: string
  ) {
    const walletDataHash =
      "0x" + this.getWalletHash(wallet, statelessWallet).toString("hex");
    const typedData = this.toTypedDataWallet(
      statelessWallet,
      walletDataHash,
      verifyingContract
    );
    return sigUtil.TypedDataUtils.sign(typedData);
  }
}

export namespace OwnerChangeUtils {
  export function toTypedData(
    accountTransfer: OwnerChange,
    verifyingContract: string
  ) {
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" }
        ],
        OwnerChange: [
          { name: "owner", type: "address" },
          { name: "accountID", type: "uint24" },
          { name: "feeTokenID", type: "uint16" },
          { name: "fee", type: "uint256" },
          { name: "newOwner", type: "address" },
          { name: "nonce", type: "uint32" },
          { name: "statelessWallet", type: "address" },
          { name: "walletDataHash", type: "bytes32" },
          { name: "walletCalldata", type: "bytes" }
        ]
      },
      primaryType: "OwnerChange",
      domain: {
        name: "Loopring Protocol",
        version: "3.6.0",
        chainId: new BN(/*await web3.eth.net.getId()*/ 1),
        verifyingContract
      },
      message: {
        owner: accountTransfer.owner,
        accountID: accountTransfer.accountID,
        feeTokenID: accountTransfer.feeTokenID,
        fee: accountTransfer.fee,
        newOwner: accountTransfer.newOwner,
        nonce: accountTransfer.nonce,
        statelessWallet: accountTransfer.statelessWallet,
        walletDataHash: accountTransfer.walletDataHash,
        walletCalldata: accountTransfer.walletCalldata
      }
    };
    return typedData;
  }

  export function getHash(
    accountTransfer: OwnerChange,
    verifyingContract: string
  ) {
    const typedData = this.toTypedData(accountTransfer, verifyingContract);
    return sigUtil.TypedDataUtils.sign(typedData);
  }
}

export namespace NewAccountUtils {
  export function toTypedData(update: NewAccount, verifyingContract: string) {
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" }
        ],
        NewAccount: [
          { name: "accountID", type: "uint24" },
          { name: "owner", type: "address" },
          { name: "publicKey", type: "uint256" },
          { name: "walletHash", type: "uint256" }
        ]
      },
      primaryType: "NewAccount",
      domain: {
        name: "Loopring Protocol",
        version: "3.6.0",
        chainId: new BN(/*await web3.eth.net.getId()*/ 1),
        verifyingContract
      },
      message: {
        accountID: update.newAccountID,
        owner: update.newOwner,
        publicKey: new BN(
          EdDSA.pack(update.newPublicKeyX, update.newPublicKeyY),
          16
        ),
        walletHash: new BN(update.newWalletHash)
      }
    };
    return typedData;
  }

  export function getHash(create: NewAccount, verifyingContract: string) {
    const typedData = this.toTypedData(create, verifyingContract);
    return sigUtil.TypedDataUtils.sign(typedData);
  }

  export function sign(keyPair: any, create: NewAccount) {
    // Calculate hash
    const hasher = Poseidon.createHash(11, 6, 53);
    const inputs = [
      create.exchange,
      create.payerAccountID,
      create.feeTokenID,
      create.fee,
      create.nonce,
      create.newAccountID,
      create.newOwner,
      create.newPublicKeyX,
      create.newPublicKeyY,
      create.newWalletHash
    ];
    const hash = hasher(inputs).toString(10);

    // Create signature
    const signature = EdDSA.sign(keyPair.secretKey, hash);

    // Verify signature
    const success = EdDSA.verify(hash, signature, [
      keyPair.publicKeyX,
      keyPair.publicKeyY
    ]);
    assert(success, "Failed to verify signature");

    return signature;
  }
}

export class ExchangeTestUtil {
  public context: Context;
  public testContext: ExchangeTestContext;

  public explorer: Explorer;

  public blockSizes = [8];

  public loopringV3: any;
  public blockVerifier: any;
  public lzDecompressor: any;

  public lrcAddress: string;
  public wethAddress: string;

  public exchange: any;
  public depositContract: any;
  public exchangeOwner: string;
  public exchangeOperator: string;
  public exchangeId: number;

  public operator: any;
  public activeOperator: number;

  public userStakingPool: any;
  public protocolFeeVault: any;
  public protocolFeeVaultContract: any;
  public universalRegistry: any;

  public statelessWallet: any;

  public blocks: Block[][] = [];
  public accounts: Account[][] = [];

  public operators: number[] = [];

  public GENESIS_MERKLE_ROOT: BN;
  public SNARK_SCALAR_FIELD: BN;
  public MAX_OPEN_FORCED_REQUESTS: number;
  public MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE: number;
  public TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS: number;
  public MAX_NUM_TOKENS: number;
  public MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED: number;
  public MIN_TIME_IN_SHUTDOWN: number;
  public TX_DATA_AVAILABILITY_SIZE: number;
  public MAX_AGE_DEPOSIT_UNTIL_WITHDRAWABLE: number;

  public tokenAddressToIDMap = new Map<string, number>();
  public tokenIDToAddressMap = new Map<number, string>();

  public index = new Map<string, BN>();

  public contracts = new Artifacts(artifacts);

  public pendingBlocks: Block[][] = [];

  public rollupMode = true;
  public compressionType = CompressionType.LZ;

  public autoCommit = true;

  public useProverServer: boolean = true;

  private pendingTransactions: TxType[][] = [];

  private orderIDGenerator: number = 0;

  private MAX_NUM_EXCHANGES: number = 512;

  private proverPorts = new Map<number, number>();
  private portGenerator = 1234;

  public async initialize(accounts: string[]) {
    this.context = await this.createContractContext();
    this.testContext = await this.createExchangeTestContext(accounts);

    this.statelessWallet = await this.contracts.StatelessWallet.new();

    this.explorer = new Explorer();
    await this.explorer.initialize(web3, this.universalRegistry.address);

    // Initialize LoopringV3
    this.protocolFeeVault = this.testContext.ringMatchers[0];

    await this.loopringV3.updateSettings(
      this.protocolFeeVault,
      this.blockVerifier.address,
      new BN(web3.utils.toWei("10000", "ether")),
      new BN(web3.utils.toWei("0.02", "ether")),
      new BN(web3.utils.toWei("250000", "ether")),
      new BN(web3.utils.toWei("1000000", "ether")),
      { from: this.testContext.deployer }
    );

    // Register LoopringV3 to UniversalRegistry
    // await this.universalRegistry.registerProtocol(
    //   this.loopringV3.address,
    //   this.exchange.address,
    //   { from: this.testContext.deployer }
    // );

    await this.loopringV3.updateProtocolFeeSettings(
      25,
      50,
      10,
      25,
      new BN(web3.utils.toWei("25000000", "ether")),
      new BN(web3.utils.toWei("10000000", "ether")),
      { from: this.testContext.deployer }
    );

    for (let i = 0; i < this.MAX_NUM_EXCHANGES; i++) {
      this.pendingTransactions.push([]);
      this.pendingBlocks.push([]);
      this.blocks.push([]);

      const protocolFeeAccount: Account = {
        accountID: 0,
        owner: Constants.zeroAddress,
        publicKeyX: "0",
        publicKeyY: "0",
        secretKey: "0",
        nonce: 0
      };
      const indexAccount: Account = {
        accountID: 1,
        owner: Constants.zeroAddress,
        publicKeyX: "0",
        publicKeyY: "0",
        secretKey: "0",
        nonce: 0
      };
      this.accounts.push([protocolFeeAccount, indexAccount]);
    }

    await this.createExchange(this.testContext.deployer, true, this.rollupMode);

    const constants = await this.exchange.getConstants();
    this.SNARK_SCALAR_FIELD = new BN(constants.SNARK_SCALAR_FIELD);
    this.MAX_OPEN_FORCED_REQUESTS = new BN(
      constants.MAX_OPEN_FORCED_REQUESTS
    ).toNumber();
    this.MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE = new BN(
      constants.MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE
    ).toNumber();
    this.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS = new BN(
      constants.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS
    ).toNumber();
    this.MAX_NUM_TOKENS = new BN(constants.MAX_NUM_TOKENS).toNumber();
    this.MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED = new BN(
      constants.MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED
    ).toNumber();
    this.MIN_TIME_IN_SHUTDOWN = new BN(
      constants.MIN_TIME_IN_SHUTDOWN
    ).toNumber();
    this.TX_DATA_AVAILABILITY_SIZE = new BN(
      constants.TX_DATA_AVAILABILITY_SIZE
    ).toNumber();
    this.MAX_AGE_DEPOSIT_UNTIL_WITHDRAWABLE = new BN(
      constants.MAX_AGE_DEPOSIT_UNTIL_WITHDRAWABLE
    ).toNumber();
  }

  public async setupTestState(exchangeID: number) {
    this.operators[exchangeID] = await this.createOperator(
      this.testContext.operators[0]
    );
  }

  public async createOperator(owner: string) {
    // Make an account for the operator
    const deposit = await this.deposit(
      owner,
      owner,
      Constants.zeroAddress,
      new BN(0)
    );
    return deposit.accountID;
  }

  public async getEventsFromContract(
    contract: any,
    eventName: string,
    fromBlock: number
  ) {
    return await contract
      .getPastEvents(eventName, {
        fromBlock,
        toBlock: "latest"
      })
      .then((events: any) => {
        return events;
      });
  }

  // This works differently from truffleAssert.eventEmitted in that it also is able to
  // get events emmitted in `deep contracts` (i.e. events not emmitted in the contract
  // the function got called in).
  public async assertEventsEmitted(
    contract: any,
    event: string,
    numExpected: number,
    filter?: any
  ) {
    const eventArr: any = await this.getEventsFromContract(
      contract,
      event,
      web3.eth.blockNumber
    );
    const items = eventArr.map((eventObj: any) => {
      if (filter !== undefined) {
        assert(filter(eventObj.args), "Event values unexpected: " + eventObj);
      }
      return eventObj.args;
    });
    assert.equal(
      items.length,
      numExpected,
      "Unexpected number of '" + event + "' events",
      event
    );
    return items;
  }

  public async assertEventEmitted(contract: any, event: string, filter?: any) {
    return (await this.assertEventsEmitted(contract, event, 1, filter))[0];
  }

  public async assertNoEventEmitted(contract: any, event: string) {
    this.assertEventsEmitted(contract, event, 0, undefined);
  }

  public async transfer(
    from: string,
    to: string,
    token: string,
    amount: BN,
    feeToken: string,
    fee: BN,
    options: TransferOptions = {}
  ) {
    amount = roundToFloatValue(amount, Constants.Float24Encoding);
    fee = roundToFloatValue(fee, Constants.Float16Encoding);

    // Fill in defaults
    const amountToDeposit = options.amountToDeposit
      ? options.amountToDeposit
      : amount;
    const feeToDeposit = options.feeToDeposit ? options.feeToDeposit : fee;
    const authMethod =
      options.authMethod !== undefined ? options.authMethod : AuthMethod.EDDSA;
    const useDualAuthoring =
      options.useDualAuthoring !== undefined ? options.useDualAuthoring : false;
    const secretKnown =
      options.secretKnown !== undefined ? options.secretKnown : true;
    const transferToNew =
      options.transferToNew !== undefined ? options.transferToNew : false;
    const signer = options.signer !== undefined ? options.signer : from;

    // From
    await this.deposit(from, from, token, amountToDeposit);
    await this.deposit(from, from, feeToken, feeToDeposit);

    // To
    let toAccountID = this.getAccountID(to);
    if (!transferToNew) {
      if (toAccountID === undefined) {
        await this.deposit(to, to, token, new BN(0));
        toAccountID = this.findAccount(to).accountID;
      }
    } else {
      const account: Account = {
        accountID: this.accounts[this.exchangeId].length,
        owner: to,
        publicKeyX: "0",
        publicKeyY: "0",
        secretKey: "0",
        wallet: undefined,
        nonce: 0
      };
      this.accounts[this.exchangeId].push(account);
      toAccountID = account.accountID;
    }

    // Tokens
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    if (!feeToken.startsWith("0x")) {
      feeToken = this.testContext.tokenSymbolAddrMap.get(feeToken);
    }
    const tokenID = this.tokenAddressToIDMap.get(token);
    const feeTokenID = this.tokenAddressToIDMap.get(feeToken);

    // Dual author key
    const dualAuthorkeyPair = this.getKeyPairEDDSA();
    let dualAuthorX = "0";
    let dualAuthorY = "0";
    let dualSecretKey = "0";
    if (useDualAuthoring) {
      dualAuthorX = dualAuthorkeyPair.publicKeyX;
      dualAuthorY = dualAuthorkeyPair.publicKeyY;
      dualSecretKey = dualAuthorkeyPair.secretKey;
    }

    // Setup the transfer tx
    const accountFrom = this.findAccount(from);
    const fromAccountID = accountFrom.accountID;
    const transfer: Transfer = {
      txType: "Transfer",
      exchange: this.exchange.address,
      fromAccountID,
      toAccountID,
      tokenID,
      amount,
      feeTokenID,
      fee,
      from,
      to,
      data: this.getRandomMemo(),
      type: authMethod === AuthMethod.EDDSA ? 0 : 1,
      validUntil: 0xffffffff,
      dualAuthorX,
      dualAuthorY,
      payerToAccountID: useDualAuthoring ? 0 : toAccountID,
      payerTo: useDualAuthoring ? Constants.zeroAddress : to,
      payeeToAccountID: toAccountID,
      nonce: this.accounts[this.exchangeId][fromAccountID].nonce++,
      dualSecretKey
    };

    // Authorize the tx
    if (authMethod === AuthMethod.EDDSA) {
      transfer.signature = TransferUtils.sign(accountFrom, transfer, true);
      if (useDualAuthoring) {
        const dualKeyPair = secretKnown
          ? dualAuthorkeyPair
          : this.getKeyPairEDDSA();
        transfer.dualSignature = TransferUtils.sign(
          dualKeyPair,
          transfer,
          false
        );
      }
    } else if (authMethod === AuthMethod.ECDSA) {
      const hash = TransferUtils.getHash(transfer, this.exchange.address);
      transfer.onchainSignature = await sign(
        signer,
        hash,
        SignatureType.EIP_712
      );
      await verifySignature(signer, hash, transfer.onchainSignature);
    } else if (authMethod === AuthMethod.APPROVE) {
      const txHash = TransferUtils.getHash(transfer, this.exchange.address);

      // Randomly approve using approveOffchainTransfer/approveTransaction
      const toggle = this.getRandomBool();
      if (toggle) {
        await this.exchange.approveOffchainTransfer(
          signer,
          transfer.to,
          token,
          transfer.amount,
          feeToken,
          transfer.fee,
          transfer.data,
          transfer.nonce,
          { from: signer }
        );
      } else {
        await this.exchange.approveTransaction(signer, txHash, {
          from: signer
        });
      }
      // Verify the transaction has been approved
      // Check the event
      const event = await this.assertEventEmitted(
        this.exchange,
        "TransactionApproved"
      );
      assert.equal(event.owner, signer, "unexpected tx owner");
      assert.equal(
        event.transactionHash,
        "0x" + txHash.toString("hex"),
        "unexpected tx hasg"
      );
      // Check the exchange state
      const isApproved = await this.exchange.isTransactionApproved(
        signer,
        txHash
      );
      assert(isApproved, "tx not approved");
    }

    this.pendingTransactions[this.exchangeId].push(transfer);

    return transfer;
  }

  public async setupRing(
    ring: SpotTrade,
    bSetupOrderA: boolean = true,
    bSetupOrderB: boolean = true
  ) {
    if (bSetupOrderA) {
      await this.setupOrder(ring.orderA, this.orderIDGenerator++);
    }
    if (bSetupOrderB) {
      await this.setupOrder(ring.orderB, this.orderIDGenerator++);
    }
    ring.tokenID =
      ring.tokenID !== undefined
        ? ring.tokenID
        : await this.getTokenIdFromNameOrAddress("LRC");
    ring.fee = ring.fee ? ring.fee : new BN(web3.utils.toWei("1", "ether"));
  }

  public async setupOrder(order: OrderInfo, index: number) {
    if (order.owner === undefined) {
      const accountIndex = index % this.testContext.orderOwners.length;
      order.owner = this.testContext.orderOwners[accountIndex];
    } else if (order.owner !== undefined && !order.owner.startsWith("0x")) {
      const accountIndex = parseInt(order.owner, 10);
      assert(
        accountIndex >= 0 && accountIndex < this.testContext.orderOwners.length,
        "Invalid owner index"
      );
      order.owner = this.testContext.orderOwners[accountIndex];
    }
    if (!order.tokenS.startsWith("0x")) {
      order.tokenS = this.testContext.tokenSymbolAddrMap.get(order.tokenS);
    }
    if (!order.tokenB.startsWith("0x")) {
      order.tokenB = this.testContext.tokenSymbolAddrMap.get(order.tokenB);
    }
    if (!order.validSince) {
      // Set the order validSince time to a bit before the current timestamp;
      const blockNumber = await web3.eth.getBlockNumber();
      order.validSince =
        (await web3.eth.getBlock(blockNumber)).timestamp - 10000;
    }
    if (!order.validUntil) {
      // Set the order validUntil time to a bit after the current timestamp;
      const blockNumber = await web3.eth.getBlockNumber();
      order.validUntil =
        (await web3.eth.getBlock(blockNumber)).timestamp + 3600;
    }

    order.exchange =
      order.exchange !== undefined ? order.exchange : this.exchange.address;

    order.buy = order.buy !== undefined ? order.buy : true;

    order.maxFeeBips = order.maxFeeBips !== undefined ? order.maxFeeBips : 20;
    order.allOrNone = order.allOrNone ? order.allOrNone : false;

    order.feeBips =
      order.feeBips !== undefined ? order.feeBips : order.maxFeeBips;
    order.rebateBips = order.rebateBips !== undefined ? order.rebateBips : 0;

    order.orderID = order.orderID !== undefined ? order.orderID : index;

    order.tokenIdS = this.tokenAddressToIDMap.get(order.tokenS);
    order.tokenIdB = this.tokenAddressToIDMap.get(order.tokenB);

    assert(order.maxFeeBips < 64, "maxFeeBips >= 64");
    assert(order.feeBips < 64, "feeBips >= 64");
    assert(order.rebateBips < 64, "rebateBips >= 64");

    order.transferAmountTrade =
      order.transferAmountTrade !== undefined
        ? order.transferAmountTrade
        : new BN(0);
    order.reduceOnly =
      order.reduceOnly !== undefined ? order.reduceOnly : false;
    order.triggerPrice =
      order.triggerPrice !== undefined ? order.triggerPrice : new BN(0);

    order.transferAmount =
      order.transferAmount !== undefined ? order.transferAmount : new BN(0);
    order.transferFee =
      order.transferFee !== undefined ? order.transferFee : new BN(0);

    // setup initial balances:
    await this.setOrderBalances(order);

    // Sign the order
    this.signOrder(order);
  }

  public signOrder(order: OrderInfo) {
    if (order.signature !== undefined) {
      return;
    }
    const account = this.accounts[this.exchangeId][order.accountID];

    // Calculate hash
    const hasher = Poseidon.createHash(13, 6, 53);
    const inputs = [
      order.exchange,
      order.orderID,
      order.accountID,
      order.tokenIdS,
      order.tokenIdB,
      order.amountS,
      order.amountB,
      order.allOrNone ? 1 : 0,
      order.validSince,
      order.validUntil,
      order.maxFeeBips,
      order.buy ? 1 : 0
    ];
    order.hash = hasher(inputs).toString(10);

    // Create signature
    order.signature = EdDSA.sign(account.secretKey, order.hash);

    // Verify signature
    const success = EdDSA.verify(order.hash, order.signature, [
      account.publicKeyX,
      account.publicKeyY
    ]);
    assert(success, "Failed to verify signature");
  }

  public signRingBlock(block: any, publicDataInput: any) {
    if (block.signature !== undefined) {
      return;
    }

    const hasher = Poseidon.createHash(3, 6, 51);
    const account = this.accounts[this.exchangeId][block.operatorAccountID];

    console.log("operator nonce: " + account.nonce);

    // Calculate hash
    const inputs = [new BN(publicDataInput, 10), account.nonce++];
    const hash = hasher(inputs).toString(10);

    // Create signature
    block.signature = EdDSA.sign(account.secretKey, hash);

    // Verify signature
    const success = EdDSA.verify(hash, block.signature, [
      account.publicKeyX,
      account.publicKeyY
    ]);
    assert(success, "Failed to verify signature");
  }

  public async setOrderBalances(order: OrderInfo) {
    const balanceS =
      order.balanceS !== undefined ? order.balanceS : order.amountS;
    const deposit = await this.deposit(
      order.owner,
      order.owner,
      order.tokenS,
      balanceS
    );
    order.accountID = deposit.accountID;

    const balanceB = order.balanceB !== undefined ? order.balanceB : new BN(0);
    if (balanceB.gt(new BN(0)) || order.accountID === undefined) {
      const deposit = await this.deposit(
        order.owner,
        order.owner,
        order.tokenB,
        balanceB
      );
      order.accountID = deposit.accountID;
    }
  }

  public getAddressBook(
    ring: SpotTrade,
    index?: number,
    addressBook: { [id: number]: string } = {}
  ) {
    const addAccount = (
      addrBook: { [id: string]: any },
      accountID: number,
      name: string
    ) => {
      addrBook[accountID] =
        (addrBook[accountID] ? addrBook[accountID] + "=" : "") + name;
    };
    const bIndex = index !== undefined;
    addAccount(addressBook, 0, "ProtocolFeePool");
    addAccount(
      addressBook,
      ring.orderA.accountID,
      "OwnerA" + (bIndex ? "[" + index + "]" : "")
    );
    addAccount(
      addressBook,
      ring.orderB.accountID,
      "OwnerB" + (bIndex ? "[" + index + "]" : "")
    );
    return addressBook;
  }

  public getAddressBookBlock(block: TxBlock) {
    const addAccount = (
      addrBook: { [id: string]: any },
      accountID: number,
      name: string
    ) => {
      addrBook[accountID] =
        (addrBook[accountID] ? addrBook[accountID] + "=" : "") + name;
    };

    let addressBook: { [id: number]: string } = {};
    let index = 0;
    for (const tx of block.transactions) {
      if (tx.txType === "SpotTrade") {
        addressBook = this.getAddressBook(tx, index++, addressBook);
      }
    }
    addAccount(addressBook, block.operatorAccountID, "Operator");
    return addressBook;
  }

  public getKeyPairEDDSA() {
    return EdDSA.getKeyPair();
  }

  public getZeroKeyPairEDDSA() {
    return {
      publicKeyX: "0",
      publicKeyY: "0",
      secretKey: "0"
    };
  }

  public flattenList = (l: any[]) => {
    return [].concat.apply([], l);
  };

  public flattenVK = (vk: any) => {
    return [
      this.flattenList([
        vk.alpha[0],
        vk.alpha[1],
        this.flattenList(vk.beta),
        this.flattenList(vk.gamma),
        this.flattenList(vk.delta)
      ]),
      this.flattenList(vk.gammaABC)
    ];
  };

  public flattenProof = (proof: any) => {
    return this.flattenList([proof.A, this.flattenList(proof.B), proof.C]);
  };

  public async deposit(
    from: string,
    to: string,
    token: string,
    amount: BN,
    fee?: BN,
    autoSetKeys: boolean = true,
    accountContract?: any
  ) {
    console.log("token:" + token);
    console.log("amount:" + amount.toString(10));
    if (fee === undefined) {
      fee = this.getRandomFee();
    }
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    const tokenID = await this.getTokenID(token);

    const contract = accountContract ? accountContract : this.exchange;
    const caller = accountContract ? this.testContext.orderOwners[0] : from;

    let accountID = await this.getAccountID(to);
    let accountNewCreated = false;
    if (accountID === undefined) {
      const account: Account = {
        accountID: this.accounts[this.exchangeId].length,
        owner: to,
        publicKeyX: "0",
        publicKeyY: "0",
        secretKey: "0",
        nonce: 0
      };
      this.accounts[this.exchangeId].push(account);
      accountID = account.accountID;

      accountNewCreated = true;
    }

    let ethToSend = fee;
    if (amount.gt(0)) {
      if (token !== Constants.zeroAddress) {
        const Token = this.testContext.tokenAddrInstanceMap.get(token);
        await Token.setBalance(from, amount);
        await Token.approve(this.depositContract.address, amount, { from });
      } else {
        ethToSend = ethToSend.add(web3.utils.toBN(amount));
      }
    }

    const callerEthBalanceBefore = await this.getOnchainBalance(
      from,
      Constants.zeroAddress
    );

    const tx = await contract.deposit(
      from,
      to,
      token,
      web3.utils.toBN(amount),
      web3.utils.hexToBytes("0x"),
      { from: caller, value: ethToSend, gasPrice: 0 }
    );
    const ethBlock = await web3.eth.getBlock(tx.receipt.blockNumber);
    logInfo("\x1b[46m%s\x1b[0m", "[Deposit] Gas used: " + tx.receipt.gasUsed);

    // Check if the correct fee amount was paid
    const callerEthBalanceAfter = await this.getOnchainBalance(
      from,
      Constants.zeroAddress
    );
    assert(
      callerEthBalanceAfter.eq(callerEthBalanceBefore.sub(ethToSend)),
      "fee paid by the depositer needs to match exactly with the fee needed"
    );

    const event = await this.assertEventEmitted(
      this.exchange,
      "DepositRequested"
    );
    const index = event.index;
    this.index.set(token, index);
    // console.log("index: " + index.toString(10));

    const deposit: Deposit = {
      txType: "Deposit",
      owner: to,
      accountID,
      tokenID: this.tokenAddressToIDMap.get(token),
      amount,
      index,
      fee,
      token,
      timestamp: ethBlock.timestamp,
      transactionHash: tx.receipt.transactionHash
    };
    this.pendingTransactions[this.exchangeId].push(deposit);

    if (accountNewCreated && autoSetKeys) {
      let keyPair = this.getKeyPairEDDSA();
      await this.requestAccountUpdate(
        to,
        token,
        new BN(0),
        keyPair,
        undefined,
        { authMethod: AuthMethod.ECDSA }
      );
    }

    return deposit;
  }

  public hexToDecString(hex: string) {
    return new BN(hex.slice(2), 16).toString(10);
  }

  public async requestWithdrawal(
    owner: string,
    token: string,
    amount: BN,
    feeToken: string,
    fee: BN,
    options: WithdrawOptions = {}
  ) {
    // Fill in defaults
    const authMethod =
      options.authMethod !== undefined ? options.authMethod : AuthMethod.EDDSA;
    const to = options.to !== undefined ? options.to : owner;
    const minGas = options.minGas !== undefined ? options.minGas : 0;
    const gas =
      options.gas !== undefined ? options.gas : minGas > 0 ? minGas : 100000;
    const signer = options.signer !== undefined ? options.signer : owner;
    const data = options.data !== undefined ? options.data : "0x";

    let type = 0;
    if (authMethod === AuthMethod.ECDSA || authMethod === AuthMethod.APPROVE) {
      type = 1;
    }
    if (authMethod === AuthMethod.FORCE) {
      if (signer === owner) {
        type = 2;
      } else {
        type = 3;
      }
    }

    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    const tokenID = this.tokenAddressToIDMap.get(token);
    if (!feeToken.startsWith("0x")) {
      feeToken = this.testContext.tokenSymbolAddrMap.get(feeToken);
    }

    let accountID = this.getAccountID(owner);
    if (authMethod === AuthMethod.FORCE) {
      const withdrawalFee = await this.loopringV3.forcedWithdrawalFee();
      if (owner != Constants.zeroAddress) {
        const numAvailableSlotsBefore = (await this.exchange.getNumAvailableForcedSlots()).toNumber();
        await this.exchange.forceWithdraw(owner, token, accountID, {
          from: signer,
          value: withdrawalFee
        });
        const numAvailableSlotsAfter = (await this.exchange.getNumAvailableForcedSlots()).toNumber();
        assert.equal(
          numAvailableSlotsAfter,
          numAvailableSlotsBefore - 1,
          "available slots should have decreased by 1"
        );
      } else {
        accountID = 0;
        await this.exchange.withdrawProtocolFees(token, {
          value: withdrawalFee
        });
      }
      //withdrawalRequest.timestamp = ethBlock.timestamp;
      //withdrawalRequest.transactionHash = tx.receipt.transactionHash;
    }

    const account = this.accounts[this.exchangeId][accountID];
    const feeTokenID = this.tokenAddressToIDMap.get(feeToken);
    const withdrawalRequest: WithdrawalRequest = {
      txType: "Withdraw",
      exchange: this.exchange.address,
      type,
      owner,
      accountID,
      nonce: account.nonce,
      tokenID,
      amount,
      feeTokenID,
      fee,
      to,
      withdrawalFee: await this.loopringV3.forcedWithdrawalFee(),
      minGas,
      gas,
      dataHash: this.hashToFieldElement("0x" + "00".repeat(32))
    };

    if (authMethod === AuthMethod.EDDSA) {
      WithdrawalUtils.sign(account, withdrawalRequest);
    } else if (authMethod === AuthMethod.ECDSA) {
      const hash = WithdrawalUtils.getHash(
        withdrawalRequest,
        this.exchange.address
      );
      withdrawalRequest.onchainSignature = await sign(
        owner,
        hash,
        SignatureType.EIP_712
      );
      await verifySignature(owner, hash, withdrawalRequest.onchainSignature);
    } else if (authMethod === AuthMethod.APPROVE) {
      const hash = WithdrawalUtils.getHash(
        withdrawalRequest,
        this.exchange.address
      );
      await this.exchange.approveTransaction(owner, hash, { from: owner });
    }

    if (type == 0 || type == 1) {
      this.accounts[this.exchangeId][accountID].nonce++;
    }

    this.pendingTransactions[this.exchangeId].push(withdrawalRequest);
    return withdrawalRequest;
  }

  public async requestNewAccount(
    payer: string,
    feeToken: string,
    fee: BN,
    newOwner: string,
    keyPair: any,
    wallet?: Wallet,
    options: NewAccountOptions = {}
  ) {
    fee = roundToFloatValue(fee, Constants.Float16Encoding);

    // Fill in defaults
    const authMethod =
      options.authMethod !== undefined ? options.authMethod : AuthMethod.ECDSA;

    if (!feeToken.startsWith("0x")) {
      feeToken = this.testContext.tokenSymbolAddrMap.get(feeToken);
    }
    const feeTokenID = this.tokenAddressToIDMap.get(feeToken);

    let walletHash = "0";
    if (wallet !== undefined) {
      const hash = WalletUtils.getHash(
        wallet,
        this.statelessWallet.address,
        this.exchange.address
      );
      walletHash = this.hashToFieldElement("0x" + hash.toString("hex"));
    }

    const payerAccount = this.findAccount(payer);

    const account: Account = {
      accountID: this.accounts[this.exchangeId].length,
      owner: newOwner,
      publicKeyX: keyPair.publicKeyX,
      publicKeyY: keyPair.publicKeyY,
      secretKey: keyPair.secretKey,
      wallet,
      nonce: 0
    };
    this.accounts[this.exchangeId].push(account);

    const accountNew: NewAccount = {
      txType: "NewAccount",
      exchange: this.exchange.address,
      payerAccountID: payerAccount.accountID,
      feeTokenID,
      fee,
      nonce: payerAccount.nonce++,
      newOwner,
      newAccountID: account.accountID,
      newPublicKeyX: account.publicKeyX,
      newPublicKeyY: account.publicKeyY,
      newWalletHash: walletHash
    };
    accountNew.signature = NewAccountUtils.sign(payerAccount, accountNew);

    // Let the new owner sign the new account data
    if (authMethod === AuthMethod.ECDSA) {
      const hash = NewAccountUtils.getHash(accountNew, this.exchange.address);
      accountNew.onchainSignature = await sign(
        newOwner,
        hash,
        SignatureType.EIP_712
      );
      await verifySignature(newOwner, hash, accountNew.onchainSignature);
    } else if (authMethod === AuthMethod.APPROVE) {
      const hash = NewAccountUtils.getHash(accountNew, this.exchange.address);
      await this.exchange.approveTransaction(newOwner, hash, {
        from: newOwner
      });
    }

    this.pendingTransactions[this.exchangeId].push(accountNew);
    return accountNew;
  }

  public async requestAccountUpdate(
    owner: string,
    feeToken: string,
    fee: BN,
    keyPair: any,
    wallet?: Wallet,
    options: AccountUpdateOptions = {}
  ) {
    fee = roundToFloatValue(fee, Constants.Float16Encoding);

    // Fill in defaults
    const authMethod =
      options.authMethod !== undefined ? options.authMethod : AuthMethod.EDDSA;

    // Type
    let type = 0;
    if (authMethod !== AuthMethod.EDDSA) {
      type = 1;
    }

    if (!feeToken.startsWith("0x")) {
      feeToken = this.testContext.tokenSymbolAddrMap.get(feeToken);
    }
    const feeTokenID = this.tokenAddressToIDMap.get(feeToken);

    let walletHash = "0";
    if (wallet !== undefined) {
      const hash = WalletUtils.getHash(
        wallet,
        this.statelessWallet.address,
        this.exchange.address
      );
      walletHash = this.hashToFieldElement("0x" + hash.toString("hex"));
    }

    const account = this.findAccount(owner);

    const accountUpdate: AccountUpdate = {
      txType: "AccountUpdate",
      exchange: this.exchange.address,
      type,
      owner,
      accountID: account.accountID,
      nonce: account.nonce++,
      publicKeyX: keyPair.publicKeyX,
      publicKeyY: keyPair.publicKeyY,
      walletHash,
      feeTokenID,
      fee
    };

    // Sign the public key update
    if (authMethod === AuthMethod.EDDSA) {
      accountUpdate.signature = AccountUpdateUtils.sign(account, accountUpdate);
    } else if (authMethod === AuthMethod.ECDSA) {
      const hash = AccountUpdateUtils.getHash(
        accountUpdate,
        this.exchange.address
      );
      accountUpdate.onchainSignature = await sign(
        owner,
        hash,
        SignatureType.EIP_712
      );
      await verifySignature(owner, hash, accountUpdate.onchainSignature);
    } else if (authMethod === AuthMethod.APPROVE) {
      const hash = AccountUpdateUtils.getHash(
        accountUpdate,
        this.exchange.address
      );
      await this.exchange.approveTransaction(owner, hash, { from: owner });
    }

    this.pendingTransactions[this.exchangeId].push(accountUpdate);

    // Update local account state
    account.publicKeyX = keyPair.publicKeyX;
    account.publicKeyY = keyPair.publicKeyY;
    account.secretKey = keyPair.secretKey;

    return accountUpdate;
  }

  public async requestOwnerChange(
    owner: string,
    feeToken: string,
    fee: BN,
    newOwner: string,
    options: OwnerChangeOptions = {}
  ) {
    fee = roundToFloatValue(fee, Constants.Float16Encoding);

    // Fill in defaults
    const authMethod =
      options.authMethod !== undefined ? options.authMethod : AuthMethod.ECDSA;
    const walletCalldata =
      options.walletCalldata !== undefined ? options.walletCalldata : "0x";

    if (!feeToken.startsWith("0x")) {
      feeToken = this.testContext.tokenSymbolAddrMap.get(feeToken);
    }
    const feeTokenID = this.tokenAddressToIDMap.get(feeToken);

    const account = this.findAccount(owner);

    let walletHash = "0";
    let walletDataHash = "0x0";
    if (account.wallet !== undefined) {
      const hash = WalletUtils.getHash(
        account.wallet,
        this.statelessWallet.address,
        this.exchange.address
      );
      const dataHash = WalletUtils.getWalletHash(
        account.wallet,
        this.statelessWallet.address
      );
      walletHash = this.hashToFieldElement("0x" + hash.toString("hex"));
      walletDataHash = "0x" + dataHash.toString("hex");
    }

    const accountTransfer: OwnerChange = {
      txType: "OwnerChange",
      owner,
      accountID: account.accountID,
      feeTokenID,
      fee,
      walletHash,
      nonce: account.nonce++,
      newOwner,
      statelessWallet:
        authMethod === AuthMethod.WALLET
          ? this.statelessWallet.address
          : Constants.zeroAddress,
      walletDataHash,
      walletCalldata
    };

    // New owner always has to sign
    const hash = OwnerChangeUtils.getHash(
      accountTransfer,
      this.exchange.address
    );
    accountTransfer.onchainSignatureNewOwner = await sign(
      newOwner,
      hash,
      SignatureType.EIP_712
    );
    await verifySignature(
      newOwner,
      hash,
      accountTransfer.onchainSignatureNewOwner
    );

    // Sign the public key update
    if (authMethod === AuthMethod.ECDSA) {
      accountTransfer.onchainSignatureOldOwner = await sign(
        owner,
        hash,
        SignatureType.EIP_712
      );
      await verifySignature(
        owner,
        hash,
        accountTransfer.onchainSignatureOldOwner
      );
    } else if (authMethod === AuthMethod.WALLET) {
      // Nothing more to do
    }

    // Change the owner on the internal state
    account.owner = newOwner;

    this.pendingTransactions[this.exchangeId].push(accountTransfer);
    return accountTransfer;
  }

  public sendRing(ring: SpotTrade) {
    ring.txType = "SpotTrade";
    this.pendingTransactions[this.exchangeId].push(ring);
  }

  public ensureDirectoryExists(filePath: string) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
      return true;
    }
    this.ensureDirectoryExists(dirname);
    fs.mkdirSync(dirname);
  }

  public async createBlock(
    exchangeID: number,
    blockType: BlockType,
    data: string,
    validate: boolean = true
  ) {
    const nextBlockIdx = this.blocks[exchangeID].length;
    const inputFilename =
      "./blocks/block_" + exchangeID + "_" + nextBlockIdx + "_info.json";
    const outputFilename =
      "./blocks/block_" + exchangeID + "_" + nextBlockIdx + ".json";

    this.ensureDirectoryExists(inputFilename);
    fs.writeFileSync(inputFilename, data, "utf8");

    // Create the block
    const result = childProcess.spawnSync(
      "python3",
      [
        "operator/create_block.py",
        "" + exchangeID,
        "" + nextBlockIdx,
        "" + blockType,
        inputFilename,
        outputFilename
      ],
      { stdio: doDebugLogging() ? "inherit" : "ignore" }
    );
    assert(result.status === 0, "create_block failed: " + blockType);

    if (validate) {
      await this.validateBlock(outputFilename);
    }

    return { blockIdx: nextBlockIdx, blockFilename: outputFilename };
  }

  public hashToFieldElement(hash: string) {
    const fieldHash = new BN(hash.slice(2), 16).shrn(3).toString(10);
    return fieldHash;
  }

  public getPublicDataHashAndInput(data: string) {
    const publicDataHash =
      "0x" + SHA256(Buffer.from(data.slice(2), "hex")).toString("hex");
    return {
      publicDataHash,
      publicInput: this.hashToFieldElement(publicDataHash)
    };
  }

  public async validateBlock(filename: string) {
    // Validate the block
    const result = childProcess.spawnSync(
      "build/circuit/dex_circuit",
      ["-validate", filename],
      { stdio: doDebugLogging() ? "inherit" : "ignore" }
    );
    assert(result.status === 0, "invalid block: " + filename);
  }

  public async commitBlock(
    operatorId: number,
    blockType: BlockType,
    blockSize: number,
    data: string,
    filename: string,
    txBlock: TxBlock,
    auxiliaryData: string = "0x"
  ) {
    const publicDataHashAndInput = this.getPublicDataHashAndInput(data);
    const publicDataHash = publicDataHashAndInput.publicDataHash;
    const publicInput = publicDataHashAndInput.publicInput;
    logDebug("- " + filename);
    logDebug("[EVM]PublicData: " + data);
    logDebug("[EVM]PublicDataHash: " + publicDataHash);
    logDebug("[EVM]PublicInput: " + publicInput);
    logDebug("[EVM]AuxiliaryData: " + auxiliaryData);

    const compressedData = compress(
      data,
      this.compressionType,
      this.lzDecompressor.address
    );

    // Make sure the keys are generated
    await this.registerCircuit(blockType, blockSize, 0);

    const blockVersion = 0;
    let offchainData =
      this.getRandomInt(2) === 0
        ? "0x0ff" + this.blocks[this.exchangeId].length
        : "0x";
    if (offchainData.length % 2 == 1) {
      offchainData += "0";
    }

    const blockFile = JSON.parse(fs.readFileSync(filename, "ascii"));
    const block: Block = {
      blockIdx: this.blocks[this.exchangeId].length,
      filename,
      blockType,
      blockSize,
      blockVersion,
      operator: this.operator ? this.operator.address : this.exchangeOperator,
      origin: this.exchangeOperator,
      operatorId,
      merkleRoot: "0x" + new BN(blockFile.merkleRootAfter, 10).toString(16, 64),
      data,
      auxiliaryData,
      offchainData,
      compressedData,
      publicDataHash,
      publicInput,
      blockFee: new BN(0),
      timestamp: 0,
      transactionHash: "0",
      internalBlock: txBlock
    };
    this.pendingBlocks[this.exchangeId].push(block);
    this.blocks[this.exchangeId].push(block);

    return block;
  }

  public async registerCircuit(
    blockType: BlockType,
    blockSize: number,
    blockVersion: number
  ) {
    const blockFilename =
      "./blocks/protoblock_" + blockType + "_blockSize_" + blockSize + ".json";

    const block: any = {};
    block.blockType = blockType;
    block.blockSize = blockSize;
    block.rollupMode = this.rollupMode;
    fs.writeFileSync(
      blockFilename,
      JSON.stringify(block, undefined, 4),
      "ascii"
    );

    const isCircuitRegistered = await this.blockVerifier.isCircuitRegistered(
      block.blockType,
      block.rollupMode,
      block.blockSize,
      blockVersion
    );
    if (!isCircuitRegistered) {
      const result = childProcess.spawnSync(
        "build/circuit/dex_circuit",
        ["-createkeys", blockFilename],
        { stdio: doDebugLogging() ? "inherit" : "ignore" }
      );
      assert(result.status === 0, "generateKeys failed: " + blockFilename);

      let verificationKeyFilename = "keys/";
      verificationKeyFilename += "all";
      verificationKeyFilename += block.rollupMode ? "_DA_" : "_";
      verificationKeyFilename += block.blockSize + "_vk.json";

      // Read the verification key and set it in the smart contract
      const vk = JSON.parse(fs.readFileSync(verificationKeyFilename, "ascii"));
      const vkFlattened = this.flattenList(this.flattenVK(vk));
      // console.log(vkFlattened);

      await this.blockVerifier.registerCircuit(
        block.blockType,
        block.rollupMode,
        block.blockSize,
        blockVersion,
        vkFlattened
      );
    }
  }

  public getKey(block: Block) {
    let key = 0;
    key |= block.blockType;
    key <<= 16;
    key |= block.blockSize;
    key <<= 8;
    key |= block.blockVersion;
    key <<= 1;
    key |= this.rollupMode ? 1 : 0;
    return key;
  }

  public sleep(millis: number) {
    return new Promise(resolve => setTimeout(resolve, millis));
  }

  // function returns a Promise
  public async httpGetSync(url: string, port: number) {
    return new Promise((resolve, reject) => {
      http.get(url, { port, timeout: 600 }, response => {
        let chunks_of_data: Buffer[] = [];

        response.on("data", fragments => {
          chunks_of_data.push(fragments);
        });

        response.on("end", () => {
          let response_body = Buffer.concat(chunks_of_data);
          resolve(response_body.toString());
        });

        response.on("error", error => {
          reject(error);
        });
      });
    });
  }

  public async stop() {
    // Stop all prover servers
    for (const port of this.proverPorts.values()) {
      await this.httpGetSync("http://localhost/stop", port);
    }
  }

  public async submitBlocks(blocks: Block[], callback?: any) {
    if (blocks.length === 0) {
      return;
    }

    // Generate proofs
    for (const [i, block] of blocks.entries()) {
      const blockData = JSON.parse(fs.readFileSync(block.filename, "ascii"));

      const proofFilename =
        "./blocks/block_" +
        this.exchangeId +
        "_" +
        block.blockIdx +
        "_proof.json";

      //console.log("Generating proof: " + proofFilename);

      if (this.useProverServer) {
        const key = this.getKey(block);
        if (!this.proverPorts.has(key)) {
          const port = this.portGenerator++;
          const process = childProcess.spawn(
            "build/circuit/dex_circuit",
            ["-server", block.filename, "" + port],
            { detached: false, stdio: doDebugLogging() ? "inherit" : "ignore" }
          );
          let connected = false;
          let numTries = 0;
          while (!connected) {
            // Wait for the prover server to start up
            http
              .get("http://localhost/status", { port }, res => {
                connected = true;
                this.proverPorts.set(key, port);
              })
              .on("error", e => {
                numTries++;
                if (numTries > 240) {
                  assert(false, "prover server failed to start: " + e);
                }
              });
            await this.sleep(1000);
          }
        }
        const port = this.proverPorts.get(key);
        // Generate the proof
        let proveQuery =
          "http://localhost/prove?block_filename=" + block.filename;
        proveQuery += "&proof_filename=" + proofFilename;
        proveQuery += "&validate=true";
        await this.httpGetSync(proveQuery, port);
      } else {
        // Generate the proof by starting a dedicated circuit binary app instance
        const result = childProcess.spawnSync(
          "build/circuit/dex_circuit",
          ["-prove", block.filename, proofFilename],
          { stdio: doDebugLogging() ? "inherit" : "ignore" }
        );
        assert(
          result.status === 0,
          "Block proof generation failed: " + block.filename
        );
      }

      // Read the proof
      block.proof = this.flattenProof(
        JSON.parse(fs.readFileSync(proofFilename, "ascii"))
      );
      // console.log(proof);
    }

    // Prepare block data
    const onchainBlocks: OnchainBlock[] = [];
    for (const [i, block] of blocks.entries()) {
      //console.log(block.blockIdx);
      const onchainBlock: OnchainBlock = {
        blockType: block.blockType,
        blockSize: block.blockSize,
        blockVersion: block.blockVersion,
        data: web3.utils.hexToBytes(block.data),
        proof: block.proof,
        storeDataHashOnchain: this.getRandomBool(),
        offchainData: web3.utils.hexToBytes(block.offchainData),
        auxiliaryData: web3.utils.hexToBytes(block.auxiliaryData)
      };
      onchainBlocks.push(onchainBlock);
    }

    // Callback that allows modifying the blocks
    if (callback !== undefined) {
      callback(onchainBlocks, blocks);
    }

    const numBlocksSubmittedBefore = (await this.exchange.getBlockHeight()).toNumber();

    // Forced requests
    const numAvailableSlotsBefore = (await this.exchange.getNumAvailableForcedSlots()).toNumber();

    // Submit the blocks onchain
    const operatorContract = this.operator ? this.operator : this.exchange;

    // Compress the data
    const txData = operatorContract.contract.methods
      .submitBlocks(onchainBlocks, this.exchangeOperator)
      .encodeABI();
    const compressed = compressLZ(txData);
    //console.log(txData);
    //console.log(compressed);

    let tx: any = undefined;
    tx = await operatorContract.submitBlocksCompressed(
      web3.utils.hexToBytes(compressed),
      { from: this.exchangeOperator, gasPrice: 0 }
    );
    /*tx = await operatorContract.submitBlocks(
      onchainBlocks,
      this.exchangeOperator,
      { from: this.exchangeOperator, gasPrice: 0 }
    );*/
    logInfo(
      "\x1b[46m%s\x1b[0m",
      "[submitBlocks] Gas used: " + tx.receipt.gasUsed
    );
    const ethBlock = await web3.eth.getBlock(tx.receipt.blockNumber);

    // Check number of blocks submitted
    const numBlocksSubmittedAfter = (await this.exchange.getBlockHeight()).toNumber();
    assert.equal(
      numBlocksSubmittedAfter,
      numBlocksSubmittedBefore + blocks.length,
      "unexpected block height"
    );

    // Check the BlockSubmitted event(s)
    {
      const events = await this.assertEventsEmitted(
        this.exchange,
        "BlockSubmitted",
        blocks.length
      );
      for (const [i, event] of events.entries()) {
        const blockIdx = event.blockIdx.toNumber();
        assert.equal(blockIdx, blocks[i].blockIdx, "unexpected block idx");
        assert.equal(
          event.publicDataHash,
          blocks[i].publicDataHash,
          "unexpected public data hash"
        );
        const block = this.blocks[this.exchangeId][event.blockIdx.toNumber()];
        block.transactionHash = tx.receipt.transactionHash;
        block.timestamp = ethBlock.timestamp;
        block.blockFee = new BN(event.blockFee);
      }
    }

    // Check the new Merkle root
    const merkleRoot = await this.exchange.getMerkleRoot();
    assert.equal(
      merkleRoot,
      blocks[blocks.length - 1].merkleRoot,
      "unexpected Merkle root"
    );

    // Check the Block info stored onchain
    for (const [i, block] of blocks.entries()) {
      const blockInfo = await this.exchange.getBlockInfo(block.blockIdx);
      const expectedHash = onchainBlocks[i].storeDataHashOnchain
        ? block.publicDataHash
        : "0x" + "00".repeat(32);
      assert.equal(
        blockInfo.blockDataHash,
        expectedHash,
        "unexpected public data hash"
      );
    }

    // Forced requests
    const numAvailableSlotsAfter = (await this.exchange.getNumAvailableForcedSlots()).toNumber();
    let numForcedRequestsProcessed = 0;
    for (const block of blocks) {
      for (const tx of block.internalBlock.transactions) {
        if (tx.txType === "Withdraw" && tx.type > 1) {
          numForcedRequestsProcessed++;
        }
      }
    }
    assert.equal(
      numAvailableSlotsAfter - numForcedRequestsProcessed,
      numAvailableSlotsBefore,
      "unexpected num available slots"
    );

    // Check the current state against the explorer state
    await this.checkExplorerState();
  }

  public async submitPendingBlocks(callback?: any) {
    await this.submitBlocks(this.pendingBlocks[this.exchangeId], callback);
    this.pendingBlocks[this.exchangeId] = [];
  }

  public async getActiveOperator(exchangeID: number) {
    return this.activeOperator
      ? this.activeOperator
      : this.operators[exchangeID];
  }

  public async setOperatorContract(operator: any) {
    await this.exchange.setOperator(operator.address, {
      from: this.exchangeOwner
    });
    this.operator = operator;
  }

  public async setActiveOperator(operator: number) {
    this.activeOperator = operator;
  }

  public async submitTransactions(forcedBlockSize?: number) {
    const exchangeID = this.exchangeId;
    const pendingTransactions = this.pendingTransactions[exchangeID];
    if (pendingTransactions.length === 0) {
      return [];
    }

    // Generate the token transfers for the ring
    const blockNumber = await web3.eth.getBlockNumber();
    const timestamp = (await web3.eth.getBlock(blockNumber)).timestamp + 30;

    let numTransactionsDone = 0;
    const blocks: Block[] = [];
    while (numTransactionsDone < pendingTransactions.length) {
      // Get all rings for the block
      const blockSize = forcedBlockSize
        ? forcedBlockSize
        : this.getBestBlockSize(
            pendingTransactions.length - numTransactionsDone,
            this.blockSizes
          );
      const transactions: TxType[] = [];
      for (
        let b = numTransactionsDone;
        b < numTransactionsDone + blockSize;
        b++
      ) {
        if (b < pendingTransactions.length) {
          transactions.push(pendingTransactions[b]);
        } else {
          const noop: Noop = {
            txType: "Noop"
          };
          transactions.push(noop);
        }
      }
      assert(transactions.length === blockSize);
      numTransactionsDone += blockSize;

      // Create the auxiliary data
      const auxiliaryData: any[] = [];
      let numConditionalTransactions = 0;
      for (const [i, transaction] of transactions.entries()) {
        if (transaction.txType === "Transfer") {
          if (transaction.type > 0) {
            numConditionalTransactions++;
            auxiliaryData.push([
              i,
              web3.utils.hexToBytes(
                transaction.onchainSignature
                  ? transaction.onchainSignature
                  : "0x"
              )
            ]);
          }
        } else if (transaction.txType === "Withdraw") {
          numConditionalTransactions++;
          const encodedWithdrawalData = web3.eth.abi.encodeParameter(
            "tuple(uint256,bytes,bytes)",
            [
              transaction.gas,
              web3.utils.hexToBytes(
                transaction.onchainSignature
                  ? transaction.onchainSignature
                  : "0x"
              ),
              web3.utils.hexToBytes("0x")
            ]
          );
          auxiliaryData.push([i, web3.utils.hexToBytes(encodedWithdrawalData)]);
        } else if (transaction.txType === "Deposit") {
          numConditionalTransactions++;
          auxiliaryData.push([i, web3.utils.hexToBytes("0x")]);
        } else if (transaction.txType === "NewAccount") {
          numConditionalTransactions++;
          auxiliaryData.push([
            i,
            web3.utils.hexToBytes(
              transaction.onchainSignature ? transaction.onchainSignature : "0x"
            )
          ]);
        } else if (transaction.txType === "AccountUpdate") {
          if (transaction.type > 0) {
            numConditionalTransactions++;
            auxiliaryData.push([
              i,
              web3.utils.hexToBytes(
                transaction.onchainSignature
                  ? transaction.onchainSignature
                  : "0x"
              )
            ]);
          }
        } else if (transaction.txType === "OwnerChange") {
          numConditionalTransactions++;
          const encodedOwnerChangeData = web3.eth.abi.encodeParameter(
            "tuple(bytes,bytes,address,bytes32,bytes)",
            [
              web3.utils.hexToBytes(
                transaction.onchainSignatureOldOwner
                  ? transaction.onchainSignatureOldOwner
                  : "0x"
              ),
              web3.utils.hexToBytes(
                transaction.onchainSignatureNewOwner
                  ? transaction.onchainSignatureNewOwner
                  : "0x"
              ),
              transaction.statelessWallet,
              transaction.walletDataHash,
              transaction.walletCalldata
            ]
          );
          auxiliaryData.push([
            i,
            web3.utils.hexToBytes(encodedOwnerChangeData)
          ]);
        }
      }
      console.log("numConditionalTransactions: " + numConditionalTransactions);
      const encodedAuxiliaryData = web3.eth.abi.encodeParameter(
        "tuple(uint256,bytes)[]",
        auxiliaryData
      );

      const currentBlockIdx = this.blocks[exchangeID].length - 1;

      const protocolFees = await this.exchange.getProtocolFeeValues();
      const protocolTakerFeeBips = protocolFees.takerFeeBips.toNumber();
      const protocolMakerFeeBips = protocolFees.makerFeeBips.toNumber();

      for (const tx of transactions) {
        console.log(tx.txType);
      }

      const operator = await this.getActiveOperator(exchangeID);
      const txBlock: TxBlock = {
        transactions,
        rollupMode: this.rollupMode,
        timestamp,
        protocolTakerFeeBips,
        protocolMakerFeeBips,
        exchange: this.exchange.address,
        operatorAccountID: operator
      };

      // Store state before
      const stateBefore = await Simulator.loadExchangeState(
        exchangeID,
        currentBlockIdx
      );

      // Create the block
      const { blockIdx, blockFilename } = await this.createBlock(
        exchangeID,
        0,
        JSON.stringify(txBlock, replacer, 4),
        false
      );

      // Read in the block
      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

      // Pack the data that needs to be committed onchain
      const bs = new Bitstream();
      bs.addBN(new BN(block.exchange), 20);
      bs.addBN(new BN(block.merkleRootBefore, 10), 32);
      bs.addBN(new BN(block.merkleRootAfter, 10), 32);
      bs.addNumber(txBlock.timestamp, 4);
      bs.addNumber(txBlock.protocolTakerFeeBips, 1);
      bs.addNumber(txBlock.protocolMakerFeeBips, 1);
      bs.addNumber(numConditionalTransactions, 4);
      const allDa = new Bitstream();
      if (block.rollupMode) {
        allDa.addNumber(block.operatorAccountID, 3);
        for (const tx of block.transactions) {
          //console.log(tx);
          const da = new Bitstream();
          if (tx.noop) {
            // Do nothing
          } else if (tx.spotTrade) {
            const spotTrade = tx.spotTrade;
            const orderA = spotTrade.orderA;
            const orderB = spotTrade.orderB;

            da.addNumber(TransactionType.SPOT_TRADE, 1);

            const numSlots = 2 ** Constants.BINARY_TREE_DEPTH_TRADING_HISTORY;
            da.addNumber(
              spotTrade.overwriteTradeHistorySlotA * numSlots +
                (orderA.orderID % numSlots),
              2
            );
            da.addNumber(
              spotTrade.overwriteTradeHistorySlotB * numSlots +
                (orderB.orderID % numSlots),
              2
            );
            da.addNumber(orderA.accountID, 3);
            da.addNumber(orderB.accountID, 3);
            da.addNumber(orderA.tokenS * 2 ** 12 + orderB.tokenS, 3);
            da.addNumber(spotTrade.fFillS_A, 3);
            da.addNumber(spotTrade.fFillS_B, 3);

            let buyMask = orderA.buy ? 0b10000000 : 0;
            let rebateMask = orderA.rebateBips > 0 ? 0b01000000 : 0;
            da.addNumber(
              buyMask + rebateMask + orderA.feeBips + orderA.rebateBips,
              1
            );

            buyMask = orderB.buy ? 0b10000000 : 0;
            rebateMask = orderB.rebateBips > 0 ? 0b01000000 : 0;
            da.addNumber(
              buyMask + rebateMask + orderB.feeBips + orderB.rebateBips,
              1
            );
          } else if (tx.transfer) {
            const transfer = tx.transfer;
            da.addNumber(TransactionType.TRANSFER, 1);
            da.addNumber(transfer.type, 1);
            da.addNumber(transfer.fromAccountID, 3);
            da.addNumber(transfer.toAccountID, 3);
            da.addNumber(transfer.tokenID * 2 ** 12 + transfer.feeTokenID, 3);
            da.addNumber(
              toFloat(new BN(transfer.amount), Constants.Float24Encoding),
              3
            );
            da.addNumber(
              toFloat(new BN(transfer.fee), Constants.Float16Encoding),
              2
            );
            da.addBN(
              new BN(
                transfer.type > 0 || transfer.toNewAccount ? transfer.to : "0"
              ),
              20
            );
            da.addNumber(transfer.type > 0 ? transfer.nonce : 0, 4);
            da.addBN(new BN(transfer.type > 0 ? transfer.from : "0"), 20);
            da.addBN(new BN(transfer.data), 32);
          } else if (tx.withdraw) {
            const withdraw = tx.withdraw;
            da.addNumber(TransactionType.WITHDRAWAL, 1);
            da.addNumber(withdraw.type, 1);
            da.addBN(new BN(withdraw.owner), 20);
            da.addNumber(withdraw.accountID, 3);
            da.addNumber(withdraw.nonce, 4);
            da.addNumber(withdraw.tokenID * 2 ** 12 + withdraw.feeTokenID, 3);
            da.addBN(new BN(withdraw.amount), 12);
            da.addNumber(
              toFloat(new BN(withdraw.fee), Constants.Float16Encoding),
              2
            );
            da.addBN(new BN(withdraw.to), 20);
            da.addBN(new BN(withdraw.dataHash), 32);
            da.addNumber(withdraw.minGas, 3);
          } else if (tx.deposit) {
            const deposit = tx.deposit;
            da.addNumber(TransactionType.DEPOSIT, 1);
            da.addBN(new BN(deposit.owner), 20);
            da.addNumber(deposit.accountID, 3);
            da.addNumber(deposit.tokenID, 2);
            da.addBN(new BN(deposit.amount), 12);
            da.addBN(new BN(deposit.index), 12);
          } else if (tx.accountUpdate) {
            const update = tx.accountUpdate;
            da.addNumber(TransactionType.ACCOUNT_UPDATE, 1);
            da.addNumber(update.type, 1);
            da.addBN(new BN(update.owner), 20);
            da.addNumber(update.accountID, 3);
            da.addNumber(update.nonce, 4);
            da.addBN(
              new BN(EdDSA.pack(update.publicKeyX, update.publicKeyY), 16),
              32
            );
            da.addBN(new BN(update.walletHash), 32);
            da.addNumber(update.feeTokenID, 2);
            da.addNumber(
              toFloat(new BN(update.fee), Constants.Float16Encoding),
              2
            );
          } else if (tx.accountNew) {
            const create = tx.accountNew;
            da.addNumber(TransactionType.ACCOUNT_NEW, 1);
            da.addNumber(create.payerAccountID, 3);
            da.addNumber(create.feeTokenID, 2);
            da.addNumber(
              toFloat(new BN(create.fee), Constants.Float16Encoding),
              2
            );
            da.addNumber(create.newAccountID, 3);
            da.addBN(new BN(create.newOwner), 20);
            da.addBN(
              new BN(
                EdDSA.pack(create.newPublicKeyX, create.newPublicKeyY),
                16
              ),
              32
            );
            da.addBN(new BN(create.newWalletHash), 32);
          } else if (tx.accountTransfer) {
            const change = tx.accountTransfer;
            da.addNumber(TransactionType.ACCOUNT_TRANSFER, 1);
            da.addBN(new BN(change.owner), 20);
            da.addNumber(change.accountID, 3);
            da.addNumber(change.nonce, 4);
            da.addNumber(change.feeTokenID, 2);
            da.addNumber(
              toFloat(new BN(change.fee), Constants.Float16Encoding),
              2
            );
            da.addBN(new BN(change.newOwner), 20);
            da.addBN(new BN(change.walletHash), 32);
          }

          assert(
            da.length() <= Constants.TX_DATA_AVAILABILITY_SIZE,
            "tx uses too much da"
          );
          while (da.length() < Constants.TX_DATA_AVAILABILITY_SIZE) {
            da.addNumber(0, 1);
          }
          allDa.addHex(da.getData());
        }
      }
      if (block.rollupMode) {
        bs.addHex(allDa.getData());
      }

      // Write the block signature
      const publicDataHashAndInput = this.getPublicDataHashAndInput(
        bs.getData()
      );

      logDebug("[EVM]PublicData: " + bs.getData());
      logDebug("[EVM]PublicDataHash: " + publicDataHashAndInput.publicDataHash);
      logDebug("[EVM]PublicInput: " + publicDataHashAndInput.publicInput);

      this.signRingBlock(block, publicDataHashAndInput.publicInput);
      fs.writeFileSync(
        blockFilename,
        JSON.stringify(block, undefined, 4),
        "utf8"
      );

      // Validate the block after generating the signature
      await this.validateBlock(blockFilename);

      // Load state after
      const stateAfter = await Simulator.loadExchangeState(
        exchangeID,
        currentBlockIdx + 1
      );

      // Validate state change
      Simulator.executeBlock(txBlock, stateBefore, stateAfter);

      // Commit the block
      const blockInfo = await this.commitBlock(
        operator,
        0,
        blockSize,
        bs.getData(),
        blockFilename,
        txBlock,
        encodedAuxiliaryData
      );
      blocks.push(blockInfo);
    }

    this.pendingTransactions[exchangeID] = [];
    return blocks;
  }

  public async registerTokens() {
    for (const token of this.testContext.allTokens) {
      const tokenAddress =
        token === null ? Constants.zeroAddress : token.address;
      const symbol = this.testContext.tokenAddrSymbolMap.get(tokenAddress);
      // console.log(symbol + ": " + tokenAddress);

      if (symbol !== "ETH" && symbol !== "LRC") {
        // Make sure the exchange owner can pay the registration fee
        const registrationCost = await this.exchange.getLRCFeeForRegisteringOneMoreToken();
        await this.setBalanceAndApprove(
          this.exchangeOwner,
          "LRC",
          registrationCost,
          this.exchange.address
        );
        // Register the token
        const tx = await this.exchange.registerToken(tokenAddress, {
          from: this.exchangeOwner
        });
        // logInfo("\x1b[46m%s\x1b[0m", "[TokenRegistration] Gas used: " + tx.receipt.gasUsed);
      }

      const tokenID = await this.getTokenID(tokenAddress);
      this.tokenAddressToIDMap.set(tokenAddress, tokenID);
      this.tokenIDToAddressMap.set(tokenID, tokenAddress);
    }
    // console.log(this.tokenIDMap);
  }

  public async getTokenID(token: string) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    const tokenID = await this.exchange.getTokenID(token);
    return tokenID.toNumber();
  }

  public getTokenAddressFromID(tokenID: number) {
    return this.tokenIDToAddressMap.get(tokenID);
  }

  public getAccountID(owner: string) {
    //console.log("Finding: " + owner);
    for (const account of this.accounts[this.exchangeId]) {
      //console.log(account);
      if (account.owner === owner) {
        //console.log("Found!: " + account.accountID);
        return account.accountID;
      }
    }
    return undefined;
  }

  public getAccount(accountId: number) {
    return this.accounts[this.exchangeId][accountId];
  }

  public findAccount(owner: string) {
    for (let i = 0; i < this.accounts[this.exchangeId].length; i++) {
      if (this.accounts[this.exchangeId][i].owner === owner) {
        return this.accounts[this.exchangeId][i];
      }
    }
    return undefined;
  }

  public async createExchange(
    owner: string,
    bSetupTestState: boolean = true,
    rollupMode: boolean = true
  ) {
    const operator = this.testContext.operators[0];
    const exchangeCreationCostLRC = await this.loopringV3.exchangeCreationCostLRC();

    // Send enough tokens to the owner so the Exchange can be created
    const lrcAddress = this.testContext.tokenSymbolAddrMap.get("LRC");
    const LRC = this.testContext.tokenAddrInstanceMap.get(lrcAddress);
    await LRC.addBalance(owner, exchangeCreationCostLRC);
    await LRC.approve(this.universalRegistry.address, exchangeCreationCostLRC, {
      from: owner
    });

    // randomely support upgradability
    const forgeMode = new Date().getMilliseconds() % 4;
    // Create the new exchange
    const tx = await this.universalRegistry.forgeExchange(
      forgeMode,
      rollupMode,
      Constants.zeroAddress,
      Constants.zeroAddress,
      { from: owner }
    );

    // logInfo(
    //   "\x1b[46m%s\x1b[0m",
    //   "[CreateExchange] Gas used: " + tx.receipt.gasUsed
    // );

    const event = await this.assertEventEmitted(
      this.universalRegistry,
      "ExchangeForged"
    );
    const exchangeAddress = event.exchangeAddress;
    const exchangeId = event.exchangeId.toNumber();

    this.exchange = await this.contracts.ExchangeV3.at(exchangeAddress);

    // Create a deposit contract impl
    const depositContractImpl = await this.contracts.BasicDepositContract.new();
    // Create the proxy contract for the exchange using the implementation
    const depositContractProxy = await this.contracts.OwnedUpgradeabilityProxy.new(
      { from: owner }
    );
    await depositContractProxy.upgradeTo(depositContractImpl.address, {
      from: owner
    });
    // Wrap the proxy contract
    this.depositContract = await this.contracts.BasicDepositContract.at(
      depositContractProxy.address
    );
    // Ininitialze the deposit contract
    await this.depositContract.initialize(
      this.exchange.address,
      this.loopringV3.address
    );

    // Set the deposit contract on the exchange
    await this.exchange.setDepositContract(this.depositContract.address, {
      from: owner
    });
    // Check the deposit contract
    const onchainDepositContract = await this.exchange.getDepositContract();
    assert.equal(
      onchainDepositContract,
      this.depositContract.address,
      "unexpected deposit contract"
    );

    this.exchangeOwner = owner;
    this.exchangeOperator = operator;
    this.exchangeId = exchangeId;
    this.rollupMode = rollupMode;
    this.activeOperator = undefined;

    // Set the operator
    const operatorContract = await this.contracts.Operator.new(
      this.exchange.address,
      { from: this.exchangeOperator }
    );

    await operatorContract.addManager(this.exchangeOperator, {
      from: this.exchangeOperator
    });
    await this.setOperatorContract(operatorContract);

    const exchangeCreationTimestamp = (await this.exchange.getExchangeCreationTimestamp()).toNumber();
    this.GENESIS_MERKLE_ROOT = new BN(
      (await this.exchange.genesisMerkleRoot()).slice(2),
      16
    );

    const genesisBlock: Block = {
      blockIdx: 0,
      filename: null,
      blockType: BlockType.UNIVERSAL,
      blockSize: 0,
      blockVersion: 0,
      operator: Constants.zeroAddress,
      origin: Constants.zeroAddress,
      operatorId: 0,
      merkleRoot: "0x" + this.GENESIS_MERKLE_ROOT.toString(16, 64),
      data: "0x",
      auxiliaryData: "0x",
      offchainData: "0x",
      compressedData: "0x",
      publicDataHash: "0",
      publicInput: "0",
      blockFee: new BN(0),
      timestamp: exchangeCreationTimestamp,
      internalBlock: undefined,
      transactionHash: Constants.zeroAddress
    };
    this.blocks[exchangeId] = [genesisBlock];

    if (bSetupTestState) {
      await this.registerTokens();
      await this.setupTestState(exchangeId);
    }

    // Deposit some LRC to stake for the exchange
    const depositer = this.testContext.operators[2];
    const stakeAmount = rollupMode
      ? await this.loopringV3.minExchangeStakeRollup()
      : await this.loopringV3.minExchangeStakeValidium();
    await this.setBalanceAndApprove(
      depositer,
      "LRC",
      stakeAmount,
      this.loopringV3.address
    );

    // Stake it
    await this.loopringV3.depositExchangeStake(exchangeId, stakeAmount, {
      from: depositer
    });

    return exchangeId;
  }

  public async syncExplorer() {
    await this.explorer.sync(await web3.eth.getBlockNumber());
  }

  public getTokenAddress(token: string) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    return token;
  }

  public getTokenIdFromNameOrAddress(token: string) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    const tokenID = this.tokenAddressToIDMap.get(token);
    return tokenID;
  }

  public async createMerkleTreeInclusionProof(
    accountID: number,
    token: string
  ) {
    const tokenID = this.getTokenIdFromNameOrAddress(token);

    await this.syncExplorer();
    const explorerExchange = this.explorer.getExchangeById(this.exchangeId);
    explorerExchange.buildMerkleTreeForWithdrawalMode();
    return explorerExchange.getWithdrawFromMerkleTreeData(accountID, tokenID);
  }

  public async withdrawFromMerkleTreeWithProof(
    data: WithdrawFromMerkleTreeData
  ) {
    const tx = await this.exchange.withdrawFromMerkleTree(data);
    logInfo(
      "\x1b[46m%s\x1b[0m",
      "[WithdrawFromMerkleTree] Gas used: " + tx.receipt.gasUsed
    );
  }

  public async withdrawFromMerkleTree(accountID: number, token: string) {
    const proof = await this.createMerkleTreeInclusionProof(accountID, token);
    await this.withdrawFromMerkleTreeWithProof(proof);
  }

  public async setBalanceAndApprove(
    owner: string,
    token: string,
    amount: BN,
    contractAddress?: string
  ) {
    if (contractAddress === undefined) {
      contractAddress = this.depositContract.address;
    }
    const Token = await this.getTokenContract(token);
    if (owner !== this.testContext.deployer) {
      // Burn complete existing balance
      const existingBalance = await this.getOnchainBalance(owner, token);
      await Token.transfer(Constants.zeroAddress, existingBalance, {
        from: owner
      });
    }
    await Token.transfer(owner, amount, { from: this.testContext.deployer });
    await Token.approve(contractAddress, amount, { from: owner });
  }

  public async transferBalance(to: string, token: string, amount: BN) {
    const Token = await this.getTokenContract(token);
    await Token.transfer(to, amount, { from: this.testContext.deployer });
  }

  public evmIncreaseTime(seconds: number) {
    return new Promise((resolve, reject) => {
      web3.currentProvider.send(
        {
          jsonrpc: "2.0",
          method: "evm_increaseTime",
          params: [seconds]
        },
        (err: any, res: any) => {
          return err ? reject(err) : resolve(res);
        }
      );
    });
  }

  public async getMerkleRootOnchain() {
    return await this.exchange.getMerkleRoot();
  }

  public async getNumBlocksOnchain() {
    return (await this.exchange.getBlockHeight()).toNumber();
  }

  public evmMine() {
    return new Promise((resolve, reject) => {
      web3.currentProvider.send(
        {
          jsonrpc: "2.0",
          method: "evm_mine",
          id: Date.now()
        },
        (err: any, res: any) => {
          return err ? reject(err) : resolve(res);
        }
      );
    });
  }

  public async advanceBlockTimestamp(seconds: number) {
    const previousTimestamp = (await web3.eth.getBlock(
      await web3.eth.getBlockNumber()
    )).timestamp;
    await this.evmIncreaseTime(seconds);
    await this.evmMine();
    const currentTimestamp = (await web3.eth.getBlock(
      await web3.eth.getBlockNumber()
    )).timestamp;
    assert(
      Math.abs(currentTimestamp - (previousTimestamp + seconds)) < 60,
      "Timestamp should have been increased by roughly the expected value"
    );
  }

  public async getOffchainBalance(
    exchangeID: number,
    accountID: number,
    tokenID: number
  ) {
    const latestBlockIdx = this.blocks[exchangeID].length - 1;
    const state = await Simulator.loadExchangeState(exchangeID, latestBlockIdx);
    try {
      return state.accounts[accountID].balances[tokenID].balance;
    } catch {
      return new BN(0);
    }
  }

  public async getTokenContract(token: string) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    return await this.contracts.DummyToken.at(token);
  }

  public async getOnchainBalance(owner: string, token: string) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    if (token === Constants.zeroAddress) {
      return new BN(await web3.eth.getBalance(owner));
    } else {
      const Token = await this.contracts.DummyToken.at(token);
      return await Token.balanceOf(owner);
    }
  }

  public async checkOffchainBalance(
    accountID: number,
    tokenID: number,
    expectedBalance: BN,
    desc: string
  ) {
    const balance = await this.getOffchainBalance(
      this.exchangeId,
      accountID,
      tokenID
    );
    assert(
      balance.eq(expectedBalance),
      desc +
        ". " +
        balance.toString(10) +
        " but expected " +
        expectedBalance.toString(10)
    );
  }

  public async randomizeWithdrawalFee() {
    await this.loopringV3.updateSettings(
      await this.loopringV3.protocolFeeVault(),
      await this.loopringV3.blockVerifierAddress(),
      await this.loopringV3.exchangeCreationCostLRC(),
      this.getRandomFee(),
      await this.loopringV3.minExchangeStakeRollup(),
      await this.loopringV3.minExchangeStakeValidium(),
      { from: this.testContext.deployer }
    );
  }

  public async doRandomDeposit(ownerIndex?: number) {
    const orderOwners = this.testContext.orderOwners;
    ownerIndex =
      ownerIndex !== undefined
        ? ownerIndex
        : this.getRandomInt(orderOwners.length);
    const owner = orderOwners[Number(ownerIndex)];
    const amount = this.getRandomAmount();
    const token = this.getTokenAddress("LRC");
    return await this.deposit(owner, owner, token, amount);
  }

  public async doRandomOnchainWithdrawal(deposit: Deposit) {
    return await this.requestWithdrawal(
      deposit.owner,
      deposit.token,
      this.getRandomAmount(),
      "ETH",
      new BN(0),
      { authMethod: AuthMethod.FORCE }
    );
  }

  public async doRandomOffchainWithdrawal(deposit: Deposit) {
    assert(false);
    this.requestWithdrawal(
      deposit.owner,
      deposit.token,
      this.getRandomAmount(),
      "LRC",
      new BN(0)
    );
  }

  public shuffle(a: any[]) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  public async checkExplorerState() {
    // Get the current state
    const numBlocksOnchain = this.blocks[this.exchangeId].length;
    const state = await Simulator.loadExchangeState(
      this.exchangeId,
      numBlocksOnchain - 1
    );

    await this.syncExplorer();
    const exchange = this.explorer.getExchangeById(this.exchangeId);

    // Compare accounts
    assert.equal(
      exchange.getNumAccounts(),
      state.accounts.length,
      "number of accounts does not match"
    );
    for (let accountID = 0; accountID < state.accounts.length; accountID++) {
      const accountA = state.accounts[accountID];
      const accountB = exchange.getAccount(accountID);
      Simulator.compareAccounts(accountA, accountB);
    }

    // Compare blocks
    assert.equal(
      exchange.getNumBlocks(),
      this.blocks[this.exchangeId].length,
      "number of blocks does not match"
    );
    for (let blockIdx = 0; blockIdx < exchange.getNumBlocks(); blockIdx++) {
      //console.log("Testing blockIdx: " + blockIdx);
      const explorerBlock = exchange.getBlock(blockIdx);
      const testBlock = this.blocks[this.exchangeId][blockIdx];
      assert.equal(
        explorerBlock.exchangeId,
        this.exchangeId,
        "unexpected exchangeId"
      );
      assert.equal(
        explorerBlock.blockIdx,
        testBlock.blockIdx,
        "unexpected blockIdx"
      );
      assert.equal(
        explorerBlock.blockType,
        testBlock.blockType,
        "unexpected blockType"
      );
      assert.equal(
        explorerBlock.blockVersion,
        testBlock.blockVersion,
        "unexpected blockVersion"
      );
      assert.equal(explorerBlock.data, testBlock.data, "unexpected data");
      assert.equal(
        explorerBlock.offchainData,
        testBlock.offchainData,
        "unexpected offchainData"
      );
      assert.equal(
        explorerBlock.operator,
        testBlock.operator,
        "unexpected operator"
      );
      assert.equal(explorerBlock.origin, testBlock.origin, "unexpected origin");
      assert(
        explorerBlock.blockFee.eq(testBlock.blockFee),
        "unexpected blockFee"
      );
      assert.equal(
        explorerBlock.timestamp,
        testBlock.timestamp,
        "unexpected timestamp"
      );
      assert.equal(
        explorerBlock.transactionHash,
        testBlock.transactionHash,
        "unexpected transactionHash"
      );
    }

    // Compare deposits
    /*assert.equal(
      exchange.getNumDeposits(),
      this.deposits[this.exchangeId].length,
      "number of deposits does not match"
    );
    for (
      let depositIdx = 0;
      depositIdx < exchange.getNumDeposits();
      depositIdx++
    ) {
      const explorerDeposit = exchange.getDeposit(depositIdx);
      const testDeposit = this.deposits[this.exchangeId][depositIdx];
      assert.equal(
        explorerDeposit.exchangeId,
        testDeposit.exchangeId,
        "unexpected exchangeId"
      );
      assert.equal(
        explorerDeposit.depositIdx,
        testDeposit.depositIdx,
        "unexpected depositIdx"
      );
      assert.equal(
        explorerDeposit.timestamp,
        testDeposit.timestamp,
        "unexpected timestamp"
      );
      assert.equal(
        explorerDeposit.accountID,
        testDeposit.accountID,
        "unexpected accountID"
      );
      assert.equal(
        explorerDeposit.tokenID,
        testDeposit.tokenID,
        "unexpected tokenID"
      );
      assert(
        explorerDeposit.amount.eq(testDeposit.amount),
        "unexpected amount"
      );
      assert.equal(
        explorerDeposit.publicKeyX,
        testDeposit.publicKeyX,
        "unexpected publicKeyX"
      );
      assert.equal(
        explorerDeposit.publicKeyY,
        testDeposit.publicKeyY,
        "unexpected publicKeyY"
      );
    }

    // Compare on-chain withdrawal requests
    assert.equal(
      exchange.getNumOnchainWithdrawalRequests(),
      this.onchainWithdrawals[this.exchangeId].length,
      "number of on-chain withdrawals does not match"
    );
    for (
      let withdrawalIdx = 0;
      withdrawalIdx < exchange.getNumOnchainWithdrawalRequests();
      withdrawalIdx++
    ) {
      const explorerWithdrawal = exchange.getOnchainWithdrawalRequest(
        withdrawalIdx
      );
      const testWithdrawal = this.onchainWithdrawals[this.exchangeId][
        withdrawalIdx
      ];
      assert.equal(
        explorerWithdrawal.exchangeId,
        this.exchangeId,
        "unexpected exchangeId"
      );
      assert.equal(
        explorerWithdrawal.withdrawalIdx,
        testWithdrawal.withdrawalIdx,
        "unexpected withdrawalIdx"
      );
      assert.equal(
        explorerWithdrawal.timestamp,
        testWithdrawal.timestamp,
        "unexpected timestamp"
      );
      assert.equal(
        explorerWithdrawal.accountID,
        testWithdrawal.accountID,
        "unexpected accountID"
      );
      assert.equal(
        explorerWithdrawal.tokenID,
        testWithdrawal.tokenID,
        "unexpected tokenID"
      );
      assert(
        explorerWithdrawal.amountRequested.eq(testWithdrawal.amount),
        "unexpected amountRequested"
      );
    }*/
  }

  public getRandomInt(max: number) {
    return Math.floor(Math.random() * max);
  }

  public getRandomBool() {
    return this.getRandomInt(1000) >= 500;
  }

  public getRandomMemo() {
    const toggle = this.getRandomBool();
    if (toggle) {
      return "0";
    } else {
      return new BN(
        SHA256(Buffer.from("" + this.getRandomInt(1000)), "hex").toString(
          "hex"
        ),
        16
      )
        .shrn(3)
        .toString(10);
    }
  }

  public getRandomAmount() {
    return new BN(web3.utils.toWei("" + this.getRandomInt(100000000) / 1000));
  }

  public getRandomSmallAmount() {
    return new BN(web3.utils.toWei("" + this.getRandomInt(1000) / 1000));
  }

  public getRandomFee() {
    return new BN(web3.utils.toWei("" + this.getRandomInt(10000) / 1000000));
  }

  public async depositExchangeStakeChecked(amount: BN, owner: string) {
    const snapshot = new BalanceSnapshot(this);
    await snapshot.transfer(
      owner,
      this.loopringV3.address,
      "LRC",
      amount,
      "owner",
      "loopringV3"
    );

    const stakeBefore = await this.exchange.getExchangeStake();
    const totalStakeBefore = await this.loopringV3.totalStake();

    await this.loopringV3.depositExchangeStake(this.exchangeId, amount, {
      from: owner
    });

    await snapshot.verifyBalances();

    const stakeAfter = await this.exchange.getExchangeStake();
    const totalStakeAfter = await this.loopringV3.totalStake();

    assert(
      stakeAfter.eq(stakeBefore.add(amount)),
      "Stake should be increased by amount"
    );
    assert(
      totalStakeAfter.eq(totalStakeBefore.add(amount)),
      "Total stake should be increased by amount"
    );

    // Get the ExchangeStakeDeposited event
    const event = await this.assertEventEmitted(
      this.loopringV3,
      "ExchangeStakeDeposited"
    );
    assert.equal(
      event.exchangeId.toNumber(),
      this.exchangeId,
      "exchangeId should match"
    );
    assert(event.amount.eq(amount), "amount should match");
  }

  public async withdrawExchangeStakeChecked(recipient: string, amount: BN) {
    const snapshot = new BalanceSnapshot(this);
    await snapshot.transfer(
      this.loopringV3.address,
      recipient,
      "LRC",
      amount,
      "loopringV3",
      "recipient"
    );

    const stakeBefore = await this.exchange.getExchangeStake();
    const totalStakeBefore = await this.loopringV3.totalStake();

    await this.exchange.withdrawExchangeStake(recipient, {
      from: this.exchangeOwner
    });

    await snapshot.verifyBalances();

    const stakeAfter = await this.exchange.getExchangeStake();
    const totalStakeAfter = await this.loopringV3.totalStake();

    assert(
      stakeBefore.eq(stakeAfter.add(amount)),
      "Stake should be decreased by amount"
    );
    assert(
      totalStakeAfter.eq(totalStakeBefore.sub(amount)),
      "Total stake should be decreased by amount"
    );

    // Get the ExchangeStakeWithdrawn event
    const event = await this.assertEventEmitted(
      this.loopringV3,
      "ExchangeStakeWithdrawn"
    );
    assert.equal(
      event.exchangeId.toNumber(),
      this.exchangeId,
      "exchangeId should match"
    );
    assert(event.amount.eq(amount), "amount should match");
  }

  public async depositProtocolFeeStakeChecked(amount: BN, owner: string) {
    const snapshot = new BalanceSnapshot(this);
    await snapshot.transfer(
      owner,
      this.loopringV3.address,
      "LRC",
      amount,
      "owner",
      "loopringV3"
    );

    const stakeBefore = await this.loopringV3.getProtocolFeeStake(
      this.exchangeId
    );
    const totalStakeBefore = await this.loopringV3.totalStake();

    await this.loopringV3.depositProtocolFeeStake(this.exchangeId, amount, {
      from: owner
    });

    await snapshot.verifyBalances();

    const stakeAfter = await this.loopringV3.getProtocolFeeStake(
      this.exchangeId
    );
    const totalStakeAfter = await this.loopringV3.totalStake();

    assert(
      stakeAfter.eq(stakeBefore.add(amount)),
      "Stake should be increased by amount"
    );
    assert(
      totalStakeAfter.eq(totalStakeBefore.add(amount)),
      "Total stake should be increased by amount"
    );

    // Get the ProtocolFeeStakeDeposited event
    const event = await this.assertEventEmitted(
      this.loopringV3,
      "ProtocolFeeStakeDeposited"
    );
    assert.equal(
      event.exchangeId.toNumber(),
      this.exchangeId,
      "exchangeId should match"
    );
    assert(event.amount.eq(amount), "amount should match");
  }

  public async withdrawProtocolFeeStakeChecked(recipient: string, amount: BN) {
    const snapshot = new BalanceSnapshot(this);
    await snapshot.transfer(
      this.loopringV3.address,
      recipient,
      "LRC",
      amount,
      "loopringV3",
      "recipient"
    );

    const stakeBefore = await this.loopringV3.getProtocolFeeStake(
      this.exchangeId
    );
    const totalStakeBefore = await this.loopringV3.totalStake();

    await this.exchange.withdrawProtocolFeeStake(recipient, amount, {
      from: this.exchangeOwner
    });

    await snapshot.verifyBalances();

    const stakeAfter = await this.loopringV3.getProtocolFeeStake(
      this.exchangeId
    );
    const totalStakeAfter = await this.loopringV3.totalStake();

    assert(
      stakeBefore.eq(stakeAfter.add(amount)),
      "Stake should be decreased by amount"
    );
    assert(
      totalStakeAfter.eq(totalStakeBefore.sub(amount)),
      "Total stake should be decreased by amount"
    );

    // Get the ProtocolFeeStakeWithdrawn event
    const event = await this.assertEventEmitted(
      this.loopringV3,
      "ProtocolFeeStakeWithdrawn"
    );
    assert.equal(
      event.exchangeId.toNumber(),
      this.exchangeId,
      "exchangeId should match"
    );
    assert(event.amount.eq(amount), "amount should match");
  }

  // private functions:
  private async createContractContext() {
    const [
      universalRegistry,
      loopringV3,
      exchange,
      blockVerifier,
      lrcToken,
      wethToken
    ] = await Promise.all([
      this.contracts.UniversalRegistry.deployed(),
      this.contracts.LoopringV3.deployed(),
      this.contracts.ExchangeV3.deployed(),
      this.contracts.BlockVerifier.deployed(),
      this.contracts.LRCToken.deployed(),
      this.contracts.WETHToken.deployed()
    ]);

    const [userStakingPool, protocolFeeVaultContract] = await Promise.all([
      this.contracts.UserStakingPool.deployed(),
      this.contracts.ProtocolFeeVault.deployed()
    ]);

    this.userStakingPool = userStakingPool;
    this.protocolFeeVaultContract = protocolFeeVaultContract;

    this.lzDecompressor = await this.contracts.LzDecompressor.new();

    this.universalRegistry = universalRegistry;
    this.loopringV3 = loopringV3;
    this.exchange = exchange;
    this.blockVerifier = blockVerifier;

    this.lrcAddress = lrcToken.address;
    this.wethAddress = wethToken.address;

    const currBlockNumber = await web3.eth.getBlockNumber();
    const currBlockTimestamp = (await web3.eth.getBlock(currBlockNumber))
      .timestamp;
    return new Context(currBlockNumber, currBlockTimestamp, lrcToken.address);
  }

  private async createExchangeTestContext(accounts: string[]) {
    const tokenSymbolAddrMap = new Map<string, string>();
    const tokenAddrSymbolMap = new Map<string, string>();
    const tokenAddrDecimalsMap = new Map<string, number>();
    const tokenAddrInstanceMap = new Map<string, any>();

    const [eth, weth, lrc, gto, rdn, rep, inda, indb, test] = await Promise.all(
      [
        null,
        this.contracts.WETHToken.deployed(),
        this.contracts.LRCToken.deployed(),
        this.contracts.GTOToken.deployed(),
        this.contracts.RDNToken.deployed(),
        this.contracts.REPToken.deployed(),
        this.contracts.INDAToken.deployed(),
        this.contracts.INDBToken.deployed(),
        this.contracts.TESTToken.deployed()
      ]
    );

    const allTokens = [eth, weth, lrc, gto, rdn, rep, inda, indb, test];

    tokenSymbolAddrMap.set("ETH", Constants.zeroAddress);
    tokenSymbolAddrMap.set("WETH", this.contracts.WETHToken.address);
    tokenSymbolAddrMap.set("LRC", this.contracts.LRCToken.address);
    tokenSymbolAddrMap.set("GTO", this.contracts.GTOToken.address);
    tokenSymbolAddrMap.set("RDN", this.contracts.RDNToken.address);
    tokenSymbolAddrMap.set("REP", this.contracts.REPToken.address);
    tokenSymbolAddrMap.set("INDA", this.contracts.INDAToken.address);
    tokenSymbolAddrMap.set("INDB", this.contracts.INDBToken.address);
    tokenSymbolAddrMap.set("TEST", this.contracts.TESTToken.address);

    for (const token of allTokens) {
      if (token === null) {
        tokenAddrDecimalsMap.set(Constants.zeroAddress, 18);
      } else {
        tokenAddrDecimalsMap.set(token.address, await token.decimals());
      }
    }

    tokenAddrSymbolMap.set(Constants.zeroAddress, "ETH");
    tokenAddrSymbolMap.set(this.contracts.WETHToken.address, "WETH");
    tokenAddrSymbolMap.set(this.contracts.LRCToken.address, "LRC");
    tokenAddrSymbolMap.set(this.contracts.GTOToken.address, "GTO");
    tokenAddrSymbolMap.set(this.contracts.RDNToken.address, "RDN");
    tokenAddrSymbolMap.set(this.contracts.REPToken.address, "REP");
    tokenAddrSymbolMap.set(this.contracts.INDAToken.address, "INDA");
    tokenAddrSymbolMap.set(this.contracts.INDBToken.address, "INDB");
    tokenAddrSymbolMap.set(this.contracts.TESTToken.address, "TEST");

    tokenAddrInstanceMap.set(Constants.zeroAddress, null);
    tokenAddrInstanceMap.set(this.contracts.WETHToken.address, weth);
    tokenAddrInstanceMap.set(this.contracts.LRCToken.address, lrc);
    tokenAddrInstanceMap.set(this.contracts.GTOToken.address, gto);
    tokenAddrInstanceMap.set(this.contracts.RDNToken.address, rdn);
    tokenAddrInstanceMap.set(this.contracts.REPToken.address, rep);
    tokenAddrInstanceMap.set(this.contracts.INDAToken.address, inda);
    tokenAddrInstanceMap.set(this.contracts.INDBToken.address, indb);
    tokenAddrInstanceMap.set(this.contracts.TESTToken.address, test);

    const deployer = accounts[0];
    const stateOwners = accounts.slice(1, 5);
    const operators = accounts.slice(5, 10);
    const orderOwners = accounts.slice(10, 20);
    const wallets = accounts.slice(20, 30);
    const ringMatchers = accounts.slice(30, 40);
    const feeRecipients = accounts.slice(40, 50);

    return new ExchangeTestContext(
      deployer,
      stateOwners,
      operators,
      orderOwners,
      wallets,
      ringMatchers,
      feeRecipients,
      tokenSymbolAddrMap,
      tokenAddrSymbolMap,
      tokenAddrDecimalsMap,
      tokenAddrInstanceMap,
      allTokens
    );
  }

  private getBestBlockSize(count: number, blockSizes: number[]) {
    let blockSize = blockSizes[0];
    let i = 1;
    while (count > blockSize && i < blockSizes.length) {
      blockSize = blockSizes[i];
      i++;
    }
    return blockSize;
  }
}

export class BalanceSnapshot {
  private exchangeTestUtil: ExchangeTestUtil;
  private balances: Map<string, BN>[] = [];
  private addressBook: Map<string, string>;

  constructor(util: ExchangeTestUtil) {
    this.exchangeTestUtil = util;
    for (let i = 0; i < this.exchangeTestUtil.MAX_NUM_TOKENS; i++) {
      this.balances[i] = new Map<string, BN>();
    }
    this.addressBook = new Map<string, string>();
  }

  public async watchBalance(owner: string, token: string, name?: string) {
    const tokenID = await this.exchangeTestUtil.getTokenID(token);
    const balance = await this.exchangeTestUtil.getOnchainBalance(owner, token);
    if (!this.balances[tokenID].has(owner)) {
      this.balances[tokenID].set(owner, balance);
    }
    if (name !== undefined) {
      this.addressBook.set(owner, name);
    }
  }

  public async transfer(
    from: string,
    to: string,
    token: string,
    amount: BN,
    fromName?: string,
    toName?: string
  ) {
    const tokenID = await this.exchangeTestUtil.getTokenID(token);
    if (!this.balances[tokenID].has(from)) {
      await this.watchBalance(from, token, fromName);
    }
    if (!this.balances[tokenID].has(to)) {
      await this.watchBalance(to, token, toName);
    }
    //const symbol = this.exchangeTestUtil.testContext.tokenAddrSymbolMap.get(this.exchangeTestUtil.getTokenAddress(token));
    const balanceFrom = this.balances[tokenID].get(from);
    const balanceTo = this.balances[tokenID].get(to);
    //console.log(
    //  amount.toString(10) + symbol + " from " +
    //  this.addressBook.get(from) + " (" + balanceFrom.toString(10) + ") to " +
    //  this.addressBook.get(to) + " (" + balanceTo.toString(10) + ").");
    this.balances[tokenID].set(from, balanceFrom.sub(amount));
    this.balances[tokenID].set(to, balanceTo.add(amount));
  }

  public async verifyBalances(allowedDelta: BN = new BN(0)) {
    for (let i = 0; i < this.exchangeTestUtil.MAX_NUM_TOKENS; i++) {
      for (const [owner, balance] of this.balances[i].entries()) {
        const token = this.exchangeTestUtil.getTokenAddressFromID(i);
        const symbol = this.exchangeTestUtil.testContext.tokenAddrSymbolMap.get(
          this.exchangeTestUtil.getTokenAddress(token)
        );
        const currentBalance = await this.exchangeTestUtil.getOnchainBalance(
          owner,
          token
        );
        const ownerName = this.addressBook.get(owner);
        let descr = symbol + " balance of " + ownerName + " does not match: ";
        descr += currentBalance.toString(10) + " != " + balance.toString(10);
        assert(
          balance
            .sub(currentBalance)
            .abs()
            .lte(allowedDelta),
          descr
        );
      }
    }
  }
}
