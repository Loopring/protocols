import BN = require("bn.js");
import childProcess = require("child_process");
import ethUtil = require("ethereumjs-util");
import fs = require("fs");
import path = require("path");
import * as pjs from "protocol2-js";
import { SHA256 } from "sha2";
import util = require("util");
import { Artifacts } from "../util/Artifacts";
import { Context } from "./context";
import { Simulator } from "./simulator";
import { ExchangeTestContext } from "./testExchangeContext";
import { Account, Balance, Block, BlockType, Cancel, CancelBlock,
         Deposit, DepositBlock, DepositInfo, DetailedTokenTransfer,
         Operator, OrderInfo, Realm, RingBlock, RingInfo, TradeHistory, Wallet, Withdrawal,
         WithdrawalRequest, WithdrawBlock } from "./types";

// JSON replacer function for BN values
function replacer(name: any, val: any) {
  if (name === "balance" || name === "amountS" || name === "amountB" || name === "amountF" ||
      name === "amount" || name === "fee" || name === "startHash") {
    return new BN(val, 16).toString(10);
  } else {
    return val;
  }
}

export class ExchangeTestUtil {
  public context: Context;
  public testContext: ExchangeTestContext;

  public TREE_DEPTH_TRADING_HISTORY = 14;

  public ringSettlementBlockSizes = [1, 2];
  public depositBlockSizes = [4, 8];
  public onchainWithdrawalBlockSizes = [4, 8];
  public offchainWithdrawalBlockSizes = [4, 8];
  public orderCancellationBlockSizes = [4, 8];

  public loopringV3: any;
  public exchangeDeployer: any;
  public blockVerifier: any;

  public lrcAddress: string;
  public wethAddress: string;

  public exchange: any;
  public exchangeOwner: string;
  public exchangeOperator: string;
  public exchangeId: number;

  public minerAccountID: number[] = [];
  public feeRecipientAccountID: number[] = [];

  public operators: Operator[] = [];
  public wallets: Wallet[][] = [];

  public GENESIS_MERKLE_ROOT: BN = new BN("06ea7e01611a784ff676387ee0a6f58933eb184d8a2ff765608488e7e8da76d3", 16);

  public MAX_PROOF_GENERATION_TIME_IN_SECONDS: number;
  public MAX_AGE_REQUEST_UNTIL_FORCED: number;
  public MAX_AGE_REQUEST_UNTIL_WITHDRAW_MODE: number;
  public MAX_AGE_UNFINALIZED_BLOCK_UNTIL_WITHDRAW_MODE: number;
  public STAKE_AMOUNT_IN_LRC: BN;
  public MIN_TIME_UNTIL_OPERATOR_CAN_WITHDRAW: number;
  public MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS: number;
  public MAX_TIME_IN_SHUTDOWN_BASE: number;
  public MAX_TIME_IN_SHUTDOWN_DELTA: number;
  public FEE_BLOCK_FINE_START_TIME: number;
  public FEE_BLOCK_FINE_MAX_DURATION: number;
  public TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS: number;
  public MAX_NUM_TOKENS: number;

  public BURNRATE_TIER1: BN;
  public BURNRATE_TIER2: BN;
  public BURNRATE_TIER3: BN;
  public BURNRATE_TIER4: BN;

  public TIER_UPGRADE_DURATION: number;

  public dummyAccountId: number;
  public dummyAccountKeyPair: any;

  public tokenAddressToIDMap = new Map<string, number>();
  public tokenIDToAddressMap = new Map<number, string>();

  public zeroAddress = "0x" + "00".repeat(20);

  public contracts = new Artifacts(artifacts);

  public pendingBlocks: Block[][] = [];

  private pendingRings: RingInfo[][] = [];
  private pendingDeposits: Deposit[][] = [];
  private pendingOffchainWithdrawalRequests: WithdrawalRequest[][] = [];
  private pendingOnchainWithdrawalRequests: WithdrawalRequest[][] = [];
  private pendingCancels: Cancel[][] = [];

  private pendingWithdrawals: Withdrawal[] = [];

  private orderIDGenerator: number = 0;

  private dualAuthKeyPair: any;

  private onchainDataAvailability = true;

  private MAX_NUM_EXCHANGES: number = 128;

  public async initialize(accounts: string[]) {
    this.context = await this.createContractContext();
    this.testContext = await this.createExchangeTestContext(accounts);

    this.dualAuthKeyPair = this.getKeyPairEDDSA();

    // Initialize Loopring
    await this.loopringV3.updateSettings(
      this.blockVerifier.address,
      new BN(web3.utils.toWei("1000", "ether")),
      new BN(1),
      new BN(web3.utils.toWei("0.02", "ether")),
      new BN(web3.utils.toWei("10000", "ether")),
      new BN(web3.utils.toWei("2", "ether")),
      new BN(web3.utils.toWei("2000", "ether")),
      new BN(web3.utils.toWei("1000", "ether")),
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

      const wallets: Wallet[] = [];
      this.wallets.push(wallets);

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
    this.STAKE_AMOUNT_IN_LRC = new BN(0);
    this.MIN_TIME_UNTIL_OPERATOR_CAN_WITHDRAW = 0;

    this.BURNRATE_TIER1 = await this.loopringV3.BURNRATE_TIER1();
    this.BURNRATE_TIER2 = await this.loopringV3.BURNRATE_TIER2();
    this.BURNRATE_TIER3 = await this.loopringV3.BURNRATE_TIER3();
    this.BURNRATE_TIER4 = await this.loopringV3.BURNRATE_TIER4();

    this.TIER_UPGRADE_DURATION = (await this.loopringV3.TIER_UPGRADE_DURATION()).toNumber();
  }

  public async setupTestState(realmID: number) {

    const keyPair = this.getKeyPairEDDSA();
    const depositInfo = await this.deposit(realmID, this.testContext.deployer,
                                           keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                           this.zeroAddress, new BN(1));
    this.dummyAccountId = depositInfo.accountID;
    this.dummyAccountKeyPair = keyPair;

    this.operators[realmID] = await this.createOperator(realmID, this.testContext.operators[0]);

    [this.minerAccountID[realmID], this.feeRecipientAccountID[realmID]] = await this.createRingMatcher(
      realmID,
      this.testContext.ringMatchers[0],
      this.testContext.feeRecipients[0],
    );

    for (const walletAddress of this.testContext.wallets) {
      const wallet = await this.createWallet(realmID, walletAddress);
      this.wallets[realmID].push(wallet);
    }
  }

  public async createOperator(realmID: number, owner: string) {
    // Make an account for the operator
    const keyPair = this.getKeyPairEDDSA();
    const depositInfo = await this.deposit(realmID, owner,
                                           keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                           this.zeroAddress, new BN(1));
    const operator: Operator = {
      owner,
      accountID: depositInfo.accountID,
    };
    return operator;
  }

  public async createWallet(realmID: number, owner: string) {
    // Make a dual author account for the wallet
    const walletDeposit = await this.deposit(realmID, owner,
                                             "1", "1", "1",
                                             this.zeroAddress, new BN(0));
    const wallet: Wallet = {
      owner,
      walletAccountID: walletDeposit.accountID,
    };
    return wallet;
  }

  public async createRingMatcher(realmID: number, owner: string, feeRecipient: string) {
    const lrcAddress = this.testContext.tokenSymbolAddrMap.get("LRC");
    const LRC = this.testContext.tokenAddrInstanceMap.get(lrcAddress);

    const balance = new BN(web3.utils.toWei("1000000", "ether"));

    // Make an account for the ringmatcher
    const keyPairM = this.getKeyPairEDDSA();
    await LRC.addBalance(owner, balance);
    const minerDeposit = await this.deposit(realmID, owner,
                                            keyPairM.secretKey, keyPairM.publicKeyX, keyPairM.publicKeyY,
                                            lrcAddress, balance);

    // Make an account to receive fees
    const feeRecipientDeposit = await this.deposit(realmID, feeRecipient,
                                                   "1", "1", "1",
                                                   this.zeroAddress, new BN(0));

    return [minerDeposit.accountID, feeRecipientDeposit.accountID];
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
      pjs.logDebug("event:", util.inspect(e.args, false, null));
    });
  }

  public async setupRing(ring: RingInfo, bSetupOrderA: boolean = true, bSetupOrderB: boolean = true) {
    ring.minerAccountID = this.minerAccountID[ring.orderA.realmID];
    ring.feeRecipientAccountID = this.feeRecipientAccountID[ring.orderA.realmID];
    ring.tokenID = ring.tokenID ? ring.tokenID : (await this.getTokenIdFromNameOrAddress("LRC"));
    ring.fee = ring.fee ? ring.fee : new BN(web3.utils.toWei("1", "ether"));
    if (bSetupOrderA) {
      await this.setupOrder(ring.orderA, this.orderIDGenerator++);
    }
    if (bSetupOrderB) {
      await this.setupOrder(ring.orderB, this.orderIDGenerator++);
    }
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
    if (order.tokenF && !order.tokenF.startsWith("0x")) {
      order.tokenF = this.testContext.tokenSymbolAddrMap.get(order.tokenF);
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

    // Fill in defaults
    order.tokenF = order.tokenF ? order.tokenF : this.context.lrcAddress;
    order.amountF = order.amountF ? order.amountF : new BN(web3.utils.toWei("1.5", "ether"));

    order.allOrNone = order.allOrNone ? order.allOrNone : false;
    order.walletSplitPercentage = (order.walletSplitPercentage !== undefined) ? order.walletSplitPercentage : 50;

    order.waiveFeePercentage = (order.waiveFeePercentage !== undefined) ? order.waiveFeePercentage : 50;

    const walletIndex = index % this.testContext.wallets.length;
    order.walletAccountID = (order.walletAccountID !== undefined) ?
                              order.walletAccountID : this.wallets[order.realmID][walletIndex].walletAccountID;

    order.orderID = (order.orderID !== undefined) ? order.orderID : index;

    order.realmID = (order.realmID !== undefined) ? order.realmID : 0;

    order.tokenIdS = this.tokenAddressToIDMap.get(order.tokenS);
    order.tokenIdB = this.tokenAddressToIDMap.get(order.tokenB);
    order.tokenIdF = this.tokenAddressToIDMap.get(order.tokenF);

    // setup initial balances:
    await this.setOrderBalances(order);
  }

  public async setOrderBalances(order: OrderInfo) {
    const keyPair = this.getKeyPairEDDSA();

    const accountID = await this.getAccountID(order.owner);

    const balanceS = (order.balanceS !== undefined) ? order.balanceS : order.amountS;
    const depositInfo = await this.deposit(order.realmID, order.owner,
                                           keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                           order.tokenS, balanceS, accountID);
    order.accountID = depositInfo.accountID;

    const balanceF = (order.balanceF !== undefined) ? order.balanceF : order.amountF;
    if (balanceF.gt(new BN(0))) {
      await this.deposit(order.realmID, order.owner,
                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                         order.tokenF, balanceF, order.accountID);
    }

    const balanceB = (order.balanceB !== undefined) ? order.balanceB : new BN(0);
    if (balanceB.gt(new BN(0))) {
      await this.deposit(order.realmID, order.owner,
                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                         order.tokenB, balanceB, order.accountID);
    }
  }

  public getAddressBook(ring: RingInfo, index?: number, addressBook: { [id: number]: string; } = {}) {
    const addAccount = (addrBook: { [id: string]: any; }, accountID: number, name: string) => {
      addrBook[accountID] = (addrBook[accountID] ? addrBook[accountID] + "=" : "") + name;
    };
    const bIndex = index !== undefined;
    addAccount(addressBook, ring.orderA.accountID, "OwnerA" + (bIndex ? "[" + index + "]" : ""));
    addAccount(addressBook, ring.orderA.walletAccountID, "WalletA" + (bIndex ? "[" + index + "]" : ""));
    addAccount(addressBook, ring.orderB.accountID, "OwnerB" + (bIndex ? "[" + index + "]" : ""));
    addAccount(addressBook, ring.orderB.walletAccountID, "WalletB" + (bIndex ? "[" + index + "]" : ""));
    addAccount(addressBook, ring.minerAccountID, "RingMatcher" + (bIndex ? "[" + index + "]" : ""));
    addAccount(addressBook, ring.feeRecipientAccountID, "FeeRecipient" + (bIndex ? "[" + index + "]" : ""));
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
    childProcess.spawnSync("python3", ["util/generate_EDDSA_keypair.py"], {stdio: "inherit"});
    const jKeyPair = fs.readFileSync("EDDSA_KeyPair.json", "ascii");
    const keyPair = JSON.parse(jKeyPair);
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

  public async deposit(realmID: number, owner: string, secretKey: string, publicKeyX: string, publicKeyY: string,
                       token: string, amount: BN, accountID?: number) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }

    let numAvailableSlots = (await this.exchange.getNumAvailableDepositSlots()).toNumber();
    if (numAvailableSlots === 0) {
      await this.commitDeposits(realmID);
      numAvailableSlots = (await this.exchange.getNumAvailableDepositSlots()).toNumber();
      assert(numAvailableSlots > 0, "numAvailableSlots > 0");
    }

    const fees = await this.exchange.getFees();
    let ethToSend = fees._depositFeeETH.add(fees._accountCreationFeeETH);
    if (amount.gt(0)) {
      if (token !== this.zeroAddress) {
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
    if (accountID !== undefined) {
      const tx = await this.exchange.updateAccountAndDeposit(
        new BN(publicKeyX),
        new BN(publicKeyY),
        token,
        web3.utils.toBN(amount),
        {from: owner, value: ethToSend},
      );
      // pjs.logInfo("\x1b[46m%s\x1b[0m", "[Deposit] Gas used: " + tx.receipt.gasUsed);
    } else {
      if (publicKeyX === "1" && publicKeyY === "1") {
        const tx = await this.exchange.createFeeRecipientAccount({from: owner, value: ethToSend});
        assert(amount.isZero(), "Cannot deposit to fee recipient");
      } else {
        const tx = await this.exchange.updateAccountAndDeposit(
          new BN(publicKeyX),
          new BN(publicKeyY),
          token,
          web3.utils.toBN(amount),
          {from: owner, value: ethToSend},
        );
        // pjs.logInfo("\x1b[46m%s\x1b[0m", "[DepositAndCreate] Gas used: " + tx.receipt.gasUsed);
      }
    }

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

    this.addDeposit(this.pendingDeposits[realmID], depositInfo.depositIdx, depositInfo.accountID,
                    secretKey, publicKeyX, publicKeyY,
                    this.tokenAddressToIDMap.get(token), amount);
    return depositInfo;
  }

  public async requestWithdrawalOffchain(realmID: number, accountID: number, token: string, amount: BN,
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
    this.addWithdrawalRequest(this.pendingOffchainWithdrawalRequests[realmID], accountID, tokenID, amount,
                              walletAccountID, feeTokenID, fee, walletSplitPercentage);
    return this.pendingOffchainWithdrawalRequests[realmID][this.pendingOffchainWithdrawalRequests[realmID].length - 1];
  }

  public async requestWithdrawalOnchain(realmID: number, accountID: number, token: string,
                                        amount: BN, owner: string) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    const tokenID = this.tokenAddressToIDMap.get(token);

    let numAvailableSlots = (await this.exchange.getNumAvailableWithdrawalSlots()).toNumber();
    if (numAvailableSlots === 0) {
        await this.commitOnchainWithdrawalRequests(realmID);
        numAvailableSlots = (await this.exchange.getNumAvailableWithdrawalSlots()).toNumber();
        assert(numAvailableSlots > 0, "numAvailableSlots > 0");
    }

    const withdrawalFee = (await this.exchange.getFees())._withdrawalFeeETH;

    // Submit the withdraw request
    const tx = await this.exchange.withdraw(
      token,
      web3.utils.toBN(amount),
      {from: owner, value: withdrawalFee},
    );
    pjs.logInfo("\x1b[46m%s\x1b[0m", "[WithdrawRequest] Gas used: " + tx.receipt.gasUsed);

    const eventArr: any = await this.getEventsFromContract(this.exchange, "WithdrawalRequested", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.withdrawalIdx];
    });
    const withdrawalIdx = items[0][0].toNumber();

    const walletAccountID = this.wallets[realmID][0].walletAccountID;
    this.addWithdrawalRequest(this.pendingOnchainWithdrawalRequests[realmID],
                              accountID, tokenID, amount, walletAccountID, tokenID, new BN(0),
                              0, withdrawalIdx, withdrawalFee);
    return this.pendingOnchainWithdrawalRequests[realmID][this.pendingOnchainWithdrawalRequests[realmID].length - 1];
  }

  public async requestShutdownWithdrawal(realmID: number, accountID: number, token: string, amount: BN) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    const tokenID = this.tokenAddressToIDMap.get(token);

    this.addWithdrawalRequest(this.pendingOnchainWithdrawalRequests[realmID],
                              accountID, tokenID, amount, 0, tokenID, new BN(0),
                              0, 0);
    return this.pendingOnchainWithdrawalRequests[realmID][this.pendingOnchainWithdrawalRequests[realmID].length - 1];
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

  public cancelOrderID(realmID: number, accountID: number,
                       orderTokenID: number, orderID: number,
                       walletAccountID: number,
                       feeTokenID: number, fee: BN, walletSplitPercentage: number) {
    this.addCancel(this.pendingCancels[realmID], accountID, orderTokenID, orderID, walletAccountID,
                                                 feeTokenID, fee, walletSplitPercentage);
  }

  public cancelOrder(order: OrderInfo, feeToken: string, fee: BN) {
    if (!feeToken.startsWith("0x")) {
      feeToken = this.testContext.tokenSymbolAddrMap.get(feeToken);
    }
    const feeTokenID = this.tokenAddressToIDMap.get(feeToken);
    this.cancelOrderID(order.realmID, order.accountID, order.tokenIdS, order.orderID, order.walletAccountID,
                       feeTokenID, fee, 50);
  }

  public addWithdrawalRequest(withdrawalRequests: WithdrawalRequest[],
                              accountID: number, tokenID: number, amount: BN,
                              walletAccountID: number, feeTokenID: number, fee: BN, walletSplitPercentage: number,
                              withdrawalIdx?: number, withdrawalFee?: BN) {
    withdrawalRequests.push({accountID, tokenID, amount, walletAccountID,
                             feeTokenID, fee, walletSplitPercentage, withdrawalIdx, withdrawalFee});
  }

  public sendRing(realmID: number, ring: RingInfo) {
    this.pendingRings[realmID].push(ring);
  }

  public ensureDirectoryExists(filePath: string) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
      return true;
    }
    this.ensureDirectoryExists(dirname);
    fs.mkdirSync(dirname);
  }

  public async createBlock(realmID: number, blockType: number, data: string) {
    const nextBlockIdx = (await this.exchange.getBlockHeight()).toNumber() + 1;
    const inputFilename = "./blocks/block_" + realmID + "_" + nextBlockIdx + "_info.json";
    const outputFilename = "./blocks/block_" + realmID + "_" + nextBlockIdx + ".json";

    this.ensureDirectoryExists(inputFilename);
    fs.writeFileSync(inputFilename, data, "utf8");

    const result = childProcess.spawnSync(
      "python3",
      ["operator/create_block.py", "" + realmID, "" + nextBlockIdx, "" + blockType, inputFilename, outputFilename],
      {stdio: "inherit"},
    );
    assert(result.status === 0, "create_block failed: " + blockType);

    return [nextBlockIdx, outputFilename];
  }

  public async commitBlock(operator: Operator, blockType: BlockType, numElements: number,
                           data: string, filename: string) {
    const bitstream = new pjs.Bitstream(data);
    const realmID = bitstream.extractUint32(0);

    // Make sure the keys are generated
    await this.generateKeys(filename);

    // const activeOperator = await this.getActiveOperator(realmID);
    // assert.equal(activeOperator.operatorID, operator.operatorID);
    // console.log("Active operator: " + activeOperator.owner + " " + activeOperator.operatorID);
    const tx = await this.exchange.commitBlock(
      web3.utils.toBN(blockType),
      web3.utils.toBN(numElements),
      web3.utils.hexToBytes(data),
      {from: this.exchangeOperator},
    );
    // pjs.logInfo("\x1b[46m%s\x1b[0m", "[commitBlock] Gas used: " + tx.receipt.gasUsed);

    const blockIdx = (await this.exchange.getBlockHeight()).toNumber();
    const block: Block = {
      blockIdx,
      filename,
      operator,
    };
    this.pendingBlocks[realmID].push(block);
    return block;
  }

  public async generateKeys(blockFilename: string) {
    const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

    const result = childProcess.spawnSync(
      "build/circuit/dex_circuit",
      ["-createkeys", blockFilename],
      {stdio: "inherit"},
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
    verificationKeyFilename += block.numElements + "_vk.json";

    // Read the verification key and set it in the smart contract
    const vk = JSON.parse(fs.readFileSync(verificationKeyFilename, "ascii"));
    const vkFlattened = this.flattenList(this.flattenVK(vk));
    // console.log(vkFlattened);
    await this.blockVerifier.setVerifyingKey(
      block.blockType,
      block.onchainDataAvailability,
      block.numElements,
      vkFlattened,
    );
  }

  public async verifyBlock(blockIdx: number, blockFilename: string) {
    const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

    const proofFilename = "./blocks/block_" + block.realmID + "_" + blockIdx + "_proof.json";
    const result = childProcess.spawnSync(
      "build/circuit/dex_circuit",
      ["-prove", blockFilename, proofFilename],
      {stdio: "inherit"},
    );
    assert(result.status === 0, "verifyBlock failed: " + blockFilename);

    // Read the proof
    const proof = JSON.parse(fs.readFileSync(proofFilename, "ascii"));
    const proofFlattened = this.flattenProof(proof);
    // console.log(proof);
    // console.log(this.flattenProof(proof));

    const tx = await this.exchange.verifyBlock(
      web3.utils.toBN(blockIdx),
      proofFlattened,
      {from: this.exchangeOperator},
    );
    pjs.logInfo("\x1b[46m%s\x1b[0m", "[verifyBlock] Gas used: " + tx.receipt.gasUsed);

    return proofFilename;
  }

  public async verifyPendingBlocks(realmID: number) {
    for (const block of this.pendingBlocks[realmID]) {
      await this.verifyBlock(block.blockIdx, block.filename);
    }
    this.pendingBlocks[realmID] = [];
  }

  public getPendingDeposits(realmID: number) {
    const pendingDeposits: Deposit[] = [];
    for (const pendingDeposit of this.pendingDeposits[realmID]) {
      pendingDeposits.push(pendingDeposit);
    }
    return pendingDeposits;
  }

  public async commitDeposits(realmID: number, pendingDeposits?: Deposit[]) {
    const blockInfos: Block[] = [];

    if (pendingDeposits === undefined) {
      pendingDeposits = this.pendingDeposits[realmID];
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
        const hashData = new pjs.Bitstream();
        hashData.addHex(endingHash);
        hashData.addNumber(deposit.accountID, 3);
        hashData.addBN(new BN(deposit.publicKeyX, 10), 32);
        hashData.addBN(new BN(deposit.publicKeyY, 10), 32);
        hashData.addNumber(deposit.tokenID, 2);
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
      const stateBefore = await this.loadRealm(realmID, currentBlockIdx);

      const [blockIdx, blockFilename] = await this.createBlock(realmID, 1, JSON.stringify(depositBlock, replacer, 4));

      // Store state after
      const stateAfter = await this.loadRealm(realmID, currentBlockIdx + 1);

      // Validate state change
      this.validateDeposits(deposits, stateBefore, stateAfter);

      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));
      const bs = new pjs.Bitstream();
      bs.addNumber(block.realmID, 4);
      bs.addBN(new BN(block.merkleRootBefore, 10), 32);
      bs.addBN(new BN(block.merkleRootAfter, 10), 32);
      bs.addBN(new BN(startingHash.slice(2), 16), 32);
      bs.addBN(new BN(endingHash.slice(2), 16), 32);
      bs.addNumber(startIndex, 4);
      bs.addNumber(numRequestsInBlock, 4);

      // Commit the block
      const operator = await this.getActiveOperator(realmID);
      const blockInfo = await this.commitBlock(operator, BlockType.DEPOSIT, blockSize, bs.getData(), blockFilename);

      blockInfos.push(blockInfo);
    }

    this.pendingDeposits[realmID] = [];

    return blockInfos;
  }

  public async loadRealm(realmID: number, blockIdx?: number) {
    // Read in the state
    if (blockIdx === undefined) {
      blockIdx = (await this.exchange.getBlockHeight()).toNumber();
    }
    const accounts: Account[] = [];
    if (blockIdx > 0) {
      const stateFile = "states/state_" + realmID + "_" + blockIdx + ".json";
      const jState = JSON.parse(fs.readFileSync(stateFile, "ascii"));

      const accountsKeys: string[] = Object.keys(jState.accounts_values);
      let numAccounts = 1;
      for (const accountKey of accountsKeys) {
        numAccounts = (Number(accountKey) >= numAccounts) ? Number(accountKey) + 1 : numAccounts;
      }
      for (let i = 0; i < numAccounts; i++) {
        const emptyAccount: Account = {
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
        const account: Account = {
          publicKeyX: jAccount.publicKeyX,
          publicKeyY: jAccount.publicKeyY,
          nonce: jAccount.nonce,
          balances,
        };
        accounts[Number(accountKey)] = account;
      }
    } else {
      const emptyAccount: Account = {
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

    const realm: Realm = {
      accounts,
    };
    return realm;
  }

  public async getActiveOperator(realmID: number) {
    return this.operators[realmID];
  }

  public async commitWithdrawalRequests(onchain: boolean, realmID: number, shutdown: boolean = false) {
    let pendingWithdrawals: WithdrawalRequest[];
    if (onchain) {
      pendingWithdrawals = this.pendingOnchainWithdrawalRequests[realmID];
    } else {
      pendingWithdrawals = this.pendingOffchainWithdrawalRequests[realmID];
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
            walletAccountID: onchain ? 0 : this.wallets[realmID][0].walletAccountID,
            feeTokenID: 1,
            fee: new BN(0),
            walletSplitPercentage: 0,
          };
          withdrawals.push(dummyWithdrawalRequest);
        }
      }
      assert(withdrawals.length === blockSize);
      numWithdrawalsDone += blockSize;

      const startIndex = (await this.exchange.getNumWithdrawalRequestsProcessed()).toNumber();
      // console.log("startIndex: " + startIndex);
      // console.log("numRequestsProcessed: " + numRequestsProcessed);
      const firstRequestData = await this.exchange.getWithdrawRequest(startIndex - 1);
      const startingHash = firstRequestData.accumulatedHash;
      // console.log(requestData);

      // Calculate ending hash
      let endingHash = startingHash;
      for (const withdrawal of withdrawals) {
        const hashData = new pjs.Bitstream();
        hashData.addHex(endingHash);
        hashData.addNumber(withdrawal.accountID, 3);
        hashData.addNumber(withdrawal.tokenID, 2);
        hashData.addBN(withdrawal.amount, 12);
        endingHash = "0x" + SHA256(Buffer.from(hashData.getData().slice(2), "hex")).toString("hex");
      }

      // Block info
      const operator = await this.getActiveOperator(realmID);
      const withdrawalBlock: WithdrawBlock = {
        withdrawals,
        onchainDataAvailability: this.onchainDataAvailability,
        operatorAccountID: onchain ? 0 : operator.accountID,
        startHash: onchain ? new BN(startingHash.slice(2), 16) : new BN(0),
        startIndex: onchain ? startIndex : 0,
        count: shutdown ? 0 : (onchain ? numRequestsInBlock : 0),
      };

      // Store state before
      const currentBlockIdx = (await this.exchange.getBlockHeight()).toNumber();
      const stateBefore = await this.loadRealm(realmID, currentBlockIdx);

      const jWithdrawalsInfo = JSON.stringify(withdrawalBlock, replacer, 4);
      const [blockIdx, blockFilename] = await this.createBlock(realmID, blockType, jWithdrawalsInfo);

      // Store state after
      const stateAfter = await this.loadRealm(realmID, currentBlockIdx + 1);

      // Validate state change
      if (onchain) {
        this.validateOnchainWithdrawals(withdrawalBlock, stateBefore, stateAfter);
      } else {
        this.validateOffchainWithdrawals(withdrawalBlock, stateBefore, stateAfter);
      }

      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));
      const bs = new pjs.Bitstream();
      bs.addNumber(block.realmID, 4);
      bs.addBN(new BN(block.merkleRootBefore, 10), 32);
      bs.addBN(new BN(block.merkleRootAfter, 10), 32);
      if (onchain) {
        bs.addBN(new BN(startingHash.slice(2), 16), 32);
        bs.addBN(new BN(endingHash.slice(2), 16), 32);
        bs.addNumber(block.startIndex, 4);
        bs.addNumber(block.count, 4);
      }
      for (const withdrawal of block.withdrawals) {
        bs.addNumber(withdrawal.accountID, 3);
        bs.addNumber(withdrawal.tokenID, 2);
        bs.addBN(web3.utils.toBN(withdrawal.amountWithdrawn), 12);
      }
      if (!onchain && block.onchainDataAvailability) {
        bs.addNumber(block.operatorAccountID, 3);
        for (const withdrawal of block.withdrawals) {
          bs.addNumber(withdrawal.walletAccountID, 3);
          bs.addNumber(withdrawal.feeTokenID, 2);
          bs.addBN(web3.utils.toBN(withdrawal.fee), 12);
          bs.addNumber(withdrawal.walletSplitPercentage, 1);
        }
      }

      // Commit the block
      await this.commitBlock(operator, blockType, blockSize, bs.getData(), blockFilename);

      // Add as a pending withdrawal
      let withdrawalIdx = 0;
      for (const withdrawalRequest of block.withdrawals) {
        const withdrawal: Withdrawal = {
          realmID,
          blockIdx,
          withdrawalIdx,
        };
        this.pendingWithdrawals.push(withdrawal);
        withdrawalIdx++;
      }
    }

    if (onchain) {
      this.pendingOnchainWithdrawalRequests[realmID] = [];
    } else {
      this.pendingOffchainWithdrawalRequests[realmID] = [];
    }
  }

  public async commitOffchainWithdrawalRequests(realmID: number) {
    return this.commitWithdrawalRequests(false, realmID);
  }

  public async commitOnchainWithdrawalRequests(realmID: number) {
    return this.commitWithdrawalRequests(true, realmID);
  }

  public async commitShutdownWithdrawalRequests(realmID: number) {
    return this.commitWithdrawalRequests(true, realmID, true);
  }

  public async submitPendingWithdrawals(addressBook?: { [id: string]: string; }) {
    for (const withdrawal of this.pendingWithdrawals) {
      const txw = await this.exchange.withdraw(
        web3.utils.toBN(withdrawal.realmID),
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
      console.log("Withdrawn: " + to + ": " + amount + " " + tokenSymbol);
    }

    this.pendingWithdrawals = [];
  }

  public async commitRings(realmID: number) {
    const pendingRings = this.pendingRings[realmID];
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
          const walletAccountID = this.wallets[realmID][0].walletAccountID;
          const dummyRing: RingInfo = {
            orderA:
              {
                realmID,
                orderID: 0,
                accountID: this.dummyAccountId,
                walletAccountID,

                dualAuthPublicKeyX: this.dualAuthKeyPair.publicKeyX,
                dualAuthPublicKeyY: this.dualAuthKeyPair.publicKeyY,
                dualAuthSecretKey: this.dualAuthKeyPair.secretKey,

                tokenIdS: 0,
                tokenIdB: 1,
                tokenIdF: 0,

                allOrNone: false,
                validSince: 0,
                validUntil: 0,
                walletSplitPercentage: 0,
                waiveFeePercentage: 0,

                amountS: new BN(1),
                amountB: new BN(1),
                amountF: new BN(1),
              },
            orderB:
              {
                realmID,
                orderID: 0,
                accountID: this.dummyAccountId,
                walletAccountID,

                dualAuthPublicKeyX: this.dualAuthKeyPair.publicKeyX,
                dualAuthPublicKeyY: this.dualAuthKeyPair.publicKeyY,
                dualAuthSecretKey: this.dualAuthKeyPair.secretKey,

                tokenIdS: 1,
                tokenIdB: 0,
                tokenIdF: 0,

                allOrNone: false,
                validSince: 0,
                validUntil: 0,
                walletSplitPercentage: 0,
                waiveFeePercentage: 0,

                amountS: new BN(1),
                amountB: new BN(1),
                amountF: new BN(1),
              },
            minerAccountID: this.minerAccountID[realmID],
            feeRecipientAccountID: this.feeRecipientAccountID[realmID],
            tokenID: 0,
            fee: new BN(0),
          };
          rings.push(dummyRing);
        }
      }
      assert(rings.length === blockSize);
      numRingsDone += blockSize;

      const operator = await this.getActiveOperator(realmID);
      const ringBlock: RingBlock = {
        rings,
        onchainDataAvailability: this.onchainDataAvailability,
        timestamp,
        realmID,
        operatorAccountID: operator.accountID,
      };

      // Store state before
      const currentBlockIdx = (await this.exchange.getBlockHeight()).toNumber();
      const stateBefore = await this.loadRealmForRingBlock(realmID, currentBlockIdx, ringBlock);

      // Create the block
      const [blockIdx, blockFilename] = await this.createBlock(realmID, 0, JSON.stringify(ringBlock, replacer, 4));

      // Store state after
      const stateAfter = await this.loadRealmForRingBlock(realmID, currentBlockIdx + 1, ringBlock);

      // Validate state change
      this.validateRingSettlements(ringBlock, stateBefore, stateAfter);

      // Read in the block
      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

      const bs = new pjs.Bitstream();
      bs.addNumber(realmID, 4);
      bs.addBN(new BN(block.merkleRootBefore, 10), 32);
      bs.addBN(new BN(block.merkleRootAfter, 10), 32);
      bs.addNumber(ringBlock.timestamp, 4);
      if (block.onchainDataAvailability) {
        bs.addNumber(block.operatorAccountID, 3);
        for (const ringSettlement of block.ringSettlements) {
          const ring = ringSettlement.ring;
          const orderA = ringSettlement.ring.orderA;
          const orderB = ringSettlement.ring.orderB;

          bs.addNumber(ring.minerAccountID, 3);
          bs.addNumber(ring.feeRecipientAccountID, 3);
          bs.addNumber(ring.tokenID, 2);
          bs.addBN(new BN(ring.fee, 10), 12);
          bs.addBN(new BN(ring.margin, 10), 12);
          let index = 0;
          for (const order of [orderA, orderB]) {
            bs.addNumber(order.accountID, 3);
            bs.addNumber(order.walletAccountID, 3);
            bs.addNumber(order.tokenS, 2);
            bs.addNumber(order.tokenF, 2);
            bs.addNumber(order.orderID, 4);
            bs.addBN(new BN(index === 0 ? ring.fillS_A : ring.fillS_B, 10), 12);
            bs.addBN(new BN(index === 0 ? ring.fillF_A : ring.fillF_B, 10), 12);
            bs.addNumber(order.walletSplitPercentage, 1);
            bs.addNumber(order.waiveFeePercentage, 1);
            index++;
          }
        }
      }

      // Commit the block
      await this.commitBlock(operator, BlockType.RING_SETTLEMENT, blockSize, bs.getData(), blockFilename);
    }

    this.pendingRings[realmID] = [];
  }

  public cancelPendingRings(realmID: number) {
    this.pendingRings[realmID] = [];
  }

  public async commitCancels(realmID: number) {
    const pendingCancels = this.pendingCancels[realmID];
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
          const walletAccountID = this.wallets[realmID][0].walletAccountID;
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

      const operator = await this.getActiveOperator(realmID);
      const cancelBlock: CancelBlock = {
        cancels,
        onchainDataAvailability: this.onchainDataAvailability,
        operatorAccountID: operator.accountID,
      };

      // Store state before
      const currentBlockIdx = (await this.exchange.getBlockHeight()).toNumber();
      const stateBefore = await this.loadRealm(realmID, currentBlockIdx);

      // Create the block
      const [blockIdx, blockFilename] = await this.createBlock(realmID, 4, JSON.stringify(cancelBlock, replacer, 4));

      // Store state after
      const stateAfter = await this.loadRealm(realmID, currentBlockIdx + 1);

      // Validate state change
      this.validateOrderCancellations(cancelBlock, stateBefore, stateAfter);

      // Read in the block
      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

      const bs = new pjs.Bitstream();
      bs.addNumber(block.realmID, 4);
      bs.addBN(new BN(block.merkleRootBefore, 10), 32);
      bs.addBN(new BN(block.merkleRootAfter, 10), 32);
      if (block.onchainDataAvailability) {
        bs.addNumber(block.operatorAccountID, 3);
        for (const cancel of cancels) {
          bs.addNumber(cancel.accountID, 3);
          bs.addNumber(cancel.orderTokenID, 2);
          bs.addNumber(cancel.orderID, 4);
          bs.addNumber(cancel.walletAccountID, 3);
          bs.addNumber(cancel.feeTokenID, 2);
          bs.addBN(cancel.fee, 12);
          bs.addNumber(cancel.walletSplitPercentage, 1);
        }
      }

      // Commit the block
      await this.commitBlock(operator, BlockType.ORDER_CANCELLATION, blockSize, bs.getData(), blockFilename);
    }

    this.pendingCancels[realmID] = [];
  }

  public async registerTokens() {
    for (const token of this.testContext.allTokens) {
      const tokenAddress = (token === null) ? this.zeroAddress : token.address;
      const symbol = this.testContext.tokenAddrSymbolMap.get(tokenAddress);
      // console.log(symbol + ": " + tokenAddress);

      if (symbol !== "ETH" && symbol !== "WETH" && symbol !== "LRC") {
        // Make sure the exchange owner can pay the registration fee
        const registrationCost = await this.exchange.getLRCFeeForRegisteringOneMoreToken();
        await this.setBalanceAndApprove(this.exchangeOwner, "LRC", registrationCost);
        // Register the token
        const tx = await this.exchange.registerToken(tokenAddress, {from: this.exchangeOwner});
        // pjs.logInfo("\x1b[46m%s\x1b[0m", "[TokenRegistration] Gas used: " + tx.receipt.gasUsed);
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

  public async createExchange(
      owner: string,
      bSetupTestState: boolean = true,
      onchainDataAvailability: boolean = true,
      accountCreationFeeInETH: BN = new BN(web3.utils.toWei("0.0001", "ether")),
      accountUpdateFeeInETH: BN = new BN(web3.utils.toWei("0.0001", "ether")),
      depositFeeInETH: BN = new BN(web3.utils.toWei("0.0001", "ether")),
      withdrawalFeeInETH: BN = new BN(web3.utils.toWei("0.0001", "ether")),
    ) {

    const exchangeCreationCostLRC = await this.loopringV3.exchangeCreationCostLRC();

    // Send enough tokens to the owner so the Exchange can be created
    const lrcAddress = this.testContext.tokenSymbolAddrMap.get("LRC");
    const LRC = this.testContext.tokenAddrInstanceMap.get(lrcAddress);
    await LRC.addBalance(owner, exchangeCreationCostLRC);
    await LRC.approve(this.loopringV3.address, exchangeCreationCostLRC, {from: owner});

    // Create the new exchange
    const tx = await this.loopringV3.createExchange(owner, onchainDataAvailability, {from: owner});
    // pjs.logInfo("\x1b[46m%s\x1b[0m", "[CreateExchange] Gas used: " + tx.receipt.gasUsed);

    const eventArr: any = await this.getEventsFromContract(this.loopringV3, "ExchangeCreated", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.exchangeAddress, eventObj.args.exchangeId];
    });
    const exchangeAddress = items[0][0];
    const realmID = items[0][1].toNumber();

    this.exchange = await this.contracts.Exchange.at(exchangeAddress);
    this.exchangeOwner = owner;
    this.exchangeOperator = owner;
    this.exchangeId = realmID;
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
      await this.setupTestState(realmID);
    }

    return realmID;
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
    await this.exchange.revertBlock(
      web3.utils.toBN(blockIdx),
      {from: this.exchangeOperator},
    );
    console.log("Reverted to block " + (blockIdx - 1));
    this.pendingBlocks[this.exchangeId] = [];
  }

  public async withdrawFromMerkleTree(owner: string, token: string, pubKeyX: string, pubKeyY: string) {
    const accountID = await this.getAccountID(owner);
    const tokenID = this.getTokenIdFromNameOrAddress(token);

    const realmID = this.exchangeId;

    const blockIdx = (await this.exchange.getBlockHeight()).toNumber();
    const filename = "withdraw_proof.json";
    const result = childProcess.spawnSync(
      "python3",
      ["operator/create_withdraw_proof.py",
      "" + realmID, "" + blockIdx, "" + accountID, "" + tokenID, filename],
      {stdio: "inherit"},
    );
    assert(result.status === 0, "create_withdraw_proof failed!");

    // Read in the proof
    const data = JSON.parse(fs.readFileSync(filename, "ascii"));
    // console.log(data);
    const tx = await this.exchange.withdrawFromMerkleTreeFor(
      owner,
      token,
      pubKeyX,
      pubKeyY,
      web3.utils.toBN(data.proof.account.nonce),
      web3.utils.toBN(data.proof.balance.balance),
      web3.utils.toBN(data.proof.balance.tradingHistoryRoot),
      data.proof.accountProof,
      data.proof.balanceProof,
    );
    pjs.logInfo("\x1b[46m%s\x1b[0m", "[WithdrawFromMerkleTree] Gas used: " + tx.receipt.gasUsed);
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
      await Token.transfer(this.zeroAddress, existingBalance, {from: owner});
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

  public async getOffchainBalance(realmID: number, accountID: number, tokenID: number) {
    const state = await this.loadRealm(realmID);
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
    if (token === this.zeroAddress) {
      return new BN(await web3.eth.getBalance(owner));
    } else {
      const Token = await this.contracts.DummyToken.at(token);
      return await Token.balanceOf(owner);
    }
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
    const amount = new BN(web3.utils.toWei("" + Math.random() * 1000, "ether"));
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
      new BN(Math.random() * 1000),
      depositInfo.owner,
    );
  }

  public async doRandomOffchainWithdrawal(depositInfo: DepositInfo) {
    this.requestWithdrawalOffchain(
      this.exchangeId,
      depositInfo.accountID,
      depositInfo.token,
      new BN(Math.random() * 1000),
      "LRC",
      new BN(0),
      0,
      this.wallets[this.exchangeId][0].walletAccountID,
    );
  }

  public shuffle(a: any[]) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  public compareStates(stateA: Realm, stateB: Realm) {
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

  public validateRingSettlements(ringBlock: RingBlock, stateBefore: Realm, stateAfter: Realm) {
    console.log("----------------------------------------------------");
    const operatorAccountID = ringBlock.operatorAccountID;
    const timestamp = ringBlock.timestamp;
    let latestState = stateBefore;
    const addressBook = this.getAddressBookBlock(ringBlock);
    for (const ring of ringBlock.rings) {
      const simulator = new Simulator();
      const simulatorReport = simulator.settleRing(ring, latestState, timestamp, operatorAccountID);

      for (const detailedTransfer of simulatorReport.detailedTransfers) {
        this.logDetailedTokenTransfer(detailedTransfer, addressBook);
      }
      this.logFilledAmountsRing(ring, latestState, simulatorReport.realmAfter);
      latestState = simulatorReport.realmAfter;
    }

    // Verify resulting state
    this.compareStates(stateAfter, latestState);
    console.log("----------------------------------------------------");
  }

  public validateDeposits(deposits: Deposit[], stateBefore: Realm, stateAfter: Realm) {
    console.log("----------------------------------------------------");
    let latestState = stateBefore;
    for (const deposit of deposits) {
      const simulator = new Simulator();
      const simulatorReport = simulator.deposit(deposit, latestState);

      let accountBefore = latestState.accounts[deposit.accountID];
      const accountAfter = simulatorReport.realmAfter.accounts[deposit.accountID];

      let bNewAccount = false;
      if (accountBefore === undefined) {
        const balances: {[key: number]: Balance} = {};
        for (let i = 0; i < this.MAX_NUM_TOKENS; i++) {
          balances[i] = {
            balance: new BN(0),
            tradeHistory: {},
          };
        }
        const emptyAccount: Account = {
          publicKeyX: "0",
          publicKeyY: "0",
          nonce: 0,
          balances,
        };
        accountBefore = emptyAccount;
        bNewAccount = true;
      }

      console.log("> Account " + deposit.accountID + (bNewAccount ? " (NEW ACCOUNT)" : ""));
      if (accountBefore.publicKeyX !== accountAfter.publicKeyX) {
        console.log("publicKeyX: " + accountBefore.publicKeyX + " -> " + accountAfter.publicKeyX);
      }
      if (accountBefore.publicKeyY !== accountAfter.publicKeyY) {
        console.log("publicKeyY: " + accountBefore.publicKeyY + " -> " + accountAfter.publicKeyY);
      }
      if (accountBefore.nonce !== accountAfter.nonce) {
        console.log("nonce: " + accountBefore.nonce + " -> " + accountAfter.nonce);
      }
      for (let i = 0; i < this.MAX_NUM_TOKENS; i++) {
        if (!accountBefore.balances[i].balance.eq(accountAfter.balances[i].balance)) {
          this.prettyPrintBalanceChange(deposit.accountID, i, accountBefore.balances[i].balance,
                                                              accountAfter.balances[i].balance);
        }
      }

      latestState = simulatorReport.realmAfter;
    }

    // Verify resulting state
    this.compareStates(stateAfter, latestState);
    console.log("----------------------------------------------------");
  }

  public validateOnchainWithdrawals(withdrawBlock: WithdrawBlock, stateBefore: Realm, stateAfter: Realm) {
    console.log("----------------------------------------------------");
    let latestState = stateBefore;
    const shutdown = withdrawBlock.count === 0;
    for (const withdrawal of withdrawBlock.withdrawals) {
      const simulator = new Simulator();
      const simulatorReport = simulator.onchainWithdraw(withdrawal, shutdown, latestState);

      const accountBefore = latestState.accounts[withdrawal.accountID];
      const accountAfter = simulatorReport.realmAfter.accounts[withdrawal.accountID];

      if (withdrawal.tokenID > 0 && withdrawal.accountID < latestState.accounts.length) {
        this.prettyPrintBalanceChange(
          withdrawal.accountID, withdrawal.tokenID,
          accountBefore.balances[withdrawal.tokenID].balance,
          accountAfter.balances[withdrawal.tokenID].balance,
        );
      }

      latestState = simulatorReport.realmAfter;
    }

    // Verify resulting state
    this.compareStates(stateAfter, latestState);
    console.log("----------------------------------------------------");
  }

  public validateOffchainWithdrawals(withdrawBlock: WithdrawBlock, stateBefore: Realm, stateAfter: Realm) {
    console.log("----------------------------------------------------");
    const operatorAccountID = withdrawBlock.operatorAccountID;
    let latestState = stateBefore;
    for (const withdrawal of withdrawBlock.withdrawals) {
      const simulator = new Simulator();
      const simulatorReport = simulator.offchainWithdraw(withdrawal, latestState, operatorAccountID);

      const accountBefore = latestState.accounts[withdrawal.accountID];
      const accountAfter = simulatorReport.realmAfter.accounts[withdrawal.accountID];

      if (withdrawal.tokenID > 0) {
        this.prettyPrintBalanceChange(
          withdrawal.accountID, withdrawal.tokenID,
          accountBefore.balances[withdrawal.tokenID].balance,
          accountAfter.balances[withdrawal.tokenID].balance,
        );
      }

      latestState = simulatorReport.realmAfter;
    }

    // Verify resulting state
    this.compareStates(stateAfter, latestState);
    console.log("----------------------------------------------------");
  }

  public validateOrderCancellations(cancelBlock: CancelBlock, stateBefore: Realm, stateAfter: Realm) {
    console.log("----------------------------------------------------");
    const operatorAccountID = cancelBlock.operatorAccountID;
    let latestState = stateBefore;
    for (const cancel of cancelBlock.cancels) {
      const simulator = new Simulator();
      const simulatorReport = simulator.cancelOrder(cancel, latestState, operatorAccountID);

      // const accountBefore = latestState.accounts[cancel.accountID];
      // const accountAfter = simulatorReport.realmAfter.accounts[cancel.accountID];

      latestState = simulatorReport.realmAfter;
    }

    // Verify resulting state
    this.compareStates(stateAfter, latestState);
    console.log("----------------------------------------------------");
  }

  public async loadRealmForRingBlock(realmID: number, blockIdx: number, ringBlock: RingBlock) {
    const state = await this.loadRealm(realmID, blockIdx);
    const orders: OrderInfo[] = [];
    for (const ring of ringBlock.rings) {
      orders.push(ring.orderA);
      orders.push(ring.orderB);
    }
    for (const order of orders) {
      // Make sure the trading history for the orders exists
      const tradeHistorySlot = order.orderID % (2 ** this.TREE_DEPTH_TRADING_HISTORY);
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

  public prettyPrintBalance(accountID: number, tokenID: number, balance: BN) {
    const tokenAddress = this.tokenIDToAddressMap.get(tokenID);
    const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(tokenAddress);
    const decimals = this.testContext.tokenAddrDecimalsMap.get(tokenAddress);
    const prettyBalance = balance.div(web3.utils.toBN(10 ** decimals)).toString(10);
    console.log(accountID + ": " + prettyBalance + " " + tokenSymbol);
  }

  public prettyPrintBalanceChange(accountID: number, tokenID: number, balanceBefore: BN, balanceAfter: BN) {
    const tokenAddress = this.tokenIDToAddressMap.get(tokenID);
    const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(tokenAddress);
    const decimals = this.testContext.tokenAddrDecimalsMap.get(tokenAddress);
    const prettyBalanceBefore = balanceBefore.div(web3.utils.toBN(10 ** decimals)).toString(10);
    const prettyBalanceAfter = balanceAfter.div(web3.utils.toBN(10 ** decimals)).toString(10);
    console.log(accountID + ": " +
                prettyBalanceBefore + " " + tokenSymbol + " -> " +
                prettyBalanceAfter + " " + tokenSymbol);
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

    tokenSymbolAddrMap.set("ETH", this.zeroAddress);
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
        tokenAddrDecimalsMap.set(this.zeroAddress, 18);
      } else {
        tokenAddrDecimalsMap.set(token.address, (await token.decimals()));
      }
    }

    tokenAddrSymbolMap.set(this.zeroAddress, "ETH");
    tokenAddrSymbolMap.set(this.contracts.WETHToken.address, "WETH");
    tokenAddrSymbolMap.set(this.contracts.LRCToken.address, "LRC");
    tokenAddrSymbolMap.set(this.contracts.GTOToken.address, "GTO");
    tokenAddrSymbolMap.set(this.contracts.RDNToken.address, "RDN");
    tokenAddrSymbolMap.set(this.contracts.REPToken.address, "REP");
    tokenAddrSymbolMap.set(this.contracts.INDAToken.address, "INDA");
    tokenAddrSymbolMap.set(this.contracts.INDBToken.address, "INDB");
    tokenAddrSymbolMap.set(this.contracts.TESTToken.address, "TEST");

    tokenAddrInstanceMap.set(this.zeroAddress, null);
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
      pjs.logDebug(whiteSpace + "- " + " [" + description + "] " + prettyAmount + " -> " + toName);
    } else {
      pjs.logDebug(whiteSpace + "+ " + " [" + description + "] " + prettyAmount);
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

  private logFilledAmountsRing(ring: RingInfo, stateBefore: Realm, stateAfter: Realm) {
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

  private logFilledAmountOrder(description: string, accountBefore: Account, accountAfter: Account, order: OrderInfo) {
    const tradeHistorySlot = order.orderID % (2 ** this.TREE_DEPTH_TRADING_HISTORY);
    const before = accountBefore.balances[order.tokenIdS].tradeHistory[tradeHistorySlot];
    const after = accountAfter.balances[order.tokenIdS].tradeHistory[tradeHistorySlot];
    const filledBeforePercentage = before.filled.mul(new BN(100)).div(order.amountS);
    const filledAfterPercentage = after.filled.mul(new BN(100)).div(order.amountS);
    const filledBeforePretty = this.getPrettyAmount(order.tokenIdS, before.filled);
    const filledAfterPretty = this.getPrettyAmount(order.tokenIdS, after.filled);
    console.log(
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
