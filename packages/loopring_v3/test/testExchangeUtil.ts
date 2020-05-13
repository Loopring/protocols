import BN = require("bn.js");
import childProcess = require("child_process");
import fs = require("fs");
import path = require("path");
import http = require("http");
import { performance } from "perf_hooks";
import { SHA256 } from "sha2";
import util = require("util");
import { Artifacts } from "../util/Artifacts";
import { compress, CompressionType } from "./compression";
import {
  Bitstream,
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
    name === "startHash"
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

export interface OnchainBlock {
  blockType: number;
  blockSize: number;
  blockVersion: number;
  data: any;
  proof: any;
  auxiliaryData?: any;
  offchainData?: any;
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

  public loopringV3: any;
  public blockVerifier: any;
  public downtimeCostCalculator: any;
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

  public blocks: Block[][] = [];
  public accounts: Account[][] = [];

  public deposits: Deposit[][] = [];
  public onchainWithdrawals: WithdrawalRequest[][] = [];
  public numDepositRequestsCommitted: number[] = [];
  public numWithdrawalRequestsCommitted: number[] = [];

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
  public MAX_NUM_ACCOUNTS: number;
  public FEE_BLOCK_FINE_START_TIME: number;
  public FEE_BLOCK_FINE_MAX_DURATION: number;
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

  public useProverServer: boolean = true;

  private pendingRings: RingInfo[][] = [];
  private pendingDeposits: Deposit[][] = [];
  private pendingInternalTransfers: InternalTransferRequest[][] = [];
  private pendingOffchainWithdrawalRequests: WithdrawalRequest[][] = [];
  private pendingOnchainWithdrawalRequests: WithdrawalRequest[][] = [];

  private pendingWithdrawals: Withdrawal[] = [];

  private orderIDGenerator: number = 0;

  private MAX_NUM_EXCHANGES: number = 512;

  private proverPorts = new Map<number, number>();
  private portGenerator = 1234;

  public async initialize(accounts: string[]) {
    this.context = await this.createContractContext();
    this.testContext = await this.createExchangeTestContext(accounts);

    this.explorer = new Explorer();
    await this.explorer.initialize(web3, this.universalRegistry.address);

    // Initialize LoopringV3
    this.protocolFeeVault = this.testContext.ringMatchers[0];

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
      this.pendingInternalTransfers.push([]);
      this.pendingBlocks.push([]);

      this.blocks.push([]);
      this.deposits.push([]);
      this.onchainWithdrawals.push([]);
      this.numDepositRequestsCommitted.push(1);
      this.numWithdrawalRequestsCommitted.push(1);

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
    this.MAX_NUM_ACCOUNTS = constants[9].toNumber();
    this.FEE_BLOCK_FINE_START_TIME = constants[10].toNumber();
    this.FEE_BLOCK_FINE_MAX_DURATION = constants[11].toNumber();
    this.MIN_AGE_PROTOCOL_FEES_UNTIL_UPDATED = constants[12].toNumber();
    this.GAS_LIMIT_SEND_TOKENS = constants[13].toNumber();
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

        feeBips: 0,
        rebateBips: 0,

        amountS: new BN(1),
        amountB: new BN(1)
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

        feeBips: 0,
        rebateBips: 0,

        amountS: new BN(1),
        amountB: new BN(1)
      },
      tokenID: 0,
      fee: new BN(0)
    };
    this.signOrder(this.dummyRing.orderA);
    this.signOrder(this.dummyRing.orderB);
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

    assert(order.maxFeeBips < 64, "maxFeeBips >= 64");
    assert(order.feeBips < 64, "feeBips >= 64");
    assert(order.rebateBips < 64, "rebateBips >= 64");

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
    if (withdrawal.signature !== undefined) {
      return;
    }

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

    const hasher = Poseidon.createHash(9, 6, 53);
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

    let numAvailableSlots = (
      await this.exchange.getNumAvailableDepositSlots()
    ).toNumber();
    if (this.autoCommit && numAvailableSlots === 0) {
      await this.commitDeposits(exchangeID);
      numAvailableSlots = (
        await this.exchange.getNumAvailableDepositSlots()
      ).toNumber();
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
        await Token.approve(this.depositContract.address, amount, {
          from: owner
        });
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
      owner,
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

    const event = await this.assertEventEmitted(
      this.exchange,
      "DepositRequested"
    );
    accountID = event.accountID.toNumber();

    const depositInfo: DepositInfo = {
      owner,
      token,
      amount,
      fee: feeETH,
      timestamp: ethBlock.timestamp,
      accountID,
      depositIdx: event.depositIdx.toNumber()
    };

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
    conditionalTransfer: boolean = false
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
      type: conditionalTransfer ? 1 : 0
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
    fee: BN
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
      fee
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

    let numAvailableSlots = (
      await this.exchange.getNumAvailableWithdrawalSlots()
    ).toNumber();
    if (this.autoCommit && numAvailableSlots === 0) {
      await this.commitOnchainWithdrawalRequests(exchangeID);
      numAvailableSlots = (
        await this.exchange.getNumAvailableWithdrawalSlots()
      ).toNumber();
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

    const withdrawalRequest = this.addWithdrawalRequest(
      this.pendingOnchainWithdrawalRequests[exchangeID],
      accountID,
      tokenID,
      amount,
      tokenID,
      new BN(0),
      event.withdrawalIdx.toNumber(),
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

  public addWithdrawalRequest(
    withdrawalRequests: WithdrawalRequest[],
    accountID: number,
    tokenID: number,
    amount: BN,
    feeTokenID: number,
    fee: BN,
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
    filename: string,
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
      blockFeeRewarded: new BN(0),
      blockFeeFined: new BN(0),
      timestamp: 0,
      transactionHash: "0"
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
    block.onchainDataAvailability =
      blockType === BlockType.DEPOSIT ||
      blockType === BlockType.ONCHAIN_WITHDRAWAL
        ? false
        : this.onchainDataAvailability;
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
      if (block.blockType === BlockType.SETTLEMENT) {
        verificationKeyFilename += "trade";
      } else if (block.blockType === BlockType.DEPOSIT) {
        verificationKeyFilename += "deposit";
      } else if (block.blockType === BlockType.ONCHAIN_WITHDRAWAL) {
        verificationKeyFilename += "withdraw_onchain";
      } else if (block.blockType === BlockType.OFFCHAIN_WITHDRAWAL) {
        verificationKeyFilename += "withdraw_offchain";
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
        (block.blockIdx + 1) +
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

    const numBlocksSubmittedBefore = (
      await this.exchange.getBlockHeight()
    ).toNumber();

    // Simulate the Conditional transfers on the approvals
    const approvalsSnapshot = new ApprovalsSnapshot(this);
    for (const block of blocks) {
      if (block.blockType === BlockType.INTERNAL_TRANSFER) {
        const transferBlock: InternalTransferBlock = block.internalBlock;
        for (const transfer of transferBlock.transfers) {
          if (transfer.type === 1) {
            approvalsSnapshot.transfer(
              transfer.accountFromID,
              transfer.accountToID,
              transfer.transTokenID,
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
    }

    // Deposits
    const numAvailableDepositSlotsBefore = await this.exchange.getNumAvailableDepositSlots();
    const numDepositRequestsProcessedBefore = await this.exchange.getNumDepositRequestsProcessed();
    // Onchain withdrawals
    const numAvailableWithdrawalSlotsBefore = await this.exchange.getNumAvailableWithdrawalSlots();
    const numWithdrawalRequestsProcessedBefore = await this.exchange.getNumWithdrawalRequestsProcessed();

    // Submit the blocks onchain
    const operatorContract = this.operator ? this.operator : this.exchange;
    const tx = await operatorContract.submitBlocks(
      onchainBlocks,
      this.exchangeOperator,
      { from: this.exchangeOperator, gasPrice: 0 }
    );
    logInfo(
      "\x1b[46m%s\x1b[0m",
      "[submitBlocks] Gas used: " + tx.receipt.gasUsed
    );
    const ethBlock = await web3.eth.getBlock(tx.receipt.blockNumber);

    // Check number of blocks submitted
    const numBlocksSubmittedAfter = (
      await this.exchange.getBlockHeight()
    ).toNumber();
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
    {
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
    }

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

    // Check the current state against the explorer state
    await this.checkExplorerState();
  }

  public async submitPendingBlocks(exchangeID: number, callback?: any) {
    await this.submitBlocks(this.pendingBlocks[exchangeID], callback);
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

      const startIndex = this.numDepositRequestsCommitted[exchangeID];
      // console.log("startIndex: " + startIndex);
      const firstRequestData = await this.exchange.getDepositRequest(
        startIndex - 1
      );
      const startingHash = firstRequestData.accumulatedHash;
      // console.log(requestData);

      this.numDepositRequestsCommitted[exchangeID] += numRequestsInBlock;

      // Calculate ending hash
      let endingHash = startingHash;
      for (const deposit of deposits) {
        const hashData = new Bitstream();
        hashData.addHex(endingHash);
        hashData.addNumber(deposit.accountID, 3);
        hashData.addBN(new BN(deposit.publicKeyX, 10), 32);
        hashData.addBN(new BN(deposit.publicKeyY, 10), 32);
        hashData.addNumber(deposit.tokenID, 2);
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

      //console.log("startIndex: " + startIndex);
      //console.log("numRequestsInBlock: " + numRequestsInBlock);

      // Store state before
      const currentBlockIdx = this.blocks[exchangeID].length - 1;
      const stateBefore = await this.loadExchangeState(
        exchangeID,
        currentBlockIdx
      );

      const { blockIdx, blockFilename } = await this.createBlock(
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

      // Commit the block
      const operator = await this.getActiveOperator(exchangeID);
      const blockInfo = await this.commitBlock(
        operator,
        BlockType.DEPOSIT,
        blockSize,
        bs.getData(),
        blockFilename
      );
      blockInfo.internalBlock = depositBlock;

      blockInfos.push(blockInfo);
    }

    this.pendingDeposits[exchangeID] = [];

    return blockInfos;
  }

  public async loadExchangeState(exchangeID: number, blockIdx?: number) {
    // Read in the state
    if (blockIdx === undefined) {
      blockIdx = this.blocks[exchangeID].length - 1;
    }
    //console.log("blockIdx:" + blockIdx);
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
            fee: new BN(0)
          };
          withdrawals.push(dummyWithdrawalRequest);
        }
      }
      assert(withdrawals.length === blockSize);
      numWithdrawalsDone += blockSize;

      let startIndex = 0;
      let startingHash = "";
      let endingHash = "";

      if (onchain) {
        startIndex = this.numWithdrawalRequestsCommitted[exchangeID];
        const firstRequestData = await this.exchange.getWithdrawRequest(
          startIndex - 1
        );
        startingHash = firstRequestData.accumulatedHash;
        // console.log(requestData);
        this.numWithdrawalRequestsCommitted[exchangeID] += shutdown
          ? 0
          : numRequestsInBlock;

        // Calculate ending hash
        endingHash = startingHash;
        for (const withdrawal of withdrawals) {
          const hashData = new Bitstream();
          hashData.addHex(endingHash);
          hashData.addNumber(withdrawal.accountID, 3);
          hashData.addNumber(withdrawal.tokenID, 2);
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
      } else {
        // Sign the offchain withdrawals
        for (const withdrawal of withdrawals) {
          this.signWithdrawal(withdrawal);
        }
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
      const currentBlockIdx = this.blocks[exchangeID].length - 1;
      const stateBefore = await this.loadExchangeState(
        exchangeID,
        currentBlockIdx
      );

      const jWithdrawalsInfo = JSON.stringify(withdrawalBlock, replacer, 4);
      const { blockIdx, blockFilename } = await this.createBlock(
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
        bs.addNumber(withdrawal.tokenID, 2);
        bs.addNumber(withdrawal.accountID, 3);
        bs.addNumber(withdrawal.fAmountWithdrawn, 3);
      }
      if (!onchain) {
        if (block.onchainDataAvailability) {
          bs.addNumber(block.operatorAccountID, 3);
          for (const withdrawal of block.withdrawals) {
            bs.addNumber(withdrawal.feeTokenID, 2);
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

      // Commit the block
      const committedBlock = await this.commitBlock(
        operator,
        blockType,
        blockSize,
        bs.getData(),
        blockFilename
      );
      if (shutdown) {
        committedBlock.shutdown = true;
      }
      committedBlock.internalBlock = withdrawalBlock;

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
      // Get all transfers for the block
      const blockSizes = this.transferBlockSizes;
      const blockSize = this.getBestBlockSize(
        pendingTransfers.length - numTransferDone,
        blockSizes
      );
      for (let b = numTransferDone; b < numTransferDone + blockSize; b++) {
        if (b < pendingTransfers.length) {
          transfers.push(pendingTransfers[b]);
        } else {
          const dummyInternalTransferRequest: InternalTransferRequest = {
            accountFromID: this.dummyAccountId,
            accountToID: this.dummyAccountId,
            transTokenID: 0,
            amount: new BN(0),
            feeTokenID: 0,
            fee: new BN(0),
            type: 0
          };
          transfers.push(dummyInternalTransferRequest);
        }
      }
      assert(transfers.length === blockSize);
      numTransferDone += blockSize;

      // Sign the offchain withdrawals
      for (const transfer of transfers) {
        if (transfer.type === 0) {
          this.signInternalTransfer(transfer);
        } else {
          const keyPair = this.getKeyPairEDDSA();
          // Random valid curve point
          transfer.signature = {
            Rx: keyPair.publicKeyX,
            Ry: keyPair.publicKeyY,
            s: "0"
          };
        }
      }

      // Build the conditional transfer data
      const auxiliaryData = new Bitstream();
      let numConditionalTransfers = 0;
      for (const [i, transfer] of transfers.entries()) {
        if (transfer.type > 0) {
          numConditionalTransfers++;
          auxiliaryData.addNumber(i, 4);
        }
      }

      // Block info
      const operator = await this.getActiveOperator(exchangeID);
      const internalTransferBlock: InternalTransferBlock = {
        transfers,
        onchainDataAvailability: this.onchainDataAvailability,
        operatorAccountID: operator
      };

      // Store state before
      const currentBlockIdx = this.blocks[exchangeID].length - 1;
      const stateBefore = await this.loadExchangeState(
        exchangeID,
        currentBlockIdx
      );

      const jWithdrawalsInfo = JSON.stringify(
        internalTransferBlock,
        replacer,
        4
      );
      const { blockIdx, blockFilename } = await this.createBlock(
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
      bs.addNumber(numConditionalTransfers, 4);
      if (block.onchainDataAvailability) {
        bs.addNumber(block.operatorAccountID, 3);
        for (const transfer of block.transfers) {
          bs.addNumber(transfer.type, 1);
          bs.addNumber(transfer.accountFromID, 3);
          bs.addNumber(transfer.accountToID, 3);
          bs.addNumber(
            transfer.transTokenID * 2 ** 12 + transfer.feeTokenID,
            3
          );
          bs.addNumber(transfer.fAmountTrans, 3);
          bs.addNumber(
            toFloat(new BN(transfer.fee), Constants.Float16Encoding),
            2
          );
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
      const committedBlock = await this.commitBlock(
        operator,
        blockType,
        blockSize,
        bs.getData(),
        blockFilename,
        auxiliaryData.getData()
      );
      committedBlock.internalBlock = internalTransferBlock;
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

      const event = await this.assertEventEmitted(this.exchange, "Withdraw");
      const tokenID = event.tokenID.toNumber();
      const tokenAddress = this.tokenIDToAddressMap.get(tokenID);
      const to = addressBook ? addressBook[event.to] : event.to;
      const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(tokenAddress);
      const decimals = this.testContext.tokenAddrDecimalsMap.get(tokenAddress);
      const amount = event.amount
        .div(web3.utils.toBN(10 ** decimals))
        .toString(10);
      logInfo("Withdrawn: " + to + ": " + amount + " " + tokenSymbol);
    }

    this.pendingWithdrawals = [];
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

      const currentBlockIdx = this.blocks[exchangeID].length - 1;

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
      const { blockIdx, blockFilename } = await this.createBlock(
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
      const da = new Bitstream();
      if (block.onchainDataAvailability) {
        bs.addNumber(block.operatorAccountID, 3);
        for (const ringSettlement of block.ringSettlements) {
          const ring = ringSettlement.ring;
          const orderA = ringSettlement.ring.orderA;
          const orderB = ringSettlement.ring.orderB;

          const numSlots = 2 ** Constants.BINARY_TREE_DEPTH_TRADING_HISTORY;
          da.addNumber(
            ring.overwriteTradeHistorySlotA * numSlots +
              (orderA.orderID % numSlots),
            2
          );
          da.addNumber(
            ring.overwriteTradeHistorySlotB * numSlots +
              (orderB.orderID % numSlots),
            2
          );
          da.addNumber(orderA.accountID, 3);
          da.addNumber(orderB.accountID, 3);
          da.addNumber(orderA.tokenS * 2 ** 12 + orderB.tokenS, 3);
          da.addNumber(ring.fFillS_A, 3);
          da.addNumber(ring.fFillS_B, 3);

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
        BlockType.SETTLEMENT,
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
    ranges.push([{ offset: 0, length: 4 }]); // orderA.orderID + orderB.orderID
    ranges.push([{ offset: 4, length: 6 }]); // orderA.accountID + orderB.accountID
    ranges.push([{ offset: 10, length: 3 }]); // orderA.tokenS + orderB.tokenS
    ranges.push([{ offset: 13, length: 6 }]); // orderA.fillS + orderB.fillS
    ranges.push([{ offset: 19, length: 1 }]); // orderA.data
    ranges.push([{ offset: 20, length: 1 }]); // orderB.data
    return ranges;
  }

  public transformRingSettlementsData(input: string) {
    // Compress
    const bs = new Bitstream(input);
    const compressed = new Bitstream();
    const ringSize = 21;
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
    const ringSize = 21;
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

    // Set the operator
    await this.exchange.setOperator(operator, { from: owner });

    this.exchangeOwner = owner;
    this.exchangeOperator = operator;
    this.exchangeId = exchangeId;
    this.onchainDataAvailability = onchainDataAvailability;
    this.activeOperator = undefined;

    const exchangeCreationTimestamp = (
      await this.exchange.getExchangeCreationTimestamp()
    ).toNumber();
    this.GENESIS_MERKLE_ROOT = new BN(
      (await this.exchange.genesisBlockHash()).slice(2),
      16
    );

    const genesisBlock: Block = {
      blockIdx: 0,
      filename: null,
      blockType: BlockType.SETTLEMENT,
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
    const previousTimestamp = (
      await web3.eth.getBlock(await web3.eth.getBlockNumber())
    ).timestamp;
    await this.evmIncreaseTime(seconds);
    await this.evmMine();
    const currentTimestamp = (
      await web3.eth.getBlock(await web3.eth.getBlockNumber())
    ).timestamp;
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
    const numBlocksOnchain = this.blocks[this.exchangeId].length;
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
          orderID: 0
        };
        tradeHistoryValueB = tradeHistoryValueB || {
          filled: new BN(0),
          orderID: 0
        };

        assert(
          tradeHistoryValueA.filled.eq(tradeHistoryValueB.filled),
          "trade history filled does not match"
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
      const ringDataStart = 4 + 32 + 32 + 4 + 1 + 1 + 3;
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
        order.orderID % 2 ** Constants.BINARY_TREE_DEPTH_TRADING_HISTORY;
      if (
        !state.accounts[order.accountID].balances[order.tokenIdS].tradeHistory[
          tradeHistorySlot
        ]
      ) {
        state.accounts[order.accountID].balances[order.tokenIdS].tradeHistory[
          tradeHistorySlot
        ] = {
          filled: new BN(0),
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

    const [
      eth,
      weth,
      lrc,
      gto,
      rdn,
      rep,
      inda,
      indb,
      test
    ] = await Promise.all([
      null,
      this.contracts.WETHToken.deployed(),
      this.contracts.LRCToken.deployed(),
      this.contracts.GTOToken.deployed(),
      this.contracts.RDNToken.deployed(),
      this.contracts.REPToken.deployed(),
      this.contracts.INDAToken.deployed(),
      this.contracts.INDBToken.deployed(),
      this.contracts.TESTToken.deployed()
    ]);

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
      order.orderID % 2 ** Constants.BINARY_TREE_DEPTH_TRADING_HISTORY;
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
