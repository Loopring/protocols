import BN = require("bn.js");
import childProcess = require("child_process");
import fs = require("fs");
import path = require("path");
import { SHA256 } from "sha2";
import snarkjs = require("snarkjs");
import util = require("util");
import { Artifacts } from "../util/Artifacts";
import babyJub = require("./babyjub");
import { BitArray } from "./bitarray";
import { Bitstream } from "./bitstream";
import { compress, CompressionType } from "./compression";
import * as constants from "./constants";
import { Context } from "./context";
import eddsa = require("./eddsa");
import { toFloat } from "./float";
import { doDebugLogging, logDebug, logInfo } from "./logs";
import { Simulator } from "./simulator";
import { ExchangeTestContext } from "./testExchangeContext";
import { Account, AccountLeaf, Balance, Block, BlockType, Cancel, CancelBlock,
         Deposit, DepositBlock, DepositInfo, DetailedTokenTransfer, ExchangeState, KeyPair,
         OrderInfo, RingBlock, RingInfo, TradeHistory, Withdrawal,
         WithdrawalRequest, WithdrawBlock } from "./types";

const bigInt = snarkjs.bigInt;

// JSON replacer function for BN values
function replacer(name: any, val: any) {
  if (name === "balance" || name === "amountS" || name === "amountB" ||
      name === "amount" || name === "fee" || name === "startHash") {
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

  public ringSettlementBlockSizes = [1, 2];
  public depositBlockSizes = [4, 8];
  public onchainWithdrawalBlockSizes = [4, 8];
  public offchainWithdrawalBlockSizes = [4, 8];
  public orderCancellationBlockSizes = [4, 8];

  public loopringV3: any;
  public exchangeDeployer: any;
  public blockVerifier: any;
  public lzDecompressor: any;

  public lrcAddress: string;
  public wethAddress: string;

  public exchange: any;
  public exchangeOwner: string;
  public exchangeOperator: string;
  public exchangeId: number;

  public operator: any;
  public activeOperator: number;

  public ringMatcherAccountID: number[] = [];

  public accounts: Account[][] = [];

  public operators: number[] = [];
  public wallets: number[][] = [];

  public GENESIS_MERKLE_ROOT: BN = new BN("06ea7e01611a784ff676387ee0a6f58933eb184d8a2ff765608488e7e8da76d3", 16);

  public MAX_PROOF_GENERATION_TIME_IN_SECONDS: number;
  public MAX_AGE_REQUEST_UNTIL_FORCED: number;
  public MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE: number;
  public MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE: number;
  public MIN_TIME_UNTIL_OPERATOR_CAN_WITHDRAW: number;
  public MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS: number;
  public MAX_TIME_IN_SHUTDOWN_BASE: number;
  public MAX_TIME_IN_SHUTDOWN_DELTA: number;
  public FEE_BLOCK_FINE_START_TIME: number;
  public FEE_BLOCK_FINE_MAX_DURATION: number;
  public TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS: number;
  public MAX_NUM_TOKENS: number;

  public dummyAccountId: number;
  public dummyAccountKeyPair: any;

  public tokenAddressToIDMap = new Map<string, number>();
  public tokenIDToAddressMap = new Map<number, string>();

  public contracts = new Artifacts(artifacts);

  public pendingBlocks: Block[][] = [];

  public onchainDataAvailability = true;
  public compressionType = CompressionType.LZ;

  public commitWrongPublicDataOnce = false;

  private pendingRings: RingInfo[][] = [];
  private pendingDeposits: Deposit[][] = [];
  private pendingOffchainWithdrawalRequests: WithdrawalRequest[][] = [];
  private pendingOnchainWithdrawalRequests: WithdrawalRequest[][] = [];
  private pendingCancels: Cancel[][] = [];

  private pendingWithdrawals: Withdrawal[] = [];

  private orderIDGenerator: number = 0;

  private dualAuthKeyPair: any;

  private MAX_NUM_EXCHANGES: number = 256;

  public async initialize(accounts: string[]) {
    this.context = await this.createContractContext();
    this.testContext = await this.createExchangeTestContext(accounts);

    this.dualAuthKeyPair = this.getKeyPairEDDSA();

    // Initialize Loopring
    await this.loopringV3.updateSettings(
      this.blockVerifier.address,
      new BN(web3.utils.toWei("1000", "ether")),
      new BN(web3.utils.toWei("0.02", "ether")),
      new BN(web3.utils.toWei("10000", "ether")),
      new BN(web3.utils.toWei("2000", "ether")),
      new BN(web3.utils.toWei("1", "ether")),
      new BN(web3.utils.toWei("250000", "ether")),
      new BN(web3.utils.toWei("1000000", "ether")),
      new BN(web3.utils.toWei("50000", "ether")),
      new BN(web3.utils.toWei("10", "ether")),
      {from: this.testContext.deployer},
    );

    await this.loopringV3.updateProtocolFeeSettings(
      25,
      50,
      10,
      25,
      new BN(web3.utils.toWei("25000000", "ether")),
      new BN(web3.utils.toWei("10000000", "ether")),
      {from: this.testContext.deployer},
    );

    for (let i = 0; i < this.MAX_NUM_EXCHANGES; i++) {
      const rings: RingInfo[] = [];
      this.pendingRings.push(rings);

      const deposits: Deposit[] = [];
      this.pendingDeposits.push(deposits);

      const offchainWithdrawalRequests: WithdrawalRequest[] = [];
      this.pendingOffchainWithdrawalRequests.push(offchainWithdrawalRequests);

      const onchainWithdrawalRequests: WithdrawalRequest[] = [];
      this.pendingOnchainWithdrawalRequests.push(onchainWithdrawalRequests);

      const cancels: Cancel[] = [];
      this.pendingCancels.push(cancels);

      const wallets: number[] = [];
      this.wallets.push(wallets);

      const accountsT: Account[] = [];
      const account: Account = {
        accountID: 0,
        owner: this.loopringV3.address,
        publicKeyX: "0",
        publicKeyY: "0",
        secretKey: "0",
        nonce: 0,
      };
      accountsT.push(account);
      this.accounts.push(accountsT);

      const pendingBlocks: Block[] = [];
      this.pendingBlocks.push(pendingBlocks);
    }

    await this.createExchange(
      this.testContext.deployer,
      true,
      this.onchainDataAvailability,
      new BN(web3.utils.toWei("0.001", "ether")),
      new BN(web3.utils.toWei("0.001", "ether")),
    );

    const settings = (await this.exchange.getGlobalSettings());
    this.MAX_PROOF_GENERATION_TIME_IN_SECONDS = settings.MAX_PROOF_GENERATION_TIME_IN_SECONDS.toNumber();
    this.MAX_AGE_REQUEST_UNTIL_FORCED = settings.MAX_AGE_REQUEST_UNTIL_FORCED.toNumber();
    this.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE = settings.MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE.toNumber();
    this.MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE =
      settings.MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE.toNumber();
    this.MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS = settings.MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS.toNumber();
    this.MAX_TIME_IN_SHUTDOWN_BASE = settings.MAX_TIME_IN_SHUTDOWN_BASE.toNumber();
    this.MAX_TIME_IN_SHUTDOWN_DELTA = settings.MAX_TIME_IN_SHUTDOWN_DELTA.toNumber();
    this.FEE_BLOCK_FINE_START_TIME = settings.FEE_BLOCK_FINE_START_TIME.toNumber();
    this.FEE_BLOCK_FINE_MAX_DURATION = settings.FEE_BLOCK_FINE_MAX_DURATION.toNumber();
    this.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS = settings.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS.toNumber();
    this.MAX_NUM_TOKENS = settings.MAX_NUM_TOKENS.toNumber();
    this.MIN_TIME_UNTIL_OPERATOR_CAN_WITHDRAW = 0;
  }

  public async setupTestState(exchangeID: number) {

    const keyPair = this.getKeyPairEDDSA();
    const depositInfo = await this.deposit(exchangeID, this.testContext.deployer,
                                           keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                           constants.zeroAddress, new BN(1));
    this.dummyAccountId = depositInfo.accountID;
    this.dummyAccountKeyPair = keyPair;

    this.operators[exchangeID] = await this.createOperator(exchangeID, this.testContext.operators[0]);

    this.ringMatcherAccountID[exchangeID] = await this.createRingMatcher(
      exchangeID,
      this.testContext.ringMatchers[0],
    );

    for (const walletAddress of this.testContext.wallets) {
      const wallet = await this.createWallet(exchangeID, walletAddress);
      this.wallets[exchangeID].push(wallet);
    }
  }

  public async createOperator(exchangeID: number, owner: string) {
    // Make an account for the operator
    const keyPair = this.getKeyPairEDDSA();
    const depositInfo = await this.deposit(exchangeID, owner,
                                           keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                           constants.zeroAddress, new BN(1));
    return depositInfo.accountID;
  }

  public async createWallet(exchangeID: number, owner: string) {
    // Make an account for the wallet
    const keyPair = this.getKeyPairEDDSA();
    const walletDeposit = await this.deposit(exchangeID, owner,
                                             keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                             constants.zeroAddress, new BN(0));
    return walletDeposit.accountID;
  }

  public async createRingMatcher(exchangeID: number, owner: string) {
    const lrcAddress = this.testContext.tokenSymbolAddrMap.get("LRC");
    const LRC = this.testContext.tokenAddrInstanceMap.get(lrcAddress);

    const balance = new BN(web3.utils.toWei("1000000", "ether"));

    // Make an account for the ringmatcher
    const keyPair = this.getKeyPairEDDSA();
    await LRC.addBalance(owner, balance);
    const ringMatcherDeposit = await this.deposit(exchangeID, owner,
                                                  keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                  lrcAddress, balance);
    return ringMatcherDeposit.accountID;
  }

  public assertNumberEqualsWithPrecision(n1: number, n2: number, precision: number = 8) {
    const numStr1 = (n1 / 1e18).toFixed(precision);
    const numStr2 = (n2 / 1e18).toFixed(precision);

    return assert.equal(Number(numStr1), Number(numStr2));
  }

  public async getEventsFromContract(contract: any, eventName: string, fromBlock: number) {
    return await contract.getPastEvents(eventName, {
      fromBlock,
      toBlock: "latest",
    }).then((events: any) => {
        return events;
    });
  }

  public async getTransferEvents(tokens: any[], fromBlock: number) {
    let transferItems: Array<[string, string, string, BN]> = [];
    for (const tokenContractInstance of tokens) {
      const eventArr: any = await this.getEventsFromContract(tokenContractInstance, "Transfer", fromBlock);
      const items = eventArr.map((eventObj: any) => {
        return [tokenContractInstance.address, eventObj.args.from, eventObj.args.to, eventObj.args.value];
      });
      transferItems = transferItems.concat(items);
    }

    return transferItems;
  }

  public async watchAndPrintEvent(contract: any, eventName: string) {
    const events: any = await this.getEventsFromContract(contract, eventName, web3.eth.blockNumber);

    events.forEach((e: any) => {
      logInfo("event:", util.inspect(e.args, false, null));
    });
  }

  public async setupRing(ring: RingInfo, bSetupOrderA: boolean = true, bSetupOrderB: boolean = true) {
    if (bSetupOrderA) {
      await this.setupOrder(ring.orderA, this.orderIDGenerator++);
    }
    if (bSetupOrderB) {
      await this.setupOrder(ring.orderB, this.orderIDGenerator++);
    }
    ring.ringMatcherAccountID = (ring.ringMatcherAccountID !== undefined) ?
                                ring.ringMatcherAccountID : this.ringMatcherAccountID[ring.orderA.exchangeID];
    ring.tokenID = (ring.tokenID !== undefined) ? ring.tokenID : (await this.getTokenIdFromNameOrAddress("LRC"));
    ring.fee = ring.fee ? ring.fee : new BN(web3.utils.toWei("1", "ether"));
  }

  public async setupOrder(order: OrderInfo, index: number) {
    if (order.owner === undefined) {
      const accountIndex = index % this.testContext.orderOwners.length;
      order.owner = this.testContext.orderOwners[accountIndex];
    } else if (order.owner !== undefined && !order.owner.startsWith("0x")) {
      const accountIndex = parseInt(order.owner, 10);
      assert(accountIndex >= 0 && accountIndex < this.testContext.orderOwners.length, "Invalid owner index");
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
      order.validSince = (await web3.eth.getBlock(blockNumber)).timestamp - 10000;
    }
    if (!order.validUntil) {
      // Set the order validUntil time to a bit after the current timestamp;
      const blockNumber = await web3.eth.getBlockNumber();
      order.validUntil = (await web3.eth.getBlock(blockNumber)).timestamp + 25000;
    }
    if (!order.dualAuthPublicKeyX || !order.dualAuthPublicKeyY) {
      const keyPair = this.getKeyPairEDDSA();
      order.dualAuthPublicKeyX = keyPair.publicKeyX;
      order.dualAuthPublicKeyY = keyPair.publicKeyY;
      order.dualAuthSecretKey = keyPair.secretKey;
    }

    order.exchangeID = (order.exchangeID !== undefined) ? order.exchangeID : this.exchangeId;

    order.buy = (order.buy !== undefined) ? order.buy : true;

    order.maxFeeBips = (order.maxFeeBips !== undefined) ? order.maxFeeBips : 20;
    order.allOrNone = order.allOrNone ? order.allOrNone : false;

    order.feeBips = (order.feeBips !== undefined) ? order.feeBips : order.maxFeeBips;
    order.rebateBips = (order.rebateBips !== undefined) ? order.rebateBips : 0;

    order.orderID = (order.orderID !== undefined) ? order.orderID : index;

    order.exchangeID = (order.exchangeID !== undefined) ? order.exchangeID : 0;

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
    const message = new BitArray();
    message.addNumber(this.exchangeId, 32);
    message.addNumber(order.orderID, 20);
    message.addNumber(order.accountID, 20);
    message.addString(order.dualAuthPublicKeyX, 254);
    message.addString(order.dualAuthPublicKeyY, 254);
    message.addNumber(order.tokenIdS, 8);
    message.addNumber(order.tokenIdB, 8);
    message.addBN(order.amountS, 96);
    message.addBN(order.amountB, 96);
    message.addNumber(order.allOrNone ? 1 : 0, 1);
    message.addNumber(order.validSince, 32);
    message.addNumber(order.validUntil, 32);
    message.addNumber(order.maxFeeBips, 6);
    message.addNumber(order.buy ? 1 : 0, 1);
    const account = this.accounts[this.exchangeId][order.accountID];
    const sig = eddsa.sign(account.secretKey, message.getBits());
    order.hash = sig.hash;
    order.signature = {
      Rx: sig.R[0].toString(),
      Ry: sig.R[1].toString(),
      s: sig.S.toString(),
    };
    // console.log(order.signature);
  }

  public signRing(ring: RingInfo) {
    if (ring.ringMatcherSignature !== undefined) {
      return;
    }
    const account = this.accounts[this.exchangeId][ring.ringMatcherAccountID];
    const nonce = account.nonce++;
    const message = new BitArray();
    message.addString(ring.orderA.hash, 254);
    message.addString(ring.orderB.hash, 254);
    message.addNumber(ring.ringMatcherAccountID, 20);
    message.addNumber(ring.tokenID, 8);
    message.addBN(ring.fee, 96);
    message.addNumber(ring.orderA.feeBips, 6);
    message.addNumber(ring.orderB.feeBips, 6);
    message.addNumber(ring.orderA.rebateBips, 6);
    message.addNumber(ring.orderB.rebateBips, 6);
    message.addNumber(nonce, 32);
    message.addNumber(0, 1);
    const sig = eddsa.sign(account.secretKey, message.getBits());
    ring.ringMatcherSignature = {
      Rx: sig.R[0].toString(),
      Ry: sig.R[1].toString(),
      s: sig.S.toString(),
    };

    if (ring.dualAuthASignature === undefined) {
      const dualAuthAsig = eddsa.sign(ring.orderA.dualAuthSecretKey, message.getBits());
      ring.dualAuthASignature = {
        Rx: dualAuthAsig.R[0].toString(),
        Ry: dualAuthAsig.R[1].toString(),
        s: dualAuthAsig.S.toString(),
      };
    }

    if (ring.dualAuthBSignature === undefined) {
      const dualAuthBsig = eddsa.sign(ring.orderB.dualAuthSecretKey, message.getBits());
      ring.dualAuthBSignature = {
        Rx: dualAuthBsig.R[0].toString(),
        Ry: dualAuthBsig.R[1].toString(),
        s: dualAuthBsig.S.toString(),
      };
    }
  }

  public signCancel(cancel: Cancel) {
    if (cancel.signature !== undefined) {
      return;
    }
    const account = this.accounts[this.exchangeId][cancel.accountID];
    const message = new BitArray();
    message.addNumber(this.exchangeId, 32);
    message.addNumber(cancel.accountID, 20);
    message.addNumber(cancel.orderTokenID, 8);
    message.addNumber(cancel.orderID, 20);
    message.addNumber(cancel.walletAccountID, 20);
    message.addNumber(cancel.feeTokenID, 8);
    message.addBN(cancel.fee, 96);
    message.addNumber(cancel.walletSplitPercentage, 7);
    message.addNumber(account.nonce++, 32);
    message.addNumber(0, 2);
    const sig = eddsa.sign(account.secretKey, message.getBits());
    cancel.signature = {
      Rx: sig.R[0].toString(),
      Ry: sig.R[1].toString(),
      s: sig.S.toString(),
    };
    // console.log(cancel.signature);
  }

  public signWithdrawal(withdrawal: WithdrawalRequest) {
    if (withdrawal.signature !== undefined) {
      return;
    }
    const account = this.accounts[this.exchangeId][withdrawal.accountID];
    const message = new BitArray();
    message.addNumber(this.exchangeId, 32);
    message.addNumber(withdrawal.accountID, 20);
    message.addNumber(withdrawal.tokenID, 8);
    message.addBN(withdrawal.amount, 96);
    message.addNumber(withdrawal.walletAccountID, 20);
    message.addNumber(withdrawal.feeTokenID, 8);
    message.addBN(withdrawal.fee, 96);
    message.addNumber(withdrawal.walletSplitPercentage, 7);
    message.addNumber(account.nonce++, 32);
    message.addNumber(0, 1);
    const sig = eddsa.sign(account.secretKey, message.getBits());
    withdrawal.signature = {
      Rx: sig.R[0].toString(),
      Ry: sig.R[1].toString(),
      s: sig.S.toString(),
    };
    // console.log(withdrawal.signature);
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

    const balanceS = (order.balanceS !== undefined) ? order.balanceS : order.amountS;
    const depositInfo = await this.deposit(order.exchangeID, order.owner,
                                           secretKey, publicKeyX, publicKeyY,
                                           order.tokenS, balanceS, accountID);
    order.accountID = depositInfo.accountID;

    const balanceB = (order.balanceB !== undefined) ? order.balanceB : new BN(0);
    if (balanceB.gt(new BN(0))) {
      await this.deposit(order.exchangeID, order.owner,
                         secretKey, publicKeyX, publicKeyY,
                         order.tokenB, balanceB, order.accountID);
    }
  }

  public getAddressBook(ring: RingInfo, index?: number, addressBook: { [id: number]: string; } = {}) {
    const addAccount = (addrBook: { [id: string]: any; }, accountID: number, name: string) => {
      addrBook[accountID] = (addrBook[accountID] ? addrBook[accountID] + "=" : "") + name;
    };
    const bIndex = index !== undefined;
    addAccount(addressBook, 0, "ProtocolFeePool");
    addAccount(addressBook, ring.orderA.accountID, "OwnerA" + (bIndex ? "[" + index + "]" : ""));
    addAccount(addressBook, ring.orderB.accountID, "OwnerB" + (bIndex ? "[" + index + "]" : ""));
    addAccount(addressBook, ring.ringMatcherAccountID, "RingMatcher" + (bIndex ? "[" + index + "]" : ""));
    return addressBook;
  }

  public getAddressBookBlock(ringBlock: RingBlock) {
    const addAccount = (addrBook: { [id: string]: any; }, accountID: number, name: string) => {
      addrBook[accountID] = (addrBook[accountID] ? addrBook[accountID] + "=" : "") + name;
    };

    let addressBook: { [id: number]: string; } = {};
    let index = 0;
    for (const ring of ringBlock.rings) {
      addressBook = this.getAddressBook(ring, index++, addressBook);
    }
    addAccount(addressBook, ringBlock.operatorAccountID, "Operator");
    return addressBook;
  }

  public getKeyPairEDDSA() {
    // TODO: secure random number generation
    const randomNumber = this.getRandomInt(218882428718390);
    let secretKey = bigInt(randomNumber.toString(10));
    secretKey = secretKey.mod(babyJub.subOrder);

    // const publicKey = eddsa.prv2pub(secretKey);
    const publicKey = babyJub.mulPointEscalar(babyJub.Base8, secretKey);
    // const publicKey = eddsa.prv2pub(Buffer.from(randomNumber.toString(16), "hex"));
    // console.log(secretKey);
    // console.log(publicKey);

    const keyPair: KeyPair = {
      publicKeyX: publicKey[0].toString(10),
      publicKeyY: publicKey[1].toString(10),
      secretKey: secretKey.toString(10),
    };
    // console.log(keyPair);
    return keyPair;
  }

  public flattenList = (l: any[]) => {
    return [].concat.apply([], l);
  }

  public flattenVK = (vk: any) => {
    return [
      this.flattenList([
        vk.alpha[0], vk.alpha[1],
        this.flattenList(vk.beta),
        this.flattenList(vk.gamma),
        this.flattenList(vk.delta),
      ]),
      this.flattenList(vk.gammaABC),
    ];
  }

  public flattenProof = (proof: any) => {
    return this.flattenList([
        proof.A,
        this.flattenList(proof.B),
        proof.C,
    ]);
  }

  public async deposit(exchangeID: number, owner: string, secretKey: string, publicKeyX: string, publicKeyY: string,
                       token: string, amount: BN, accountID?: number, accountContract?: any) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }

    let numAvailableSlots = (await this.exchange.getNumAvailableDepositSlots()).toNumber();
    if (numAvailableSlots === 0) {
      await this.commitDeposits(exchangeID);
      numAvailableSlots = (await this.exchange.getNumAvailableDepositSlots()).toNumber();
      assert(numAvailableSlots > 0, "numAvailableSlots > 0");
    }

    const fees = await this.exchange.getFees();
    let ethToSend = fees._depositFeeETH.add(fees._accountCreationFeeETH);
    if (amount.gt(0)) {
      if (token !== constants.zeroAddress) {
        const Token = this.testContext.tokenAddrInstanceMap.get(token);
        await Token.setBalance(
          owner,
          amount,
        );
        await Token.approve(
          this.exchange.address,
          amount,
          {from: owner},
        );
      } else {
        ethToSend = ethToSend.add(web3.utils.toBN(amount));
      }
    }

    // Do the deposit
    const contract = accountContract ? accountContract : this.exchange;
    const caller = accountContract ? this.testContext.orderOwners[0] : owner;
    const tx = await contract.updateAccountAndDeposit(
      new BN(publicKeyX),
      new BN(publicKeyY),
      token,
      web3.utils.toBN(amount),
      {from: caller, value: ethToSend},
    );
    // logInfo("\x1b[46m%s\x1b[0m", "[Deposit] Gas used: " + tx.receipt.gasUsed);

    const eventArr: any = await this.getEventsFromContract(this.exchange, "DepositRequested", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.accountID, eventObj.args.depositIdx];
    });

    const depositInfo: DepositInfo = {
      owner,
      token,
      amount,
      fee: fees._depositFeeETH,
      timestamp: (await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp,
      accountID: items[0][0].toNumber(),
      depositIdx: items[0][1].toNumber(),
    };

    accountID = items[0][0].toNumber();

    if (accountID === this.accounts[exchangeID].length) {
      const account: Account = {
        accountID,
        owner,
        publicKeyX,
        publicKeyY,
        secretKey,
        nonce: 0,
      };
      this.accounts[exchangeID].push(account);
    } else {
      const account = this.accounts[exchangeID][accountID];
      account.publicKeyX = publicKeyX;
      account.publicKeyY = publicKeyY;
      account.secretKey = secretKey;
    }

    this.addDeposit(this.pendingDeposits[exchangeID], depositInfo.depositIdx, depositInfo.accountID,
                    secretKey, publicKeyX, publicKeyY,
                    this.tokenAddressToIDMap.get(token), amount);
    return depositInfo;
  }

  public async depositTo(accountID: number, token: string, amount: BN) {
    const account = this.accounts[this.exchangeId][accountID];
    return await this.deposit(this.exchangeId, account.owner,
                              account.secretKey, account.publicKeyX, account.publicKeyY,
                              token, amount);
  }

  public async requestWithdrawalOffchain(exchangeID: number, accountID: number, token: string, amount: BN,
                                         feeToken: string, fee: BN, walletSplitPercentage: number,
                                         walletAccountID: number) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    const tokenID = this.tokenAddressToIDMap.get(token);
    if (!feeToken.startsWith("0x")) {
      feeToken = this.testContext.tokenSymbolAddrMap.get(feeToken);
    }
    const feeTokenID = this.tokenAddressToIDMap.get(feeToken);
    this.addWithdrawalRequest(this.pendingOffchainWithdrawalRequests[exchangeID], accountID, tokenID, amount,
                              walletAccountID, feeTokenID, fee, walletSplitPercentage);
    return this.pendingOffchainWithdrawalRequests[exchangeID]
           [this.pendingOffchainWithdrawalRequests[exchangeID].length - 1];
  }

  public async requestWithdrawalOnchain(exchangeID: number, accountID: number, token: string,
                                        amount: BN, owner: string) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    const tokenID = this.tokenAddressToIDMap.get(token);

    let numAvailableSlots = (await this.exchange.getNumAvailableWithdrawalSlots()).toNumber();
    if (numAvailableSlots === 0) {
        await this.commitOnchainWithdrawalRequests(exchangeID);
        numAvailableSlots = (await this.exchange.getNumAvailableWithdrawalSlots()).toNumber();
        assert(numAvailableSlots > 0, "numAvailableSlots > 0");
    }

    const withdrawalFee = (await this.exchange.getFees())._withdrawalFeeETH;

    // Submit the withdraw request
    let tx;
    if (accountID === 0) {
      tx = await this.loopringV3.withdrawProtocolFeesFromExchange(
        exchangeID,
        token,
        {from: owner, value: withdrawalFee},
      );
      amount = new BN(2);
      amount = amount.pow(new BN(96)).sub(new BN(1));
    } else {
      tx = await this.exchange.withdraw(
        token,
        web3.utils.toBN(amount),
        {from: owner, value: withdrawalFee},
      );
    }
    logInfo("\x1b[46m%s\x1b[0m", "[WithdrawRequest] Gas used: " + tx.receipt.gasUsed);

    const eventArr: any = await this.getEventsFromContract(this.exchange, "WithdrawalRequested", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.withdrawalIdx];
    });
    const withdrawalIdx = items[0][0].toNumber();

    const walletAccountID = this.wallets[exchangeID][0];
    this.addWithdrawalRequest(this.pendingOnchainWithdrawalRequests[exchangeID],
                              accountID, tokenID, amount, walletAccountID, tokenID, new BN(0),
                              0, withdrawalIdx, withdrawalFee);
    return this.pendingOnchainWithdrawalRequests[exchangeID]
           [this.pendingOnchainWithdrawalRequests[exchangeID].length - 1];
  }

  public async requestShutdownWithdrawal(exchangeID: number, accountID: number, token: string, amount: BN) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    const tokenID = this.tokenAddressToIDMap.get(token);

    this.addWithdrawalRequest(this.pendingOnchainWithdrawalRequests[exchangeID],
                              accountID, tokenID, amount, 0, tokenID, new BN(0),
                              0, 0);
    return this.pendingOnchainWithdrawalRequests[exchangeID]
           [this.pendingOnchainWithdrawalRequests[exchangeID].length - 1];
  }

  public addDeposit(deposits: Deposit[], depositIdx: number, accountID: number,
                    secretKey: string, publicKeyX: string, publicKeyY: string,
                    tokenID: number, amount: BN) {
    deposits.push({accountID, depositIdx, secretKey, publicKeyX, publicKeyY, tokenID, amount});
  }

  public addCancel(cancels: Cancel[], accountID: number, orderTokenID: number, orderID: number,
                   walletAccountID: number, feeTokenID: number, fee: BN, walletSplitPercentage: number) {
    cancels.push({accountID, orderTokenID, orderID, walletAccountID, feeTokenID, fee, walletSplitPercentage});
  }

  public cancelOrderID(exchangeID: number, accountID: number,
                       orderTokenID: number, orderID: number,
                       walletAccountID: number,
                       feeTokenID: number, fee: BN, walletSplitPercentage: number) {
    this.addCancel(this.pendingCancels[exchangeID], accountID, orderTokenID, orderID, walletAccountID,
                                                 feeTokenID, fee, walletSplitPercentage);
  }

  public cancelOrder(order: OrderInfo, walletAccountID: number, feeToken: string, fee: BN) {
    if (!feeToken.startsWith("0x")) {
      feeToken = this.testContext.tokenSymbolAddrMap.get(feeToken);
    }
    const feeTokenID = this.tokenAddressToIDMap.get(feeToken);
    this.cancelOrderID(order.exchangeID, order.accountID, order.tokenIdS, order.orderID,
                       walletAccountID, feeTokenID, fee, 50);
  }

  public addWithdrawalRequest(withdrawalRequests: WithdrawalRequest[],
                              accountID: number, tokenID: number, amount: BN,
                              walletAccountID: number, feeTokenID: number, fee: BN, walletSplitPercentage: number,
                              withdrawalIdx?: number, withdrawalFee?: BN) {
    withdrawalRequests.push({accountID, tokenID, amount, walletAccountID,
                             feeTokenID, fee, walletSplitPercentage, withdrawalIdx, withdrawalFee});
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

  public async createBlock(exchangeID: number, blockType: number, data: string) {
    const nextBlockIdx = (await this.exchange.getBlockHeight()).toNumber() + 1;
    const inputFilename = "./blocks/block_" + exchangeID + "_" + nextBlockIdx + "_info.json";
    const outputFilename = "./blocks/block_" + exchangeID + "_" + nextBlockIdx + ".json";

    this.ensureDirectoryExists(inputFilename);
    fs.writeFileSync(inputFilename, data, "utf8");

    const result = childProcess.spawnSync(
      "python3",
      ["operator/create_block.py", "" + exchangeID, "" + nextBlockIdx, "" + blockType, inputFilename, outputFilename],
      {stdio: doDebugLogging() ? "inherit" : "ignore"},
    );
    assert(result.status === 0, "create_block failed: " + blockType);

    return [nextBlockIdx, outputFilename];
  }

  public async commitBlock(operatorId: number, blockType: BlockType, blockSize: number,
                           data: string, filename: string) {
    if (this.commitWrongPublicDataOnce) {
      data += "00";
      this.commitWrongPublicDataOnce = false;
    }
    logDebug("[EVM]PublicData: " + data);
    const compressedData = compress(data, this.compressionType, this.lzDecompressor.address);

    // Make sure the keys are generated
    await this.generateKeys(filename);

    const blockVersion = 0;
    const operatorContract = this.operator ? this.operator : this.exchange;
    const tx = await operatorContract.commitBlock(
      web3.utils.toBN(blockType),
      web3.utils.toBN(blockSize),
      web3.utils.toBN(blockVersion),
      web3.utils.hexToBytes(compressedData),
      web3.utils.hexToBytes("0x"),
      {from: this.exchangeOperator},
    );
    logInfo("\x1b[46m%s\x1b[0m", "[commitBlock] Gas used: " + tx.receipt.gasUsed);

    const blockIdx = (await this.exchange.getBlockHeight()).toNumber();
    const block: Block = {
      blockIdx,
      filename,
      operatorId,
      compressedData,
    };
    this.pendingBlocks[this.exchangeId].push(block);
    return block;
  }

  public async generateKeys(blockFilename: string) {
    const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

    const result = childProcess.spawnSync(
      "build/circuit/dex_circuit",
      ["-createkeys", blockFilename],
      {stdio: doDebugLogging() ? "inherit" : "ignore"},
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
    }
    verificationKeyFilename += block.onchainDataAvailability ? "_DA_" : "_";
    verificationKeyFilename += block.blockSize + "_vk.json";

    // Read the verification key and set it in the smart contract
    const vk = JSON.parse(fs.readFileSync(verificationKeyFilename, "ascii"));
    const vkFlattened = this.flattenList(this.flattenVK(vk));
    // console.log(vkFlattened);
    const blockVersion = 0;
    await this.blockVerifier.setVerifyingKey(
      block.blockType,
      block.onchainDataAvailability,
      block.blockSize,
      blockVersion,
      vkFlattened,
    );
  }

  public async verifyBlock(blockIdx: number, blockFilename: string) {
    const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

    const proofFilename = "./blocks/block_" + block.exchangeID + "_" + blockIdx + "_proof.json";
    const result = childProcess.spawnSync(
      "build/circuit/dex_circuit",
      ["-prove", blockFilename, proofFilename],
      {stdio: doDebugLogging() ? "inherit" : "ignore"},
    );
    assert(result.status === 0, "verifyBlock failed: " + blockFilename);

    // Read the proof
    const proof = JSON.parse(fs.readFileSync(proofFilename, "ascii"));
    const proofFlattened = this.flattenProof(proof);
    // console.log(proof);
    // console.log(this.flattenProof(proof));

    const operatorContract = this.operator ? this.operator : this.exchange;
    const tx = await operatorContract.verifyBlock(
      web3.utils.toBN(blockIdx),
      proofFlattened,
      {from: this.exchangeOperator},
    );
    logInfo("\x1b[46m%s\x1b[0m", "[verifyBlock] Gas used: " + tx.receipt.gasUsed);

    return proofFilename;
  }

  public async verifyPendingBlocks(exchangeID: number) {
    for (const block of this.pendingBlocks[exchangeID]) {
      await this.verifyBlock(block.blockIdx, block.filename);
    }
    this.pendingBlocks[exchangeID] = [];
  }

  public getPendingDeposits(exchangeID: number) {
    const pendingDeposits: Deposit[] = [];
    for (const pendingDeposit of this.pendingDeposits[exchangeID]) {
      pendingDeposits.push(pendingDeposit);
    }
    return pendingDeposits;
  }

  public async commitDeposits(exchangeID: number, pendingDeposits?: Deposit[]) {
    const blockInfos: Block[] = [];

    if (pendingDeposits === undefined) {
      pendingDeposits = this.pendingDeposits[exchangeID];
    }
    if (pendingDeposits.length === 0) {
      return;
    }

    let numDepositsDone = 0;
    while (numDepositsDone < pendingDeposits.length) {
      const deposits: Deposit[] = [];
      let numRequestsInBlock = 0;

      // Get all deposits for the block
      const blockSize = this.getBestBlockSize(pendingDeposits.length - numDepositsDone, this.depositBlockSizes);
      for (let b = numDepositsDone; b < numDepositsDone + blockSize; b++) {
          if (b < pendingDeposits.length) {
            deposits.push(pendingDeposits[b]);
            numRequestsInBlock++;
          } else {
            const dummyDeposit: Deposit = {
              depositIdx: 0,
              accountID: 0,
              secretKey: "0",
              publicKeyX: "0",
              publicKeyY: "0",
              tokenID: 0,
              amount: new BN(0),
            };
            deposits.push(dummyDeposit);
          }
      }
      assert(deposits.length === blockSize);
      numDepositsDone += blockSize;

      const startIndex = (await this.exchange.getNumDepositRequestsProcessed()).toNumber();
      // console.log("startIndex: " + startIndex);
      // console.log("numRequestsProcessed: " + numRequestsProcessed);
      const firstRequestData = await this.exchange.getDepositRequest(startIndex - 1);
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
        endingHash = "0x" + SHA256(Buffer.from(hashData.getData().slice(2), "hex")).toString("hex");
      }

      // Block info
      const depositBlock: DepositBlock = {
        onchainDataAvailability: false,
        startHash: new BN(startingHash.slice(2), 16),
        deposits,
        startIndex,
        count: numRequestsInBlock,
      };

      // Store state before
      const currentBlockIdx = (await this.exchange.getBlockHeight()).toNumber();
      const stateBefore = await this.loadExchangeState(exchangeID, currentBlockIdx);

      const [idx, blockFilename] = await this.createBlock(exchangeID, 1, JSON.stringify(depositBlock, replacer, 4));

      // Store state after
      const stateAfter = await this.loadExchangeState(exchangeID, currentBlockIdx + 1);

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
      const blockInfo = await this.commitBlock(operator, BlockType.DEPOSIT, blockSize, bs.getData(), blockFilename);

      blockInfos.push(blockInfo);
    }

    this.pendingDeposits[exchangeID] = [];

    return blockInfos;
  }

  public async loadExchangeState(exchangeID: number, blockIdx?: number) {
    // Read in the state
    if (blockIdx === undefined) {
      blockIdx = (await this.exchange.getBlockHeight()).toNumber();
    }
    const accounts: AccountLeaf[] = [];
    if (blockIdx > 0) {
      const stateFile = "states/state_" + exchangeID + "_" + blockIdx + ".json";
      const jState = JSON.parse(fs.readFileSync(stateFile, "ascii"));

      const accountsKeys: string[] = Object.keys(jState.accounts_values);
      let numAccounts = 1;
      for (const accountKey of accountsKeys) {
        numAccounts = (Number(accountKey) >= numAccounts) ? Number(accountKey) + 1 : numAccounts;
      }
      for (let i = 0; i < numAccounts; i++) {
        const emptyAccount: AccountLeaf = {
          publicKeyX: "0",
          publicKeyY: "0",
          nonce: 0,
          balances: {},
        };
        accounts.push(emptyAccount);
      }
      for (const accountKey of accountsKeys) {
        const jAccount = jState.accounts_values[accountKey];

        const balances: {[key: number]: Balance} = {};
        const balancesKeys: string[] = Object.keys(jAccount._balancesLeafs);
        for (const balanceKey of balancesKeys) {
          const jBalance = jAccount._balancesLeafs[balanceKey];

          const tradeHistory: {[key: number]: TradeHistory} = {};
          const tradeHistoryKeys: string[] = Object.keys(jBalance._tradeHistoryLeafs);
          for (const tradeHistoryKey of tradeHistoryKeys) {
            const jTradeHistory = jBalance._tradeHistoryLeafs[tradeHistoryKey];
            tradeHistory[Number(tradeHistoryKey)] = {
              filled: new BN(jTradeHistory.filled, 10),
              cancelled: jTradeHistory.cancelled === 1,
              orderID: jTradeHistory.orderID,
            };
          }
          balances[Number(balanceKey)] = {
            balance: new BN(jBalance.balance, 10),
            tradeHistory,
          };
        }
        const account: AccountLeaf = {
          publicKeyX: jAccount.publicKeyX,
          publicKeyY: jAccount.publicKeyY,
          nonce: jAccount.nonce,
          balances,
        };
        accounts[Number(accountKey)] = account;
      }
    } else {
      const emptyAccount: AccountLeaf = {
        publicKeyX: "0",
        publicKeyY: "0",
        nonce: 0,
        balances: {},
      };
      accounts.push(emptyAccount);
    }

    // Make sure all tokens exist
    for (const account of accounts) {
      for (let i = 0; i < this.MAX_NUM_TOKENS; i++) {
        if (!account.balances[i]) {
          account.balances[i] = {
            balance: new BN(0),
            tradeHistory: {},
          };
        }
      }
    }

    const exchangeState: ExchangeState = {
      accounts,
    };
    return exchangeState;
  }

  public async getActiveOperator(exchangeID: number) {
    return this.activeOperator ? this.activeOperator : this.operators[exchangeID];
  }

  public async setOperatorContract(operator: any) {
    await this.exchange.setOperator(operator.address, {from: this.exchangeOwner});
    this.operator = operator;
  }

  public async setActiveOperator(operator: number) {
    this.activeOperator = operator;
  }

  public async commitWithdrawalRequests(onchain: boolean, exchangeID: number, shutdown: boolean = false) {
    let pendingWithdrawals: WithdrawalRequest[];
    if (onchain) {
      pendingWithdrawals = this.pendingOnchainWithdrawalRequests[exchangeID];
    } else {
      pendingWithdrawals = this.pendingOffchainWithdrawalRequests[exchangeID];
    }
    if (pendingWithdrawals.length === 0) {
      return;
    }

    const blockType = onchain ? BlockType.ONCHAIN_WITHDRAWAL : BlockType.OFFCHAIN_WITHDRAWAL;

    let numWithdrawalsDone = 0;
    while (numWithdrawalsDone < pendingWithdrawals.length) {
      const withdrawals: WithdrawalRequest[] = [];
      let numRequestsInBlock = 0;
      // Get all withdrawals for the block
      const blockSizes = onchain ? this.onchainWithdrawalBlockSizes : this.offchainWithdrawalBlockSizes;
      const blockSize = this.getBestBlockSize(pendingWithdrawals.length - numWithdrawalsDone, blockSizes);
      for (let b = numWithdrawalsDone; b < numWithdrawalsDone + blockSize; b++) {
        if (b < pendingWithdrawals.length) {
          pendingWithdrawals[b].slotIdx = withdrawals.length;
          withdrawals.push(pendingWithdrawals[b]);
          numRequestsInBlock++;
        } else {
          const dummyWithdrawalRequest: WithdrawalRequest = {
            accountID: onchain ? 0 : this.dummyAccountId,
            tokenID: 0,
            amount: new BN(0),
            walletAccountID: onchain ? 0 : this.wallets[exchangeID][0],
            feeTokenID: 1,
            fee: new BN(0),
            walletSplitPercentage: 0,
          };
          withdrawals.push(dummyWithdrawalRequest);
        }
      }
      assert(withdrawals.length === blockSize);
      numWithdrawalsDone += blockSize;

      if (!onchain) {
        // Sign the offchain withdrawals
        for (const withdrawal of withdrawals) {
          this.signWithdrawal(withdrawal);
        }
      }

      const startIndex = (await this.exchange.getNumWithdrawalRequestsProcessed()).toNumber();
      // console.log("startIndex: " + startIndex);
      // console.log("numRequestsProcessed: " + numRequestsProcessed);
      const firstRequestData = await this.exchange.getWithdrawRequest(startIndex - 1);
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
        endingHash = "0x" + SHA256(Buffer.from(hashData.getData().slice(2), "hex")).toString("hex");
      }

      // Block info
      const operator = await this.getActiveOperator(exchangeID);
      const withdrawalBlock: WithdrawBlock = {
        withdrawals,
        onchainDataAvailability: this.onchainDataAvailability,
        operatorAccountID: onchain ? 0 : operator,
        startHash: onchain ? new BN(startingHash.slice(2), 16) : new BN(0),
        startIndex: onchain ? startIndex : 0,
        count: shutdown ? 0 : (onchain ? numRequestsInBlock : 0),
      };

      // Store state before
      const currentBlockIdx = (await this.exchange.getBlockHeight()).toNumber();
      const stateBefore = await this.loadExchangeState(exchangeID, currentBlockIdx);

      const jWithdrawalsInfo = JSON.stringify(withdrawalBlock, replacer, 4);
      const [blockIdx, blockFilename] = await this.createBlock(exchangeID, blockType, jWithdrawalsInfo);

      // Store state after
      const stateAfter = await this.loadExchangeState(exchangeID, currentBlockIdx + 1);

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
        bs.addNumber((withdrawal.accountID * (2 ** 28)) + withdrawal.fAmountWithdrawn, 6);
      }
      if (!onchain && block.onchainDataAvailability) {
        bs.addNumber(block.operatorAccountID, 3);
        for (const withdrawal of block.withdrawals) {
          bs.addNumber(withdrawal.walletAccountID, 3);
          bs.addNumber(withdrawal.feeTokenID, 1);
          bs.addNumber(toFloat(new BN(withdrawal.fee), constants.Float16Encoding), 2);
          bs.addNumber(withdrawal.walletSplitPercentage, 1);
        }
      }

       // Validate state change
      if (onchain) {
        this.validateOnchainWithdrawals(withdrawalBlock, stateBefore, stateAfter);
      } else {
        this.validateOffchainWithdrawals(withdrawalBlock, bs, stateBefore, stateAfter);
      }

      // Commit the block
      await this.commitBlock(operator, blockType, blockSize, bs.getData(), blockFilename);

      // Add as a pending withdrawal
      let withdrawalIdx = 0;
      for (const withdrawalRequest of block.withdrawals) {
        const withdrawal: Withdrawal = {
          exchangeID,
          blockIdx,
          withdrawalIdx,
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

  public async commitOffchainWithdrawalRequests(exchangeID: number) {
    return this.commitWithdrawalRequests(false, exchangeID);
  }

  public async commitOnchainWithdrawalRequests(exchangeID: number) {
    return this.commitWithdrawalRequests(true, exchangeID);
  }

  public async commitShutdownWithdrawalRequests(exchangeID: number) {
    return this.commitWithdrawalRequests(true, exchangeID, true);
  }

  public async submitPendingWithdrawals(addressBook?: { [id: string]: string; }) {
    for (const withdrawal of this.pendingWithdrawals) {
      const txw = await this.exchange.withdraw(
        web3.utils.toBN(withdrawal.exchangeID),
        web3.utils.toBN(withdrawal.blockIdx),
        web3.utils.toBN(withdrawal.withdrawalIdx),
      );

      const eventArr: any = await this.getEventsFromContract(this.exchange, "Withdraw", web3.eth.blockNumber);
      const items = eventArr.map((eventObj: any) => {
        return [eventObj.args.to, eventObj.args.tokenID, eventObj.args.amount];
      });
      const tokenID = items[0][1].toNumber();
      const tokenAddress = this.tokenIDToAddressMap.get(tokenID);
      const to = addressBook ? addressBook[items[0][0]] : items[0][0];
      const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(tokenAddress);
      const decimals = this.testContext.tokenAddrDecimalsMap.get(tokenAddress);
      const amount = items[0][2].div(web3.utils.toBN(10 ** decimals)).toString(10);
      logInfo("Withdrawn: " + to + ": " + amount + " " + tokenSymbol);
    }

    this.pendingWithdrawals = [];
  }

  public async commitRings(exchangeID: number) {
    const pendingRings = this.pendingRings[exchangeID];
    if (pendingRings.length === 0) {
      return;
    }

    // Generate the token transfers for the ring
    const blockNumber = await web3.eth.getBlockNumber();
    const timestamp = (await web3.eth.getBlock(blockNumber)).timestamp + 30;

    let numRingsDone = 0;
    while (numRingsDone < pendingRings.length) {
      // Get all rings for the block
      const blockSize = this.getBestBlockSize(pendingRings.length - numRingsDone, this.ringSettlementBlockSizes);
      const rings: RingInfo[] = [];
      for (let b = numRingsDone; b < numRingsDone + blockSize; b++) {
        if (b < pendingRings.length) {
          rings.push(pendingRings[b]);
        } else {
          const walletAccountID = this.wallets[exchangeID][0];
          const dummyRing: RingInfo = {
            orderA:
              {
                exchangeID,
                orderID: 0,
                accountID: this.dummyAccountId,
                walletAccountID,

                dualAuthPublicKeyX: this.dualAuthKeyPair.publicKeyX,
                dualAuthPublicKeyY: this.dualAuthKeyPair.publicKeyY,
                dualAuthSecretKey: this.dualAuthKeyPair.secretKey,

                tokenIdS: 0,
                tokenIdB: 1,

                allOrNone: false,
                validSince: 0,
                validUntil: 0,

                maxFeeBips: 0,

                feeBips: 0,
                rebateBips: 0,

                amountS: new BN(1),
                amountB: new BN(1),
              },
            orderB:
              {
                exchangeID,
                orderID: 0,
                accountID: this.dummyAccountId,
                walletAccountID,

                dualAuthPublicKeyX: this.dualAuthKeyPair.publicKeyX,
                dualAuthPublicKeyY: this.dualAuthKeyPair.publicKeyY,
                dualAuthSecretKey: this.dualAuthKeyPair.secretKey,

                tokenIdS: 1,
                tokenIdB: 0,

                allOrNone: false,
                validSince: 0,
                validUntil: 0,

                maxFeeBips: 0,

                feeBips: 0,
                rebateBips: 0,

                amountS: new BN(1),
                amountB: new BN(1),
              },
              ringMatcherAccountID: this.ringMatcherAccountID[exchangeID],
            tokenID: 0,
            fee: new BN(0),
          };
          this.signOrder(dummyRing.orderA);
          this.signOrder(dummyRing.orderB);
          rings.push(dummyRing);
        }
      }
      assert(rings.length === blockSize);
      numRingsDone += blockSize;

      // Sign the rings
      for (const ring of rings) {
        this.signRing(ring);
      }

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
        operatorAccountID: operator,
      };

      // Store state before
      const currentBlockIdx = (await this.exchange.getBlockHeight()).toNumber();
      const stateBefore = await this.loadExchangeStateForRingBlock(exchangeID, currentBlockIdx, ringBlock);

      // Create the block
      const [blockIdx, blockFilename] = await this.createBlock(exchangeID, 0, JSON.stringify(ringBlock, replacer, 4));

      // Store state after
      const stateAfter = await this.loadExchangeStateForRingBlock(exchangeID, currentBlockIdx + 1, ringBlock);

      // Read in the block
      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

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

          const fRingFee = toFloat(new BN(ring.fee), constants.Float12Encoding);
          da.addNumber((ring.ringMatcherAccountID * (2 ** 12)) + fRingFee, 4);
          da.addNumber(ring.tokenID, 1);

          da.addNumber((orderA.orderID * (2 ** constants.NUM_BITS_ORDERID)) + orderB.orderID, 5);
          da.addNumber((orderA.accountID * (2 ** constants.NUM_BITS_ACCOUNTID)) + orderB.accountID, 5);

          da.addNumber(orderA.tokenS, 1);
          da.addNumber(ring.fFillS_A, 3);
          let buyMask = orderA.buy ? 0b10000000 : 0;
          let rebateMask = orderA.rebateBips > 0 ? 0b01000000 : 0;
          da.addNumber(buyMask + rebateMask + orderA.feeBips + orderA.rebateBips, 1);

          da.addNumber(orderB.tokenS, 1);
          da.addNumber(ring.fFillS_B, 3);
          buyMask = orderB.buy ? 0b10000000 : 0;
          rebateMask = orderB.rebateBips > 0 ? 0b01000000 : 0;
          da.addNumber(buyMask + rebateMask + orderB.feeBips + orderB.rebateBips, 1);
        }
      }

      if (block.onchainDataAvailability) {
        // Apply circuit transfrom
        const transformedData = this.transformRingSettlementsData(da.getData());
        bs.addHex(transformedData);
      }

      // Validate state change
      this.validateRingSettlements(ringBlock, bs.getData(), stateBefore, stateAfter);

      // Commit the block
      await this.commitBlock(operator, BlockType.RING_SETTLEMENT, blockSize, bs.getData(), blockFilename);
    }

    this.pendingRings[exchangeID] = [];
  }

  public getRingTransformations() {
    const ranges: Range[][] = [];
    ranges.push([{offset: 0, length: 5}]);                            // ringMatcherID + fFee + tokenID
    ranges.push([{offset: 5, length: 5}]);                            // orderA.orderID + orderB.orderID
    ranges.push([{offset: 10, length: 5}]);                           // orderA.accountID + orderB.accountID
    ranges.push([{offset: 15, length: 1}, {offset: 20, length: 1}]);  // orderA.tokenS + orderB.tokenS
    ranges.push([{offset: 16, length: 3}, {offset: 21, length: 3}]);  // orderA.fillS + orderB.fillS
    ranges.push([{offset: 19, length: 1}]);                           // orderA.data
    ranges.push([{offset: 24, length: 1}]);                           // orderB.data
    return ranges;
  }

  public transformRingSettlementsData(input: string) {
    // Compress
    const bs = new Bitstream(input);
    const compressed = new Bitstream();
    const ringSize = 25;
    compressed.addHex(bs.extractData(0, ringSize));
    for (let offset = ringSize; offset < bs.length(); offset += ringSize) {
      for (let i = 0; i < 5; i++) {
        const previousRingData = bs.extractUint8(offset + i - ringSize);
        const currentRingData = bs.extractUint8(offset + i);
        const data = previousRingData ^ currentRingData;
        compressed.addNumber(data, 1);
      }
      compressed.addHex(bs.extractData(offset + 5, ringSize - 5));
    }
    // Transform
    const ranges = this.getRingTransformations();
    const transformed = new Bitstream();
    for (const subranges of ranges) {
      for (let offset = 0; offset < compressed.length(); offset += ringSize) {
        for (const subrange of subranges) {
          transformed.addHex(compressed.extractData(offset + subrange.offset, subrange.length));
        }
      }
    }
    return transformed.getData();
  }

  public replaceAt(data: string, index: number, replacement: string) {
      return data.substr(0, index) + replacement + data.substr(index + replacement.length);
  }

  public inverseTransformRingSettlementsData(input: string) {
    // Inverse Transform
    const transformed = new Bitstream(input);
    const ringSize = 25;
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
            offset + totalRangeLength * r + partialRangeLength, subrange.length,
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
    bs.addHex(compressed.extractData(0, ringSize));
    for (let r = 1; r < numRings; r++) {
      for (let i = 0; i < 5; i++) {
        const previousRingData = bs.extractUint8((r - 1) * ringSize + i);
        const delta = compressed.extractUint8(r * ringSize + i);
        const reconstructedData = previousRingData ^ delta;
        bs.addNumber(reconstructedData, 1);
      }
      bs.addHex(compressed.extractData(r * ringSize + 5, ringSize - 5));
    }
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
      const blockSize = this.getBestBlockSize(pendingCancels.length - numCancelsDone, this.depositBlockSizes);
      const cancels: Cancel[] = [];
      for (let b = numCancelsDone; b < numCancelsDone + blockSize; b++) {
        if (b < pendingCancels.length) {
          cancels.push(pendingCancels[b]);
        } else {
          const walletAccountID = this.wallets[exchangeID][0];
          const dummyCancel: Cancel = {
            accountID: this.dummyAccountId,
            orderTokenID: 0,
            orderID: 0,
            walletAccountID,
            feeTokenID: 1,
            fee: new BN(0),
            walletSplitPercentage: 0,
          };
          cancels.push(dummyCancel);
        }
      }
      assert(cancels.length === blockSize);
      numCancelsDone += blockSize;

      // Sign the order cancelations
      for (const cancel of cancels) {
        this.signCancel(cancel);
      }

      const operator = await this.getActiveOperator(exchangeID);
      const cancelBlock: CancelBlock = {
        cancels,
        onchainDataAvailability: this.onchainDataAvailability,
        operatorAccountID: operator,
      };

      // Store state before
      const currentBlockIdx = (await this.exchange.getBlockHeight()).toNumber();
      const stateBefore = await this.loadExchangeState(exchangeID, currentBlockIdx);

      // Create the block
      const [blockIdx, blockFilename] = await this.createBlock(exchangeID, 4, JSON.stringify(cancelBlock, replacer, 4));

      // Store state after
      const stateAfter = await this.loadExchangeState(exchangeID, currentBlockIdx + 1);

      // Read in the block
      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

      const bs = new Bitstream();
      bs.addNumber(block.exchangeID, 4);
      bs.addBN(new BN(block.merkleRootBefore, 10), 32);
      bs.addBN(new BN(block.merkleRootAfter, 10), 32);
      if (block.onchainDataAvailability) {
        bs.addNumber(block.operatorAccountID, 3);
        for (const cancel of cancels) {
          bs.addNumber((cancel.accountID * (2 ** constants.NUM_BITS_ACCOUNTID)) + cancel.walletAccountID, 5);
          bs.addNumber(cancel.orderTokenID, 1);
          bs.addNumber(cancel.orderID, 3);
          bs.addNumber(cancel.feeTokenID, 1);
          bs.addNumber(toFloat(cancel.fee, constants.Float16Encoding), 2);
          bs.addNumber(cancel.walletSplitPercentage, 1);
        }
      }

      // Validate state change
      this.validateOrderCancellations(cancelBlock, bs, stateBefore, stateAfter);

      // Commit the block
      await this.commitBlock(operator, BlockType.ORDER_CANCELLATION, blockSize, bs.getData(), blockFilename);
    }

    this.pendingCancels[exchangeID] = [];
  }

  public async registerTokens() {
    for (const token of this.testContext.allTokens) {
      const tokenAddress = (token === null) ? constants.zeroAddress : token.address;
      const symbol = this.testContext.tokenAddrSymbolMap.get(tokenAddress);
      // console.log(symbol + ": " + tokenAddress);

      if (symbol !== "ETH" && symbol !== "WETH" && symbol !== "LRC") {
        // Make sure the exchange owner can pay the registration fee
        const registrationCost = await this.exchange.getLRCFeeForRegisteringOneMoreToken();
        await this.setBalanceAndApprove(this.exchangeOwner, "LRC", registrationCost);
        // Register the token
        const tx = await this.exchange.registerToken(tokenAddress, {from: this.exchangeOwner});
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
      accountCreationFeeInETH: BN = new BN(web3.utils.toWei("0.0001", "ether")),
      accountUpdateFeeInETH: BN = new BN(web3.utils.toWei("0.0001", "ether")),
      depositFeeInETH: BN = new BN(web3.utils.toWei("0.0001", "ether")),
      withdrawalFeeInETH: BN = new BN(web3.utils.toWei("0.0001", "ether")),
    ) {

    const operator = this.testContext.operators[0];

    const exchangeCreationCostLRC = await this.loopringV3.exchangeCreationCostLRC();

    // Send enough tokens to the owner so the Exchange can be created
    const lrcAddress = this.testContext.tokenSymbolAddrMap.get("LRC");
    const LRC = this.testContext.tokenAddrInstanceMap.get(lrcAddress);
    await LRC.addBalance(owner, exchangeCreationCostLRC);
    await LRC.approve(this.loopringV3.address, exchangeCreationCostLRC, {from: owner});

    // Create the new exchange
    const tx = await this.loopringV3.createExchange(operator, onchainDataAvailability, {from: owner});
    // logInfo("\x1b[46m%s\x1b[0m", "[CreateExchange] Gas used: " + tx.receipt.gasUsed);

    const eventArr: any = await this.getEventsFromContract(this.loopringV3, "ExchangeCreated", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.exchangeAddress, eventObj.args.exchangeId];
    });
    const exchangeAddress = items[0][0];
    const exchangeID = items[0][1].toNumber();

    this.exchange = await this.contracts.Exchange.at(exchangeAddress);
    this.exchangeOwner = owner;
    this.exchangeOperator = operator;
    this.exchangeId = exchangeID;
    this.onchainDataAvailability = onchainDataAvailability;

    await this.exchange.setFees(
      accountCreationFeeInETH,
      accountUpdateFeeInETH,
      depositFeeInETH,
      withdrawalFeeInETH,
      {from: this.exchangeOwner},
    );

    if (bSetupTestState) {
      await this.registerTokens();
      await this.setupTestState(exchangeID);
    }

    // Deposit some LRC to stake for the exchange
    const depositer = this.testContext.operators[2];
    const stakeAmount = onchainDataAvailability ?
                        (await this.loopringV3.minExchangeStakeWithDataAvailability()) :
                        (await this.loopringV3.minExchangeStakeWithoutDataAvailability());
    await this.setBalanceAndApprove(depositer, "LRC", stakeAmount, this.loopringV3.address);

    // Stake it
    await this.loopringV3.depositExchangeStake(exchangeID, stakeAmount, {from: depositer});

    return exchangeID;
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
    const operatorContract = this.operator ? this.operator : this.exchange;
    await operatorContract.revertBlock(
      web3.utils.toBN(blockIdx),
      {from: this.exchangeOperator},
    );
    logInfo("Reverted to block " + (blockIdx - 1));
    this.pendingBlocks[this.exchangeId] = [];
  }

  public async createMerkleTreeInclusionProof(owner: string, token: string) {
    const accountID = await this.getAccountID(owner);
    const tokenID = this.getTokenIdFromNameOrAddress(token);

    const exchangeID = this.exchangeId;

    const blockIdx = (await this.exchange.getBlockHeight()).toNumber();
    const filename = "withdraw_proof.json";
    const result = childProcess.spawnSync(
      "python3",
      ["operator/create_withdraw_proof.py",
      "" + exchangeID, "" + blockIdx, "" + accountID, "" + tokenID, filename],
      {stdio: doDebugLogging() ? "inherit" : "ignore"},
    );
    assert(result.status === 0, "create_withdraw_proof failed!");

    // Read in the Merkle proof
    const data = JSON.parse(fs.readFileSync(filename, "ascii"));
    // console.log(data);
    return data.proof;
  }

  public async withdrawFromMerkleTreeWithProof(owner: string, token: string, proof: any) {
    const accountID = await this.getAccountID(owner);
    const account = this.accounts[this.exchangeId][accountID];
    const tx = await this.exchange.withdrawFromMerkleTreeFor(
      owner,
      token,
      account.publicKeyX,
      account.publicKeyY,
      web3.utils.toBN(proof.account.nonce),
      web3.utils.toBN(proof.balance.balance),
      web3.utils.toBN(proof.balance.tradingHistoryRoot),
      proof.accountProof,
      proof.balanceProof,
    );
    logInfo("\x1b[46m%s\x1b[0m", "[WithdrawFromMerkleTree] Gas used: " + tx.receipt.gasUsed);
  }

  public async withdrawFromMerkleTree(owner: string, token: string) {
    const proof = await this.createMerkleTreeInclusionProof(owner, token);
    await this.withdrawFromMerkleTreeWithProof(owner, token, proof);
  }

  public async withdrawFromDepositRequest(requestIdx: number) {
    await this.exchange.withdrawFromDepositRequest(
      web3.utils.toBN(requestIdx),
    );
  }

  public async setBalanceAndApprove(owner: string, token: string, amount: BN, contractAddress?: string) {
    if (contractAddress === undefined) {
      contractAddress = this.exchange.address;
    }
    const Token = await this.getTokenContract(token);
    if (owner !== this.testContext.deployer) {
      // Burn complete existing balance
      const existingBalance = await this.getOnchainBalance(owner, token);
      await Token.transfer(constants.zeroAddress, existingBalance, {from: owner});
    }
    await Token.transfer(owner, amount, {from: this.testContext.deployer});
    await Token.approve(contractAddress, amount, {from: owner});
  }

  public evmIncreaseTime(seconds: number) {
    return new Promise((resolve, reject) => {
      web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [seconds],
      }, (err: any, res: any) => {
        return err ? reject(err) : resolve(res);
      });
    });
  }

  public evmMine() {
    return new Promise((resolve, reject) => {
      web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_mine",
        id: Date.now(),
      }, (err: any, res: any) => {
        return err ? reject(err) : resolve(res);
      });
    });
  }

  public async advanceBlockTimestamp(seconds: number) {
    const previousTimestamp = (await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp;
    await this.evmIncreaseTime(seconds);
    await this.evmMine();
    const currentTimestamp = (await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp;
    assert(Math.abs(currentTimestamp - (previousTimestamp + seconds)) < 60,
           "Timestamp should have been increased by roughly the expected value");
  }

  public async getOffchainBalance(exchangeID: number, accountID: number, tokenID: number) {
    const state = await this.loadExchangeState(exchangeID);
    return state.accounts[accountID].balances[tokenID].balance;
  }

  public async getTokenContract(token: string) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    return (await this.contracts.DummyToken.at(token));
  }

  public async getOnchainBalance(owner: string, token: string) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    if (token === constants.zeroAddress) {
      return new BN(await web3.eth.getBalance(owner));
    } else {
      const Token = await this.contracts.DummyToken.at(token);
      return await Token.balanceOf(owner);
    }
  }

  public async checkOffchainBalance(accountID: number, tokenID: number, expectedBalance: BN, desc: string) {
    const balance = await this.getOffchainBalance(this.exchangeId, accountID, tokenID);
    assert(balance.eq(expectedBalance), desc);
  }

  public async doRandomDeposit(ownerIndex?: number) {
    // Change the deposit fee
    const fees = await this.exchange.getFees();
    await this.exchange.setFees(
      fees._accountCreationFeeETH,
      fees._accountUpdateFeeETH,
      fees._depositFeeETH.mul(new BN(2)),
      fees._withdrawalFeeETH,
      {from: this.exchangeOwner},
    );

    const orderOwners = this.testContext.orderOwners;
    ownerIndex = (ownerIndex !== undefined) ? ownerIndex : this.getRandomInt(orderOwners.length);
    const keyPair = this.getKeyPairEDDSA();
    const owner = orderOwners[Number(ownerIndex)];
    const amount = this.getRandomAmount();
    const token = this.getTokenAddress("LRC");
    return await this.deposit(this.exchangeId, owner,
                              keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                              token, amount);
  }

  public async doRandomOnchainWithdrawal(depositInfo: DepositInfo) {
    // Change the withdrawal fee
    const fees = await this.exchange.getFees();
    await this.exchange.setFees(
      fees._accountCreationFeeETH,
      fees._accountUpdateFeeETH,
      fees._depositFeeETH,
      fees._withdrawalFeeETH.mul(new BN(2)),
      {from: this.exchangeOwner},
    );

    return await this.requestWithdrawalOnchain(
      this.exchangeId,
      depositInfo.accountID,
      depositInfo.token,
      this.getRandomAmount(),
      depositInfo.owner,
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
      0,
      this.wallets[this.exchangeId][0],
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
    assert.equal(stateA.accounts.length, stateA.accounts.length, "number of accounts does not match");
    for (let accountID = 0; accountID < stateA.accounts.length; accountID++) {
      const accountA = stateA.accounts[accountID];
      const accountB = stateB.accounts[accountID];

      for (const tokenID of Object.keys(accountA.balances)) {
        const balanceValueA = accountA.balances[Number(tokenID)];
        const balanceValueB = accountB.balances[Number(tokenID)];

        for (const orderID of Object.keys(balanceValueA.tradeHistory)) {
          const tradeHistoryValueA = balanceValueA.tradeHistory[Number(orderID)];
          const tradeHistoryValueB = balanceValueA.tradeHistory[Number(orderID)];

          assert(tradeHistoryValueA.filled.eq(tradeHistoryValueB.filled), "trade history filled does not match");
          assert.equal(tradeHistoryValueA.cancelled, tradeHistoryValueB.cancelled, "cancelled does not match");
          assert.equal(tradeHistoryValueA.orderID, tradeHistoryValueB.orderID, "orderID does not match");
        }
        assert(balanceValueA.balance.eq(balanceValueB.balance), "balance does not match");
      }
      assert.equal(accountA.publicKeyX, accountB.publicKeyX, "pubKeyX does not match");
      assert.equal(accountA.publicKeyY, accountB.publicKeyY, "pubKeyY does not match");
      assert.equal(accountA.nonce, accountB.nonce, "nonce does not match");
    }
  }

  public validateRingSettlements(ringBlock: RingBlock, onchainData: string,
                                 stateBefore: ExchangeState, stateAfter: ExchangeState) {
    let bs: Bitstream;
    if (ringBlock.onchainDataAvailability) {
      // Reverse circuit transform
      const ringDataStart = 4 + 32 + 32 + 4 + 1 + 1 + 3;
      const ringData = this.inverseTransformRingSettlementsData("0x" + onchainData.slice(2 + 2 * ringDataStart));
      bs = new Bitstream(onchainData.slice(0, 2 + 2 * ringDataStart) + ringData.slice(2));
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
        ring, latestState, timestamp, operatorAccountID,
        ringBlock.protocolTakerFeeBips, ringBlock.protocolMakerFeeBips,
      );

      if (ringBlock.onchainDataAvailability) {
        // Verify onchain data can be used to update the Merkle tree correctly
        const reconstructedState = simulator.settleRingFromOnchainData(bs, ringIndex, latestState);
        this.compareStates(simulatorReport.exchangeStateAfter, reconstructedState);
      }

      for (const detailedTransfer of simulatorReport.detailedTransfers) {
        this.logDetailedTokenTransfer(detailedTransfer, addressBook);
      }
      this.logFilledAmountsRing(ring, latestState, simulatorReport.exchangeStateAfter);
      latestState = simulatorReport.exchangeStateAfter;
    }

    // Verify resulting state
    this.compareStates(stateAfter, latestState);
    logInfo("----------------------------------------------------");
  }

  public validateDeposits(deposits: Deposit[], stateBefore: ExchangeState, stateAfter: ExchangeState) {
    logInfo("----------------------------------------------------");
    let latestState = stateBefore;
    for (const deposit of deposits) {
      const simulator = new Simulator();
      const simulatorReport = simulator.deposit(deposit, latestState);

      let accountBefore = latestState.accounts[deposit.accountID];
      const accountAfter = simulatorReport.exchangeStateAfter.accounts[deposit.accountID];

      let bNewAccount = false;
      if (accountBefore === undefined) {
        const balances: {[key: number]: Balance} = {};
        for (let i = 0; i < this.MAX_NUM_TOKENS; i++) {
          balances[i] = {
            balance: new BN(0),
            tradeHistory: {},
          };
        }
        const emptyAccount: AccountLeaf = {
          publicKeyX: "0",
          publicKeyY: "0",
          nonce: 0,
          balances,
        };
        accountBefore = emptyAccount;
        bNewAccount = true;
      }

      logInfo("> Account " + deposit.accountID + (bNewAccount ? " (NEW ACCOUNT)" : ""));
      if (accountBefore.publicKeyX !== accountAfter.publicKeyX) {
        logInfo("publicKeyX: " + accountBefore.publicKeyX + " -> " + accountAfter.publicKeyX);
      }
      if (accountBefore.publicKeyY !== accountAfter.publicKeyY) {
        logInfo("publicKeyY: " + accountBefore.publicKeyY + " -> " + accountAfter.publicKeyY);
      }
      if (accountBefore.nonce !== accountAfter.nonce) {
        logInfo("nonce: " + accountBefore.nonce + " -> " + accountAfter.nonce);
      }
      for (let i = 0; i < this.MAX_NUM_TOKENS; i++) {
        if (!accountBefore.balances[i].balance.eq(accountAfter.balances[i].balance)) {
          this.prettyPrintBalanceChange(deposit.accountID, i, accountBefore.balances[i].balance,
                                                              accountAfter.balances[i].balance);
        }
      }

      latestState = simulatorReport.exchangeStateAfter;
    }

    // Verify resulting state
    this.compareStates(stateAfter, latestState);
    logInfo("----------------------------------------------------");
  }

  public validateOnchainWithdrawals(withdrawBlock: WithdrawBlock,
                                    stateBefore: ExchangeState, stateAfter: ExchangeState) {
    logInfo("----------------------------------------------------");
    let latestState = stateBefore;
    const shutdown = withdrawBlock.count === 0;
    for (const withdrawal of withdrawBlock.withdrawals) {
      const simulator = new Simulator();
      const simulatorReport = simulator.onchainWithdraw(withdrawal, shutdown, latestState);

      const accountBefore = latestState.accounts[withdrawal.accountID];
      const accountAfter = simulatorReport.exchangeStateAfter.accounts[withdrawal.accountID];

      if (withdrawal.tokenID > 0 && withdrawal.accountID < latestState.accounts.length) {
        this.prettyPrintBalanceChange(
          withdrawal.accountID, withdrawal.tokenID,
          accountBefore.balances[withdrawal.tokenID].balance,
          accountAfter.balances[withdrawal.tokenID].balance,
        );
      }

      latestState = simulatorReport.exchangeStateAfter;
    }

    // Verify resulting state
    this.compareStates(stateAfter, latestState);
    logInfo("----------------------------------------------------");
  }

  public validateOffchainWithdrawals(withdrawBlock: WithdrawBlock, bs: Bitstream,
                                     stateBefore: ExchangeState, stateAfter: ExchangeState) {
    logInfo("----------------------------------------------------");
    const operatorAccountID = withdrawBlock.operatorAccountID;
    let latestState = stateBefore;
    for (const [withdrawalIndex, withdrawal] of withdrawBlock.withdrawals.entries()) {
      const simulator = new Simulator();
      const simulatorReport = simulator.offchainWithdrawFromInputData(withdrawal, latestState, operatorAccountID);

      if (withdrawBlock.onchainDataAvailability) {
        // Verify onchain data can be used to update the Merkle tree correctly
        const reconstructedState = simulator.offchainWithdrawFromOnchainData(
          bs, withdrawBlock.withdrawals.length, withdrawalIndex, latestState,
        );
        this.compareStates(simulatorReport.exchangeStateAfter, reconstructedState);
      }

      const accountBefore = latestState.accounts[withdrawal.accountID];
      const accountAfter = simulatorReport.exchangeStateAfter.accounts[withdrawal.accountID];

      if (withdrawal.tokenID > 0) {
        this.prettyPrintBalanceChange(
          withdrawal.accountID, withdrawal.tokenID,
          accountBefore.balances[withdrawal.tokenID].balance,
          accountAfter.balances[withdrawal.tokenID].balance,
        );
      }

      latestState = simulatorReport.exchangeStateAfter;
    }

    // Verify resulting state
    this.compareStates(stateAfter, latestState);
    logInfo("----------------------------------------------------");
  }

  public validateOrderCancellations(cancelBlock: CancelBlock, bs: Bitstream,
                                    stateBefore: ExchangeState, stateAfter: ExchangeState) {
    logInfo("----------------------------------------------------");
    const operatorAccountID = cancelBlock.operatorAccountID;
    let latestState = stateBefore;
    for (const [cancelIndex, cancel] of cancelBlock.cancels.entries()) {
      const simulator = new Simulator();
      const simulatorReport = simulator.cancelOrderFromInputData(cancel, latestState, operatorAccountID);

      if (cancelBlock.onchainDataAvailability) {
        // Verify onchain data can be used to update the Merkle tree correctly
        const reconstructedState = simulator.cancelOrderFromOnchainData(
          bs, cancelIndex, latestState,
        );
        this.compareStates(simulatorReport.exchangeStateAfter, reconstructedState);
      }

      // const accountBefore = latestState.accounts[cancel.accountID];
      // const accountAfter = simulatorReport.exchangeStateAfter.accounts[cancel.accountID];

      latestState = simulatorReport.exchangeStateAfter;
    }

    // Verify resulting state
    this.compareStates(stateAfter, latestState);
    logInfo("----------------------------------------------------");
  }

  public async loadExchangeStateForRingBlock(exchangeID: number, blockIdx: number, ringBlock: RingBlock) {
    const state = await this.loadExchangeState(exchangeID, blockIdx);
    const orders: OrderInfo[] = [];
    for (const ring of ringBlock.rings) {
      orders.push(ring.orderA);
      orders.push(ring.orderB);
    }
    for (const order of orders) {
      // Make sure the trading history for the orders exists
      const tradeHistorySlot = order.orderID % (2 ** constants.TREE_DEPTH_TRADING_HISTORY);
      if (!state.accounts[order.accountID].balances[order.tokenIdS].tradeHistory[tradeHistorySlot]) {
        state.accounts[order.accountID].balances[order.tokenIdS].tradeHistory[tradeHistorySlot] = {
          filled: new BN(0),
          cancelled: false,
          orderID: 0,
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
    const tokenAddress = this.tokenIDToAddressMap.get(tokenID);
    const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(tokenAddress);
    const decimals = this.testContext.tokenAddrDecimalsMap.get(tokenAddress);
    const prettyBalance = balance.div(web3.utils.toBN(10 ** decimals)).toString(10);
    logInfo(accountID + ": " + prettyBalance + " " + tokenSymbol);
  }

  public prettyPrintBalanceChange(accountID: number, tokenID: number, balanceBefore: BN, balanceAfter: BN) {
    const tokenAddress = this.tokenIDToAddressMap.get(tokenID);
    const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(tokenAddress);
    const decimals = this.testContext.tokenAddrDecimalsMap.get(tokenAddress);
    const prettyBalanceBefore = balanceBefore.div(web3.utils.toBN(10 ** decimals)).toString(10);
    const prettyBalanceAfter = balanceAfter.div(web3.utils.toBN(10 ** decimals)).toString(10);
    logInfo(accountID + ": " +
            prettyBalanceBefore + " " + tokenSymbol + " -> " +
            prettyBalanceAfter + " " + tokenSymbol);
  }

  public async depositExchangeStakeChecked(amount: BN, owner: string) {
    const token = "LRC";
    const balanceOwnerBefore = await this.getOnchainBalance(owner, token);
    const balanceContractBefore = await this.getOnchainBalance(this.loopringV3.address, token);
    const stakeBefore = await this.exchange.getExchangeStake();
    const totalStakeBefore = await this.loopringV3.totalStake();

    await this.loopringV3.depositExchangeStake(this.exchangeId, amount, {from: owner});

    const balanceOwnerAfter = await this.getOnchainBalance(owner, token);
    const balanceContractAfter = await this.getOnchainBalance(this.loopringV3.address, token);
    const stakeAfter = await this.exchange.getExchangeStake();
    const totalStakeAfter = await this.loopringV3.totalStake();

    assert(balanceOwnerBefore.eq(balanceOwnerAfter.add(amount)),
           "Token balance of owner should be decreased by amount");
    assert(balanceContractAfter.eq(balanceContractBefore.add(amount)),
           "Token balance of contract should be increased by amount");
    assert(stakeAfter.eq(stakeBefore.add(amount)),
           "Stake should be increased by amount");
    assert(totalStakeAfter.eq(totalStakeBefore.add(amount)),
           "Total stake should be increased by amount");

    // Get the ExchangeStakeDeposited event
    const eventArr: any = await this.getEventsFromContract(
      this.loopringV3, "ExchangeStakeDeposited", web3.eth.blockNumber,
    );
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.exchangeId, eventObj.args.amount];
    });
    assert.equal(items.length, 1, "A single ExchangeStakeDeposited event should have been emitted");
    assert.equal(items[0][0].toNumber(), this.exchangeId, "exchangeId should match");
    assert(items[0][1].eq(amount), "amount should match");
  }

  public async withdrawExchangeStakeChecked(recipient: string, amount: BN) {
    const token = "LRC";
    const balanceOwnerBefore = await this.getOnchainBalance(recipient, token);
    const balanceContractBefore = await this.getOnchainBalance(this.loopringV3.address, token);
    const stakeBefore = await this.exchange.getExchangeStake();
    const totalStakeBefore = await this.loopringV3.totalStake();

    await this.exchange.withdrawExchangeStake(recipient, {from: this.exchangeOwner});

    const balanceOwnerAfter = await this.getOnchainBalance(recipient, token);
    const balanceContractAfter = await this.getOnchainBalance(this.loopringV3.address, token);
    const stakeAfter = await this.exchange.getExchangeStake();
    const totalStakeAfter = await this.loopringV3.totalStake();

    assert(balanceOwnerAfter.eq(balanceOwnerBefore.add(amount)),
           "Token balance of owner should be increased by amount");
    assert(balanceContractBefore.eq(balanceContractAfter.add(amount)),
           "Token balance of contract should be decreased by amount");
    assert(stakeBefore.eq(stakeAfter.add(amount)),
           "Stake should be decreased by amount");
    assert(totalStakeAfter.eq(totalStakeBefore.sub(amount)),
           "Total stake should be decreased by amount");

    // Get the ExchangeStakeWithdrawn event
    const eventArr: any = await this.getEventsFromContract(
      this.loopringV3, "ExchangeStakeWithdrawn", web3.eth.blockNumber,
    );
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.exchangeId, eventObj.args.amount];
    });
    assert.equal(items.length, 1, "A single ExchangeStakeWithdrawn event should have been emitted");
    assert.equal(items[0][0].toNumber(), this.exchangeId, "exchangeId should match");
    assert(items[0][1].eq(amount), "amount should match");
  }

  public async depositProtocolFeeStakeChecked(amount: BN, owner: string) {
    const token = "LRC";
    const balanceOwnerBefore = await this.getOnchainBalance(owner, token);
    const balanceContractBefore = await this.getOnchainBalance(this.loopringV3.address, token);
    const stakeBefore = await this.loopringV3.getProtocolFeeStake(this.exchangeId);
    const totalStakeBefore = await this.loopringV3.totalStake();

    await this.loopringV3.depositProtocolFeeStake(this.exchangeId, amount, {from: owner});

    const balanceOwnerAfter = await this.getOnchainBalance(owner, token);
    const balanceContractAfter = await this.getOnchainBalance(this.loopringV3.address, token);
    const stakeAfter = await this.loopringV3.getProtocolFeeStake(this.exchangeId);
    const totalStakeAfter = await this.loopringV3.totalStake();

    assert(balanceOwnerBefore.eq(balanceOwnerAfter.add(amount)),
           "Token balance of owner should be decreased by amount");
    assert(balanceContractAfter.eq(balanceContractBefore.add(amount)),
           "Token balance of contract should be increased by amount");
    assert(stakeAfter.eq(stakeBefore.add(amount)),
           "Stake should be increased by amount");
    assert(totalStakeAfter.eq(totalStakeBefore.add(amount)),
           "Total stake should be increased by amount");

    // Get the ProtocolFeeStakeDeposited event
    const eventArr: any = await this.getEventsFromContract(
      this.loopringV3, "ProtocolFeeStakeDeposited", web3.eth.blockNumber,
    );
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.exchangeId, eventObj.args.amount];
    });
    assert.equal(items.length, 1, "A single ProtocolFeeStakeDeposited event should have been emitted");
    assert.equal(items[0][0].toNumber(), this.exchangeId, "exchangeId should match");
    assert(items[0][1].eq(amount), "amount should match");
  }

  public async withdrawProtocolFeeStakeChecked(recipient: string, amount: BN) {
    const token = "LRC";
    const balanceOwnerBefore = await this.getOnchainBalance(recipient, token);
    const balanceContractBefore = await this.getOnchainBalance(this.loopringV3.address, token);
    const stakeBefore = await this.loopringV3.getProtocolFeeStake(this.exchangeId);
    const totalStakeBefore = await this.loopringV3.totalStake();

    await this.exchange.withdrawProtocolFeeStake(recipient, amount, {from: this.exchangeOwner});

    const balanceOwnerAfter = await this.getOnchainBalance(recipient, token);
    const balanceContractAfter = await this.getOnchainBalance(this.loopringV3.address, token);
    const stakeAfter = await this.loopringV3.getProtocolFeeStake(this.exchangeId);
    const totalStakeAfter = await this.loopringV3.totalStake();

    assert(balanceOwnerAfter.eq(balanceOwnerBefore.add(amount)),
           "Token balance of owner should be increased by amount");
    assert(balanceContractBefore.eq(balanceContractAfter.add(amount)),
           "Token balance of contract should be decreased by amount");
    assert(stakeBefore.eq(stakeAfter.add(amount)),
           "Stake should be decreased by amount");
    assert(totalStakeAfter.eq(totalStakeBefore.sub(amount)),
           "Total stake should be decreased by amount");

    // Get the ProtocolFeeStakeWithdrawn event
    const eventArr: any = await this.getEventsFromContract(
      this.loopringV3, "ProtocolFeeStakeWithdrawn", web3.eth.blockNumber,
    );
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.exchangeId, eventObj.args.amount];
    });
    assert.equal(items.length, 1, "A single ProtocolFeeStakeWithdrawn event should have been emitted");
    assert.equal(items[0][0].toNumber(), this.exchangeId, "exchangeId should match");
    assert(items[0][1].eq(amount), "amount should match");
  }

  private getPrivateKey(address: string) {
    const textData = fs.readFileSync("./ganache_account_keys.txt", "ascii");
    const data = JSON.parse(textData);
    return data.private_keys[address.toLowerCase()];
  }

  // private functions:
  private async createContractContext() {
    const [loopringV3, exchangeDeployer, blockVerifier, lrcToken, wethToken] = await Promise.all([
        this.contracts.LoopringV3.deployed(),
        this.contracts.ExchangeDeployer.deployed(),
        this.contracts.BlockVerifier.deployed(),
        this.contracts.LRCToken.deployed(),
        this.contracts.WETHToken.deployed(),
      ]);

    this.lzDecompressor = await this.contracts.LzDecompressor.new();

    this.loopringV3 = loopringV3;
    this.exchangeDeployer = exchangeDeployer;
    this.blockVerifier = blockVerifier;

    this.lrcAddress = lrcToken.address;
    this.wethAddress = wethToken.address;

    const currBlockNumber = await web3.eth.getBlockNumber();
    const currBlockTimestamp = (await web3.eth.getBlock(currBlockNumber)).timestamp;
    return new Context(currBlockNumber,
                       currBlockTimestamp,
                       lrcToken.address);
  }

  private async createExchangeTestContext(accounts: string[]) {
    const tokenSymbolAddrMap = new Map<string, string>();
    const tokenAddrSymbolMap = new Map<string, string>();
    const tokenAddrDecimalsMap = new Map<string, number>();
    const tokenAddrInstanceMap = new Map<string, any>();

    const [eth, weth, lrc, gto, rdn, rep, inda, indb, test] = await Promise.all([
      null,
      this.contracts.WETHToken.deployed(),
      this.contracts.LRCToken.deployed(),
      this.contracts.GTOToken.deployed(),
      this.contracts.RDNToken.deployed(),
      this.contracts.REPToken.deployed(),
      this.contracts.INDAToken.deployed(),
      this.contracts.INDBToken.deployed(),
      this.contracts.TESTToken.deployed(),
    ]);

    const allTokens = [eth, weth, lrc, gto, rdn, rep, inda, indb, test];

    tokenSymbolAddrMap.set("ETH", constants.zeroAddress);
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
        tokenAddrDecimalsMap.set(constants.zeroAddress, 18);
      } else {
        tokenAddrDecimalsMap.set(token.address, (await token.decimals()));
      }
    }

    tokenAddrSymbolMap.set(constants.zeroAddress, "ETH");
    tokenAddrSymbolMap.set(this.contracts.WETHToken.address, "WETH");
    tokenAddrSymbolMap.set(this.contracts.LRCToken.address, "LRC");
    tokenAddrSymbolMap.set(this.contracts.GTOToken.address, "GTO");
    tokenAddrSymbolMap.set(this.contracts.RDNToken.address, "RDN");
    tokenAddrSymbolMap.set(this.contracts.REPToken.address, "REP");
    tokenAddrSymbolMap.set(this.contracts.INDAToken.address, "INDA");
    tokenAddrSymbolMap.set(this.contracts.INDBToken.address, "INDB");
    tokenAddrSymbolMap.set(this.contracts.TESTToken.address, "TEST");

    tokenAddrInstanceMap.set(constants.zeroAddress, null);
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

    return new ExchangeTestContext(deployer,
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
                                   allTokens);
  }

  private logDetailedTokenTransfer(payment: DetailedTokenTransfer,
                                   addressBook: { [id: number]: string; } = {},
                                   depth: number = 0) {
    if (payment.amount.eq(new BN(0)) && payment.subPayments.length === 0) {
      return;
    }
    const whiteSpace = " ".repeat(depth);
    const description = payment.description ? payment.description : "";
    const prettyAmount = this.getPrettyAmount(payment.token, payment.amount);
    if (payment.subPayments.length === 0) {
      const toName = addressBook[payment.to] !== undefined ? addressBook[payment.to] : payment.to;
      logInfo(whiteSpace + "- " + " [" + description + "] " + prettyAmount + " -> " + toName);
    } else {
      logInfo(whiteSpace + "+ " + " [" + description + "] " + prettyAmount);
      for (const subPayment of payment.subPayments) {
        this.logDetailedTokenTransfer(subPayment, addressBook, depth + 1);
      }
    }
  }

  private getPrettyAmount(tokenID: number, amount: BN) {
    const tokenAddress = this.tokenIDToAddressMap.get(tokenID);
    const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(tokenAddress);
    const decimals = this.testContext.tokenAddrDecimalsMap.get(tokenAddress);
    const amountDec = Number(amount.toString(10)) / (10 ** decimals);
    return amountDec + " " + tokenSymbol;
  }

  private getPrettyCancelled(cancelled: boolean) {
    return cancelled ? "Cancelled" : "NotCancelled";
  }

  private logFilledAmountsRing(ring: RingInfo, stateBefore: ExchangeState, stateAfter: ExchangeState) {
    this.logFilledAmountOrder(
      "[Filled] OrderA",
      stateBefore.accounts[ring.orderA.accountID],
      stateAfter.accounts[ring.orderA.accountID],
      ring.orderA,
    );
    this.logFilledAmountOrder(
      "[Filled] OrderB",
      stateBefore.accounts[ring.orderB.accountID],
      stateAfter.accounts[ring.orderB.accountID],
      ring.orderB,
    );
  }

  private logFilledAmountOrder(description: string,
                               accountBefore: AccountLeaf, accountAfter: AccountLeaf,
                               order: OrderInfo) {
    const tradeHistorySlot = order.orderID % (2 ** constants.TREE_DEPTH_TRADING_HISTORY);
    const before = accountBefore.balances[order.tokenIdS].tradeHistory[tradeHistorySlot];
    const after = accountAfter.balances[order.tokenIdS].tradeHistory[tradeHistorySlot];
    const filledBeforePercentage = before.filled.mul(new BN(100)).div(order.buy ? order.amountB : order.amountS);
    const filledAfterPercentage = after.filled.mul(new BN(100)).div(order.buy ? order.amountB : order.amountS);
    const filledBeforePretty = this.getPrettyAmount(order.buy ? order.tokenIdB : order.tokenIdS, before.filled);
    const filledAfterPretty = this.getPrettyAmount(order.buy ? order.tokenIdB : order.tokenIdS, after.filled);
    logInfo(
      description + ": " + filledBeforePretty + " -> " + filledAfterPretty +
      " (" + filledBeforePercentage.toString(10) + "% -> " + filledAfterPercentage.toString(10) + "%)" +
      " (" + this.getPrettyCancelled(before.cancelled) + " -> " + this.getPrettyCancelled(after.cancelled) + ")",
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
