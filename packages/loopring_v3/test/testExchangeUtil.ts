import BN = require("bn.js");
import childProcess = require("child_process");
import fs = require("fs");
import path = require("path");
import http = require("http");
import { performance } from "perf_hooks";
import { SHA256 } from "sha2";
import util = require("util");
import { calculateCalldataCost, compressLZ, decompressLZ } from "./compression";
import { Artifacts } from "../util/Artifacts";
import {
  SignatureType,
  sign,
  verifySignature
} from "../util/Signature";
import { compress, CompressionType } from "./compression";
import {
  Bitstream,
  BlockType,
  Constants,
  EdDSA,
  Explorer,
  roundToFloatValue,
  toFloat,
  Poseidon,
  WithdrawFromMerkleTreeData
} from "loopringV3.js";
import { Context } from "./context";
import { expectThrow } from "./expectThrow";
import { doDebugLogging, logDebug, logInfo } from "./logs";
import * as sigUtil from 'eth-sig-util';
import { Simulator } from "./simulator";
import { ExchangeTestContext } from "./testExchangeContext";
import {
  Account,
  Block,
  Deposit,
  Transfer,
  Noop,
  OrderInfo,
  TxBlock,
  PublicKeyUpdate,
  SpotTrade,
  WithdrawalRequest,
  NewAccount,
  Wallet,
  Guardian,
  OwnerChange,
  PermissionData
} from "./types";
import { OffchainWithdrawal } from "loopringV3.js";


type TxType = Noop | SpotTrade | Transfer | WithdrawalRequest | Deposit | PublicKeyUpdate | NewAccount | OwnerChange;

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
    name === "ownerFrom" ||
    name === "ownerTo" ||
    name === "payerOwnerTo" ||
    name === "to"
  ) {
    return new BN(val.slice(2), 16).toString(10);
  }else {
    return val;
  }
}

export interface TransferOptions {
  conditionalTransfer?: boolean;
  useDualAuthoring?: boolean;
  useOnchainSignature?: boolean;
  autoApprove?: boolean;
  amountToDeposit?: BN;
  feeToDeposit?: BN;
  transferToNew?: boolean;
  signer?: string;
}

export interface OnchainBlock {
  blockType: number;
  blockSize: number;
  blockVersion: number;
  data: any;
  proof: any;
  auxiliaryData?: any;
  offchainData?: any;
}

export interface AuxiliaryData {
  txIndex: number;
  txAuxiliaryData?: any;
}

export namespace PublicKeyUpdateUtils {
  export function toTypedData(update: PublicKeyUpdate, verifyingContract: string) {
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" }
        ],
        PublicKeyUpdate: [
          { name: "owner", type: "address" },
          { name: "accountID", type: "uint24" },
          { name: "nonce", type: "uint32" },
          { name: "publicKey", type: "uint256" },
          { name: "feeTokenID", type: "uint16" },
          { name: "fee", type: "uint256" }
        ]
      },
      primaryType: "PublicKeyUpdate",
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
        feeTokenID: update.feeTokenID,
        fee: update.fee
      }
    };
    return typedData;
  }

  export function getHash(update: PublicKeyUpdate, verifyingContract: string) {
    const typedData = this.toTypedData(update, verifyingContract);
    return sigUtil.TypedDataUtils.sign(typedData);
  }
}

export namespace WithdrawalUtils {
  export function toTypedData(withdrawal: WithdrawalRequest, verifyingContract: string) {
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
          { name: "to", type: "address" }
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
        to: withdrawal.to
      }
    };
    return typedData;
  }

  export function getHash(withdrawal: WithdrawalRequest, verifyingContract: string) {
    const typedData = this.toTypedData(withdrawal, verifyingContract);
    return sigUtil.TypedDataUtils.sign(typedData);
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
          //{ name: "fromAccountID", type: "uint24" },
          //{ name: "toAccountID", type: "uint24" },
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
        from: transfer.ownerFrom,
        to: transfer.ownerTo,
        tokenID: transfer.tokenID,
        amount: transfer.amount,
        feeTokenID: transfer.feeTokenID,
        fee: transfer.fee,
        //fromAccountID: transfer.accountFromID,
        //toAccountID: transfer.accountToID,
        nonce: transfer.nonce
      }
    };
    return typedData;
  }

  export function getHash(transfer: Transfer, verifyingContract: string) {
    const typedData = this.toTypedData(transfer, verifyingContract);
    return sigUtil.TypedDataUtils.sign(typedData);
  }
}

export namespace WalletUtils {
  export function toTypedDataStatelessWallet(wallet: Wallet, verifyingContract: string) {
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

  export function toTypedDataWallet(walletAddress: string, walletDataHash: string, verifyingContract: string) {
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" }
        ],
        Wallet: [
          { name: "walletAddress", type: "address" },
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
        walletAddress,
        walletDataHash
      }
    };
    return typedData;
  }


  export function getWalletHash(wallet: Wallet, verifyingContract: string) {
    /*const utils = sigUtil.TypedDataUtils;
    const privateKey = SHA256(Buffer.from("FF"), "hex");
    const message = "0x" + utils.sign(typedData).toString("hex");
    const sig = sigUtil.signTypedData_v4(privateKey, { data: typedData });
    console.log(message);
    console.log(sig);*/
    //const typedData = this.toTypedData(wallet, verifyingContract);
    //const hash = "0x" + sigUtil.TypedDataUtils.sign(typedData).toString("hex");
    //return hash;
    const typedData = this.toTypedDataStatelessWallet(wallet, verifyingContract);
    return sigUtil.TypedDataUtils.sign(typedData);
  }

  export function getHash(wallet: Wallet, walletAddress: string, verifyingContract: string) {
    /*const utils = sigUtil.TypedDataUtils;
    const privateKey = SHA256(Buffer.from("FF"), "hex");
    const message = "0x" + utils.sign(typedData).toString("hex");
    const sig = sigUtil.signTypedData_v4(privateKey, { data: typedData });
    console.log(message);
    console.log(sig);*/
    //const typedData = this.toTypedData(wallet, verifyingContract);
    //const hash = "0x" + sigUtil.TypedDataUtils.sign(typedData).toString("hex");
    //return hash;
    const walletDataHash = "0x" + this.getWalletHash(wallet, walletAddress).toString("hex");
    const typedData = this.toTypedDataWallet(walletAddress, walletDataHash, verifyingContract);
    return sigUtil.TypedDataUtils.sign(typedData);
  }
}

export namespace OwnerChangeUtils {
  export function toTypedData(ownerChange: OwnerChange, verifyingContract: string) {
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
          { name: "walletAddress", type: "address" },
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
        owner: ownerChange.owner,
        accountID: ownerChange.accountID,
        feeTokenID: ownerChange.feeTokenID,
        fee: ownerChange.fee,
        newOwner: ownerChange.newOwner,
        nonce: ownerChange.nonce,
        walletAddress: ownerChange.walletAddress,
        walletDataHash: ownerChange.walletDataHash,
        walletCalldata: ownerChange.walletCalldata
      }
    };
    return typedData;
  }

  export function getHash(ownerChange: OwnerChange, verifyingContract: string) {
    const typedData = this.toTypedData(ownerChange, verifyingContract);
    return sigUtil.TypedDataUtils.sign(typedData);
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

  public exchangeConstants: any;
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
  public MAX_OPEN_DEPOSIT_REQUESTS: number;
  public MAX_OPEN_WITHDRAWAL_REQUESTS: number;
  public MAX_AGE_REQUEST_UNTIL_FORCED: number;
  public MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE: number;
  public MAX_TIME_IN_SHUTDOWN_BASE: number;
  public MAX_TIME_IN_SHUTDOWN_DELTA: number;
  public TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS: number;
  public MAX_NUM_TOKENS: number;
  public MAX_NUM_TOKEN_IDS: number;
  public MAX_NUM_ACCOUNTS: number;
  public MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED: number;
  public GAS_LIMIT_SEND_TOKENS: number;

  public tokenAddressToIDMap = new Map<string, number>();
  public tokenIDToAddressMap = new Map<number, string>();

  public contracts = new Artifacts(artifacts);

  public pendingBlocks: Block[][] = [];

  public onchainDataAvailability = true;
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
      new BN(web3.utils.toWei("2000", "ether")),
      new BN(web3.utils.toWei("1", "ether")),
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
      const dummyAccountA: Account = {
        accountID: 2,
        owner: Constants.zeroAddress,
        publicKeyX: "0",
        publicKeyY: "0",
        secretKey: "0",
        nonce: 0
      };
      const dummyAccountB: Account = {
        accountID: 3,
        owner: Constants.zeroAddress,
        publicKeyX: "0",
        publicKeyY: "0",
        secretKey: "0",
        nonce: 0
      };
      this.accounts.push([protocolFeeAccount, indexAccount, dummyAccountA, dummyAccountB]);
    }

    await this.createExchange(
      this.testContext.deployer,
      true,
      this.onchainDataAvailability
    );

    const constants = await this.exchangeConstants.getConstants();
    this.SNARK_SCALAR_FIELD = new BN(constants[0]);
    this.MAX_OPEN_DEPOSIT_REQUESTS = constants[1].toNumber();
    this.MAX_OPEN_WITHDRAWAL_REQUESTS = constants[2].toNumber();
    this.MAX_AGE_REQUEST_UNTIL_FORCED = constants[3].toNumber();
    this.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE = constants[4].toNumber();
    this.MAX_TIME_IN_SHUTDOWN_BASE = constants[5].toNumber();
    this.MAX_TIME_IN_SHUTDOWN_DELTA = constants[6].toNumber();
    this.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS = constants[7].toNumber();
    this.MAX_NUM_TOKENS = constants[8].toNumber();
    this.MAX_NUM_TOKEN_IDS = 1024;
    this.MAX_NUM_ACCOUNTS = constants[9].toNumber();
    this.MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED = constants[12].toNumber();
    this.GAS_LIMIT_SEND_TOKENS = constants[13].toNumber();
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
    // Fill in defaults
    const amountToDeposit = options.amountToDeposit
      ? options.amountToDeposit
      : amount;
    const feeToDeposit = options.feeToDeposit ? options.feeToDeposit : fee;
    const conditionalTransfer =
      options.conditionalTransfer !== undefined
        ? options.conditionalTransfer
        : false;
    const useDualAuthoring =
        options.useDualAuthoring !== undefined
          ? options.useDualAuthoring
          : false;
    const useOnchainSignature =
        options.useOnchainSignature !== undefined
          ? options.useOnchainSignature
          : false;
    const autoApprove =
      options.autoApprove !== undefined ? options.autoApprove : true;
    const transferToNew =
      options.transferToNew !== undefined ? options.transferToNew : false;
    const signer =
      options.signer !== undefined ? options.signer : from;

    // From
    await this.deposit(from, from, token, amountToDeposit);
    await this.deposit(from, from, feeToken, feeToDeposit);

    // To
    let accountToID = this.findAccount(to).accountID;
    if (!transferToNew) {
      if (accountToID === undefined) {
        await this.deposit(to, to, token, new BN(0));
        accountToID = this.findAccount(to).accountID;
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
      accountToID = account.accountID;
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
    const accountFromID = this.findAccount(from).accountID;
    const transfer: Transfer = {
      txType: "Transfer",
      accountFromID,
      accountToID,
      tokenID,
      amount,
      feeTokenID,
      fee,
      ownerFrom: from,
      ownerTo: to,
      type: conditionalTransfer ? 1 : 0,
      validUntil: 0xFFFFFFFF,
      dualAuthorX,
      dualAuthorY,
      payerAccountToID: useDualAuthoring ? 0 : accountToID,
      payerOwnerTo: useDualAuthoring ? Constants.zeroAddress : to,
      payeeAccountToID: accountToID,
      nonce: this.accounts[this.exchangeId][accountFromID].nonce++,
      dualSecretKey
    };

    // Authorize the tx someway
    if (transfer.type === 0) {
      this.signTransfer(transfer, true);
      if (useDualAuthoring) {
        this.signTransfer(transfer, false);
      }
    } else {
      if (useOnchainSignature) {
        const hash = TransferUtils.getHash(transfer, this.exchange.address);
        transfer.onchainSignature = await sign(signer, hash, SignatureType.EIP_712);
        await verifySignature(signer, hash, transfer.onchainSignature);
      } else if (autoApprove) {
        //await this.approveOffchainTransfer(from, to, token, amount);
        const txHash = TransferUtils.getHash(transfer, this.exchange.address);
        await this.exchange.approveTransaction(signer, txHash, {from: signer});
      }
    }

    this.pendingTransactions[this.exchangeId].push(transfer);

    return transfer;
  };

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
        (await web3.eth.getBlock(blockNumber)).timestamp +
        this.MAX_AGE_REQUEST_UNTIL_FORCED * 2 +
        100;
    }

    order.exchangeID =
      order.exchangeID !== undefined ? order.exchangeID : this.exchangeId;

    order.buy = order.buy !== undefined ? order.buy : true;

    order.maxFeeBips = order.maxFeeBips !== undefined ? order.maxFeeBips : 20;
    order.allOrNone = order.allOrNone ? order.allOrNone : false;

    order.feeBips =
      order.feeBips !== undefined ? order.feeBips : order.maxFeeBips;
    order.rebateBips = order.rebateBips !== undefined ? order.rebateBips : 0;

    order.orderID = order.orderID !== undefined ? order.orderID : index;

    order.exchangeID = order.exchangeID !== undefined ? order.exchangeID : 0;

    order.tokenIdS = this.tokenAddressToIDMap.get(order.tokenS);
    order.tokenIdB = this.tokenAddressToIDMap.get(order.tokenB);

    assert(order.maxFeeBips < 64, "maxFeeBips >= 64");
    assert(order.feeBips < 64, "feeBips >= 64");
    assert(order.rebateBips < 64, "rebateBips >= 64");

    order.transferAmountTrade = order.transferAmountTrade !== undefined ? order.transferAmountTrade : new BN(0);
    order.reduceOnly = order.reduceOnly !== undefined ? order.reduceOnly : false;
    order.triggerPrice = order.triggerPrice !== undefined ? order.triggerPrice : new BN(0);

    order.transferAmount = order.transferAmount !== undefined ? order.transferAmount : new BN(0);
    order.transferFee = order.transferFee !== undefined ? order.transferFee : new BN(0);

    // setup initial balances:
    await this.setOrderBalances(order);

    // Sign the order
    this.signOrder(order);
  }

  public signOrder(order: OrderInfo) {
    if (order.signature !== undefined) {
      return;
    }

    const hasher = Poseidon.createHash(13, 6, 53);
    const account = this.accounts[this.exchangeId][order.accountID];

    //console.log(order);

    // Calculate hash
    const startHash = performance.now();
    const inputs = [
      this.exchangeId,
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
    const endHash = performance.now();
    // console.log("Hash order time: " + (endHash - startHash));

    // Create signature
    const startSign = performance.now();
    order.signature = EdDSA.sign(account.secretKey, order.hash);
    const endSign = performance.now();
    // console.log("Sign order time: " + (endSign - startSign));

    // Verify signature
    const startVerify = performance.now();
    const success = EdDSA.verify(order.hash, order.signature, [
      account.publicKeyX,
      account.publicKeyY
    ]);
    assert(success, "Failed to verify signature");
    const endVerify = performance.now();
    // console.log("Verify order signature time: " + (endVerify - startVerify));
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

  public signWithdrawal(withdrawal: WithdrawalRequest) {
    const hasher = Poseidon.createHash(8, 6, 53);
    const account = this.accounts[this.exchangeId][withdrawal.accountID];

    // Calculate hash
    const inputs = [
      this.exchangeId,
      withdrawal.accountID,
      withdrawal.tokenID,
      withdrawal.amount,
      withdrawal.feeTokenID,
      withdrawal.fee,
      withdrawal.nonce
    ];
    const hash = hasher(inputs).toString(10);

    // Create signature
    withdrawal.signature = EdDSA.sign(account.secretKey, hash);

    // Verify signature
    const success = EdDSA.verify(hash, withdrawal.signature, [
      account.publicKeyX,
      account.publicKeyY
    ]);
    assert(success, "Failed to verify signature");
  }

  public signTransfer(transfer: Transfer, payer: boolean = true) {
    const hasher = Poseidon.createHash(13, 6, 53);
    // Calculate hash
    const inputs = [
      this.exchangeId,
      transfer.accountFromID,
      payer ? transfer.payerAccountToID : transfer.accountToID,
      transfer.tokenID,
      transfer.amount,
      transfer.feeTokenID,
      transfer.fee,
      transfer.validUntil,
      payer ? transfer.payerOwnerTo : transfer.ownerTo,
      transfer.dualAuthorX,
      transfer.dualAuthorY,
      transfer.nonce
    ];
    const hash = hasher(inputs).toString(10);

    // Create signature
    if (payer) {
      const account = this.accounts[this.exchangeId][transfer.accountFromID];
      transfer.signature = EdDSA.sign(account.secretKey, hash);
      // Verify signature
      const success = EdDSA.verify(hash, transfer.signature, [
        account.publicKeyX,
        account.publicKeyY
      ]);
      assert(success, "Failed to verify signature");
    } else {
      transfer.dualSignature = EdDSA.sign(transfer.dualSecretKey, hash);
      // Verify signature
      const success = EdDSA.verify(hash, transfer.dualSignature, [
        transfer.dualAuthorX,
        transfer.dualAuthorY
      ]);
      assert(success, "Failed to verify dual signature");
    }
  }

  public signNewAccount(create: NewAccount) {
    // Calculate hash
    const hasher = Poseidon.createHash(10, 6, 53);
    const inputs = [
      this.exchangeId,
      create.payerAccountID,
      create.feeTokenID,
      create.fee,
      create.nonce,
      create.newAccountID,
      create.newOwner,
      create.newPublicKeyX,
      create.newPublicKeyY
    ];
    const hash = hasher(inputs).toString(10);

    // Create signature
    const account = this.accounts[this.exchangeId][create.payerAccountID];
    create.signature = EdDSA.sign(account.secretKey, hash);

    // Verify signature
    const success = EdDSA.verify(hash, create.signature, [
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
    let publicKeyUpdate: PublicKeyUpdate = undefined;
    if (accountID === undefined) {
      let keyPair = this.getKeyPairEDDSA();
      if (!autoSetKeys) {
        keyPair = {
          publicKeyX: "0",
          publicKeyY: "0",
          secretKey: "0",
        }
      }
      const account: Account = {
        accountID: this.accounts[this.exchangeId].length,
        owner: to,
        publicKeyX: keyPair.publicKeyX,
        publicKeyY: keyPair.publicKeyY,
        secretKey: keyPair.secretKey,
        nonce: 0
      };
      this.accounts[this.exchangeId].push(account);
      accountID = account.accountID;

      if (autoSetKeys) {
        publicKeyUpdate = {
          txType: "PublicKeyUpdate",
          owner: to,
          accountID: account.accountID,
          nonce: this.accounts[this.exchangeId][account.accountID].nonce++,
          publicKeyX: keyPair.publicKeyX,
          publicKeyY: keyPair.publicKeyY,
          walletHash: "0",
          feeTokenID: tokenID,
          fee: new BN(0)
        };
      }
    }

    let ethToSend = fee;
    if (amount.gt(0)) {
      if (token !== Constants.zeroAddress) {
        const Token = this.testContext.tokenAddrInstanceMap.get(token);
        await Token.setBalance(from, amount);
        await Token.approve(this.depositContract.address, amount, {from});
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
      callerEthBalanceAfter.eq(
        callerEthBalanceBefore.sub(ethToSend)
      ),
      "fee paid by the depositer needs to match exactly with the fee needed"
    );

    const event = await this.assertEventEmitted(
      this.exchange,
      "DepositRequested"
    );
    const index = event.index;
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

    if (publicKeyUpdate !== undefined) {
      // Sign the public key update
      const hash = PublicKeyUpdateUtils.getHash(publicKeyUpdate, this.exchange.address);
      publicKeyUpdate.onchainSignature = await sign(to, hash, SignatureType.EIP_712);
      await verifySignature(to, hash, publicKeyUpdate.onchainSignature);

      this.pendingTransactions[this.exchangeId].push(publicKeyUpdate);
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
    type: number = 0,
    to?: string
  ) {
    if (to === undefined) {
      to = owner;
    }
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    const tokenID = this.tokenAddressToIDMap.get(token);
    if (!feeToken.startsWith("0x")) {
      feeToken = this.testContext.tokenSymbolAddrMap.get(feeToken);
    }

    const accountID = this.getAccountID(owner);

    if (type > 1) {
      const sender = (type === 2) ? owner : this.exchangeOwner;
      // Force the operator to include the withdrawal
      const withdrawalFee = await this.loopringV3.forcedWithdrawalFee();
      await this.exchange.forceWithdraw(sender, token, accountID, {from: sender, value: withdrawalFee});
    }

    if (type == 0 || type == 1) {
      this.accounts[this.exchangeId][accountID].nonce++;
    }

    const feeTokenID = this.tokenAddressToIDMap.get(feeToken);
    const withdrawalRequest: WithdrawalRequest = {
      txType: "Withdraw",
      type,
      owner,
      accountID,
      nonce: this.accounts[this.exchangeId][accountID].nonce,
      tokenID,
      amount,
      feeTokenID,
      fee,
      to,
      withdrawalFee: await this.loopringV3.forcedWithdrawalFee()
    };

    if (type === 0) {
      this.signWithdrawal(withdrawalRequest);
    } else if (type === 1) {
      const hash = WithdrawalUtils.getHash(withdrawalRequest, this.exchange.address);
      withdrawalRequest.onchainSignature = await sign(owner, hash, SignatureType.EIP_712);
      await verifySignature(owner, hash, withdrawalRequest.onchainSignature);
    }

    this.pendingTransactions[this.exchangeId].push(withdrawalRequest);
    return withdrawalRequest;
  }

  /*public async requestWithdrawalOnchain(
    exchangeID: number,
    accountID: number,
    token: string,
    amount: BN,
    owner: string
  ) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    const tokenID = this.tokenAddressToIDMap.get(token);

    /*let numAvailableSlots = (await this.exchange.getNumAvailableWithdrawalSlots()).toNumber();
    if (this.autoCommit && numAvailableSlots === 0) {
      await this.commitOnchainWithdrawalRequests(exchangeID);
      numAvailableSlots = (await this.exchange.getNumAvailableWithdrawalSlots()).toNumber();
      assert(numAvailableSlots > 0, "numAvailableSlots > 0");
    }*/
   /* const withdrawalFee = await this.loopringV3.forcedWithdrawalFee();

    const feeSurplus = new BN(456);
    const ethToSend = withdrawalFee.add(feeSurplus);

    const caller = accountID === 0 ? this.exchangeOwner : owner;

    const callerEthBalanceBefore = await this.getOnchainBalance(
      caller,
      Constants.zeroAddress
    );

    // Submit the withdraw request
    let tx;
    if (accountID === 0) {
      tx = await this.exchange.withdrawProtocolFees(token, {
        from: caller,
        value: ethToSend,
        gasPrice: 0
      });
      amount = new BN(2);
      amount = amount.pow(new BN(96)).sub(new BN(1));
    } else {
      tx = await this.exchange.withdraw(owner, token, web3.utils.toBN(amount), {
        from: caller,
        value: ethToSend,
        gasPrice: 0
      });
    }
    const ethBlock = await web3.eth.getBlock(tx.receipt.blockNumber);
    // logInfo("\x1b[46m%s\x1b[0m", "[WithdrawRequest] Gas used: " + tx.receipt.gasUsed);

    // Check if the correct fee amount was paid
    const callerEthBalanceAfter = await this.getOnchainBalance(
      caller,
      Constants.zeroAddress
    );
    assert(
      callerEthBalanceAfter.eq(
        callerEthBalanceBefore.sub(ethToSend).add(feeSurplus)
      ),
      "fee paid by the withdrawer needs to match exactly with the fee needed"
    );

    const event = await this.assertEventEmitted(
      this.exchange,
      "WithdrawalRequested"
    );

    const withdrawalRequest = await this.addWithdrawalRequest(
      this.pendingTransactions[exchangeID],
      accountID,
      tokenID,
      amount,
      0,
      new BN(0),
      1,
      withdrawalFee
    );
    withdrawalRequest.timestamp = ethBlock.timestamp;
    withdrawalRequest.transactionHash = tx.receipt.transactionHash;
    //this.onchainWithdrawals[this.exchangeId].push(withdrawalRequest);
    return withdrawalRequest;
  }*/

  public async requestNewAccount(
    payerAccountID: number,
    feeToken: string,
    fee: BN,
    newOwner: string
  ) {
    if (!feeToken.startsWith("0x")) {
      feeToken = this.testContext.tokenSymbolAddrMap.get(feeToken);
    }
    const feeTokenID = this.tokenAddressToIDMap.get(feeToken);

    const guardians: Guardian[] = [{addr: newOwner, group: 1}];
    guardians.push({addr: newOwner, group: 0});
    const wallet: Wallet = {
      accountID: this.accounts[this.exchangeId].length,
      guardians,
      inheritor: newOwner,
      inheritableSince: 0
    };
    const walletHash = WalletUtils.getHash(wallet, this.statelessWallet.address, this.exchange.address);
    console.log(walletHash);
    console.log(this.hashToFieldElement("0x" + walletHash.toString("hex")));

    const keypair = this.getKeyPairEDDSA();
    const account: Account = {
      accountID: this.accounts[this.exchangeId].length,
      owner: newOwner,
      publicKeyX: keypair.publicKeyX,
      publicKeyY: keypair.publicKeyY,
      secretKey: keypair.secretKey,
      wallet,
      nonce: 0
    };
    this.accounts[this.exchangeId].push(account);

    const newAccount: NewAccount = {
      txType: "NewAccount",
      payerAccountID,
      feeTokenID,
      fee,
      nonce: this.accounts[this.exchangeId][payerAccountID].nonce++,
      newOwner,
      newAccountID: account.accountID,
      newPublicKeyX: account.publicKeyX,
      newPublicKeyY: account.publicKeyY,
      newWalletHash: this.hashToFieldElement("0x" + walletHash.toString("hex"))
    };
    this.signNewAccount(newAccount);

    this.pendingTransactions[this.exchangeId].push(newAccount);
    return newAccount;
  }

  public async requestOwnerChange(
    owner: string,
    newOwner: string,
    feeToken: string,
    fee: BN,
  ) {
    if (!feeToken.startsWith("0x")) {
      feeToken = this.testContext.tokenSymbolAddrMap.get(feeToken);
    }
    const feeTokenID = this.tokenAddressToIDMap.get(feeToken);

    const account = this.findAccount(owner);

    const walletHash = WalletUtils.getHash(account.wallet, this.statelessWallet.address, this.exchange.address);
    const walletDataHash = WalletUtils.getWalletHash(account.wallet, this.statelessWallet.address);

    const permissionData: PermissionData = {signers: [], signatures: []};

    const testResult = await this.statelessWallet.recover(
      account.accountID,
      account.nonce,
      owner,
      newOwner,
      "0x" + walletDataHash.toString("hex"),
      account.wallet,
      permissionData
    );
    console.log(testResult);

    console.log("Stateless wallet: " + this.statelessWallet.address);
    console.log("walletHash: " + walletHash.toString("hex"));
    console.log("walletDataHash: " + walletDataHash.toString("hex"));

    const walletCalldata = this.statelessWallet.contract.methods.recover(
      account.accountID,
      account.nonce,
      owner,
      newOwner,
      "0x" + walletDataHash.toString("hex"),
      account.wallet,
      permissionData
    ).encodeABI();
    console.log(walletCalldata);

    const ownerChange: OwnerChange = {
      txType: "OwnerChange",
      owner,
      accountID: account.accountID,
      feeTokenID,
      fee,
      walletHash: this.hashToFieldElement("0x" + walletHash.toString("hex")),
      nonce: account.nonce++,
      newOwner,
      walletAddress: this.statelessWallet.address,
      walletDataHash: "0x" + walletDataHash.toString("hex"),
      walletCalldata
    };

    const hash = OwnerChangeUtils.getHash(ownerChange, this.exchange.address);
    ownerChange.onchainSignatureNewOwner = await sign(newOwner, hash, SignatureType.EIP_712);
    await verifySignature(newOwner, hash, ownerChange.onchainSignatureNewOwner);

    this.pendingTransactions[this.exchangeId].push(ownerChange);
    return ownerChange;
  }

  public sendRing(exchangeID: number, ring: SpotTrade) {
    ring.txType = "SpotTrade";
    this.pendingTransactions[exchangeID].push(ring);
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
    blockType: number,
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
    const fieldHash = new BN(hash.slice(2), 16)
      .shrn(3)
      .toString(10);
    return fieldHash;
  }

  public getPublicDataHashAndInput(data: string) {
    const publicDataHash =
      "0x" + SHA256(Buffer.from(data.slice(2), "hex")).toString("hex");
    return { publicDataHash, publicInput: this.hashToFieldElement(publicDataHash) };
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
    auxiliaryData: string = "0x",
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
      blockFeeRewarded: new BN(0),
      blockFeeFined: new BN(0),
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
    block.onchainDataAvailability = this.onchainDataAvailability;
    fs.writeFileSync(
      blockFilename,
      JSON.stringify(block, undefined, 4),
      "ascii"
    );

    const isCircuitRegistered = await this.blockVerifier.isCircuitRegistered(
      block.blockType,
      block.onchainDataAvailability,
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
      verificationKeyFilename += block.onchainDataAvailability ? "_DA_" : "_";
      verificationKeyFilename += block.blockSize + "_vk.json";

      // Read the verification key and set it in the smart contract
      const vk = JSON.parse(fs.readFileSync(verificationKeyFilename, "ascii"));
      const vkFlattened = this.flattenList(this.flattenVK(vk));
      // console.log(vkFlattened);

      await this.blockVerifier.registerCircuit(
        block.blockType,
        block.onchainDataAvailability,
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
    key |= this.onchainDataAvailability ? 1 : 0;
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
        blockData.exchangeID +
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
        offchainData: web3.utils.hexToBytes(block.offchainData),
        auxiliaryData: web3.utils.hexToBytes(block.auxiliaryData)
      };
      onchainBlocks.push(onchainBlock);
    }

    // Callback that allows modifying the blocks
    if (callback !== undefined) {
      callback(onchainBlocks);
    }

    const numBlocksSubmittedBefore = (await this.exchange.getBlockHeight()).toNumber();

    // Simulate the Conditional transfers on the approvals
    const approvalsSnapshot = new ApprovalsSnapshot(this);
    /*for (const block of blocks) {
      if (block.blockType === BlockType.INTERNAL_TRANSFER) {
        const transferBlock: Block = block.internalBlock;
        for (const transfer of transferBlock.transfers) {
          if (transfer.type === 1) {
            approvalsSnapshot.transfer(
              transfer.accountFromID,
              transfer.accountToID,
              transfer.tokenID,
              transfer.amount
            );
            approvalsSnapshot.transfer(
              transfer.accountFromID,
              transferBlock.operatorAccountID,
              transfer.feeTokenID,
              transfer.fee
            );
          }
        }
      }
    }*/

    // Deposits
    /*const numAvailableDepositSlotsBefore = await this.exchange.getNumAvailableDepositSlots();
    const numDepositRequestsProcessedBefore = await this.exchange.getNumDepositRequestsProcessed();
    // Onchain withdrawals
    const numAvailableWithdrawalSlotsBefore = await this.exchange.getNumAvailableWithdrawalSlots();
    const numWithdrawalRequestsProcessedBefore = await this.exchange.getNumWithdrawalRequestsProcessed();*/

    // Submit the blocks onchain
    const operatorContract = this.operator ? this.operator : this.exchange;

    // Compress the data
    const txData = operatorContract.contract.methods.submitBlocks(
      onchainBlocks,
      this.exchangeOperator
    ).encodeABI();
    const compressed = compressLZ(txData);

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
      }
    }

    // Check the BlockFeeWithdrawn event(s)
    /*{
      let numExpected = 0;
      for (const block of blocks) {
        numExpected += block.blockType === BlockType.DEPOSIT ? 1 : 0;
        numExpected +=
          block.blockType === BlockType.ONCHAIN_WITHDRAWAL &&
          block.shutdown !== true
            ? 1
            : 0;
      }
      const events = await this.assertEventsEmitted(
        this.exchange,
        "BlockFeeWithdrawn",
        numExpected
      );
      for (const event of events) {
        const block = this.blocks[this.exchangeId][event.blockIdx.toNumber()];
        block.blockFeeRewarded = event.amountRewarded;
        block.blockFeeFined = event.amountFined;
      }
    }*/

    // Check the Conditional transfers
    await approvalsSnapshot.verifyApprovals();
    await approvalsSnapshot.verifyEvents();

    // Check the new Merkle root
    const merkleRoot = await this.exchange.getMerkleRoot();
    assert.equal(
      merkleRoot,
      blocks[blocks.length - 1].merkleRoot,
      "unexpected Merkle root"
    );
/*
    // Deposits
    {
      let numRequestsProcessed = 0;
      for (const block of blocks) {
        if (block.blockType == BlockType.DEPOSIT) {
          const depositBlock: DepositBlock = block.internalBlock;
          numRequestsProcessed += depositBlock.count;
        }
      }
      const numAvailableSlotsAfter = await this.exchange.getNumAvailableDepositSlots();
      const numDepositRequestsProcessedAfter = await this.exchange.getNumDepositRequestsProcessed();
      assert(
        numAvailableSlotsAfter.eq(
          numAvailableDepositSlotsBefore.add(new BN(numRequestsProcessed))
        ),
        "num available deposit slots should be increased by the number of deposit requests processed"
      );
      assert(
        numDepositRequestsProcessedAfter.eq(
          numDepositRequestsProcessedBefore.add(new BN(numRequestsProcessed))
        ),
        "total num deposits processed should be increased by the number of deposit requests processed"
      );
    }

    // Onhain withdrawals
    {
      let numRequestsProcessed = 0;
      for (const block of blocks) {
        if (block.blockType == BlockType.ONCHAIN_WITHDRAWAL) {
          const withdrawBlock: WithdrawBlock = block.internalBlock;
          numRequestsProcessed += withdrawBlock.count;
        }
      }
      const numAvailableSlotsAfter = await this.exchange.getNumAvailableWithdrawalSlots();
      const numWithdrawalRequestsProcessedAfter = await this.exchange.getNumWithdrawalRequestsProcessed();
      assert(
        numAvailableSlotsAfter.eq(
          numAvailableWithdrawalSlotsBefore.add(new BN(numRequestsProcessed))
        ),
        "num available withdrawal slots should be increased by the number of withdrawal requests processed"
      );
      assert(
        numWithdrawalRequestsProcessedAfter.eq(
          numWithdrawalRequestsProcessedBefore.add(new BN(numRequestsProcessed))
        ),
        "total num withdrawals processed should be increased by the number of withdrawal requests processed"
      );
    }
  */

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

  public async submitTransactions(exchangeID: number = this.exchangeId, forcedBlockSize?: number) {
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
      for (let b = numTransactionsDone; b < numTransactionsDone + blockSize; b++) {
        if (b < pendingTransactions.length) {
          transactions.push(pendingTransactions[b]);
        } else {
          const noop: Noop = {
            txType: "Noop",
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
            //console.log("Conditional transfer");
            numConditionalTransactions++;
            auxiliaryData.push([i, web3.utils.hexToBytes(transaction.onchainSignature ? transaction.onchainSignature : "0x")]);
          }
        } else if (transaction.txType === "Withdraw") {
          //console.log("withdraw");
          numConditionalTransactions++;
          const encodedWithdrawalData = web3.eth.abi.encodeParameter(
            'tuple(uint256,bytes)',
            [100000, web3.utils.hexToBytes(transaction.onchainSignature ? transaction.onchainSignature : "0x")]
          );
          auxiliaryData.push([i, web3.utils.hexToBytes(encodedWithdrawalData)]);
        } else if (transaction.txType === "Deposit") {
          //console.log("Deposit");
          numConditionalTransactions++;
          auxiliaryData.push([i, web3.utils.hexToBytes("0x")]);
        } else if (transaction.txType === "PublicKeyUpdate") {
          //console.log("PublicKeyUpdate");
          numConditionalTransactions++;
          auxiliaryData.push([i, web3.utils.hexToBytes(transaction.onchainSignature)]);
        } else if (transaction.txType === "OwnerChange") {
          //console.log("PublicKeyUpdate");
          numConditionalTransactions++;
          const encodedOwnerChangeData = web3.eth.abi.encodeParameter(
            'tuple(bytes,bytes,address,bytes32,bytes)',
            [
              web3.utils.hexToBytes(transaction.onchainSignatureOldOwner ? transaction.onchainSignatureOldOwner : "0x"),
              web3.utils.hexToBytes(transaction.onchainSignatureNewOwner ? transaction.onchainSignatureNewOwner : "0x"),
              transaction.walletAddress,
              transaction.walletDataHash,
              transaction.walletCalldata
            ]
          );
          auxiliaryData.push([i, web3.utils.hexToBytes(encodedOwnerChangeData)]);
        }
      }
      console.log("numConditionalTransactions: " + numConditionalTransactions);
      const encodedAuxiliaryData = web3.eth.abi.encodeParameter('tuple(uint256,bytes)[]', auxiliaryData);

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
        onchainDataAvailability: this.onchainDataAvailability,
        timestamp,
        protocolTakerFeeBips,
        protocolMakerFeeBips,
        exchangeID,
        operatorAccountID: operator
      };

      // Store state before
      const stateBefore = await Simulator.loadExchangeState(exchangeID, currentBlockIdx);

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
      bs.addNumber(exchangeID, 4);
      bs.addBN(new BN(block.merkleRootBefore, 10), 32);
      bs.addBN(new BN(block.merkleRootAfter, 10), 32);
      bs.addNumber(txBlock.timestamp, 4);
      bs.addNumber(txBlock.protocolTakerFeeBips, 1);
      bs.addNumber(txBlock.protocolMakerFeeBips, 1);
      bs.addNumber(numConditionalTransactions, 4);
      const allDa = new Bitstream();
      if (block.onchainDataAvailability) {
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

            da.addNumber(BlockType.SPOT_TRADE, 1);

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
          } else if(tx.transfer) {
            const transfer = tx.transfer;
            da.addNumber(BlockType.INTERNAL_TRANSFER, 1);
            da.addNumber(transfer.type, 1);
            da.addNumber(transfer.accountFromID, 3);
            da.addNumber(transfer.accountToID, 3);
            da.addNumber(
              transfer.tokenID * 2 ** 12 + transfer.feeTokenID,
              3
            );
            da.addNumber(toFloat(new BN(transfer.amount), Constants.Float24Encoding), 3);
            da.addNumber(toFloat(new BN(transfer.fee), Constants.Float16Encoding), 2);
            da.addNumber(transfer.nonce, 4);
            da.addBN(new BN(transfer.ownerFrom), 20);
            da.addBN(new BN(transfer.ownerTo), 20);
          } else if (tx.withdraw) {
            const withdraw = tx.withdraw;
            da.addNumber(BlockType.WITHDRAWAL, 1);
            da.addNumber(withdraw.type, 1);
            da.addBN(new BN(withdraw.owner), 20);
            da.addNumber(withdraw.accountID, 3);
            da.addNumber(withdraw.nonce, 4);
            da.addNumber(
              withdraw.tokenID * 2 ** 12 + withdraw.feeTokenID,
              3
            );
            da.addBN(new BN(withdraw.amount), 12);
            da.addNumber(toFloat(new BN(withdraw.fee), Constants.Float16Encoding), 2);
            da.addBN(new BN(withdraw.to), 20);
          } else if (tx.deposit) {
            const deposit = tx.deposit;
            da.addNumber(BlockType.DEPOSIT, 1);
            da.addBN(new BN(deposit.owner), 20);
            da.addNumber(deposit.accountID, 3);
            da.addNumber(deposit.tokenID, 2);
            da.addBN(new BN(deposit.amount), 12);
            da.addBN(new BN(deposit.index), 12);
          } else if (tx.publicKeyUpdate) {
            const update = tx.publicKeyUpdate;
            da.addNumber(BlockType.PUBLIC_KEY_UPDATE, 1);
            da.addBN(new BN(update.owner), 20);
            da.addNumber(update.accountID, 3);
            da.addNumber(update.nonce, 4);
            da.addBN(new BN(EdDSA.pack(update.publicKeyX, update.publicKeyY), 16), 32);
            da.addBN(new BN(update.walletHash), 32);
            da.addNumber(update.feeTokenID, 2);
            da.addNumber(toFloat(new BN(update.fee), Constants.Float16Encoding), 2);
          } else if (tx.newAccount) {
            const create = tx.newAccount;
            da.addNumber(BlockType.NEW_ACCOUNT, 1);
            da.addNumber(create.payerAccountID, 3);
            da.addNumber(create.feeTokenID, 2);
            da.addNumber(toFloat(new BN(create.fee), Constants.Float16Encoding), 2);
            da.addNumber(create.newAccountID, 3);
            da.addBN(new BN(create.newOwner), 20);
            da.addBN(new BN(EdDSA.pack(create.newPublicKeyX, create.newPublicKeyY), 16), 32);
            da.addBN(new BN(create.newWalletHash), 32);
          } else if (tx.ownerChange) {
            const change = tx.ownerChange;
            da.addNumber(BlockType.OWNER_CHANGE, 1);
            da.addBN(new BN(change.owner), 20);
            da.addNumber(change.accountID, 3);
            da.addNumber(change.nonce, 4);
            da.addNumber(change.feeTokenID, 2);
            da.addNumber(toFloat(new BN(change.fee), Constants.Float16Encoding), 2);
            da.addBN(new BN(change.newOwner), 20);
            da.addBN(new BN(change.walletHash), 32);
          }

          assert(da.length() <= Constants.TX_DATA_AVAILABILITY_SIZE, "tx uses too much da");
          while(da.length() < Constants.TX_DATA_AVAILABILITY_SIZE) {
            da.addNumber(0, 1);
          }
          allDa.addHex(da.getData());
        }
      }
      if (block.onchainDataAvailability) {
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
      const stateAfter = await Simulator.loadExchangeState(exchangeID, currentBlockIdx + 1);

      // Validate state change
      Simulator.executeBlock(
        txBlock,
        stateBefore,
        stateAfter
      );

      // Commit the block
      const blockInfo = await this.commitBlock(
        operator,
        BlockType.NOOP,
        blockSize,
        bs.getData(),
        blockFilename,
        txBlock,
        encodedAuxiliaryData,
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

      if (symbol !== "ETH" && symbol !== "WETH" && symbol !== "LRC") {
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

  public async approveOffchainTransfer(
    from: string,
    to: string,
    token: string,
    amount: BN
  ) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }

    // Get approved amount before
    const approvedBefore = await this.exchange.getApprovedTransferAmount(
      from,
      to,
      token
    );

    await this.exchange.approveOffchainTransfer(from, to, token, amount, {
      from
    });

    // Check approved amount after
    const approvedAfter = await this.exchange.getApprovedTransferAmount(
      from,
      to,
      token
    );
    assert(
      approvedAfter.eq(approvedBefore.add(amount)),
      "approved amount unexpected"
    );

    // Check the event
    const fromID = await this.getAccountID(from);
    const toID = await this.getAccountID(to);
    const tokenID = await this.getTokenID(token);
    const event = await this.assertEventEmitted(
      this.exchange,
      "ConditionalTransferApproved"
    );
    assert.equal(
      event.from,
      fromID,
      "ConditionalTransferApproved: unexpected from"
    );
    assert.equal(event.to, toID, "ConditionalTransferApproved: unexpected to");
    assert.equal(
      event.token,
      tokenID,
      "ConditionalTransferApproved: unexpected token"
    );
    assert(
      event.amount.eq(amount),
      "ConditionalTransferApproved: unexpected amount"
    );
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
    onchainDataAvailability: boolean = true
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
      onchainDataAvailability,
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
    this.onchainDataAvailability = onchainDataAvailability;
    this.activeOperator = undefined;

    // Set the operator
    const operatorContract = await this.contracts.Operator.new(this.exchange.address, {from: this.exchangeOperator});
    await this.setOperatorContract(operatorContract);

    const exchangeCreationTimestamp = (await this.exchange.getExchangeCreationTimestamp()).toNumber();
    this.GENESIS_MERKLE_ROOT = new BN(
      (await this.exchange.genesisBlockHash()).slice(2),
      16
    );

    const genesisBlock: Block = {
      blockIdx: 0,
      filename: null,
      blockType: BlockType.NOOP,
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
      blockFeeRewarded: new BN(0),
      blockFeeFined: new BN(0),
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
    const stakeAmount = onchainDataAvailability
      ? await this.loopringV3.minExchangeStakeWithDataAvailability()
      : await this.loopringV3.minExchangeStakeWithoutDataAvailability();
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
    //await this.explorer.sync(await web3.eth.getBlockNumber());
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

  public async createMerkleTreeInclusionProof(owner: string, token: string) {
    const accountID = await this.getAccountID(owner);
    const tokenID = this.getTokenIdFromNameOrAddress(token);

    await this.syncExplorer();
    const explorerExchange = this.explorer.getExchangeById(this.exchangeId);
    explorerExchange.buildMerkleTreeForWithdrawalMode();
    return explorerExchange.getWithdrawFromMerkleTreeData(accountID, tokenID);
  }

  public async withdrawFromMerkleTreeWithProof(
    data: WithdrawFromMerkleTreeData
  ) {
    const tx = await this.exchange.withdrawFromMerkleTree(
      data.owner,
      data.token,
      data.publicKeyX,
      data.publicKeyY,
      web3.utils.toBN(data.nonce),
      data.balance,
      web3.utils.toBN(data.tradeHistoryRoot),
      data.accountMerkleProof,
      data.balanceMerkleProof
    );
    logInfo(
      "\x1b[46m%s\x1b[0m",
      "[WithdrawFromMerkleTree] Gas used: " + tx.receipt.gasUsed
    );
  }

  public async withdrawFromMerkleTree(owner: string, token: string) {
    const proof = await this.createMerkleTreeInclusionProof(owner, token);
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
    const state = await Simulator.loadExchangeState(exchangeID);
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
    assert(balance.eq(expectedBalance), desc);
  }

  public async doRandomDeposit(
    ownerIndex?: number
  ) {
    const orderOwners = this.testContext.orderOwners;
    ownerIndex =
      ownerIndex !== undefined
        ? ownerIndex
        : this.getRandomInt(orderOwners.length);
    const owner = orderOwners[Number(ownerIndex)];
    const amount = this.getRandomAmount();
    const token = this.getTokenAddress("LRC");
    return await this.deposit(
      owner,
      owner,
      token,
      amount
    );
  }

  public async doRandomOnchainWithdrawal(
    deposit: Deposit,
    changeFees: boolean = true
  ) {
    await this.loopringV3.updateSettings(
      await this.loopringV3.protocolFeeVault(),
      await this.loopringV3.exchangeCreationCostLRC(),
      (await this.loopringV3.forcedWithdrawalFee()).mul(new BN(changeFees ? 2 : 1)),
      await this.loopringV3.tokenRegistrationFeeLRCBase(),
      await this.loopringV3.tokenRegistrationFeeLRCDelta(),
      await this.loopringV3.minExchangeStakeWithDataAvailability(),
      await this.loopringV3.minExchangeStakeWithoutDataAvailability(),
      { from: this.testContext.deployer }
    );

    return await this.requestWithdrawal(
      deposit.owner,
      deposit.token,
      this.getRandomAmount(),
      "ETH",
      new BN(0),
      2
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
    return;

    // Get the current state
    /*const numBlocksOnchain = this.blocks[this.exchangeId].length;
    const state = await this.loadExchangeState(
      this.exchangeId,
      numBlocksOnchain - 1
    );

    await this.syncExplorer();
    const exchange = this.explorer.getExchangeById(this.exchangeId);
    if (!exchange.hasOnchainDataAvailability()) {
      // We can't compare the state
      return;
    }

    // Compare accounts
    assert.equal(
      exchange.getNumAccounts(),
      state.accounts.length,
      "number of accounts does not match"
    );
    for (let accountID = 0; accountID < state.accounts.length; accountID++) {
      const accountA = state.accounts[accountID];
      const accountB = exchange.getAccount(accountID);
      this.compareAccounts(accountA, accountB);
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
        explorerBlock.blockFeeRewarded.eq(testBlock.blockFeeRewarded),
        "unexpected blockFeeRewarded"
      );
      assert(
        explorerBlock.blockFeeFined.eq(testBlock.blockFeeFined),
        "unexpected blockFeeFined"
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
    assert.equal(
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

  public getRandomAmount() {
    return new BN(web3.utils.toWei("" + this.getRandomInt(100000000) / 1000));
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
      exchangeConstants,
      exchange,
      blockVerifier,
      lrcToken,
      wethToken
    ] = await Promise.all([
      this.contracts.UniversalRegistry.deployed(),
      this.contracts.LoopringV3.deployed(),
      this.contracts.ExchangeConstants.deployed(),
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
    this.exchangeConstants = exchangeConstants;
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
    for (let i = 0; i < this.exchangeTestUtil.MAX_NUM_TOKEN_IDS; i++) {
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
    for (let i = 0; i < this.exchangeTestUtil.MAX_NUM_TOKEN_IDS; i++) {
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

const zeroPad = (num: number, places: number) =>
  String(num).padStart(places, "0");

export class ApprovalsSnapshot {
  private exchangeTestUtil: ExchangeTestUtil;
  private exchange: any;
  private exchangeId: number;
  private approvals: Map<string, BN>;
  private transfers: any = [];

  constructor(util: ExchangeTestUtil) {
    this.exchangeTestUtil = util;
    this.exchange = this.exchangeTestUtil.exchange;
    this.exchangeId = this.exchangeTestUtil.exchangeId;
    this.approvals = new Map<string, BN>();
  }

  public async watchApproval(from: number, to: number, token: number) {
    const approved = await this.getApprovedTransferAmount(from, to, token);
    if (!this.approvals.has(this.getKey(from, to, token))) {
      this.approvals.set(this.getKey(from, to, token), approved);
    }
  }

  public async transfer(from: number, to: number, token: number, amount: BN) {
    if (!this.approvals.has(this.getKey(from, to, token))) {
      await this.watchApproval(from, to, token);
    }
    const approved = this.approvals.get(this.getKey(from, to, token));
    this.approvals.set(this.getKey(from, to, token), approved.sub(amount));
    if (amount.gt(new BN(0))) {
      this.transfers.push({ from, to, token, amount });
    }
  }

  public async verifyApprovals() {
    for (const [key, approved] of this.approvals.entries()) {
      const [from, to, token] = this.fromKey(key);
      const currentlyApproved = await this.getApprovedTransferAmount(
        from,
        to,
        token
      );
      assert(
        currentlyApproved.eq(approved),
        "conditional transfer approval unexpected"
      );
    }
  }

  public async verifyEvents() {
    return;
    const events = await this.exchangeTestUtil.assertEventsEmitted(
      this.exchange,
      "ConditionalTransferConsumed",
      this.transfers.length
    );
    //for (const transfer of this.transfers) {
    //  console.log("T- " + transfer.from + " -> " + transfer.to + " " + transfer.amount.toString(10) + " " + transfer.token);
    //}
    //for (const event of events) {
    //  console.log("E- " + event.from.toNumber() + " -> " + event.to.toNumber() + " " + event.amount.toString(10) + " " + event.token.toNumber());
    //}
    for (const [i, event] of events.entries()) {
      const transfer = this.transfers[i];
      assert.equal(event.from, transfer.from, "unexpected from");
      assert.equal(event.to, transfer.to, "unexpected to");
      assert.equal(event.token, transfer.token, "unexpected token");
      assert(event.amount.eq(transfer.amount), "unexpected amount");
    }
  }

  private async getApprovedTransferAmount(
    from: number,
    to: number,
    token: number
  ) {
    const fromAddress = this.exchangeTestUtil.accounts[this.exchangeId][from]
      .owner;
    const toAddress = this.exchangeTestUtil.accounts[this.exchangeId][to].owner;
    const tokenAddress = this.exchangeTestUtil.getTokenAddressFromID(token);
    return await this.exchange.getApprovedTransferAmount(
      fromAddress,
      toAddress,
      tokenAddress
    );
  }

  private getKey(from: number, to: number, token: number) {
    return zeroPad(from, 10) + zeroPad(to, 10) + zeroPad(token, 5);
  }

  private fromKey(key: string) {
    //console.log("key: " + key);
    return [
      parseInt(key.slice(0, 10)),
      parseInt(key.slice(10, 20)),
      parseInt(key.slice(20, 25))
    ];
  }
}
