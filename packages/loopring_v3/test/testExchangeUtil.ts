import BN = require("bn.js");
import childProcess = require("child_process");
import fs = require("fs");
import path = require("path");
import { performance } from "perf_hooks";
import { SHA256 } from "sha2";
import util = require("util");
import { Artifacts } from "../util/Artifacts";
import { compress, CompressionType } from "./compression";
import {
  Bitstream,
  BlockState,
  BlockType,
  Constants,
  EdDSA,
  Explorer,
  toFloat,
  Poseidon,
  WithdrawFromMerkleTreeData,
  OnchainWithdrawal
} from "loopringV3.js";
import { Context } from "./context";
import { expectThrow } from "./expectThrow";
import { doDebugLogging, logDebug, logInfo } from "./logs";

import { Simulator } from "./simulator";
import { ExchangeTestContext } from "./testExchangeContext";
import {
  Account,
  AccountLeaf,
  Balance,
  Block,
  Cancel,
  CancelBlock,
  Deposit,
  DepositBlock,
  DepositInfo,
  DetailedTokenTransfer,
  ExchangeState,
  InternalTransferRequest,
  InternalTransferBlock,
  OrderInfo,
  RingBlock,
  RingInfo,
  TradeHistory,
  Withdrawal,
  WithdrawalRequest,
  WithdrawBlock
} from "./types";

// JSON replacer function for BN values
function replacer(name: any, val: any) {
  if (
    name === "balance" ||
    name === "amountS" ||
    name === "amountB" ||
    name === "amount" ||
    name === "fee" ||
    name === "startHash" ||
    name === "label"
  ) {
    return new BN(val, 16).toString(10);
  } else {
    return val;
  }
}

interface Range {
  offset: number;
  length: number;
}

export class ExchangeTestUtil {
  public context: Context;
  public testContext: ExchangeTestContext;

  public explorer: Explorer;

  public ringSettlementBlockSizes = [1, 2, 4];
  public depositBlockSizes = [4, 8];
  public onchainWithdrawalBlockSizes = [4, 8];
  public offchainWithdrawalBlockSizes = [4, 8];
  public transferBlockSizes = [4, 8];
  public orderCancellationBlockSizes = [4, 8];

  public loopringV3: any;
  public blockVerifier: any;
  public downtimeCostCalculator: any;
  public lzDecompressor: any;

  public lrcAddress: string;
  public wethAddress: string;

  public exchangeConstants: any;
  public exchange: any;
  public exchangeOwner: string;
  public exchangeOperator: string;
  public exchangeId: number;

  public operator: any;
  public activeOperator: number;

  public userStakingPool: any;
  public protocolFeeVault: any;
  public protocolFeeVaultContract: any;
  public universalRegistry: any;

  public blocks: Block[][] = [];
  public accounts: Account[][] = [];

  public deposits: Deposit[][] = [];
  public onchainWithdrawals: WithdrawalRequest[][] = [];

  public operators: number[] = [];

  public GENESIS_MERKLE_ROOT: BN;
  public SNARK_SCALAR_FIELD: BN;
  public MAX_PROOF_GENERATION_TIME_IN_SECONDS: number;
  public MAX_GAP_BETWEEN_FINALIZED_AND_VERIFIED_BLOCKS: number;
  public MAX_OPEN_DEPOSIT_REQUESTS: number;
  public MAX_OPEN_WITHDRAWAL_REQUESTS: number;
  public MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE: number;
  public MAX_AGE_REQUEST_UNTIL_FORCED: number;
  public MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE: number;
  public MAX_TIME_IN_SHUTDOWN_BASE: number;
  public MAX_TIME_IN_SHUTDOWN_DELTA: number;
  public TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS: number;
  public MAX_NUM_TOKENS: number;
  public MAX_NUM_ACCOUNTS: number;
  public MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS: number;
  public MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS_SHUTDOWN_MODE: number;
  public FEE_BLOCK_FINE_START_TIME: number;
  public FEE_BLOCK_FINE_MAX_DURATION: number;
  public MIN_GAS_TO_DISTRIBUTE_WITHDRAWALS: number;
  public MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED: number;
  public GAS_LIMIT_SEND_TOKENS: number;

  public dummyAccountId: number;
  public dummyAccountKeyPair: any;
  public dummyRing: RingInfo;

  public tokenAddressToIDMap = new Map<string, number>();
  public tokenIDToAddressMap = new Map<number, string>();

  public contracts = new Artifacts(artifacts);

  public pendingBlocks: Block[][] = [];

  public onchainDataAvailability = true;
  public compressionType = CompressionType.LZ;

  public autoCommit = true;

  public commitWrongPublicDataOnce = false;
  public commitWrongProofOnce = false;

  private pendingRings: RingInfo[][] = [];
  private pendingDeposits: Deposit[][] = [];
  private pendingInternalTransfers: InternalTransferRequest[][] = [];
  private pendingOffchainWithdrawalRequests: WithdrawalRequest[][] = [];
  private pendingOnchainWithdrawalRequests: WithdrawalRequest[][] = [];
  private pendingCancels: Cancel[][] = [];

  private pendingWithdrawals: Withdrawal[] = [];

  private orderIDGenerator: number = 0;

  private MAX_NUM_EXCHANGES: number = 512;

  public async initialize(accounts: string[]) {
    this.context = await this.createContractContext();
    this.testContext = await this.createExchangeTestContext(accounts);

    this.explorer = new Explorer();
    await this.explorer.initialize(web3, this.universalRegistry.address);

    // Initialize LoopringV3
    this.protocolFeeVault = this.testContext.deployer;

    await this.loopringV3.updateSettings(
      this.protocolFeeVault,
      this.blockVerifier.address,
      this.downtimeCostCalculator.address,
      new BN(web3.utils.toWei("0.02", "ether")),
      new BN(web3.utils.toWei("10000", "ether")),
      new BN(web3.utils.toWei("2000", "ether")),
      new BN(web3.utils.toWei("1", "ether")),
      new BN(web3.utils.toWei("250000", "ether")),
      new BN(web3.utils.toWei("1000000", "ether")),
      new BN(web3.utils.toWei("50000", "ether")),
      new BN(web3.utils.toWei("10", "ether")),
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
      this.pendingRings.push([]);
      this.pendingDeposits.push([]);
      this.pendingOffchainWithdrawalRequests.push([]);
      this.pendingOnchainWithdrawalRequests.push([]);
      this.pendingCancels.push([]);
      this.pendingInternalTransfers.push([]);
      this.pendingBlocks.push([]);

      this.blocks.push([]);
      this.deposits.push([]);
      this.onchainWithdrawals.push([]);

      const account: Account = {
        accountID: 0,
        owner: this.loopringV3.address,
        publicKeyX: "0",
        publicKeyY: "0",
        secretKey: "0",
        nonce: 0
      };
      this.accounts.push([account]);
    }

    await this.createExchange(
      this.testContext.deployer,
      true,
      this.onchainDataAvailability,
      new BN(web3.utils.toWei("0.001", "ether")),
      new BN(web3.utils.toWei("0.001", "ether"))
    );

    this.GENESIS_MERKLE_ROOT = new BN(
      (await this.exchange.genesisBlockHash()).slice(2),
      16
    );

    const constants = await this.exchangeConstants.getConstants();
    this.SNARK_SCALAR_FIELD = new BN(constants[0]);
    this.MAX_PROOF_GENERATION_TIME_IN_SECONDS = constants[1].toNumber();
    this.MAX_GAP_BETWEEN_FINALIZED_AND_VERIFIED_BLOCKS = constants[2].toNumber();
    this.MAX_OPEN_DEPOSIT_REQUESTS = constants[3].toNumber();
    this.MAX_OPEN_WITHDRAWAL_REQUESTS = constants[4].toNumber();
    this.MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE = constants[5].toNumber();
    this.MAX_AGE_REQUEST_UNTIL_FORCED = constants[6].toNumber();
    this.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE = constants[7].toNumber();
    this.MAX_TIME_IN_SHUTDOWN_BASE = constants[8].toNumber();
    this.MAX_TIME_IN_SHUTDOWN_DELTA = constants[9].toNumber();
    this.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS = constants[10].toNumber();
    this.MAX_NUM_TOKENS = constants[11].toNumber();
    this.MAX_NUM_ACCOUNTS = constants[12].toNumber();
    this.MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS = constants[13].toNumber();
    this.MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS_SHUTDOWN_MODE = constants[14].toNumber();
    this.FEE_BLOCK_FINE_START_TIME = constants[15].toNumber();
    this.FEE_BLOCK_FINE_MAX_DURATION = constants[16].toNumber();
    this.MIN_GAS_TO_DISTRIBUTE_WITHDRAWALS = constants[17].toNumber();
    this.MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED = constants[18].toNumber();
    this.GAS_LIMIT_SEND_TOKENS = constants[19].toNumber();
  }

  public async setupTestState(exchangeID: number) {
    const keyPair = this.getKeyPairEDDSA();
    const depositInfo = await this.deposit(
      exchangeID,
      this.testContext.ringMatchers[0],
      keyPair.secretKey,
      keyPair.publicKeyX,
      keyPair.publicKeyY,
      Constants.zeroAddress,
      new BN(1)
    );
    this.dummyAccountId = depositInfo.accountID;
    this.dummyAccountKeyPair = keyPair;

    this.operators[exchangeID] = await this.createOperator(
      exchangeID,
      this.testContext.operators[0]
    );

    // Create a ring that can be reused 2**96 times if filled wit 1 wei/1 wei
    this.dummyRing = {
      orderA: {
        exchangeID,
        orderID: 0,
        accountID: this.dummyAccountId,
        tokenIdS: this.getTokenIdFromNameOrAddress("ETH"),
        tokenIdB: this.getTokenIdFromNameOrAddress("LRC"),
        allOrNone: false,
        validSince: 0,
        validUntil: 2 ** 32 - 1,
        maxFeeBips: 0,
        buy: false,
        label: 1,

        feeBips: 0,
        rebateBips: 0,

        amountS: Constants.MAX_AMOUNT,
        amountB: Constants.MAX_AMOUNT
      },
      orderB: {
        exchangeID,
        orderID: 0,
        accountID: this.dummyAccountId,
        tokenIdS: this.getTokenIdFromNameOrAddress("LRC"),
        tokenIdB: this.getTokenIdFromNameOrAddress("ETH"),
        allOrNone: false,
        validSince: 0,
        validUntil: 2 ** 32 - 1,
        maxFeeBips: 0,
        buy: false,
        label: 2,

        feeBips: 0,
        rebateBips: 0,

        amountS: Constants.MAX_AMOUNT,
        amountB: Constants.MAX_AMOUNT
      },
      tokenID: 0,
      fee: new BN(0)
    };
    this.signOrder(this.dummyRing.orderA);
    this.signOrder(this.dummyRing.orderB);

    // Deposit 1 wei ETH and 1 wei LRC to the dummy account so the ring can be filled with 1 wei
    await this.depositTo(this.dummyAccountId, Constants.zeroAddress, new BN(1));
    await this.depositTo(
      this.dummyAccountId,
      this.getTokenAddress("LRC"),
      new BN(1)
    );
  }

  public isProofComputingDisabled() {
    return process.argv.indexOf("--disable-proof") > -1;
  }

  public async createOperator(exchangeID: number, owner: string) {
    // Make an account for the operator
    const keyPair = this.getKeyPairEDDSA();
    const depositInfo = await this.deposit(
      exchangeID,
      owner,
      keyPair.secretKey,
      keyPair.publicKeyX,
      keyPair.publicKeyY,
      Constants.zeroAddress,
      new BN(1)
    );
    return depositInfo.accountID;
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
      "Unexpected number of events",
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

  public async setupRing(
    ring: RingInfo,
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

    order.label =
      order.label !== undefined ? order.label : this.getRandomInt(2 ** 16);

    assert(order.maxFeeBips < 64, "maxFeeBips >= 64");
    assert(order.feeBips < 64, "feeBips >= 64");
    assert(order.rebateBips < 64, "rebateBips >= 64");
    assert(order.label < 2 ** 16, "order.label >= 2**16");

    // setup initial balances:
    await this.setOrderBalances(order);

    // Sign the order
    this.signOrder(order);
  }

  public signOrder(order: OrderInfo) {
    if (order.signature !== undefined) {
      return;
    }

    const hasher = Poseidon.createHash(14, 6, 53);
    const account = this.accounts[this.exchangeId][order.accountID];

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
      order.buy ? 1 : 0,
      order.label
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

  public signCancel(cancel: Cancel) {
    if (cancel.signature !== undefined) {
      return;
    }

    const hasher = Poseidon.createHash(9, 6, 53);
    const account = this.accounts[this.exchangeId][cancel.accountID];

    // Calculate hash
    const inputs = [
      this.exchangeId,
      cancel.accountID,
      cancel.orderTokenID,
      cancel.orderID,
      cancel.feeTokenID,
      cancel.fee,
      cancel.label,
      account.nonce++
    ];
    const hash = hasher(inputs).toString(10);

    // Create signature
    cancel.signature = EdDSA.sign(account.secretKey, hash);

    // Verify signature
    const success = EdDSA.verify(hash, cancel.signature, [
      account.publicKeyX,
      account.publicKeyY
    ]);
    assert(success, "Failed to verify signature");
  }

  public signWithdrawal(withdrawal: WithdrawalRequest) {
    if (withdrawal.signature !== undefined) {
      return;
    }

    const hasher = Poseidon.createHash(9, 6, 53);
    const account = this.accounts[this.exchangeId][withdrawal.accountID];

    // Calculate hash
    const inputs = [
      this.exchangeId,
      withdrawal.accountID,
      withdrawal.tokenID,
      withdrawal.amount,
      withdrawal.feeTokenID,
      withdrawal.fee,
      withdrawal.label,
      account.nonce++
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

  public signInternalTransfer(trans: InternalTransferRequest) {
    if (trans.signature !== undefined) {
      return;
    }

    const hasher = Poseidon.createHash(10, 6, 53);
    const account = this.accounts[this.exchangeId][trans.accountFromID];

    // Calculate hash
    const inputs = [
      this.exchangeId,
      trans.accountFromID,
      trans.accountToID,
      trans.transTokenID,
      trans.amount,
      trans.feeTokenID,
      trans.fee,
      trans.label,
      account.nonce++
    ];
    const hash = hasher(inputs).toString(10);

    // Create signature
    trans.signature = EdDSA.sign(account.secretKey, hash);

    // Verify signature
    const success = EdDSA.verify(hash, trans.signature, [
      account.publicKeyX,
      account.publicKeyY
    ]);
    assert(success, "Failed to verify signature");
  }

  public async setOrderBalances(order: OrderInfo) {
    const keyPair = this.getKeyPairEDDSA();
    let publicKeyX = keyPair.publicKeyX;
    let publicKeyY = keyPair.publicKeyY;
    let secretKey = keyPair.secretKey;

    const accountID = await this.getAccountID(order.owner);
    if (accountID !== undefined) {
      const account = this.accounts[this.exchangeId][accountID];
      publicKeyX = account.publicKeyX;
      publicKeyY = account.publicKeyY;
      secretKey = account.secretKey;
    }

    const balanceS =
      order.balanceS !== undefined ? order.balanceS : order.amountS;
    const depositInfo = await this.deposit(
      order.exchangeID,
      order.owner,
      secretKey,
      publicKeyX,
      publicKeyY,
      order.tokenS,
      balanceS,
      accountID
    );
    order.accountID = depositInfo.accountID;

    const balanceB = order.balanceB !== undefined ? order.balanceB : new BN(0);
    if (balanceB.gt(new BN(0))) {
      await this.deposit(
        order.exchangeID,
        order.owner,
        secretKey,
        publicKeyX,
        publicKeyY,
        order.tokenB,
        balanceB,
        order.accountID
      );
    }
  }

  public getAddressBook(
    ring: RingInfo,
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

  public getAddressBookBlock(ringBlock: RingBlock) {
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
    for (const ring of ringBlock.rings) {
      addressBook = this.getAddressBook(ring, index++, addressBook);
    }
    addAccount(addressBook, ringBlock.operatorAccountID, "Operator");
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
    exchangeID: number,
    owner: string,
    secretKey: string,
    publicKeyX: string,
    publicKeyY: string,
    token: string,
    amount: BN,
    accountID?: number,
    accountContract?: any
  ) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }

    let numAvailableSlots = (await this.exchange.getNumAvailableDepositSlots()).toNumber();
    if (this.autoCommit && numAvailableSlots === 0) {
      await this.commitDeposits(exchangeID);
      numAvailableSlots = (await this.exchange.getNumAvailableDepositSlots()).toNumber();
      assert(numAvailableSlots > 0, "numAvailableSlots > 0");
    }

    // Calculate how much fee needs to be paid
    const fees = await this.exchange.getFees();
    let feeETH = fees._depositFeeETH;
    const currentAccountID = await this.getAccountID(owner);
    if (currentAccountID === undefined) {
      feeETH = feeETH.add(fees._accountUpdateFeeETH);
    } else {
      const accountData = await this.exchange.getAccount(owner);
      if (
        accountData.pubKeyX.toString(10) !== publicKeyX ||
        accountData.pubKeyY.toString(10) !== publicKeyY
      ) {
        feeETH = feeETH.add(fees._accountUpdateFeeETH);
      }
    }

    // Always send a bit too much which we'll get back immediately
    const feeSurplus = new BN(123);
    let ethToSend = feeETH.add(feeSurplus);

    if (amount.gt(0)) {
      if (token !== Constants.zeroAddress) {
        const Token = this.testContext.tokenAddrInstanceMap.get(token);
        await Token.setBalance(owner, amount);
        await Token.approve(this.exchange.address, amount, { from: owner });
      } else {
        ethToSend = ethToSend.add(web3.utils.toBN(amount));
      }
    }

    // Do the deposit
    const contract = accountContract ? accountContract : this.exchange;
    const caller = accountContract ? this.testContext.orderOwners[0] : owner;

    const callerEthBalanceBefore = await this.getOnchainBalance(
      caller,
      Constants.zeroAddress
    );

    const tx = await contract.updateAccountAndDeposit(
      new BN(publicKeyX),
      new BN(publicKeyY),
      token,
      web3.utils.toBN(amount),
      Constants.emptyBytes,
      { from: caller, value: ethToSend, gasPrice: 0 }
    );
    const ethBlock = await web3.eth.getBlock(tx.receipt.blockNumber);
    // logInfo("\x1b[46m%s\x1b[0m", "[Deposit] Gas used: " + tx.receipt.gasUsed);

    // Check if the correct fee amount was paid
    const callerEthBalanceAfter = await this.getOnchainBalance(
      caller,
      Constants.zeroAddress
    );
    assert(
      callerEthBalanceAfter.eq(
        callerEthBalanceBefore.sub(ethToSend).add(feeSurplus)
      ),
      "fee paid by the depositer needs to match exactly with the fee needed"
    );

    const eventArr: any = await this.getEventsFromContract(
      this.exchange,
      "DepositRequested",
      web3.eth.blockNumber
    );
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.accountID, eventObj.args.depositIdx];
    });

    const depositInfo: DepositInfo = {
      owner,
      token,
      amount,
      fee: feeETH,
      timestamp: ethBlock.timestamp,
      accountID: items[0][0].toNumber(),
      depositIdx: items[0][1].toNumber()
    };

    accountID = items[0][0].toNumber();

    if (accountID === this.accounts[exchangeID].length) {
      const account: Account = {
        accountID,
        owner,
        publicKeyX,
        publicKeyY,
        secretKey,
        nonce: 0
      };
      this.accounts[exchangeID].push(account);
    } else {
      const account = this.accounts[exchangeID][accountID];
      account.publicKeyX = publicKeyX;
      account.publicKeyY = publicKeyY;
      account.secretKey = secretKey;
    }

    const deposit = this.addDeposit(
      this.pendingDeposits[exchangeID],
      depositInfo.depositIdx,
      depositInfo.accountID,
      publicKeyX,
      publicKeyY,
      this.tokenAddressToIDMap.get(token),
      amount
    );
    deposit.timestamp = ethBlock.timestamp;
    deposit.transactionHash = tx.receipt.transactionHash;
    this.deposits[exchangeID].push(deposit);
    return depositInfo;
  }

  public async depositTo(accountID: number, token: string, amount: BN) {
    const account = this.accounts[this.exchangeId][accountID];
    return await this.deposit(
      this.exchangeId,
      account.owner,
      account.secretKey,
      account.publicKeyX,
      account.publicKeyY,
      token,
      amount
    );
  }

  public async depositToOwner(owner: string, token: string, amount: BN) {
    let accountID = await this.getAccountID(owner);
    if (accountID === undefined) {
      const keyPair = this.getKeyPairEDDSA();
      const depositInfo = await this.deposit(
        this.exchangeId,
        owner,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        token,
        amount
      );
      accountID = depositInfo.accountID;
    } else {
      await this.depositTo(accountID, token, amount);
    }
    return accountID;
  }

  public async requestInternalTransfer(
    exchangeID: number,
    accountFromID: number,
    accountToID: number,
    token: string,
    amount: BN,
    feeToken: string,
    fee: BN,
    label: number
  ) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    if (!feeToken.startsWith("0x")) {
      feeToken = this.testContext.tokenSymbolAddrMap.get(feeToken);
    }
    const transTokenID = this.tokenAddressToIDMap.get(token);
    const feeTokenID = this.tokenAddressToIDMap.get(feeToken);

    this.pendingInternalTransfers[exchangeID].push({
      accountFromID,
      accountToID,
      transTokenID,
      amount,
      feeTokenID,
      fee,
      label
    });

    return this.pendingInternalTransfers[exchangeID][
      this.pendingInternalTransfers[exchangeID].length - 1
    ];
  }

  public async requestWithdrawalOffchain(
    exchangeID: number,
    accountID: number,
    token: string,
    amount: BN,
    feeToken: string,
    fee: BN,
    label: number
  ) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    const tokenID = this.tokenAddressToIDMap.get(token);
    if (!feeToken.startsWith("0x")) {
      feeToken = this.testContext.tokenSymbolAddrMap.get(feeToken);
    }
    const feeTokenID = this.tokenAddressToIDMap.get(feeToken);
    this.addWithdrawalRequest(
      this.pendingOffchainWithdrawalRequests[exchangeID],
      accountID,
      tokenID,
      amount,
      feeTokenID,
      fee,
      label
    );
    return this.pendingOffchainWithdrawalRequests[exchangeID][
      this.pendingOffchainWithdrawalRequests[exchangeID].length - 1
    ];
  }

  public async requestWithdrawalOnchain(
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

    let numAvailableSlots = (await this.exchange.getNumAvailableWithdrawalSlots()).toNumber();
    if (this.autoCommit && numAvailableSlots === 0) {
      await this.commitOnchainWithdrawalRequests(exchangeID);
      numAvailableSlots = (await this.exchange.getNumAvailableWithdrawalSlots()).toNumber();
      assert(numAvailableSlots > 0, "numAvailableSlots > 0");
    }
    const withdrawalFee = (await this.exchange.getFees())._withdrawalFeeETH;

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
      tx = await this.exchange.withdraw(token, web3.utils.toBN(amount), {
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

    const eventArr: any = await this.getEventsFromContract(
      this.exchange,
      "WithdrawalRequested",
      web3.eth.blockNumber
    );
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.withdrawalIdx];
    });
    const withdrawalIdx = items[0][0].toNumber();

    const withdrawalRequest = this.addWithdrawalRequest(
      this.pendingOnchainWithdrawalRequests[exchangeID],
      accountID,
      tokenID,
      amount,
      tokenID,
      new BN(0),
      0,
      withdrawalIdx,
      withdrawalFee
    );
    withdrawalRequest.timestamp = ethBlock.timestamp;
    withdrawalRequest.transactionHash = tx.receipt.transactionHash;
    this.onchainWithdrawals[this.exchangeId].push(withdrawalRequest);
    return withdrawalRequest;
  }

  public async requestShutdownWithdrawal(
    exchangeID: number,
    accountID: number,
    token: string,
    amount: BN
  ) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    const tokenID = this.tokenAddressToIDMap.get(token);

    this.addWithdrawalRequest(
      this.pendingOnchainWithdrawalRequests[exchangeID],
      accountID,
      tokenID,
      amount,
      tokenID,
      new BN(0),
      0
    );
    return this.pendingOnchainWithdrawalRequests[exchangeID][
      this.pendingOnchainWithdrawalRequests[exchangeID].length - 1
    ];
  }

  public addDeposit(
    deposits: Deposit[],
    depositIdx: number,
    accountID: number,
    publicKeyX: string,
    publicKeyY: string,
    tokenID: number,
    amount: BN
  ) {
    const deposit: Deposit = {
      exchangeId: this.exchangeId,
      accountID,
      depositIdx,
      publicKeyX,
      publicKeyY,
      tokenID,
      amount
    };
    deposits.push(deposit);
    return deposit;
  }

  public addCancel(
    cancels: Cancel[],
    accountID: number,
    orderTokenID: number,
    orderID: number,
    feeTokenID: number,
    fee: BN,
    label: number
  ) {
    cancels.push({ accountID, orderTokenID, orderID, feeTokenID, fee, label });
  }

  public cancelOrderID(
    exchangeID: number,
    accountID: number,
    orderTokenID: number,
    orderID: number,
    feeTokenID: number,
    fee: BN,
    label: number
  ) {
    this.addCancel(
      this.pendingCancels[exchangeID],
      accountID,
      orderTokenID,
      orderID,
      feeTokenID,
      fee,
      label
    );
  }

  public cancelOrder(order: OrderInfo, feeToken: string, fee: BN) {
    if (!feeToken.startsWith("0x")) {
      feeToken = this.testContext.tokenSymbolAddrMap.get(feeToken);
    }
    const feeTokenID = this.tokenAddressToIDMap.get(feeToken);
    this.cancelOrderID(
      order.exchangeID,
      order.accountID,
      order.tokenIdS,
      order.orderID,
      feeTokenID,
      fee,
      order.label
    );
  }

  public addWithdrawalRequest(
    withdrawalRequests: WithdrawalRequest[],
    accountID: number,
    tokenID: number,
    amount: BN,
    feeTokenID: number,
    fee: BN,
    label: number,
    withdrawalIdx?: number,
    withdrawalFee?: BN
  ) {
    const withdrawalRequest: WithdrawalRequest = {
      exchangeId: this.exchangeId,
      accountID,
      tokenID,
      amount,
      feeTokenID,
      fee,
      label,
      withdrawalIdx,
      withdrawalFee
    };
    withdrawalRequests.push(withdrawalRequest);
    return withdrawalRequest;
  }

  public sendRing(exchangeID: number, ring: RingInfo) {
    this.pendingRings[exchangeID].push(ring);
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
    const nextBlockIdx = await this.getNumBlocksOnchain();
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

    return [nextBlockIdx, outputFilename];
  }

  public getPublicDataHashAndInput(data: string) {
    const publicDataHash =
      "0x" + SHA256(Buffer.from(data.slice(2), "hex")).toString("hex");
    const publicInput = new BN(publicDataHash.slice(2), 16)
      .shrn(3)
      .toString(10);
    return { publicDataHash, publicInput };
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
    filename: string
  ) {
    if (this.commitWrongPublicDataOnce) {
      data += "00";
      this.commitWrongPublicDataOnce = false;
    }
    const publicDataHashAndInput = this.getPublicDataHashAndInput(data);
    const publicDataHash = publicDataHashAndInput.publicDataHash;
    const publicInput = publicDataHashAndInput.publicInput;
    logDebug("[EVM]PublicData: " + data);
    logDebug("[EVM]PublicDataHash: " + publicDataHash);
    logDebug("[EVM]PublicInput: " + publicInput);

    const compressedData = compress(
      data,
      this.compressionType,
      this.lzDecompressor.address
    );

    // Make sure the keys are generated
    await this.generateKeys(filename);

    const numBlocksBefore = await this.getNumBlocksOnchain();

    const blockVersion = 0;
    let offchainData =
      this.getRandomInt(2) === 0
        ? "0x0ff" + this.blocks[this.exchangeId].length
        : "0x";
    if (offchainData.length % 2 == 1) {
      offchainData += "0";
    }
    const operatorContract = this.operator ? this.operator : this.exchange;
    const tx = await operatorContract.commitBlock(
      web3.utils.toBN(blockType),
      web3.utils.toBN(blockSize),
      web3.utils.toBN(blockVersion),
      web3.utils.hexToBytes(compressedData),
      web3.utils.hexToBytes(offchainData),
      { from: this.exchangeOperator }
    );
    const ethBlock = await web3.eth.getBlock(tx.receipt.blockNumber);

    logInfo(
      "\x1b[46m%s\x1b[0m",
      "[commitBlock] Gas used: " + tx.receipt.gasUsed
    );

    const numBlocksAfter = await this.getNumBlocksOnchain();
    assert.equal(
      numBlocksAfter,
      numBlocksBefore + 1,
      "block height should be incremented by 1"
    );

    // Check the BlockCommitted event
    const eventArr: any = await this.getEventsFromContract(
      this.exchange,
      "BlockCommitted",
      web3.eth.blockNumber
    );
    const items = eventArr.map((eventObj: any) => {
      return {
        blockIdx: eventObj.args.blockIdx.toNumber(),
        publicDataHash: eventObj.args.publicDataHash
      };
    });
    assert(items.length === 1, "a single BlockCommitted needs to be emited");
    assert.equal(
      items[0].blockIdx,
      numBlocksAfter - 1,
      "block index should be equal to block height"
    );
    assert.equal(
      items[0].publicDataHash.toString("hex"),
      publicDataHash,
      "public data hash needs to match"
    );

    const blockIdx = (await this.getNumBlocksOnchain()) - 1;

    // Check the block data
    const blockData = await this.exchange.getBlock(blockIdx);
    assert(
      blockData.blockState.toNumber() === BlockState.COMMITTED,
      "block state needs to be COMMITTED"
    );

    const block: Block = {
      blockIdx,
      filename,
      blockType,
      blockSize,
      blockVersion,
      blockState: BlockState.COMMITTED,
      operator: this.operator ? this.operator.address : this.exchangeOperator,
      origin: this.exchangeOperator,
      operatorId,
      data,
      offchainData,
      compressedData,
      publicDataHash,
      publicInput,
      blockFeeWithdrawn: false,
      blockFeeAmountWithdrawn: new BN(0),
      committedTimestamp: ethBlock.timestamp,
      transactionHash: tx.receipt.transactionHash
    };
    this.pendingBlocks[this.exchangeId].push(block);
    this.blocks[this.exchangeId].push(block);

    // Check the current state against the explorer state
    await this.checkExplorerState();

    return block;
  }

  public async generateKeys(blockFilename: string) {
    if(this.isProofComputingDisabled()) return true;

    const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));
    const blockVersion = 0;

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
      if (block.blockType === BlockType.RING_SETTLEMENT) {
        verificationKeyFilename += "trade";
      } else if (block.blockType === BlockType.DEPOSIT) {
        verificationKeyFilename += "deposit";
      } else if (block.blockType === BlockType.ONCHAIN_WITHDRAWAL) {
        verificationKeyFilename += "withdraw_onchain";
      } else if (block.blockType === BlockType.OFFCHAIN_WITHDRAWAL) {
        verificationKeyFilename += "withdraw_offchain";
      } else if (block.blockType === BlockType.ORDER_CANCELLATION) {
        verificationKeyFilename += "cancel";
      } else if (block.blockType === BlockType.INTERNAL_TRANSFER) {
        verificationKeyFilename += "internal_transfer";
      }
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

  public async verifyBlocks(blocks: Block[]) {
    if(this.isProofComputingDisabled()) return true;

    if (blocks.length === 0) {
      return;
    }
    // Generate proofs
    const blockIndices: number[] = [];
    const proofs: any[] = [];
    for (const block of blocks) {
      const blockData = JSON.parse(fs.readFileSync(block.filename, "ascii"));

      const proofFilename =
        "./blocks/block_" +
        blockData.exchangeID +
        "_" +
        block.blockIdx +
        "_proof.json";
      const result = childProcess.spawnSync(
        "build/circuit/dex_circuit",
        ["-prove", block.filename, proofFilename],
        { stdio: doDebugLogging() ? "inherit" : "ignore" }
      );
      assert(result.status === 0, "verifyBlock failed: " + block.filename);

      // Read the proof
      block.proof = this.flattenProof(
        JSON.parse(fs.readFileSync(proofFilename, "ascii"))
      );
      // console.log(proof);

      blockIndices.push(block.blockIdx);
      proofs.push(...block.proof);
    }

    const numBlocksFinalizedBefore = await this.getNumBlocksFinalizedOnchain();

    const blockDataBefore: any[] = [];
    for (const block of blocks) {
      blockDataBefore.push(await this.exchange.getBlock(block.blockIdx));
    }

    if (this.commitWrongProofOnce) {
      const proofIdxToModify = this.getRandomInt(proofs.length);
      proofs[proofIdxToModify] =
        "0x" +
        new BN(proofs[proofIdxToModify].slice(2), 16)
          .add(new BN(1))
          .toString(16);
      this.commitWrongProofOnce = false;
    }

    const operatorContract = this.operator ? this.operator : this.exchange;
    const tx = await operatorContract.verifyBlocks(blockIndices, proofs, {
      from: this.exchangeOperator
    });
    logInfo(
      "\x1b[46m%s\x1b[0m",
      "[verifyBlocks] Gas used: " + tx.receipt.gasUsed
    );
    const ethBlock = await web3.eth.getBlock(tx.receipt.blockNumber);

    // Block state before needs to be COMMITTED
    for (const blockData of blockDataBefore) {
      assert(
        blockData.blockState.toNumber() === BlockState.COMMITTED,
        "block state before needs to be COMMITTED"
      );
    }

    // Check the BlockVerified event(s)
    {
      const eventArr: any = await this.getEventsFromContract(
        this.exchange,
        "BlockVerified",
        web3.eth.blockNumber
      );
      const items = eventArr.map((eventObj: any) => {
        return { blockIdx: eventObj.args.blockIdx };
      });
      assert(
        items.length === blocks.length,
        "a single BlockVerified needs to be emited"
      );
      for (const [i, block] of blocks.entries()) {
        assert(
          items[i].blockIdx.eq(web3.utils.toBN(block.blockIdx)),
          "block index should be equal to block idx sent"
        );
      }
    }

    // Check the block data
    for (const block of blocks) {
      const blockDataAfter = await this.exchange.getBlock(block.blockIdx);
      assert(
        blockDataAfter.blockState.toNumber() === BlockState.VERIFIED,
        "block state after needs to be VERIFIED"
      );
    }

    // Check numBlocksFinalized
    const numBlocksFinalizedAfter = await this.getNumBlocksFinalizedOnchain();
    const numBlocks = await this.getNumBlocksOnchain();
    let numBlockFinalizedExpected = 0;
    let idx = numBlocksFinalizedBefore;
    while (
      idx < numBlocks &&
      (await this.exchange.getBlock(idx)).blockState.toNumber() ===
        BlockState.VERIFIED
    ) {
      numBlockFinalizedExpected++;
      idx++;
    }
    assert.equal(
      numBlocksFinalizedAfter,
      numBlocksFinalizedBefore + numBlockFinalizedExpected,
      "num blocks finalized different than expected"
    );

    // Check for BlockFinalized events
    {
      const eventArr: any = await this.getEventsFromContract(
        this.exchange,
        "BlockFinalized",
        web3.eth.blockNumber
      );
      const items = eventArr.map((eventObj: any) => {
        return { blockIdx: eventObj.args.blockIdx.toNumber() };
      });
      assert.equal(
        items.length,
        numBlockFinalizedExpected,
        "different number of blocks finalized than expected"
      );
      const startIdx = numBlocksFinalizedBefore;
      for (let i = startIdx; i < startIdx + numBlockFinalizedExpected; i++) {
        assert.equal(
          items[i - startIdx].blockIdx,
          i,
          "finalized blockIdx needs to match"
        );
      }
    }

    // Update test state
    for (const block of blocks) {
      assert.equal(
        block.blockState,
        BlockState.COMMITTED,
        "incorrect block state"
      );
      block.blockState = BlockState.VERIFIED;
      block.verifiedTimestamp = ethBlock.timestamp;
    }

    const exchangeBlocks = this.blocks[this.exchangeId];
    for (let i = 1; i < exchangeBlocks.length; i++) {
      if (
        (exchangeBlocks[i - 1].blockState === BlockState.FINALIZED &&
          exchangeBlocks[i].blockState === BlockState.VERIFIED) ||
        exchangeBlocks[i].blockState === BlockState.FINALIZED
      ) {
        if (exchangeBlocks[i].blockState === BlockState.VERIFIED) {
          exchangeBlocks[i].blockState = BlockState.FINALIZED;
          exchangeBlocks[i].finalizedTimestamp = ethBlock.timestamp;
        }
      } else {
        assert.equal(
          i,
          numBlocksFinalizedAfter,
          "unexpected number of finalized blocks"
        );
        break;
      }
    }

    // Check the current state against the explorer state
    await this.checkExplorerState();

    return proofs;
  }

  public async verifyPendingBlocks(exchangeID: number) {
    // Sort the blocks for batching
    const blocks: Block[] = this.pendingBlocks[exchangeID].sort(
      (blockA: Block, blockB: Block) => {
        const getKey = (block: Block) => {
          let key = 0;
          key |= block.blockType;
          key <<= 16;
          key |= block.blockSize;
          key <<= 8;
          key |= block.blockVersion;
          return key;
        };
        const keyA = getKey(blockA);
        const keyB = getKey(blockB);
        return keyA - keyB;
      }
    );
    // Verify the blocks batched
    let batch: Block[] = [];
    for (let i = 0; i < blocks.length; i++) {
      if (batch.length === 0) {
        batch.push(blocks[i]);
      } else {
        // Make sure the batch only contains blocks that use the same
        // verification key. Also make sure the batch is small enough
        // to stay within the Ethereum block gas limit.
        if (
          batch[0].blockType === blocks[i].blockType &&
          batch[0].blockSize === blocks[i].blockSize &&
          batch[0].blockVersion === blocks[i].blockVersion &&
          batch.length < 16
        ) {
          batch.push(blocks[i]);
        } else {
          await this.verifyBlocks(batch);
          batch = [blocks[i]];
        }
      }
    }
    await this.verifyBlocks(batch);
    this.pendingBlocks[exchangeID] = [];
  }

  public getPendingDeposits(exchangeID: number) {
    const pendingDeposits: Deposit[] = [];
    for (const pendingDeposit of this.pendingDeposits[exchangeID]) {
      pendingDeposits.push(pendingDeposit);
    }
    return pendingDeposits;
  }

  public getPendingOnchainWithdrawals(exchangeID: number) {
    const pendingWithdrawals: WithdrawalRequest[] = [];
    for (const pendingWithdrawal of this.pendingOnchainWithdrawalRequests[
      exchangeID
    ]) {
      pendingWithdrawals.push(pendingWithdrawal);
    }
    return pendingWithdrawals;
  }

  public async commitDeposits(
    exchangeID: number,
    pendingDeposits?: Deposit[],
    forcedBlockSize?: number
  ) {
    const blockInfos: Block[] = [];

    if (pendingDeposits === undefined) {
      pendingDeposits = this.pendingDeposits[exchangeID];
    }
    if (pendingDeposits.length === 0) {
      return [];
    }

    let numDepositsDone = 0;
    while (numDepositsDone < pendingDeposits.length) {
      const deposits: Deposit[] = [];
      let numRequestsInBlock = 0;

      // Get all deposits for the block
      const blockSize = forcedBlockSize
        ? forcedBlockSize
        : this.getBestBlockSize(
            pendingDeposits.length - numDepositsDone,
            this.depositBlockSizes
          );
      for (let b = numDepositsDone; b < numDepositsDone + blockSize; b++) {
        if (b < pendingDeposits.length) {
          deposits.push(pendingDeposits[b]);
          numRequestsInBlock++;
        } else {
          const dummyDeposit: Deposit = {
            exchangeId: this.exchangeId,
            depositIdx: 0,
            accountID: 0,
            publicKeyX: "0",
            publicKeyY: "0",
            tokenID: 0,
            amount: new BN(0)
          };
          deposits.push(dummyDeposit);
        }
      }
      assert(deposits.length === blockSize);
      numDepositsDone += blockSize;

      const startIndex = (await this.exchange.getNumDepositRequestsProcessed()).toNumber();
      // console.log("startIndex: " + startIndex);
      // console.log("numRequestsProcessed: " + numRequestsProcessed);
      const firstRequestData = await this.exchange.getDepositRequest(
        startIndex - 1
      );
      const startingHash = firstRequestData.accumulatedHash;
      // console.log(requestData);

      // Calculate ending hash
      let endingHash = startingHash;
      for (const deposit of deposits) {
        const hashData = new Bitstream();
        hashData.addHex(endingHash);
        hashData.addNumber(deposit.accountID, 3);
        hashData.addBN(new BN(deposit.publicKeyX, 10), 32);
        hashData.addBN(new BN(deposit.publicKeyY, 10), 32);
        hashData.addNumber(deposit.tokenID, 1);
        hashData.addBN(deposit.amount, 12);
        endingHash =
          "0x" +
          SHA256(Buffer.from(hashData.getData().slice(2), "hex")).toString(
            "hex"
          );
      }

      // Block info
      const depositBlock: DepositBlock = {
        onchainDataAvailability: false,
        startHash: new BN(startingHash.slice(2), 16),
        deposits,
        startIndex,
        count: numRequestsInBlock
      };

      // Store state before
      const currentBlockIdx = (await this.getNumBlocksOnchain()) - 1;
      const stateBefore = await this.loadExchangeState(
        exchangeID,
        currentBlockIdx
      );

      const [idx, blockFilename] = await this.createBlock(
        exchangeID,
        1,
        JSON.stringify(depositBlock, replacer, 4)
      );

      // Store state after
      const stateAfter = await this.loadExchangeState(
        exchangeID,
        currentBlockIdx + 1
      );

      // Validate state change
      this.validateDeposits(deposits, stateBefore, stateAfter);

      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));
      const bs = new Bitstream();
      bs.addNumber(block.exchangeID, 4);
      bs.addBN(new BN(block.merkleRootBefore, 10), 32);
      bs.addBN(new BN(block.merkleRootAfter, 10), 32);
      bs.addBN(new BN(startingHash.slice(2), 16), 32);
      bs.addBN(new BN(endingHash.slice(2), 16), 32);
      bs.addNumber(startIndex, 4);
      bs.addNumber(numRequestsInBlock, 4);

      const numAvailableSlotsBefore = await this.exchange.getNumAvailableDepositSlots();
      const numDepositRequestsProcessedBefore = await this.exchange.getNumDepositRequestsProcessed();

      // Commit the block
      const operator = await this.getActiveOperator(exchangeID);
      const blockInfo = await this.commitBlock(
        operator,
        BlockType.DEPOSIT,
        blockSize,
        bs.getData(),
        blockFilename
      );

      const numAvailableSlotsAfter = await this.exchange.getNumAvailableDepositSlots();
      const numDepositRequestsProcessedAfter = await this.exchange.getNumDepositRequestsProcessed();
      assert(
        numAvailableSlotsAfter.eq(
          numAvailableSlotsBefore.add(new BN(numRequestsInBlock))
        ),
        "num available deposit slots should be increased by the number of deposit requests processed"
      );
      assert(
        numDepositRequestsProcessedAfter.eq(
          numDepositRequestsProcessedBefore.add(new BN(numRequestsInBlock))
        ),
        "total num deposits processed should be increased by the number of deposit requests processed"
      );

      blockInfos.push(blockInfo);
    }

    this.pendingDeposits[exchangeID] = [];

    return blockInfos;
  }

  public async loadExchangeState(exchangeID: number, blockIdx?: number) {
    // Read in the state
    if (blockIdx === undefined) {
      blockIdx = (await this.getNumBlocksOnchain()) - 1;
    }
    const accounts: AccountLeaf[] = [];
    if (blockIdx > 0) {
      const stateFile = "states/state_" + exchangeID + "_" + blockIdx + ".json";
      const jState = JSON.parse(fs.readFileSync(stateFile, "ascii"));

      const accountsKeys: string[] = Object.keys(jState.accounts_values);
      let numAccounts = 1;
      for (const accountKey of accountsKeys) {
        numAccounts =
          Number(accountKey) >= numAccounts
            ? Number(accountKey) + 1
            : numAccounts;
      }
      for (let i = 0; i < numAccounts; i++) {
        const emptyAccount: AccountLeaf = {
          publicKeyX: "0",
          publicKeyY: "0",
          nonce: 0,
          balances: {}
        };
        accounts.push(emptyAccount);
      }
      for (const accountKey of accountsKeys) {
        const jAccount = jState.accounts_values[accountKey];

        const balances: { [key: number]: Balance } = {};
        const balancesKeys: string[] = Object.keys(jAccount._balancesLeafs);
        for (const balanceKey of balancesKeys) {
          const jBalance = jAccount._balancesLeafs[balanceKey];

          const tradeHistory: { [key: number]: TradeHistory } = {};
          const tradeHistoryKeys: string[] = Object.keys(
            jBalance._tradeHistoryLeafs
          );
          for (const tradeHistoryKey of tradeHistoryKeys) {
            const jTradeHistory = jBalance._tradeHistoryLeafs[tradeHistoryKey];
            tradeHistory[Number(tradeHistoryKey)] = {
              filled: new BN(jTradeHistory.filled, 10),
              cancelled: jTradeHistory.cancelled === 1,
              orderID: jTradeHistory.orderID
            };
          }
          balances[Number(balanceKey)] = {
            balance: new BN(jBalance.balance, 10),
            tradeHistory
          };
        }
        const account: AccountLeaf = {
          publicKeyX: jAccount.publicKeyX,
          publicKeyY: jAccount.publicKeyY,
          nonce: jAccount.nonce,
          balances
        };
        accounts[Number(accountKey)] = account;
      }
    } else {
      const emptyAccount: AccountLeaf = {
        publicKeyX: "0",
        publicKeyY: "0",
        nonce: 0,
        balances: {}
      };
      accounts.push(emptyAccount);
    }

    // Make sure all tokens exist
    for (const account of accounts) {
      for (let i = 0; i < this.MAX_NUM_TOKENS; i++) {
        if (!account.balances[i]) {
          account.balances[i] = {
            balance: new BN(0),
            tradeHistory: {}
          };
        }
      }
    }

    const exchangeState: ExchangeState = {
      accounts
    };
    return exchangeState;
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

  public async commitWithdrawalRequests(
    onchain: boolean,
    exchangeID: number,
    shutdown: boolean = false
  ) {
    let pendingWithdrawals: WithdrawalRequest[];
    if (onchain) {
      pendingWithdrawals = this.pendingOnchainWithdrawalRequests[exchangeID];
    } else {
      pendingWithdrawals = this.pendingOffchainWithdrawalRequests[exchangeID];
    }
    if (pendingWithdrawals.length === 0) {
      return;
    }

    const blockType = onchain
      ? BlockType.ONCHAIN_WITHDRAWAL
      : BlockType.OFFCHAIN_WITHDRAWAL;

    let numWithdrawalsDone = 0;
    while (numWithdrawalsDone < pendingWithdrawals.length) {
      const withdrawals: WithdrawalRequest[] = [];
      let numRequestsInBlock = 0;
      // Get all withdrawals for the block
      const blockSizes = onchain
        ? this.onchainWithdrawalBlockSizes
        : this.offchainWithdrawalBlockSizes;
      const blockSize = this.getBestBlockSize(
        pendingWithdrawals.length - numWithdrawalsDone,
        blockSizes
      );
      for (
        let b = numWithdrawalsDone;
        b < numWithdrawalsDone + blockSize;
        b++
      ) {
        if (b < pendingWithdrawals.length) {
          pendingWithdrawals[b].slotIdx = withdrawals.length;
          withdrawals.push(pendingWithdrawals[b]);
          numRequestsInBlock++;
        } else {
          const dummyWithdrawalRequest: WithdrawalRequest = {
            exchangeId: this.exchangeId,
            accountID: onchain ? 0 : this.dummyAccountId,
            tokenID: 0,
            amount: new BN(0),
            feeTokenID: 1,
            fee: new BN(0),
            label: 0
          };
          withdrawals.push(dummyWithdrawalRequest);
        }
      }
      assert(withdrawals.length === blockSize);
      numWithdrawalsDone += blockSize;

      // Hash the labels
      const labels: number[] = [];
      for (const withdrawal of withdrawals) {
        labels.push(withdrawal.label);
      }
      const labelHash = this.hashLabels(labels);

      if (!onchain) {
        // Sign the offchain withdrawals
        for (const withdrawal of withdrawals) {
          this.signWithdrawal(withdrawal);
        }
      }

      const startIndex = (await this.exchange.getNumWithdrawalRequestsProcessed()).toNumber();
      // console.log("startIndex: " + startIndex);
      // console.log("numRequestsProcessed: " + numRequestsProcessed);
      const firstRequestData = await this.exchange.getWithdrawRequest(
        startIndex - 1
      );
      const startingHash = firstRequestData.accumulatedHash;
      // console.log(requestData);

      // Calculate ending hash
      let endingHash = startingHash;
      for (const withdrawal of withdrawals) {
        const hashData = new Bitstream();
        hashData.addHex(endingHash);
        hashData.addNumber(withdrawal.accountID, 3);
        hashData.addNumber(withdrawal.tokenID, 1);
        hashData.addBN(withdrawal.amount, 12);
        logInfo("withdrawal.accountID: " + withdrawal.accountID);
        logInfo("withdrawal.tokenID: " + withdrawal.tokenID);
        logInfo("withdrawal.amount: " + withdrawal.amount.toString(10));
        endingHash =
          "0x" +
          SHA256(Buffer.from(hashData.getData().slice(2), "hex")).toString(
            "hex"
          );
      }

      // Block info
      const operator = await this.getActiveOperator(exchangeID);
      const withdrawalBlock: WithdrawBlock = {
        withdrawals,
        onchainDataAvailability: this.onchainDataAvailability,
        operatorAccountID: onchain ? 0 : operator,
        startHash: onchain ? new BN(startingHash.slice(2), 16) : new BN(0),
        startIndex: onchain ? startIndex : 0,
        count: shutdown ? 0 : onchain ? numRequestsInBlock : 0
      };

      // Store state before
      const currentBlockIdx = (await this.getNumBlocksOnchain()) - 1;
      const stateBefore = await this.loadExchangeState(
        exchangeID,
        currentBlockIdx
      );

      const jWithdrawalsInfo = JSON.stringify(withdrawalBlock, replacer, 4);
      const [blockIdx, blockFilename] = await this.createBlock(
        exchangeID,
        blockType,
        jWithdrawalsInfo
      );

      // Store state after
      const stateAfter = await this.loadExchangeState(
        exchangeID,
        currentBlockIdx + 1
      );

      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));
      const bs = new Bitstream();
      bs.addNumber(block.exchangeID, 4);
      bs.addBN(new BN(block.merkleRootBefore, 10), 32);
      bs.addBN(new BN(block.merkleRootAfter, 10), 32);
      if (onchain) {
        bs.addBN(new BN(startingHash.slice(2), 16), 32);
        bs.addBN(new BN(endingHash.slice(2), 16), 32);
        bs.addNumber(block.startIndex, 4);
        bs.addNumber(block.count, 4);
      }
      for (const withdrawal of block.withdrawals) {
        bs.addNumber(withdrawal.tokenID, 1);
        bs.addNumber(
          withdrawal.accountID * 2 ** 28 + withdrawal.fAmountWithdrawn,
          6
        );
      }
      if (!onchain) {
        bs.addBN(new BN(labelHash, 10), 32);
        if (block.onchainDataAvailability) {
          bs.addNumber(block.operatorAccountID, 3);
          for (const withdrawal of block.withdrawals) {
            bs.addNumber(withdrawal.feeTokenID, 1);
            bs.addNumber(
              toFloat(new BN(withdrawal.fee), Constants.Float16Encoding),
              2
            );
          }
        }
      }

      // Validate state change
      if (onchain) {
        this.validateOnchainWithdrawals(
          withdrawalBlock,
          stateBefore,
          stateAfter
        );
      } else {
        this.validateOffchainWithdrawals(
          withdrawalBlock,
          bs,
          stateBefore,
          stateAfter
        );
      }

      const numAvailableSlotsBefore = await this.exchange.getNumAvailableWithdrawalSlots();
      const numWithdrawalRequestsProcessedBefore = await this.exchange.getNumWithdrawalRequestsProcessed();

      // Commit the block
      await this.commitBlock(
        operator,
        blockType,
        blockSize,
        bs.getData(),
        blockFilename
      );

      const numAvailableSlotsAfter = await this.exchange.getNumAvailableWithdrawalSlots();
      const numWithdrawalRequestsProcessedAfter = await this.exchange.getNumWithdrawalRequestsProcessed();
      if (onchain) {
        const numRequestsProcessed = shutdown
          ? new BN(0)
          : new BN(numRequestsInBlock);
        assert(
          numAvailableSlotsAfter.eq(
            numAvailableSlotsBefore.add(numRequestsProcessed)
          ),
          "num available withdrawal slots should be increased by the number of withdrawal requests processed"
        );
        assert(
          numWithdrawalRequestsProcessedAfter.eq(
            numWithdrawalRequestsProcessedBefore.add(numRequestsProcessed)
          ),
          "total num withdrawals processed should be increased by the number of withdrawal requests processed"
        );
      } else {
        assert(
          numAvailableSlotsAfter.eq(numAvailableSlotsBefore),
          "num available withdrawal slots should remain the same"
        );
        assert(
          numWithdrawalRequestsProcessedAfter.eq(
            numWithdrawalRequestsProcessedBefore
          ),
          "total num withdrawals processed should remain the same"
        );
      }

      // Add as a pending withdrawal
      let withdrawalIdx = 0;
      for (const withdrawalRequest of block.withdrawals) {
        const withdrawal: Withdrawal = {
          exchangeID,
          blockIdx,
          withdrawalIdx
        };
        this.pendingWithdrawals.push(withdrawal);
        withdrawalIdx++;
      }
    }

    if (onchain) {
      this.pendingOnchainWithdrawalRequests[exchangeID] = [];
    } else {
      this.pendingOffchainWithdrawalRequests[exchangeID] = [];
    }
  }

  public async commitInternalTransfers(exchangeID: number) {
    let pendingTransfers = this.pendingInternalTransfers[exchangeID];

    if (pendingTransfers.length === 0) {
      return;
    }

    const blockType = BlockType.INTERNAL_TRANSFER;

    let numTransferDone = 0;
    while (numTransferDone < pendingTransfers.length) {
      const transfers: InternalTransferRequest[] = [];
      let numRequestsInBlock = 0;
      // Get all transfers for the block
      const blockSizes = this.transferBlockSizes;
      const blockSize = this.getBestBlockSize(
        pendingTransfers.length - numTransferDone,
        blockSizes
      );
      for (let b = numTransferDone; b < numTransferDone + blockSize; b++) {
        if (b < pendingTransfers.length) {
          transfers.push(pendingTransfers[b]);
          numRequestsInBlock++;
        } else {
          const dummyInternalTransferRequest: InternalTransferRequest = {
            accountFromID: this.dummyAccountId,
            accountToID: this.dummyAccountId,
            transTokenID: 0,
            amount: new BN(0),
            feeTokenID: 0,
            fee: new BN(0),
            label: 0
          };
          transfers.push(dummyInternalTransferRequest);
        }
      }
      assert(transfers.length === blockSize);
      numTransferDone += blockSize;

      // Hash the labels
      const labels: number[] = [];
      for (const transfer of transfers) {
        labels.push(transfer.label);
      }
      const labelHash = this.hashLabels(labels);

      // Sign the offchain withdrawals
      for (const transfer of transfers) {
        this.signInternalTransfer(transfer);
      }

      // Block info
      const operator = await this.getActiveOperator(exchangeID);
      const internalTransferBlock: InternalTransferBlock = {
        transfers,
        onchainDataAvailability: this.onchainDataAvailability,
        operatorAccountID: operator
      };

      // Store state before
      const currentBlockIdx = (await this.exchange.getBlockHeight()).toNumber();
      const stateBefore = await this.loadExchangeState(
        exchangeID,
        currentBlockIdx
      );

      const jWithdrawalsInfo = JSON.stringify(
        internalTransferBlock,
        replacer,
        4
      );
      const [blockIdx, blockFilename] = await this.createBlock(
        exchangeID,
        blockType,
        jWithdrawalsInfo
      );

      // Store state after
      const stateAfter = await this.loadExchangeState(
        exchangeID,
        currentBlockIdx + 1
      );

      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));
      const bs = new Bitstream();
      bs.addNumber(block.exchangeID, 4);
      bs.addBN(new BN(block.merkleRootBefore, 10), 32);
      bs.addBN(new BN(block.merkleRootAfter, 10), 32);
      bs.addBN(new BN(labelHash, 10), 32);
      if (block.onchainDataAvailability) {
        bs.addNumber(block.operatorAccountID, 3);
        for (const transfer of block.transfers) {
          bs.addNumber(
            transfer.accountFromID * 2 ** Constants.NUM_BITS_ACCOUNTID +
              transfer.accountToID,
            5
          ); // 20bits * 2
          bs.addNumber(transfer.transTokenID, 1); // 8 bit
          bs.addNumber(transfer.fAmountTrans, 3); // 24 bit
          bs.addNumber(transfer.feeTokenID, 1); // 8 bit
          bs.addNumber(
            toFloat(new BN(transfer.fee), Constants.Float16Encoding),
            2
          ); // 16 bit
        }
      }

      // Validate state change
      this.validateInternalTranfers(
        internalTransferBlock,
        bs,
        stateBefore,
        stateAfter
      );

      // Commit the block
      await this.commitBlock(
        operator,
        blockType,
        blockSize,
        bs.getData(),
        blockFilename
      );
    }

    this.pendingInternalTransfers[exchangeID] = [];
  }

  public async commitOffchainWithdrawalRequests(exchangeID: number) {
    return this.commitWithdrawalRequests(false, exchangeID);
  }

  public async commitOnchainWithdrawalRequests(exchangeID: number) {
    return this.commitWithdrawalRequests(true, exchangeID);
  }

  public async commitShutdownWithdrawalRequests(exchangeID: number) {
    return this.commitWithdrawalRequests(true, exchangeID, true);
  }

  public async submitPendingWithdrawals(addressBook?: {
    [id: string]: string;
  }) {
    for (const withdrawal of this.pendingWithdrawals) {
      const txw = await this.exchange.withdraw(
        web3.utils.toBN(withdrawal.exchangeID),
        web3.utils.toBN(withdrawal.blockIdx),
        web3.utils.toBN(withdrawal.withdrawalIdx)
      );

      const eventArr: any = await this.getEventsFromContract(
        this.exchange,
        "Withdraw",
        web3.eth.blockNumber
      );
      const items = eventArr.map((eventObj: any) => {
        return [eventObj.args.to, eventObj.args.tokenID, eventObj.args.amount];
      });
      const tokenID = items[0][1].toNumber();
      const tokenAddress = this.tokenIDToAddressMap.get(tokenID);
      const to = addressBook ? addressBook[items[0][0]] : items[0][0];
      const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(tokenAddress);
      const decimals = this.testContext.tokenAddrDecimalsMap.get(tokenAddress);
      const amount = items[0][2]
        .div(web3.utils.toBN(10 ** decimals))
        .toString(10);
      logInfo("Withdrawn: " + to + ": " + amount + " " + tokenSymbol);
    }

    this.pendingWithdrawals = [];
  }

  public hashLabels(labels: number[]) {
    const hasher = Poseidon.createHash(66, 6, 56);
    const numInputs = 64;

    const numStages = Math.floor((labels.length + numInputs - 1) / numInputs);
    const stageHashes: any[] = [];
    for (let i = 0; i < numStages; i++) {
      const inputs: number[] = [];
      inputs.push(i == 0 ? 0 : stageHashes[stageHashes.length - 1]);
      for (let j = 0; j < numInputs; j++) {
        const labelIdx = i * numInputs + j;
        inputs.push(labelIdx < labels.length ? labels[labelIdx] : 0);
      }
      stageHashes.push(hasher(inputs));
    }

    const hash = stageHashes[stageHashes.length - 1];
    logDebug("[JS] labels hash: " + hash.toString(10));
    return hash;
  }

  public async commitRings(exchangeID: number, forcedBlockSize?: number) {
    const pendingRings = this.pendingRings[exchangeID];
    if (pendingRings.length === 0) {
      return [];
    }

    // Generate the token transfers for the ring
    const blockNumber = await web3.eth.getBlockNumber();
    const timestamp = (await web3.eth.getBlock(blockNumber)).timestamp + 30;

    let numRingsDone = 0;
    const blocks: Block[] = [];
    while (numRingsDone < pendingRings.length) {
      // Get all rings for the block
      const blockSize = forcedBlockSize
        ? forcedBlockSize
        : this.getBestBlockSize(
            pendingRings.length - numRingsDone,
            this.ringSettlementBlockSizes
          );
      const rings: RingInfo[] = [];
      for (let b = numRingsDone; b < numRingsDone + blockSize; b++) {
        if (b < pendingRings.length) {
          rings.push(pendingRings[b]);
        } else {
          rings.push(this.dummyRing);
        }
      }
      assert(rings.length === blockSize);
      numRingsDone += blockSize;

      // Hash the labels
      const labels: number[] = [];
      for (const ring of rings) {
        labels.push(ring.orderA.label);
        labels.push(ring.orderB.label);
      }
      const labelHash = this.hashLabels(labels);

      const currentBlockIdx = (await this.getNumBlocksOnchain()) - 1;

      const protocolFees = await this.exchange.getProtocolFeeValues();
      const protocolTakerFeeBips = protocolFees.takerFeeBips.toNumber();
      const protocolMakerFeeBips = protocolFees.makerFeeBips.toNumber();

      const operator = await this.getActiveOperator(exchangeID);
      const ringBlock: RingBlock = {
        rings,
        onchainDataAvailability: this.onchainDataAvailability,
        timestamp,
        protocolTakerFeeBips,
        protocolMakerFeeBips,
        exchangeID,
        operatorAccountID: operator
      };

      // Store state before
      const stateBefore = await this.loadExchangeStateForRingBlock(
        exchangeID,
        currentBlockIdx,
        ringBlock
      );

      // Create the block
      const [blockIdx, blockFilename] = await this.createBlock(
        exchangeID,
        0,
        JSON.stringify(ringBlock, replacer, 4),
        false
      );

      // Read in the block
      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

      // Pack the data that needs to be committed onchain
      const bs = new Bitstream();
      bs.addNumber(exchangeID, 4);
      bs.addBN(new BN(block.merkleRootBefore, 10), 32);
      bs.addBN(new BN(block.merkleRootAfter, 10), 32);
      bs.addNumber(ringBlock.timestamp, 4);
      bs.addNumber(ringBlock.protocolTakerFeeBips, 1);
      bs.addNumber(ringBlock.protocolMakerFeeBips, 1);
      bs.addBN(new BN(labelHash, 10), 32);
      const da = new Bitstream();
      if (block.onchainDataAvailability) {
        bs.addNumber(block.operatorAccountID, 3);
        for (const ringSettlement of block.ringSettlements) {
          const ring = ringSettlement.ring;
          const orderA = ringSettlement.ring.orderA;
          const orderB = ringSettlement.ring.orderB;

          da.addNumber(
            orderA.orderID * 2 ** Constants.NUM_BITS_ORDERID + orderB.orderID,
            5
          );
          da.addNumber(
            orderA.accountID * 2 ** Constants.NUM_BITS_ACCOUNTID +
              orderB.accountID,
            5
          );

          da.addNumber(orderA.tokenS, 1);
          da.addNumber(ring.fFillS_A, 3);
          let buyMask = orderA.buy ? 0b10000000 : 0;
          let rebateMask = orderA.rebateBips > 0 ? 0b01000000 : 0;
          da.addNumber(
            buyMask + rebateMask + orderA.feeBips + orderA.rebateBips,
            1
          );

          da.addNumber(orderB.tokenS, 1);
          da.addNumber(ring.fFillS_B, 3);
          buyMask = orderB.buy ? 0b10000000 : 0;
          rebateMask = orderB.rebateBips > 0 ? 0b01000000 : 0;
          da.addNumber(
            buyMask + rebateMask + orderB.feeBips + orderB.rebateBips,
            1
          );
        }
      }
      if (block.onchainDataAvailability) {
        // Apply circuit transfrom
        const transformedData = this.transformRingSettlementsData(da.getData());
        bs.addHex(transformedData);
      }

      // Write the block signature
      const publicDataHashAndInput = this.getPublicDataHashAndInput(
        bs.getData()
      );
      this.signRingBlock(block, publicDataHashAndInput.publicInput);
      fs.writeFileSync(
        blockFilename,
        JSON.stringify(block, undefined, 4),
        "utf8"
      );

      // Validate the block after generating the signature
      await this.validateBlock(blockFilename);

      // Store state after
      const stateAfter = await this.loadExchangeStateForRingBlock(
        exchangeID,
        currentBlockIdx + 1,
        ringBlock
      );

      // Validate state change
      this.validateRingSettlements(
        ringBlock,
        bs.getData(),
        stateBefore,
        stateAfter
      );

      // Commit the block
      const blockInfo = await this.commitBlock(
        operator,
        BlockType.RING_SETTLEMENT,
        blockSize,
        bs.getData(),
        blockFilename
      );
      blocks.push(blockInfo);
    }

    this.pendingRings[exchangeID] = [];
    return blocks;
  }

  public getRingTransformations() {
    const ranges: Range[][] = [];
    ranges.push([{ offset: 0, length: 5 }]); // orderA.orderID + orderB.orderID
    ranges.push([{ offset: 5, length: 5 }]); // orderA.accountID + orderB.accountID
    ranges.push([{ offset: 10, length: 1 }, { offset: 15, length: 1 }]); // orderA.tokenS + orderB.tokenS
    ranges.push([{ offset: 11, length: 3 }, { offset: 16, length: 3 }]); // orderA.fillS + orderB.fillS
    ranges.push([{ offset: 14, length: 1 }]); // orderA.data
    ranges.push([{ offset: 19, length: 1 }]); // orderB.data
    return ranges;
  }

  public transformRingSettlementsData(input: string) {
    // Compress
    const bs = new Bitstream(input);
    const compressed = new Bitstream();
    const ringSize = 20;
    compressed.addHex(bs.extractData(0, bs.length()));
    /*for (let offset = ringSize; offset < bs.length(); offset += ringSize) {
      for (let i = 0; i < 5; i++) {
        const previousRingData = bs.extractUint8(offset + i - ringSize);
        const currentRingData = bs.extractUint8(offset + i);
        const data = previousRingData ^ currentRingData;
        compressed.addNumber(data, 1);
      }
      compressed.addHex(bs.extractData(offset + 5, ringSize - 5));
    }*/
    // Transform
    const ranges = this.getRingTransformations();
    const transformed = new Bitstream();
    for (const subranges of ranges) {
      for (let offset = 0; offset < compressed.length(); offset += ringSize) {
        for (const subrange of subranges) {
          transformed.addHex(
            compressed.extractData(offset + subrange.offset, subrange.length)
          );
        }
      }
    }
    return transformed.getData();
  }

  public replaceAt(data: string, index: number, replacement: string) {
    return (
      data.substr(0, index) +
      replacement +
      data.substr(index + replacement.length)
    );
  }

  public inverseTransformRingSettlementsData(input: string) {
    // Inverse Transform
    const transformed = new Bitstream(input);
    const ringSize = 20;
    const numRings = transformed.length() / ringSize;
    const ranges = this.getRingTransformations();
    const compressed = new Bitstream();
    for (let r = 0; r < numRings; r++) {
      let offset = 0;
      let ringData = "00".repeat(ringSize);
      for (const subranges of ranges) {
        let totalRangeLength = 0;
        for (const subrange of subranges) {
          totalRangeLength += subrange.length;
        }
        let partialRangeLength = 0;
        for (const subrange of subranges) {
          const dataPart = transformed.extractData(
            offset + totalRangeLength * r + partialRangeLength,
            subrange.length
          );
          ringData = this.replaceAt(ringData, subrange.offset * 2, dataPart);
          partialRangeLength += subrange.length;
        }
        offset += totalRangeLength * numRings;
      }
      compressed.addHex(ringData);
    }

    // Decompress
    const bs = new Bitstream();
    bs.addHex(compressed.extractData(0, ringSize * numRings));
    /*for (let r = 1; r < numRings; r++) {
      for (let i = 0; i < 5; i++) {
        const previousRingData = bs.extractUint8((r - 1) * ringSize + i);
        const delta = compressed.extractUint8(r * ringSize + i);
        const reconstructedData = previousRingData ^ delta;
        bs.addNumber(reconstructedData, 1);
      }
      bs.addHex(compressed.extractData(r * ringSize + 5, ringSize - 5));
    }*/
    return bs.getData();
  }

  public cancelPendingRings(exchangeID: number) {
    this.pendingRings[exchangeID] = [];
  }

  public async commitCancels(exchangeID: number) {
    const pendingCancels = this.pendingCancels[exchangeID];
    if (pendingCancels.length === 0) {
      return;
    }

    let numCancelsDone = 0;
    while (numCancelsDone < pendingCancels.length) {
      // Get all cancels for the block
      const blockSize = this.getBestBlockSize(
        pendingCancels.length - numCancelsDone,
        this.depositBlockSizes
      );
      const cancels: Cancel[] = [];
      for (let b = numCancelsDone; b < numCancelsDone + blockSize; b++) {
        if (b < pendingCancels.length) {
          cancels.push(pendingCancels[b]);
        } else {
          const dummyCancel: Cancel = {
            accountID: this.dummyAccountId,
            orderTokenID: 0,
            orderID: 0,
            feeTokenID: 1,
            fee: new BN(0),
            label: 0
          };
          cancels.push(dummyCancel);
        }
      }
      assert(cancels.length === blockSize);
      numCancelsDone += blockSize;

      // Hash the labels
      const labels: number[] = [];
      for (const cancel of cancels) {
        labels.push(cancel.label);
      }
      const labelHash = this.hashLabels(labels);
      // Sign the order cancelations
      for (const cancel of cancels) {
        this.signCancel(cancel);
      }

      const operator = await this.getActiveOperator(exchangeID);
      const cancelBlock: CancelBlock = {
        cancels,
        onchainDataAvailability: this.onchainDataAvailability,
        operatorAccountID: operator
      };

      // Store state before
      const currentBlockIdx = (await this.getNumBlocksOnchain()) - 1;
      const stateBefore = await this.loadExchangeState(
        exchangeID,
        currentBlockIdx
      );

      // Create the block
      const [blockIdx, blockFilename] = await this.createBlock(
        exchangeID,
        4,
        JSON.stringify(cancelBlock, replacer, 4)
      );

      // Store state after
      const stateAfter = await this.loadExchangeState(
        exchangeID,
        currentBlockIdx + 1
      );

      // Read in the block
      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

      const bs = new Bitstream();
      bs.addNumber(block.exchangeID, 4);
      bs.addBN(new BN(block.merkleRootBefore, 10), 32);
      bs.addBN(new BN(block.merkleRootAfter, 10), 32);
      bs.addBN(new BN(labelHash, 10), 32);
      if (block.onchainDataAvailability) {
        bs.addNumber(block.operatorAccountID, 3);
        for (const cancel of cancels) {
          bs.addNumber(
            cancel.accountID * 2 ** Constants.NUM_BITS_ACCOUNTID +
              cancel.orderID,
            5
          );
          bs.addNumber(cancel.orderTokenID, 1);
          bs.addNumber(cancel.feeTokenID, 1);
          bs.addNumber(toFloat(cancel.fee, Constants.Float16Encoding), 2);
        }
      }

      // Validate state change
      this.validateOrderCancellations(cancelBlock, bs, stateBefore, stateAfter);

      // Commit the block
      await this.commitBlock(
        operator,
        BlockType.ORDER_CANCELLATION,
        blockSize,
        bs.getData(),
        blockFilename
      );
    }

    this.pendingCancels[exchangeID] = [];
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
          registrationCost
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

  public async getTokenID(tokenAddress: string) {
    const tokenID = await this.exchange.getTokenID(tokenAddress);
    return tokenID.toNumber();
  }

  public getTokenAddressFromID(tokenID: number) {
    return this.tokenIDToAddressMap.get(tokenID);
  }

  public async getAccountID(owner: string) {
    try {
      const result = await this.exchange.getAccount(owner);
      return result.accountID.toNumber();
    } catch {
      return undefined;
    }
  }

  public getAccount(accountId: number) {
    return this.accounts[this.exchangeId][accountId];
  }

  public async createExchange(
    owner: string,
    bSetupTestState: boolean = true,
    onchainDataAvailability: boolean = true,
    accountCreationFeeInETH: BN = new BN(web3.utils.toWei("0.00001", "ether")),
    accountUpdateFeeInETH: BN = new BN(web3.utils.toWei("0.00001", "ether")),
    depositFeeInETH: BN = new BN(web3.utils.toWei("0.00001", "ether")),
    withdrawalFeeInETH: BN = new BN(web3.utils.toWei("0.00001", "ether"))
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

    const eventArr: any = await this.getEventsFromContract(
      this.universalRegistry,
      "ExchangeForged",
      web3.eth.blockNumber
    );

    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.exchangeAddress, eventObj.args.exchangeId];
    });

    const exchangeAddress = items[0][0];
    const exchangeId = items[0][1].toNumber();

    this.exchange = await this.contracts.ExchangeV3.at(exchangeAddress);

    await this.exchange.setOperator(operator, { from: owner });

    this.exchangeOwner = owner;
    this.exchangeOperator = operator;
    this.exchangeId = exchangeId;
    this.onchainDataAvailability = onchainDataAvailability;

    const exchangeCreationTimestamp = (await this.exchange.getExchangeCreationTimestamp()).toNumber();

    const genesisBlock: Block = {
      blockIdx: 0,
      filename: null,
      blockType: BlockType.RING_SETTLEMENT,
      blockSize: 0,
      blockVersion: 0,
      blockState: BlockState.FINALIZED,
      operator: Constants.zeroAddress,
      origin: Constants.zeroAddress,
      operatorId: 0,
      data: "0x",
      offchainData: "0x",
      compressedData: "0x",
      publicDataHash: "0",
      publicInput: "0",
      blockFeeWithdrawn: true,
      blockFeeAmountWithdrawn: new BN(0),
      committedTimestamp: exchangeCreationTimestamp,
      verifiedTimestamp: exchangeCreationTimestamp,
      finalizedTimestamp: exchangeCreationTimestamp,
      transactionHash: Constants.zeroAddress
    };
    this.blocks[exchangeId] = [genesisBlock];

    const genesisDeposit: Deposit = {
      exchangeId,
      depositIdx: 0,
      timestamp: exchangeCreationTimestamp,

      accountID: 0,
      tokenID: 0,
      amount: new BN(0),
      publicKeyX: "0",
      publicKeyY: "0",

      transactionHash: "0x"
    };
    this.deposits[exchangeId] = [genesisDeposit];

    const genesisWithdrawal: WithdrawalRequest = {
      exchangeId,
      withdrawalIdx: 0,
      timestamp: exchangeCreationTimestamp,

      accountID: 0,
      tokenID: 0,
      amount: new BN(0),

      transactionHash: "0x"
    };
    this.onchainWithdrawals[exchangeId] = [genesisWithdrawal];

    await this.exchange.setFees(
      accountCreationFeeInETH,
      accountUpdateFeeInETH,
      depositFeeInETH,
      withdrawalFeeInETH,
      { from: this.exchangeOwner }
    );

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

  public async revertBlock(blockIdx: number) {
    const LRC = await this.getTokenContract("LRC");

    const revertFineLRC = await this.loopringV3.revertFineLRC();

    const numBlocksBefore = await this.getNumBlocksOnchain();
    const numBlocksFinalizedBefore = await this.getNumBlocksFinalizedOnchain();
    const lrcBalanceBefore = await this.getOnchainBalance(
      this.loopringV3.address,
      "LRC"
    );
    const lrcSupplyBefore = await LRC.totalSupply();

    const operatorContract = this.operator ? this.operator : this.exchange;
    await operatorContract.revertBlock(web3.utils.toBN(blockIdx), {
      from: this.exchangeOperator
    });

    const numBlocksAfter = await this.getNumBlocksOnchain();
    const numBlocksFinalizedAfter = await this.getNumBlocksFinalizedOnchain();
    const lrcBalanceAfter = await this.getOnchainBalance(
      this.loopringV3.address,
      "LRC"
    );
    const lrcSupplyAfter = await LRC.totalSupply();

    assert(numBlocksBefore > numBlocksAfter, "numBlocks should be decreased");
    assert.equal(
      numBlocksAfter,
      numBlocksFinalizedAfter,
      "numBlocks should have beed decreased to numBlocksFinalized"
    );
    assert.equal(
      numBlocksFinalizedAfter,
      numBlocksFinalizedBefore,
      "numBlocksFinalized should remain the same"
    );

    assert(
      lrcBalanceBefore.eq(lrcBalanceAfter.add(revertFineLRC)),
      "LRC balance of exchange needs to be reduced by revertFineLRC"
    );
    assert(
      lrcSupplyBefore.eq(lrcSupplyAfter.add(revertFineLRC)),
      "LRC supply needs to be reduced by revertFineLRC"
    );

    logInfo("Reverted to block " + (blockIdx - 1));
    this.pendingBlocks[this.exchangeId] = [];

    // Revert the test state
    for (let i = this.blocks[this.exchangeId].length - 1; i >= blockIdx; i--) {
      this.blocks[this.exchangeId].pop();
    }

    // Check the current state against the explorer state
    await this.checkExplorerState();
  }

  public async withdrawBlockFeeChecked(
    blockIdx: number,
    operator: string,
    totalBlockFee: BN,
    expectedBlockFee: BN,
    allowedDelta: BN = new BN(0)
  ) {
    const token = "ETH";
    const protocolFeeVault = await this.loopringV3.protocolFeeVault();
    const balanceOperatorBefore = await this.getOnchainBalance(operator, token);
    const balanceContractBefore = await this.getOnchainBalance(
      this.exchange.address,
      token
    );
    const balanceBurnedBefore = await this.getOnchainBalance(
      protocolFeeVault,
      token
    );

    await this.exchange.withdrawBlockFee(blockIdx, operator, {
      from: operator,
      gasPrice: 0
    });

    const balanceOperatorAfter = await this.getOnchainBalance(operator, token);
    const balanceContractAfter = await this.getOnchainBalance(
      this.exchange.address,
      token
    );
    const balanceBurnedAfter = await this.getOnchainBalance(
      protocolFeeVault,
      token
    );

    const expectedBurned = totalBlockFee.sub(expectedBlockFee);

    assert(
      balanceOperatorAfter
        .sub(balanceOperatorBefore.add(expectedBlockFee))
        .abs()
        .lte(allowedDelta),
      "Token balance of operator should be increased by expected block fee reward"
    );
    assert(
      balanceContractAfter.eq(balanceContractBefore.sub(totalBlockFee)),
      "Token balance of exchange should be decreased by total block fee"
    );
    assert(
      balanceBurnedAfter
        .sub(balanceBurnedBefore.add(expectedBurned))
        .abs()
        .lte(allowedDelta),
      "Burned amount should be increased by burned block fee"
    );

    // Get the BlockFeeWithdrawn event
    const eventArr: any = await this.getEventsFromContract(
      this.exchange,
      "BlockFeeWithdrawn",
      web3.eth.blockNumber
    );
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.blockIdx, eventObj.args.amount];
    });
    assert.equal(
      items[0][0].toNumber(),
      blockIdx,
      "Block idx in event not correct"
    );
    assert(items[0][1].eq(totalBlockFee), "Block fee different than expected");

    // Try to withdraw again
    await expectThrow(
      this.exchange.withdrawBlockFee(blockIdx, this.exchangeOperator, {
        from: this.exchangeOperator
      }),
      "FEE_WITHDRAWN_ALREADY"
    );

    this.blocks[this.exchangeId][blockIdx].blockFeeWithdrawn = true;
    this.blocks[this.exchangeId][
      blockIdx
    ].blockFeeAmountWithdrawn = totalBlockFee;

    await this.checkExplorerState();
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
    const tx = await this.exchange.withdrawFromMerkleTreeFor(
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

  public async withdrawFromDepositRequest(requestIdx: number) {
    await this.exchange.withdrawFromDepositRequest(web3.utils.toBN(requestIdx));
  }

  public async setBalanceAndApprove(
    owner: string,
    token: string,
    amount: BN,
    contractAddress?: string
  ) {
    if (contractAddress === undefined) {
      contractAddress = this.exchange.address;
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

  public async getNumBlocksOnchain() {
    return (await this.exchange.getBlockHeight()).toNumber() + 1;
  }

  public async getNumBlocksFinalizedOnchain() {
    return (await this.exchange.getNumBlocksFinalized()).toNumber() + 1;
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
    const state = await this.loadExchangeState(exchangeID);
    return state.accounts[accountID].balances[tokenID].balance;
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
    ownerIndex?: number,
    changeFees: boolean = true
  ) {
    // Change the deposit fee
    const fees = await this.exchange.getFees();
    await this.exchange.setFees(
      fees._accountCreationFeeETH,
      fees._accountUpdateFeeETH,
      fees._depositFeeETH.mul(new BN(changeFees ? 4 : 1)),
      fees._withdrawalFeeETH,
      { from: this.exchangeOwner }
    );

    const orderOwners = this.testContext.orderOwners;
    ownerIndex =
      ownerIndex !== undefined
        ? ownerIndex
        : this.getRandomInt(orderOwners.length);
    const keyPair = this.getKeyPairEDDSA();
    const owner = orderOwners[Number(ownerIndex)];
    const amount = this.getRandomAmount();
    const token = this.getTokenAddress("LRC");
    return await this.deposit(
      this.exchangeId,
      owner,
      keyPair.secretKey,
      keyPair.publicKeyX,
      keyPair.publicKeyY,
      token,
      amount
    );
  }

  public async doRandomOnchainWithdrawal(
    depositInfo: DepositInfo,
    changeFees: boolean = true
  ) {
    // Change the withdrawal fee
    const fees = await this.exchange.getFees();
    await this.exchange.setFees(
      fees._accountCreationFeeETH,
      fees._accountUpdateFeeETH,
      fees._depositFeeETH,
      fees._withdrawalFeeETH.mul(new BN(changeFees ? 2 : 1)),
      { from: this.exchangeOwner }
    );

    return await this.requestWithdrawalOnchain(
      this.exchangeId,
      depositInfo.accountID,
      depositInfo.token,
      this.getRandomAmount(),
      depositInfo.owner
    );
  }

  public async doRandomOffchainWithdrawal(depositInfo: DepositInfo) {
    this.requestWithdrawalOffchain(
      this.exchangeId,
      depositInfo.accountID,
      depositInfo.token,
      this.getRandomAmount(),
      "LRC",
      new BN(0),
      0
    );
  }

  public shuffle(a: any[]) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  public compareStates(stateA: ExchangeState, stateB: ExchangeState) {
    assert.equal(
      stateA.accounts.length,
      stateA.accounts.length,
      "number of accounts does not match"
    );
    for (let accountID = 0; accountID < stateA.accounts.length; accountID++) {
      const accountA = stateA.accounts[accountID];
      const accountB = stateB.accounts[accountID];
      this.compareAccounts(accountA, accountB);
    }
  }

  public async checkExplorerState() {
    // Get the current state
    const numBlocksOnchain = await this.getNumBlocksOnchain();
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

    const numBlocks = exchange.getNumBlocks();
    const block = exchange.getBlock(numBlocks - 1);
    if (!block.valid) {
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
      assert.equal(
        explorerBlock.blockState,
        testBlock.blockState,
        "unexpected blockState"
      );
      assert.equal(
        explorerBlock.blockFeeWithdrawn,
        testBlock.blockFeeWithdrawn,
        "unexpected blockFeeWithdrawn"
      );
      if (explorerBlock.blockFeeWithdrawn) {
        assert(
          explorerBlock.blockFeeAmountWithdrawn.eq(
            testBlock.blockFeeAmountWithdrawn
          ),
          "unexpected blockFeeAmountWithdrawn"
        );
      }
      assert.equal(
        explorerBlock.committedTimestamp,
        testBlock.committedTimestamp,
        "unexpected committedTimestamp"
      );
      if (explorerBlock.blockState > BlockState.COMMITTED) {
        assert.equal(
          explorerBlock.verifiedTimestamp,
          testBlock.verifiedTimestamp,
          "unexpected verifiedTimestamp"
        );
      }
      if (explorerBlock.blockState > BlockState.VERIFIED) {
        assert.equal(
          explorerBlock.finalizedTimestamp,
          testBlock.finalizedTimestamp,
          "unexpected finalizedTimestamp"
        );
      }
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
    }
  }

  public compareAccounts(accountA: any, accountB: any) {
    for (let tokenID = 0; tokenID < Constants.MAX_NUM_TOKENS; tokenID++) {
      let balanceValueA = accountA.balances[tokenID];
      let balanceValueB = accountB.balances[tokenID];

      balanceValueA = balanceValueA || { balance: new BN(0), tradeHistory: {} };
      balanceValueB = balanceValueB || { balance: new BN(0), tradeHistory: {} };

      for (const orderID of Object.keys(balanceValueA.tradeHistory).concat(
        Object.keys(balanceValueB.tradeHistory)
      )) {
        let tradeHistoryValueA = balanceValueA.tradeHistory[Number(orderID)];
        let tradeHistoryValueB = balanceValueB.tradeHistory[Number(orderID)];

        tradeHistoryValueA = tradeHistoryValueA || {
          filled: new BN(0),
          cancelled: false,
          orderID: 0
        };
        tradeHistoryValueB = tradeHistoryValueB || {
          filled: new BN(0),
          cancelled: false,
          orderID: 0
        };

        assert(
          tradeHistoryValueA.filled.eq(tradeHistoryValueB.filled),
          "trade history filled does not match"
        );
        assert.equal(
          tradeHistoryValueA.cancelled,
          tradeHistoryValueB.cancelled,
          "cancelled does not match"
        );
        assert.equal(
          tradeHistoryValueA.orderID,
          tradeHistoryValueB.orderID,
          "orderID does not match"
        );
      }
      assert(
        balanceValueA.balance.eq(balanceValueB.balance),
        "balance does not match"
      );
    }
    assert.equal(
      accountA.publicKeyX,
      accountB.publicKeyX,
      "pubKeyX does not match"
    );
    assert.equal(
      accountA.publicKeyY,
      accountB.publicKeyY,
      "pubKeyY does not match"
    );
    assert.equal(accountA.nonce, accountB.nonce, "nonce does not match");
  }

  public validateRingSettlements(
    ringBlock: RingBlock,
    onchainData: string,
    stateBefore: ExchangeState,
    stateAfter: ExchangeState
  ) {
    let bs: Bitstream;
    if (ringBlock.onchainDataAvailability) {
      // Reverse circuit transform
      const ringDataStart = 4 + 32 + 32 + 4 + 1 + 1 + 32 + 3;
      const ringData = this.inverseTransformRingSettlementsData(
        "0x" + onchainData.slice(2 + 2 * ringDataStart)
      );
      bs = new Bitstream(
        onchainData.slice(0, 2 + 2 * ringDataStart) + ringData.slice(2)
      );
    } else {
      bs = new Bitstream(onchainData);
    }

    logInfo("----------------------------------------------------");
    const operatorAccountID = ringBlock.operatorAccountID;
    const timestamp = ringBlock.timestamp;
    let latestState = stateBefore;
    const addressBook = this.getAddressBookBlock(ringBlock);
    for (const [ringIndex, ring] of ringBlock.rings.entries()) {
      const simulator = new Simulator();
      const simulatorReport = simulator.settleRingFromInputData(
        ring,
        latestState,
        timestamp,
        operatorAccountID,
        ringBlock.protocolTakerFeeBips,
        ringBlock.protocolMakerFeeBips
      );

      for (const detailedTransfer of simulatorReport.detailedTransfers) {
        this.logDetailedTokenTransfer(detailedTransfer, addressBook);
      }
      this.logFilledAmountsRing(
        ring,
        latestState,
        simulatorReport.exchangeStateAfter
      );
      latestState = simulatorReport.exchangeStateAfter;
    }

    // Update operator nonce
    const operator = latestState.accounts[operatorAccountID];
    operator.nonce++;

    // Verify resulting state
    this.compareStates(stateAfter, latestState);
    logInfo("----------------------------------------------------");
  }

  public validateDeposits(
    deposits: Deposit[],
    stateBefore: ExchangeState,
    stateAfter: ExchangeState
  ) {
    logInfo("----------------------------------------------------");
    let latestState = stateBefore;
    for (const deposit of deposits) {
      const simulator = new Simulator();
      const simulatorReport = simulator.deposit(deposit, latestState);

      let accountBefore = latestState.accounts[deposit.accountID];
      const accountAfter =
        simulatorReport.exchangeStateAfter.accounts[deposit.accountID];

      let bNewAccount = false;
      if (accountBefore === undefined) {
        const balances: { [key: number]: Balance } = {};
        for (let i = 0; i < this.MAX_NUM_TOKENS; i++) {
          balances[i] = {
            balance: new BN(0),
            tradeHistory: {}
          };
        }
        const emptyAccount: AccountLeaf = {
          publicKeyX: "0",
          publicKeyY: "0",
          nonce: 0,
          balances
        };
        accountBefore = emptyAccount;
        bNewAccount = true;
      }

      logInfo(
        "> Account " + deposit.accountID + (bNewAccount ? " (NEW ACCOUNT)" : "")
      );
      if (accountBefore.publicKeyX !== accountAfter.publicKeyX) {
        logInfo(
          "publicKeyX: " +
            accountBefore.publicKeyX +
            " -> " +
            accountAfter.publicKeyX
        );
      }
      if (accountBefore.publicKeyY !== accountAfter.publicKeyY) {
        logInfo(
          "publicKeyY: " +
            accountBefore.publicKeyY +
            " -> " +
            accountAfter.publicKeyY
        );
      }
      if (accountBefore.nonce !== accountAfter.nonce) {
        logInfo("nonce: " + accountBefore.nonce + " -> " + accountAfter.nonce);
      }
      for (let i = 0; i < this.MAX_NUM_TOKENS; i++) {
        if (
          !accountBefore.balances[i].balance.eq(
            accountAfter.balances[i].balance
          )
        ) {
          this.prettyPrintBalanceChange(
            deposit.accountID,
            i,
            accountBefore.balances[i].balance,
            accountAfter.balances[i].balance
          );
        }
      }

      latestState = simulatorReport.exchangeStateAfter;
    }

    // Verify resulting state
    this.compareStates(stateAfter, latestState);
    logInfo("----------------------------------------------------");
  }

  public validateOnchainWithdrawals(
    withdrawBlock: WithdrawBlock,
    stateBefore: ExchangeState,
    stateAfter: ExchangeState
  ) {
    logInfo("----------------------------------------------------");
    let latestState = stateBefore;
    const shutdown = withdrawBlock.count === 0;
    for (const withdrawal of withdrawBlock.withdrawals) {
      const simulator = new Simulator();
      const simulatorReport = simulator.onchainWithdraw(
        withdrawal,
        shutdown,
        latestState
      );

      const accountBefore = latestState.accounts[withdrawal.accountID];
      const accountAfter =
        simulatorReport.exchangeStateAfter.accounts[withdrawal.accountID];

      if (
        withdrawal.tokenID > 0 &&
        withdrawal.accountID < latestState.accounts.length
      ) {
        this.prettyPrintBalanceChange(
          withdrawal.accountID,
          withdrawal.tokenID,
          accountBefore.balances[withdrawal.tokenID].balance,
          accountAfter.balances[withdrawal.tokenID].balance
        );
      }

      latestState = simulatorReport.exchangeStateAfter;
    }

    // Verify resulting state
    this.compareStates(stateAfter, latestState);
    logInfo("----------------------------------------------------");
  }

  public validateOffchainWithdrawals(
    withdrawBlock: WithdrawBlock,
    bs: Bitstream,
    stateBefore: ExchangeState,
    stateAfter: ExchangeState
  ) {
    logInfo("----------------------------------------------------");
    const operatorAccountID = withdrawBlock.operatorAccountID;
    let latestState = stateBefore;
    for (const [
      withdrawalIndex,
      withdrawal
    ] of withdrawBlock.withdrawals.entries()) {
      const simulator = new Simulator();
      const simulatorReport = simulator.offchainWithdrawFromInputData(
        withdrawal,
        latestState,
        operatorAccountID
      );

      const accountBefore = latestState.accounts[withdrawal.accountID];
      const accountAfter =
        simulatorReport.exchangeStateAfter.accounts[withdrawal.accountID];

      this.prettyPrintBalanceChange(
        withdrawal.accountID,
        withdrawal.tokenID,
        accountBefore.balances[withdrawal.tokenID].balance,
        accountAfter.balances[withdrawal.tokenID].balance
      );

      latestState = simulatorReport.exchangeStateAfter;
    }

    // Verify resulting state
    this.compareStates(stateAfter, latestState);
    logInfo("----------------------------------------------------");
  }

  public validateInternalTranfers(
    internalTransferBlock: InternalTransferBlock,
    bs: Bitstream,
    stateBefore: ExchangeState,
    stateAfter: ExchangeState
  ) {
    logInfo("----------------------------------------------------");
    const operatorAccountID = internalTransferBlock.operatorAccountID;
    let latestState = stateBefore;
    for (const [
      transIndex,
      transfer
    ] of internalTransferBlock.transfers.entries()) {
      const simulator = new Simulator();
      const simulatorReport = simulator.internalTransferFromInputData(
        transfer,
        latestState,
        operatorAccountID
      );

      const accountFromBefore = latestState.accounts[transfer.accountFromID];
      const accountFromAfter =
        simulatorReport.exchangeStateAfter.accounts[transfer.accountFromID];

      const accountToBefore = latestState.accounts[transfer.accountToID];
      const accountToAfter =
        simulatorReport.exchangeStateAfter.accounts[transfer.accountToID];

      const accountOperatorBefore = latestState.accounts[operatorAccountID];
      const accountOperatorAfter =
        simulatorReport.exchangeStateAfter.accounts[operatorAccountID];

      let addressBook: { [id: number]: string } = {};
      for (const detailedTransfer of simulatorReport.detailedTransfers) {
        this.logDetailedTokenTransfer(detailedTransfer, addressBook);
      }

      logInfo("+ State changes:");
      logInfo("- From:");
      this.prettyPrintBalanceChange(
        transfer.accountFromID,
        transfer.transTokenID,
        accountFromBefore.balances[transfer.transTokenID].balance,
        accountFromAfter.balances[transfer.transTokenID].balance
      );
      this.prettyPrintBalanceChange(
        transfer.accountFromID,
        transfer.feeTokenID,
        accountFromBefore.balances[transfer.feeTokenID].balance,
        accountFromAfter.balances[transfer.feeTokenID].balance
      );
      logInfo("- To:");
      this.prettyPrintBalanceChange(
        transfer.accountToID,
        transfer.transTokenID,
        accountToBefore.balances[transfer.transTokenID].balance,
        accountToAfter.balances[transfer.transTokenID].balance
      );
      logInfo("- Operator:");
      this.prettyPrintBalanceChange(
        operatorAccountID,
        transfer.feeTokenID,
        accountOperatorBefore.balances[transfer.feeTokenID].balance,
        accountOperatorAfter.balances[transfer.feeTokenID].balance
      );
      logInfo("----");

      latestState = simulatorReport.exchangeStateAfter;
    }

    // Verify resulting state
    this.compareStates(stateAfter, latestState);
    logInfo("----------------------------------------------------");
  }

  public validateOrderCancellations(
    cancelBlock: CancelBlock,
    bs: Bitstream,
    stateBefore: ExchangeState,
    stateAfter: ExchangeState
  ) {
    logInfo("----------------------------------------------------");
    const operatorAccountID = cancelBlock.operatorAccountID;
    let latestState = stateBefore;
    for (const [cancelIndex, cancel] of cancelBlock.cancels.entries()) {
      const simulator = new Simulator();
      const simulatorReport = simulator.cancelOrderFromInputData(
        cancel,
        latestState,
        operatorAccountID
      );

      const accountBefore = latestState.accounts[cancel.accountID];
      const accountAfter =
        simulatorReport.exchangeStateAfter.accounts[cancel.accountID];

      const tradeHistorySlot =
        cancel.orderID % 2 ** Constants.TREE_DEPTH_TRADING_HISTORY;
      let tradeHistoryBefore =
        accountBefore.balances[cancel.orderTokenID].tradeHistory[
          tradeHistorySlot
        ];
      if (!tradeHistoryBefore) {
        tradeHistoryBefore = {
          filled: new BN(0),
          cancelled: false,
          orderID: 0
        };
      }
      const tradeHistoryAfter =
        accountAfter.balances[cancel.orderTokenID].tradeHistory[
          tradeHistorySlot
        ];
      logInfo("Slot " + tradeHistorySlot + " (" + cancel.orderID + "):");
      logInfo(
        "- cancelled: " +
          tradeHistoryBefore.cancelled +
          " -> " +
          tradeHistoryAfter.cancelled
      );
      logInfo(
        "- filled: " +
          tradeHistoryBefore.filled.toString(10) +
          " -> " +
          tradeHistoryAfter.filled.toString(10)
      );
      logInfo(
        "- orderID: " +
          tradeHistoryBefore.orderID +
          " -> " +
          tradeHistoryAfter.orderID
      );

      latestState = simulatorReport.exchangeStateAfter;
    }

    // Verify resulting state
    this.compareStates(stateAfter, latestState);
    logInfo("----------------------------------------------------");
  }

  public async loadExchangeStateForRingBlock(
    exchangeID: number,
    blockIdx: number,
    ringBlock: RingBlock
  ) {
    const state = await this.loadExchangeState(exchangeID, blockIdx);
    const orders: OrderInfo[] = [];
    for (const ring of ringBlock.rings) {
      orders.push(ring.orderA);
      orders.push(ring.orderB);
    }
    for (const order of orders) {
      // Make sure the trading history for the orders exists
      const tradeHistorySlot =
        order.orderID % 2 ** Constants.TREE_DEPTH_TRADING_HISTORY;
      if (
        !state.accounts[order.accountID].balances[order.tokenIdS].tradeHistory[
          tradeHistorySlot
        ]
      ) {
        state.accounts[order.accountID].balances[order.tokenIdS].tradeHistory[
          tradeHistorySlot
        ] = {
          filled: new BN(0),
          cancelled: false,
          orderID: 0
        };
      }
    }
    return state;
  }

  public getRandomInt(max: number) {
    return Math.floor(Math.random() * max);
  }

  public getRandomAmount() {
    return new BN(web3.utils.toWei("" + this.getRandomInt(100000000) / 1000));
  }

  public prettyPrintBalance(accountID: number, tokenID: number, balance: BN) {
    const prettyBalance = this.getPrettyAmount(tokenID, balance);
    logInfo(accountID + ": " + prettyBalance);
  }

  public prettyPrintBalanceChange(
    accountID: number,
    tokenID: number,
    balanceBefore: BN,
    balanceAfter: BN
  ) {
    const prettyBalanceBefore = this.getPrettyAmount(tokenID, balanceBefore);
    const prettyBalanceAfter = this.getPrettyAmount(tokenID, balanceAfter);
    logInfo(
      accountID + ": " + prettyBalanceBefore + " -> " + prettyBalanceAfter
    );
  }

  public async depositExchangeStakeChecked(amount: BN, owner: string) {
    const token = "LRC";
    const balanceOwnerBefore = await this.getOnchainBalance(owner, token);
    const balanceContractBefore = await this.getOnchainBalance(
      this.loopringV3.address,
      token
    );
    const stakeBefore = await this.exchange.getExchangeStake();
    const totalStakeBefore = await this.loopringV3.totalStake();

    await this.loopringV3.depositExchangeStake(this.exchangeId, amount, {
      from: owner
    });

    const balanceOwnerAfter = await this.getOnchainBalance(owner, token);
    const balanceContractAfter = await this.getOnchainBalance(
      this.loopringV3.address,
      token
    );
    const stakeAfter = await this.exchange.getExchangeStake();
    const totalStakeAfter = await this.loopringV3.totalStake();

    assert(
      balanceOwnerBefore.eq(balanceOwnerAfter.add(amount)),
      "Token balance of owner should be decreased by amount"
    );
    assert(
      balanceContractAfter.eq(balanceContractBefore.add(amount)),
      "Token balance of contract should be increased by amount"
    );
    assert(
      stakeAfter.eq(stakeBefore.add(amount)),
      "Stake should be increased by amount"
    );
    assert(
      totalStakeAfter.eq(totalStakeBefore.add(amount)),
      "Total stake should be increased by amount"
    );

    // Get the ExchangeStakeDeposited event
    const eventArr: any = await this.getEventsFromContract(
      this.loopringV3,
      "ExchangeStakeDeposited",
      web3.eth.blockNumber
    );
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.exchangeId, eventObj.args.amount];
    });
    assert.equal(
      items.length,
      1,
      "A single ExchangeStakeDeposited event should have been emitted"
    );
    assert.equal(
      items[0][0].toNumber(),
      this.exchangeId,
      "exchangeId should match"
    );
    assert(items[0][1].eq(amount), "amount should match");
  }

  public async withdrawExchangeStakeChecked(recipient: string, amount: BN) {
    const token = "LRC";
    const balanceOwnerBefore = await this.getOnchainBalance(recipient, token);
    const balanceContractBefore = await this.getOnchainBalance(
      this.loopringV3.address,
      token
    );
    const stakeBefore = await this.exchange.getExchangeStake();
    const totalStakeBefore = await this.loopringV3.totalStake();

    await this.exchange.withdrawExchangeStake(recipient, {
      from: this.exchangeOwner
    });

    const balanceOwnerAfter = await this.getOnchainBalance(recipient, token);
    const balanceContractAfter = await this.getOnchainBalance(
      this.loopringV3.address,
      token
    );
    const stakeAfter = await this.exchange.getExchangeStake();
    const totalStakeAfter = await this.loopringV3.totalStake();

    assert(
      balanceOwnerAfter.eq(balanceOwnerBefore.add(amount)),
      "Token balance of owner should be increased by amount"
    );
    assert(
      balanceContractBefore.eq(balanceContractAfter.add(amount)),
      "Token balance of contract should be decreased by amount"
    );
    assert(
      stakeBefore.eq(stakeAfter.add(amount)),
      "Stake should be decreased by amount"
    );
    assert(
      totalStakeAfter.eq(totalStakeBefore.sub(amount)),
      "Total stake should be decreased by amount"
    );

    // Get the ExchangeStakeWithdrawn event
    const eventArr: any = await this.getEventsFromContract(
      this.loopringV3,
      "ExchangeStakeWithdrawn",
      web3.eth.blockNumber
    );
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.exchangeId, eventObj.args.amount];
    });
    assert.equal(
      items.length,
      1,
      "A single ExchangeStakeWithdrawn event should have been emitted"
    );
    assert.equal(
      items[0][0].toNumber(),
      this.exchangeId,
      "exchangeId should match"
    );
    assert(items[0][1].eq(amount), "amount should match");
  }

  public async depositProtocolFeeStakeChecked(amount: BN, owner: string) {
    const token = "LRC";
    const balanceOwnerBefore = await this.getOnchainBalance(owner, token);
    const balanceContractBefore = await this.getOnchainBalance(
      this.loopringV3.address,
      token
    );
    const stakeBefore = await this.loopringV3.getProtocolFeeStake(
      this.exchangeId
    );
    const totalStakeBefore = await this.loopringV3.totalStake();

    await this.loopringV3.depositProtocolFeeStake(this.exchangeId, amount, {
      from: owner
    });

    const balanceOwnerAfter = await this.getOnchainBalance(owner, token);
    const balanceContractAfter = await this.getOnchainBalance(
      this.loopringV3.address,
      token
    );
    const stakeAfter = await this.loopringV3.getProtocolFeeStake(
      this.exchangeId
    );
    const totalStakeAfter = await this.loopringV3.totalStake();

    assert(
      balanceOwnerBefore.eq(balanceOwnerAfter.add(amount)),
      "Token balance of owner should be decreased by amount"
    );
    assert(
      balanceContractAfter.eq(balanceContractBefore.add(amount)),
      "Token balance of contract should be increased by amount"
    );
    assert(
      stakeAfter.eq(stakeBefore.add(amount)),
      "Stake should be increased by amount"
    );
    assert(
      totalStakeAfter.eq(totalStakeBefore.add(amount)),
      "Total stake should be increased by amount"
    );

    // Get the ProtocolFeeStakeDeposited event
    const eventArr: any = await this.getEventsFromContract(
      this.loopringV3,
      "ProtocolFeeStakeDeposited",
      web3.eth.blockNumber
    );
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.exchangeId, eventObj.args.amount];
    });
    assert.equal(
      items.length,
      1,
      "A single ProtocolFeeStakeDeposited event should have been emitted"
    );
    assert.equal(
      items[0][0].toNumber(),
      this.exchangeId,
      "exchangeId should match"
    );
    assert(items[0][1].eq(amount), "amount should match");
  }

  public async withdrawProtocolFeeStakeChecked(recipient: string, amount: BN) {
    const token = "LRC";
    const balanceOwnerBefore = await this.getOnchainBalance(recipient, token);
    const balanceContractBefore = await this.getOnchainBalance(
      this.loopringV3.address,
      token
    );
    const stakeBefore = await this.loopringV3.getProtocolFeeStake(
      this.exchangeId
    );
    const totalStakeBefore = await this.loopringV3.totalStake();

    await this.exchange.withdrawProtocolFeeStake(recipient, amount, {
      from: this.exchangeOwner
    });

    const balanceOwnerAfter = await this.getOnchainBalance(recipient, token);
    const balanceContractAfter = await this.getOnchainBalance(
      this.loopringV3.address,
      token
    );
    const stakeAfter = await this.loopringV3.getProtocolFeeStake(
      this.exchangeId
    );
    const totalStakeAfter = await this.loopringV3.totalStake();

    assert(
      balanceOwnerAfter.eq(balanceOwnerBefore.add(amount)),
      "Token balance of owner should be increased by amount"
    );
    assert(
      balanceContractBefore.eq(balanceContractAfter.add(amount)),
      "Token balance of contract should be decreased by amount"
    );
    assert(
      stakeBefore.eq(stakeAfter.add(amount)),
      "Stake should be decreased by amount"
    );
    assert(
      totalStakeAfter.eq(totalStakeBefore.sub(amount)),
      "Total stake should be decreased by amount"
    );

    // Get the ProtocolFeeStakeWithdrawn event
    const eventArr: any = await this.getEventsFromContract(
      this.loopringV3,
      "ProtocolFeeStakeWithdrawn",
      web3.eth.blockNumber
    );
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.exchangeId, eventObj.args.amount];
    });
    assert.equal(
      items.length,
      1,
      "A single ProtocolFeeStakeWithdrawn event should have been emitted"
    );
    assert.equal(
      items[0][0].toNumber(),
      this.exchangeId,
      "exchangeId should match"
    );
    assert(items[0][1].eq(amount), "amount should match");
  }

  // private functions:
  private async createContractContext() {
    const [
      universalRegistry,
      loopringV3,
      exchangeConstants,
      exchange,
      blockVerifier,
      downtimeCostCalculator,
      lrcToken,
      wethToken
    ] = await Promise.all([
      this.contracts.UniversalRegistry.deployed(),
      this.contracts.LoopringV3.deployed(),
      this.contracts.ExchangeConstants.deployed(),
      this.contracts.ExchangeV3.deployed(),
      this.contracts.BlockVerifier.deployed(),
      this.contracts.FixPriceDowntimeCostCalculator.deployed(),
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
    this.downtimeCostCalculator = downtimeCostCalculator;

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

  private logDetailedTokenTransfer(
    payment: DetailedTokenTransfer,
    addressBook: { [id: number]: string } = {},
    depth: number = 0
  ) {
    if (payment.amount.eq(new BN(0)) && payment.subPayments.length === 0) {
      return;
    }
    const whiteSpace = " ".repeat(depth);
    const description = payment.description ? payment.description : "";
    const prettyAmount = this.getPrettyAmount(payment.token, payment.amount);
    if (payment.subPayments.length === 0) {
      const toName =
        addressBook[payment.to] !== undefined
          ? addressBook[payment.to]
          : payment.to;
      logInfo(
        whiteSpace +
          "- " +
          " [" +
          description +
          "] " +
          prettyAmount +
          " -> " +
          toName
      );
    } else {
      logInfo(whiteSpace + "+ " + " [" + description + "] ");
      for (const subPayment of payment.subPayments) {
        this.logDetailedTokenTransfer(subPayment, addressBook, depth + 1);
      }
    }
  }

  private getPrettyAmount(tokenID: number, amount: BN) {
    const tokenAddress = this.tokenIDToAddressMap.get(tokenID);
    const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(tokenAddress);
    const decimals = this.testContext.tokenAddrDecimalsMap.get(tokenAddress);
    let amountDec = Number(amount.toString(10)) / 10 ** decimals;
    if (Math.abs(amountDec) < 0.0000000000001) {
      amountDec = 0;
    }
    return amountDec + " " + tokenSymbol;
  }

  private getPrettyCancelled(cancelled: boolean) {
    return cancelled ? "Cancelled" : "NotCancelled";
  }

  private logFilledAmountsRing(
    ring: RingInfo,
    stateBefore: ExchangeState,
    stateAfter: ExchangeState
  ) {
    this.logFilledAmountOrder(
      "[Filled] OrderA",
      stateBefore.accounts[ring.orderA.accountID],
      stateAfter.accounts[ring.orderA.accountID],
      ring.orderA
    );
    this.logFilledAmountOrder(
      "[Filled] OrderB",
      stateBefore.accounts[ring.orderB.accountID],
      stateAfter.accounts[ring.orderB.accountID],
      ring.orderB
    );
  }

  private logFilledAmountOrder(
    description: string,
    accountBefore: AccountLeaf,
    accountAfter: AccountLeaf,
    order: OrderInfo
  ) {
    const tradeHistorySlot =
      order.orderID % 2 ** Constants.TREE_DEPTH_TRADING_HISTORY;
    const before =
      accountBefore.balances[order.tokenIdS].tradeHistory[tradeHistorySlot];
    const after =
      accountAfter.balances[order.tokenIdS].tradeHistory[tradeHistorySlot];
    const filledBeforePercentage = before.filled
      .mul(new BN(100))
      .div(order.buy ? order.amountB : order.amountS);
    const filledAfterPercentage = after.filled
      .mul(new BN(100))
      .div(order.buy ? order.amountB : order.amountS);
    const filledBeforePretty = this.getPrettyAmount(
      order.buy ? order.tokenIdB : order.tokenIdS,
      before.filled
    );
    const filledAfterPretty = this.getPrettyAmount(
      order.buy ? order.tokenIdB : order.tokenIdS,
      after.filled
    );
    logInfo(
      description +
        ": " +
        filledBeforePretty +
        " -> " +
        filledAfterPretty +
        " (" +
        filledBeforePercentage.toString(10) +
        "% -> " +
        filledAfterPercentage.toString(10) +
        "%)" +
        " (slot " +
        tradeHistorySlot +
        ": " +
        this.getPrettyCancelled(before.cancelled) +
        " -> " +
        this.getPrettyCancelled(after.cancelled) +
        ")"
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
