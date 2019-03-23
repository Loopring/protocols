import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import childProcess = require("child_process");
import ethUtil = require("ethereumjs-util");
import fs = require("fs");
import path = require("path");
import * as pjs from "protocol2-js";
import util = require("util");
import { Artifacts } from "../util/Artifacts";
import { Context } from "./context";
import { Simulator } from "./simulator";
import { ExchangeTestContext } from "./testExchangeContext";
import { Account, Balance, Block, Cancel, CancelBlock, Deposit, DepositInfo, DetailedTokenTransfer,
         Operator, OrderInfo, RingBlock, RingInfo, State, TradeHistory, Wallet, Withdrawal,
         WithdrawalRequest, WithdrawBlock } from "./types";

// JSON replacer function for BN values
function replacer(name: any, val: any) {
  if (name === "balance" || name === "amountS" || name === "amountB" || name === "amountF" ||
      name === "amount" || name === "fee") {
    return new BN(val, 16).toString(10);
  } else {
    return val;
  }
}

export class ExchangeTestUtil {
  public context: Context;
  public testContext: ExchangeTestContext;
  public exchange: any;
  public tokenRegistry: any;
  public operatorRegistry: any;
  public blockVerifier: any;

  public minerAccountID: number[] = [];
  public feeRecipientAccountID: number[] = [];

  public operators: Operator[][] = [];
  public wallets: Wallet[][] = [];

  public MAX_MUM_WALLETS: number;
  public MAX_PROOF_GENERATION_TIME_IN_SECONDS: number;
  public MAX_TIME_BLOCK_UNTIL_WITHDRAWALMODE: number;
  public STAKE_AMOUNT_IN_LRC: BN;
  public MIN_TIME_UNTIL_OPERATOR_CAN_WITHDRAW: number;

  public MAX_NUM_STATES: number = 64;

  private contracts = new Artifacts(artifacts);

  private tokenAddressToIDMap = new Map<string, number>();
  private tokenIDToAddressMap = new Map<number, string>();

  private pendingRings: RingInfo[][] = [];
  private pendingDeposits: Deposit[][] = [];
  private pendingOffchainWithdrawalRequests: WithdrawalRequest[][] = [];
  private pendingOnchainWithdrawalRequests: WithdrawalRequest[][] = [];
  private pendingCancels: Cancel[][] = [];

  private pendingWithdrawals: Withdrawal[] = [];

  private pendingBlocks: Block[][] = [];

  private zeroAddress = "0x" + "00".repeat(20);

  private orderIDGenerator: number = 0;

  public async initialize(accounts: string[]) {
    this.context = await this.createContractContext();
    this.testContext = await this.createExchangeTestContext(accounts);
    await this.registerTokens();

    this.MAX_MUM_WALLETS = (await this.exchange.MAX_NUM_WALLETS()).toNumber();
    this.MAX_PROOF_GENERATION_TIME_IN_SECONDS = (await this.exchange.MAX_PROOF_GENERATION_TIME_IN_SECONDS()).toNumber();
    this.MAX_TIME_BLOCK_UNTIL_WITHDRAWALMODE = (await this.exchange.MAX_TIME_BLOCK_UNTIL_WITHDRAWALMODE()).toNumber();
    this.STAKE_AMOUNT_IN_LRC = await this.operatorRegistry.STAKE_AMOUNT_IN_LRC();
    this.MIN_TIME_UNTIL_OPERATOR_CAN_WITHDRAW =
      (await this.operatorRegistry.MIN_TIME_UNTIL_OPERATOR_CAN_WITHDRAW()).toNumber();

    for (let i = 0; i < this.MAX_NUM_STATES; i++) {
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

      const operators: Operator[] = [];
      this.operators.push(operators);

      const wallets: Wallet[] = [];
      this.wallets.push(wallets);

      const pendingBlocks: Block[] = [];
      this.pendingBlocks.push(pendingBlocks);
    }

    await this.createNewState(
      this.testContext.deployer,
      true,
      5,
      new BN(web3.utils.toWei("0.001", "ether")),
      new BN(web3.utils.toWei("0.001", "ether")),
      new BN(web3.utils.toWei("0.01", "ether")),
      false,
    );
  }

  public async setupTestState(stateID: number, numOperators: number = 1) {
    await this.deposit(
      stateID,
      this.testContext.deployer,
      (await this.exchange.DEFAULT_ACCOUNT_SECRETKEY()).toString(),
      (await this.exchange.DEFAULT_ACCOUNT_PUBLICKEY_X()).toString(),
      (await this.exchange.DEFAULT_ACCOUNT_PUBLICKEY_Y()).toString(),
      0,
      this.zeroAddress,
      new BN(0),
    );

    await this.deposit(
      stateID,
      this.testContext.deployer,
      (await this.exchange.DEFAULT_ACCOUNT_SECRETKEY()).toString(),
      (await this.exchange.DEFAULT_ACCOUNT_PUBLICKEY_X()).toString(),
      (await this.exchange.DEFAULT_ACCOUNT_PUBLICKEY_Y()).toString(),
      this.MAX_MUM_WALLETS + 0,
      this.zeroAddress,
      new BN(0),
    );

    for (let i = 0; i < numOperators; i++) {
      const operatorOwnerIdx = i % this.testContext.operators.length;
      const operatorOwner = this.testContext.operators[operatorOwnerIdx];
      const newOperator = await this.createOperator(stateID, operatorOwner);
      this.addOperator(stateID, newOperator);
    }
    [this.minerAccountID[stateID], this.feeRecipientAccountID[stateID]] = await this.createRingMatcher(
      stateID,
      this.testContext.ringMatchers[0],
      this.testContext.feeRecipients[0],
    );

    for (const walletAddress of this.testContext.wallets) {
      const wallet = await this.createWallet(stateID, walletAddress);
      this.wallets[stateID].push(wallet);
    }
  }

  public async createOperator(stateID: number, owner: string) {
    // Make an account for the operator
    const keyPair = this.getKeyPairEDDSA();
    const depositInfo = await this.deposit(stateID, owner,
                                           keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                           0, this.zeroAddress, new BN(0));

    const operatorID = await this.registerOperator(stateID, owner);

    const operator: Operator = {
      owner,
      accountID: depositInfo.accountID,
      operatorID,
    };
    return operator;
  }

  public async addOperator(stateID: number, operator: Operator) {
    assert.equal(this.operators[stateID].length, operator.operatorID);
    this.operators[stateID].push(operator);
  }

  public async createWallet(stateID: number, owner: string) {
    const walletID = await this.registerWallet(stateID, owner);

    // Make a dual author account for the wallet
    const keyPair = this.getKeyPairEDDSA();
    const walletDeposit = await this.deposit(stateID, owner,
                                             keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                             this.MAX_MUM_WALLETS + walletID, this.zeroAddress, new BN(0));
    const wallet: Wallet = {
      owner,
      walletID,
      walletAccountID: walletDeposit.accountID,
    };
    return wallet;
  }

  public async createRingMatcher(stateID: number, owner: string, feeRecipient: string) {
    const lrcAddress = this.testContext.tokenSymbolAddrMap.get("LRC");
    const LRC = this.testContext.tokenAddrInstanceMap.get(lrcAddress);

    const balance = new BN(web3.utils.toWei("1000000", "ether"));

    // Make an account for the ringmatcher
    const keyPairM = this.getKeyPairEDDSA();
    await LRC.addBalance(owner, balance);
    const minerDeposit = await this.deposit(stateID, owner,
                                            keyPairM.secretKey, keyPairM.publicKeyX, keyPairM.publicKeyY,
                                            0, lrcAddress, balance);

    // Make an account to receive fees
    const keyPairF = this.getKeyPairEDDSA();
    const feeRecipientDeposit = await this.deposit(stateID, feeRecipient,
                                                   keyPairF.secretKey, keyPairF.publicKeyX, keyPairF.publicKeyY,
                                                   this.MAX_MUM_WALLETS, lrcAddress, new BN(0));

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
    ring.minerAccountID = this.minerAccountID[ring.orderA.stateID];
    ring.feeRecipientAccountID = this.feeRecipientAccountID[ring.orderA.stateID];
    ring.tokenID = ring.tokenID ? ring.tokenID : 2;
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

    // Fill in defaults
    order.tokenF = order.tokenF ? order.tokenF : this.context.lrcAddress;
    order.amountF = order.amountF ? order.amountF : new BN(web3.utils.toWei("1.5", "ether"));

    order.allOrNone = order.allOrNone ? order.allOrNone : false;
    order.walletSplitPercentage = (order.walletSplitPercentage !== undefined) ? order.walletSplitPercentage : 50;

    order.waiveFeePercentage = (order.waiveFeePercentage !== undefined) ? order.waiveFeePercentage : 50;

    const walletIndex = index % this.testContext.wallets.length;
    order.walletID = (order.walletID !== undefined) ?
                     order.walletID : this.wallets[order.stateID][walletIndex].walletID;
    order.dualAuthAccountID = (order.dualAuthAccountID !== undefined) ?
                              order.dualAuthAccountID : this.wallets[order.stateID][walletIndex].walletAccountID;

    order.orderID = (order.orderID !== undefined) ? order.orderID : index;

    order.stateID = (order.stateID !== undefined) ? order.stateID : 0;

    order.tokenIdS = this.tokenAddressToIDMap.get(order.tokenS);
    order.tokenIdB = this.tokenAddressToIDMap.get(order.tokenB);
    order.tokenIdF = this.tokenAddressToIDMap.get(order.tokenF);

    // setup initial balances:
    await this.setOrderBalances(order);
  }

  public async setOrderBalances(order: OrderInfo) {
    const keyPair = this.getKeyPairEDDSA();

    const balanceS = (order.balanceS !== undefined) ? order.balanceS : order.amountS;
    const depositInfo = await this.deposit(order.stateID, order.owner,
                                           keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                           order.walletID, order.tokenS, balanceS);
    order.accountID = depositInfo.accountID;

    const balanceF = (order.balanceF !== undefined) ? order.balanceF : order.amountF;
    if (balanceF.gt(0)) {
      await this.deposit(order.stateID, order.owner,
                        keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                        order.walletID, order.tokenF, balanceF, order.accountID);
    }

    const balanceB = (order.balanceB !== undefined) ? order.balanceB : new BN(0);
    if (balanceB.gt(0)) {
      await this.deposit(order.stateID, order.owner,
                        keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                        order.walletID, order.tokenB, balanceB, order.accountID);
    }
  }

  public getAddressBook(ring: RingInfo, index?: number, addressBook: { [id: number]: string; } = {}) {
    const addAccount = (addrBook: { [id: string]: any; }, accountID: number, name: string) => {
      addrBook[accountID] = (addrBook[accountID] ? addrBook[accountID] + "=" : "") + name;
    };
    const bIndex = index !== undefined;
    addAccount(addressBook, ring.orderA.accountID, "OwnerA" + (bIndex ? "[" + index + "]" : ""));
    addAccount(addressBook, ring.orderA.dualAuthAccountID, "WalletA" + (bIndex ? "[" + index + "]" : ""));
    addAccount(addressBook, ring.orderB.accountID, "OwnerB" + (bIndex ? "[" + index + "]" : ""));
    addAccount(addressBook, ring.orderB.dualAuthAccountID, "WalletB" + (bIndex ? "[" + index + "]" : ""));
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

  public async deposit(stateID: number, owner: string, secretKey: string, publicKeyX: string, publicKeyY: string,
                       walletID: number, token: string, amount: BN, accountID?: number) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    const tokenID = this.tokenAddressToIDMap.get(token);

    let numAvailableSlots = (await this.exchange.getNumAvailableDepositSlots(web3.utils.toBN(stateID))).toNumber();
    if (numAvailableSlots === 0) {
        const timeToWait = (await this.exchange.MIN_TIME_BLOCK_OPEN()).toNumber();
        await this.advanceBlockTimestamp(timeToWait);
        numAvailableSlots = (await this.exchange.getNumAvailableDepositSlots(web3.utils.toBN(stateID))).toNumber();
        assert(numAvailableSlots > 0, "numAvailableSlots > 0");
    }

    const depositFee = await this.exchange.getDepositFee(stateID);

    let ethToSend = depositFee;
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
      const tx = await this.exchange.depositAndUpdateAccount(
        web3.utils.toBN(stateID),
        web3.utils.toBN(accountID),
        new BN(publicKeyX),
        new BN(publicKeyY),
        web3.utils.toBN(walletID),
        tokenID,
        web3.utils.toBN(amount),
        {from: owner, value: ethToSend},
      );
      // pjs.logInfo("\x1b[46m%s\x1b[0m", "[Deposit] Gas used: " + tx.receipt.gasUsed);
    } else {
      const tx = await this.exchange.createAccountAndDeposit(
        web3.utils.toBN(stateID),
        new BN(publicKeyX),
        new BN(publicKeyY),
        web3.utils.toBN(walletID),
        tokenID,
        web3.utils.toBN(amount),
        {from: owner, value: ethToSend},
      );
      // pjs.logInfo("\x1b[46m%s\x1b[0m", "[DepositAndCreate] Gas used: " + tx.receipt.gasUsed);
    }

    const eventArr: any = await this.getEventsFromContract(this.exchange, "Deposit", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.accountID, eventObj.args.depositBlockIdx, eventObj.args.slotIdx];
    });

    const depositInfo: DepositInfo = {
      accountID: items[0][0].toNumber(),
      depositBlockIdx: items[0][1].toNumber(),
      slotIdx: items[0][2].toNumber(),
    };

    this.addDeposit(this.pendingDeposits[stateID], depositInfo.depositBlockIdx, depositInfo.accountID,
                    secretKey, publicKeyX, publicKeyY,
                    walletID, this.tokenAddressToIDMap.get(token), amount);
    return depositInfo;
  }

  public async requestWithdrawalOffchain(stateID: number, accountID: number, token: string, amount: BN,
                                         feeToken: string, fee: BN, walletSplitPercentage: number,
                                         dualAuthAccountID: number) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    const tokenID = this.tokenAddressToIDMap.get(token);
    if (!feeToken.startsWith("0x")) {
      feeToken = this.testContext.tokenSymbolAddrMap.get(feeToken);
    }
    const feeTokenID = this.tokenAddressToIDMap.get(feeToken);
    this.addWithdrawalRequest(this.pendingOffchainWithdrawalRequests[stateID], accountID, tokenID, amount,
                              dualAuthAccountID, feeTokenID, fee, walletSplitPercentage);
    return this.pendingOffchainWithdrawalRequests[stateID][this.pendingOffchainWithdrawalRequests[stateID].length - 1];
  }

  public async requestWithdrawalOnchain(stateID: number, accountID: number, token: string,
                                        amount: BN, owner: string) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    const tokenID = this.tokenAddressToIDMap.get(token);

    let numAvailableSlots = (await this.exchange.getNumAvailableWithdrawSlots(web3.utils.toBN(stateID))).toNumber();
    console.log("numAvailableSlots: " + numAvailableSlots);
    if (numAvailableSlots === 0) {
        const timeToWait = (await this.exchange.MIN_TIME_BLOCK_OPEN()).toNumber();
        await this.advanceBlockTimestamp(timeToWait);
        numAvailableSlots = (await this.exchange.getNumAvailableWithdrawSlots(web3.utils.toBN(stateID))).toNumber();
        console.log("numAvailableSlots: " + numAvailableSlots);
        assert(numAvailableSlots > 0, "numAvailableSlots > 0");
    }

    const withdrawFee = await this.exchange.getWithdrawFee(stateID);

    // Submit the withdraw request
    const tx = await this.exchange.requestWithdraw(
      web3.utils.toBN(stateID),
      web3.utils.toBN(accountID),
      web3.utils.toBN(tokenID),
      web3.utils.toBN(amount),
      {from: owner, value: withdrawFee},
    );
    pjs.logInfo("\x1b[46m%s\x1b[0m", "[WithdrawRequest] Gas used: " + tx.receipt.gasUsed);

    const eventArr: any = await this.getEventsFromContract(this.exchange, "WithdrawRequest", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.withdrawBlockIdx, eventObj.args.slotIdx];
    });
    const withdrawBlockIdx = items[0][0].toNumber();
    const slotIdx = items[0][1].toNumber();

    this.addWithdrawalRequest(this.pendingOnchainWithdrawalRequests[stateID],
                              accountID, tokenID, amount, 0, tokenID, new BN(0), 0, withdrawBlockIdx, slotIdx);
    return this.pendingOnchainWithdrawalRequests[stateID][this.pendingOnchainWithdrawalRequests[stateID].length - 1];
  }

  public addDeposit(deposits: Deposit[], depositBlockIdx: number, accountID: number,
                    secretKey: string, publicKeyX: string, publicKeyY: string,
                    walletID: number, tokenID: number, amount: BN) {
    deposits.push({accountID, depositBlockIdx, secretKey, publicKeyX, publicKeyY, walletID, tokenID, amount});
  }

  public addCancel(cancels: Cancel[], accountID: number, orderTokenID: number, orderID: number,
                   dualAuthAccountID: number, feeTokenID: number, fee: BN, walletSplitPercentage: number) {
    cancels.push({accountID, orderTokenID, orderID, dualAuthAccountID, feeTokenID, fee, walletSplitPercentage});
  }

  public cancelOrderID(stateID: number, accountID: number,
                       orderTokenID: number, orderID: number,
                       dualAuthAccountID: number,
                       feeTokenID: number, fee: BN, walletSplitPercentage: number) {
    this.addCancel(this.pendingCancels[stateID], accountID, orderTokenID, orderID, dualAuthAccountID,
                                                 feeTokenID, fee, walletSplitPercentage);
  }

  public cancelOrder(order: OrderInfo, feeToken: string, fee: BN) {
    if (!feeToken.startsWith("0x")) {
      feeToken = this.testContext.tokenSymbolAddrMap.get(feeToken);
    }
    const feeTokenID = this.tokenAddressToIDMap.get(feeToken);
    this.cancelOrderID(order.stateID, order.accountID, order.tokenIdS, order.orderID, order.dualAuthAccountID,
                       feeTokenID, fee, 50);
  }

  public addWithdrawalRequest(withdrawalRequests: WithdrawalRequest[],
                              accountID: number, tokenID: number, amount: BN,
                              dualAuthAccountID: number, feeTokenID: number, fee: BN, walletSplitPercentage: number,
                              withdrawBlockIdx?: number, slotIdx?: number) {
    withdrawalRequests.push({accountID, tokenID, amount, dualAuthAccountID,
                             feeTokenID, fee, walletSplitPercentage, withdrawBlockIdx, slotIdx});
  }

  public sendRing(stateID: number, ring: RingInfo) {
    this.pendingRings[stateID].push(ring);
  }

  public ensureDirectoryExists(filePath: string) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
      return true;
    }
    this.ensureDirectoryExists(dirname);
    fs.mkdirSync(dirname);
  }

  public async createBlock(stateID: number, blockType: number, data: string) {
    const nextBlockIdx = (await this.exchange.getBlockIdx(web3.utils.toBN(stateID))).toNumber() + 1;
    const inputFilename = "./blocks/block_" + stateID + "_" + nextBlockIdx + "_info.json";
    const outputFilename = "./blocks/block_" + stateID + "_" + nextBlockIdx + ".json";

    this.ensureDirectoryExists(inputFilename);
    fs.writeFileSync(inputFilename, data, "utf8");

    const result = childProcess.spawnSync(
      "python3",
      ["operator/create_block.py", "" + stateID, "" + nextBlockIdx, "" + blockType, inputFilename, outputFilename],
      {stdio: "inherit"},
    );
    assert(result.status === 0, "create_block failed: " + blockType);

    return [nextBlockIdx, outputFilename];
  }

  public async commitBlock(operator: Operator, blockType: number, data: string, filename: string) {
    const bitstream = new pjs.Bitstream(data);
    const stateID = bitstream.extractUint32(0);

    // const activeOperator = await this.getActiveOperator(stateID);
    // assert.equal(activeOperator.operatorID, operator.operatorID);
    // console.log("Active operator: " + activeOperator.owner + " " + activeOperator.operatorID);
    const tx = await this.exchange.commitBlock(
      web3.utils.toBN(blockType),
      web3.utils.hexToBytes(data),
      {from: operator.owner},
    );
    // pjs.logInfo("\x1b[46m%s\x1b[0m", "[commitBlock] Gas used: " + tx.receipt.gasUsed);

    const blockIdx = (await this.exchange.getBlockIdx(web3.utils.toBN(stateID))).toNumber();
    const block: Block = {
      blockIdx,
      filename,
      operator,
    };
    this.pendingBlocks[stateID].push(block);
    return block;
  }

  public async verifyBlock(blockIdx: number, blockFilename: string) {
    const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

    const proofFilename = "./blocks/block_" + block.stateID + "_" + blockIdx + "_proof.json";
    const result = childProcess.spawnSync(
      "build/circuit/dex_circuit",
      ["-prove", blockFilename, proofFilename],
      {stdio: "inherit"},
    );
    assert(result.status === 0, "verifyBlock failed: " + blockFilename);

    let verificationKeyFilename = "keys/";
    if (block.blockType === 0) {
      verificationKeyFilename += "trade";
    } else if (block.blockType === 1) {
      verificationKeyFilename += "deposit";
    } else if (block.blockType === 2) {
      verificationKeyFilename += "withdraw_onchain";
    } else if (block.blockType === 3) {
      verificationKeyFilename += "withdraw_offchain";
    } else if (block.blockType === 4) {
      verificationKeyFilename += "cancel";
    }

    verificationKeyFilename += "_" + block.numElements + "_vk.json";

    // Read the verification key and set it in the smart contract
    const vk = JSON.parse(fs.readFileSync(verificationKeyFilename, "ascii"));
    const vkFlattened = this.flattenVK(vk);
    await this.blockVerifier.setVerifyingKey(vkFlattened[0], vkFlattened[1]);

    // Read the proof
    const proof = JSON.parse(fs.readFileSync(proofFilename, "ascii"));
    const proofFlattened = this.flattenProof(proof);
    // console.log(proof);
    // console.log(this.flattenProof(proof));

    const tx = await this.exchange.verifyBlock(
      web3.utils.toBN(block.stateID),
      web3.utils.toBN(blockIdx),
      proofFlattened,
    );
    // pjs.logInfo("\x1b[46m%s\x1b[0m", "[verifyBlock] Gas used: " + tx.receipt.gasUsed);

    return proofFilename;
  }

  public async verifyPendingBlocks(stateID: number) {
    for (const block of this.pendingBlocks[stateID]) {
      await this.verifyBlock(block.blockIdx, block.filename);
    }
    this.pendingBlocks[stateID] = [];
  }

  public getPendingDeposits(stateID: number) {
    const pendingDeposits: Deposit[] = [];
    for (const pendingDeposit of this.pendingDeposits[stateID]) {
      pendingDeposits.push(pendingDeposit);
    }
    return pendingDeposits;
  }

  public async commitDeposits(stateID: number, pendingDeposits?: Deposit[]) {
    const blockInfos: Block[] = [];

    if (pendingDeposits === undefined) {
      pendingDeposits = this.pendingDeposits[stateID];
    }
    if (pendingDeposits.length === 0) {
      return;
    }

    const numDepositsPerBlock = (await this.exchange.NUM_DEPOSITS_IN_BLOCK()).toNumber();
    const numBlocks = Math.floor((pendingDeposits.length + numDepositsPerBlock - 1) / numDepositsPerBlock);
    for (let i = 0; i < numBlocks; i++) {
      const deposits: Deposit[] = [];
      let isFull = true;
      // Get all deposits for the block
      for (let b = i * numDepositsPerBlock; b < (i + 1) * numDepositsPerBlock; b++) {
          if (b < pendingDeposits.length) {
            deposits.push(pendingDeposits[b]);
          } else {
            const dummyDeposit: Deposit = {
              depositBlockIdx: deposits[0].depositBlockIdx,
              accountID: 0,
              secretKey: (await this.exchange.DEFAULT_ACCOUNT_SECRETKEY()).toString(),
              publicKeyX: (await this.exchange.DEFAULT_ACCOUNT_PUBLICKEY_X()).toString(),
              publicKeyY: (await this.exchange.DEFAULT_ACCOUNT_PUBLICKEY_Y()).toString(),
              walletID: 0,
              tokenID: 0,
              amount: new BN(0),
            };
            deposits.push(dummyDeposit);
            isFull = false;
          }
      }
      assert(deposits.length === numDepositsPerBlock);

      let timeToWait = (await this.exchange.MIN_TIME_BLOCK_CLOSED_UNTIL_COMMITTABLE()).toNumber();
      if (!isFull) {
        timeToWait += (await this.exchange.MAX_TIME_BLOCK_OPEN()).toNumber();
      }
      await this.advanceBlockTimestamp(timeToWait);

      // Store state before
      const currentBlockIdx = (await this.exchange.getBlockIdx(web3.utils.toBN(stateID))).toNumber();
      const stateBefore = await this.loadState(stateID, currentBlockIdx);

      const [blockIdx, blockFilename] = await this.createBlock(stateID, 1, JSON.stringify(deposits, replacer, 4));

      // Store state after
      const stateAfter = await this.loadState(stateID, currentBlockIdx + 1);

      // Validate state change
      this.validateDeposits(deposits, stateBefore, stateAfter);

      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));
      const bs = new pjs.Bitstream();
      bs.addNumber(block.stateID, 4);
      bs.addBigNumber(new BigNumber(block.merkleRootBefore, 10), 32);
      bs.addBigNumber(new BigNumber(block.merkleRootAfter, 10), 32);
      bs.addNumber(0, 32);

      // Commit the block
      const operator = await this.getActiveOperator(stateID);
      const blockInfo = await this.commitBlock(operator, 1, bs.getData(), blockFilename);

      blockInfos.push(blockInfo);

      /*for (const deposit of deposits) {
        const balance = await this.getOffchainBalance(stateID, deposit.accountID, deposit.tokenID);
        this.prettyPrintBalance(deposit.accountID, deposit.tokenID, balance);
      }*/
    }

    this.pendingDeposits[stateID] = [];

    return blockInfos;
  }

  public async loadState(stateID: number, blockIdx?: number) {
    // Read in the state
    if (blockIdx === undefined) {
      blockIdx = (await this.exchange.getBlockIdx(web3.utils.toBN(stateID))).toNumber();
    }
    const accounts: {[key: number]: Account} = {};
    if (blockIdx > 0) {
      const stateFile = "states/state_" + stateID + "_" + blockIdx + ".json";
      const jState = JSON.parse(fs.readFileSync(stateFile, "ascii"));

      const accountsKeys: string[] = Object.keys(jState.accounts_values);
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
            };
          }
          balances[Number(balanceKey)] = {
            balance: new BN(jBalance.balance, 10),
            tradeHistory,
          };

          // Make sure all tokens exist
          for (let i = 0; i < 2 ** 12; i++) {
            if (!balances[i]) {
              balances[i] = {
                balance: new BN(0),
                tradeHistory: {},
              };
            }
          }
        }
        const account: Account = {
          accountID: Number(accountKey),
          walletID: jAccount.walletID,
          publicKeyX: jAccount.publicKeyX,
          publicKeyY: jAccount.publicKeyY,
          nonce: jAccount.nonce,
          balances,
        };
        accounts[Number(accountKey)] = account;
      }
    }
    const state: State = {
      accounts,
    };
    return state;
  }

  public async getActiveOperator(stateID: number) {
    const activeOperatorID = (await this.operatorRegistry.getActiveOperatorID(web3.utils.toBN(stateID))).toNumber();
    return this.operators[stateID][activeOperatorID];
  }

  public async getActiveOperators(stateID: number) {
    const activeOperators: Operator[] = [];
    const numActiveOperators = (await this.exchange.getNumActiveOperators(stateID)).toNumber();
    for (let i = 0; i < numActiveOperators; i++) {
      const data = await this.operatorRegistry.getActiveOperatorAt(stateID, web3.utils.toBN(i));
      const activeOperator = this.operators[stateID][data.operatorID.toNumber()];
      assert.equal(activeOperator.owner, data.owner, "Operator owner incorrect");
      activeOperators.push(activeOperator);
    }
    return activeOperators;
  }

  public async commitWithdrawalRequests(onchain: boolean, stateID: number) {
    let pendingWithdrawals: WithdrawalRequest[];
    if (onchain) {
      pendingWithdrawals = this.pendingOnchainWithdrawalRequests[stateID];
    } else {
      pendingWithdrawals = this.pendingOffchainWithdrawalRequests[stateID];
    }
    if (pendingWithdrawals.length === 0) {
      return;
    }

    const blockType = onchain ? 2 : 3;

    const numWithdrawsPerBlock = (await this.exchange.NUM_WITHDRAWALS_IN_BLOCK()).toNumber();
    const numBlocks = Math.floor((pendingWithdrawals.length + numWithdrawsPerBlock - 1) / numWithdrawsPerBlock);
    for (let i = 0; i < numBlocks; i++) {
      const withdrawalRequests: WithdrawalRequest[] = [];
      let isFull = true;
      // Get all withdrawals for the block
      for (let b = i * numWithdrawsPerBlock; b < (i + 1) * numWithdrawsPerBlock; b++) {
        if (b < pendingWithdrawals.length) {
          withdrawalRequests.push(pendingWithdrawals[b]);
        } else {
          const dummyWithdrawalRequest: WithdrawalRequest = {
            accountID: 0,
            tokenID: 0,
            amount: new BN(0),
            dualAuthAccountID: 1,
            feeTokenID: 0,
            fee: new BN(0),
            walletSplitPercentage: 0,
          };
          withdrawalRequests.push(dummyWithdrawalRequest);
          isFull = false;
        }
      }
      assert(withdrawalRequests.length === numWithdrawsPerBlock);

      const operator = await this.getActiveOperator(stateID);
      const withdrawalBlock: WithdrawBlock = {
        withdrawals: withdrawalRequests,
        operatorAccountID: operator.accountID,
      };

      if (onchain) {
        let timeToWait = (await this.exchange.MIN_TIME_BLOCK_CLOSED_UNTIL_COMMITTABLE()).toNumber();
        if (!isFull) {
          timeToWait += (await this.exchange.MAX_TIME_BLOCK_OPEN()).toNumber();
        }
        await this.advanceBlockTimestamp(timeToWait);
      }

      // Store state before
      const currentBlockIdx = (await this.exchange.getBlockIdx(web3.utils.toBN(stateID))).toNumber();
      const stateBefore = await this.loadState(stateID, currentBlockIdx);

      const jWithdrawalsInfo = JSON.stringify(withdrawalBlock, replacer, 4);
      const [blockIdx, blockFilename] = await this.createBlock(stateID, blockType, jWithdrawalsInfo);

      // Store state after
      const stateAfter = await this.loadState(stateID, currentBlockIdx + 1);

      // Validate state change
      this.validateWithdrawals(withdrawalBlock, stateBefore, stateAfter);

      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));
      const bs = new pjs.Bitstream();
      bs.addNumber(block.stateID, 4);
      bs.addBigNumber(new BigNumber(block.merkleRootBefore, 10), 32);
      bs.addBigNumber(new BigNumber(block.merkleRootAfter, 10), 32);
      bs.addNumber(block.operatorAccountID, 3);
      bs.addNumber(0, 32);
      for (const withdrawal of block.withdrawals) {
        bs.addNumber(withdrawal.accountID, 3);
        bs.addNumber(withdrawal.tokenID, 2);
        bs.addBN(web3.utils.toBN(withdrawal.amountWithdrawn), 12);
      }
      if (!onchain) {
        for (const withdrawal of block.withdrawals) {
          bs.addNumber(withdrawal.dualAuthAccountID, 3);
          bs.addNumber(withdrawal.feeTokenID, 2);
          bs.addBN(web3.utils.toBN(withdrawal.fee), 12);
          bs.addNumber(withdrawal.walletSplitPercentage, 1);
        }
      }

      // Commit the block
      await this.commitBlock(operator, blockType, bs.getData(), blockFilename);

      // Add as a pending withdrawal
      let withdrawalIdx = 0;
      for (const withdrawalRequest of block.withdrawals) {
        const withdrawal: Withdrawal = {
          stateID,
          blockIdx,
          withdrawalIdx,
        };
        this.pendingWithdrawals.push(withdrawal);
        withdrawalIdx++;
      }
    }

    if (onchain) {
      this.pendingOnchainWithdrawalRequests[stateID] = [];
    } else {
      this.pendingOffchainWithdrawalRequests[stateID] = [];
    }
  }

  public async commitOffchainWithdrawalRequests(stateID: number) {
    return this.commitWithdrawalRequests(false, stateID);
  }

  public async commitOnchainWithdrawalRequests(stateID: number) {
    return this.commitWithdrawalRequests(true, stateID);
  }

  public async submitPendingWithdrawals(addressBook?: { [id: string]: string; }) {
    for (const withdrawal of this.pendingWithdrawals) {
      const txw = await this.exchange.withdraw(
        web3.utils.toBN(withdrawal.stateID),
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

  public async commitRings(stateID: number) {
    const pendingRings = this.pendingRings[stateID];
    if (pendingRings.length === 0) {
      return;
    }

    // Generate the token transfers for the ring
    const blockNumber = await web3.eth.getBlockNumber();
    const timestamp = (await web3.eth.getBlock(blockNumber)).timestamp + 30;

    const numRingsPerBlock = 2;
    const numBlocks = Math.floor((pendingRings.length + numRingsPerBlock - 1) / numRingsPerBlock);
    for (let i = 0; i < numBlocks; i++) {
      // Get all rings for the block
      const rings: RingInfo[] = [];
      for (let b = i * numRingsPerBlock; b < (i + 1) * numRingsPerBlock; b++) {
        if (b < pendingRings.length) {
          rings.push(pendingRings[b]);
        } else {
          const dummyRing: RingInfo = {
            orderA:
              {
                stateID,
                walletID: 0,
                orderID: 0,
                accountID: 0,
                dualAuthAccountID: 1,

                tokenIdS: 0,
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
            orderB:
              {
                stateID,
                walletID: 0,
                orderID: 0,
                accountID: 0,
                dualAuthAccountID: 1,

                tokenIdS: 0,
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
            minerAccountID: this.minerAccountID[stateID],
            feeRecipientAccountID: this.feeRecipientAccountID[stateID],
            tokenID: 0,
            fee: new BN(0),
          };
          rings.push(dummyRing);
        }
      }
      assert(rings.length === numRingsPerBlock);

      const operator = await this.getActiveOperator(stateID);
      const ringBlock: RingBlock = {
        rings,
        timestamp,
        stateID,
        operatorAccountID: operator.accountID,
      };

      // Store state before
      const currentBlockIdx = (await this.exchange.getBlockIdx(web3.utils.toBN(stateID))).toNumber();
      const stateBefore = await this.loadStateForRingBlock(stateID, currentBlockIdx, ringBlock);

      // Create the block
      const [blockIdx, blockFilename] = await this.createBlock(stateID, 0, JSON.stringify(ringBlock, replacer, 4));

      // Store state after
      const stateAfter = await this.loadStateForRingBlock(stateID, currentBlockIdx + 1, ringBlock);

      // Validate state change
      this.validateRingSettlements(ringBlock, stateBefore, stateAfter);

      // Read in the block
      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

      const bs = new pjs.Bitstream();
      bs.addNumber(stateID, 4);
      bs.addBigNumber(new BigNumber(block.merkleRootBefore, 10), 32);
      bs.addBigNumber(new BigNumber(block.merkleRootAfter, 10), 32);
      bs.addNumber(block.operatorAccountID, 3);
      bs.addNumber(ringBlock.timestamp, 4);
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
          bs.addNumber(order.dualAuthAccountID, 3);
          bs.addNumber(order.tokenS, 2);
          bs.addNumber(order.tokenF, 2);
          bs.addNumber(order.orderID, 2);
          bs.addBN(new BN(index === 0 ? ring.fillS_A : ring.fillS_B, 10), 12);
          bs.addBN(new BN(index === 0 ? ring.fillF_A : ring.fillF_B, 10), 12);
          bs.addNumber(order.walletSplitPercentage, 1);
          bs.addNumber(order.waiveFeePercentage, 1);
          index++;
        }
      }

      // Commit the block
      await this.commitBlock(operator, 0, bs.getData(), blockFilename);
    }

    this.pendingRings[stateID] = [];
  }

  public cancelPendingRings(stateID: number) {
    this.pendingRings[stateID] = [];
  }

  public async commitCancels(stateID: number) {
    const pendingCancels = this.pendingCancels[stateID];
    if (pendingCancels.length === 0) {
      return;
    }

    const numCancelsPerBlock = 8;
    const numBlocks = Math.floor((pendingCancels.length + numCancelsPerBlock - 1) / numCancelsPerBlock);
    for (let i = 0; i < numBlocks; i++) {
      // Get all cancels for the block
      const cancels: Cancel[] = [];
      for (let b = i * numCancelsPerBlock; b < (i + 1) * numCancelsPerBlock; b++) {
        if (b < pendingCancels.length) {
          cancels.push(pendingCancels[b]);
        } else {
          const dummyCancel: Cancel = {
            accountID: 0,
            orderTokenID: 0,
            orderID: 0,
            dualAuthAccountID: 1,
            feeTokenID: 0,
            fee: new BN(0),
            walletSplitPercentage: 0,
          };
          cancels.push(dummyCancel);
        }
      }
      assert(cancels.length === numCancelsPerBlock);

      const operator = await this.getActiveOperator(stateID);
      const cancelBlock: CancelBlock = {
        cancels,
        operatorAccountID: operator.accountID,
      };

      // Create the block
      const [blockIdx, blockFilename] = await this.createBlock(stateID, 4, JSON.stringify(cancelBlock, replacer, 4));

      // Read in the block
      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

      const bs = new pjs.Bitstream();
      bs.addNumber(block.stateID, 4);
      bs.addBigNumber(new BigNumber(block.merkleRootBefore, 10), 32);
      bs.addBigNumber(new BigNumber(block.merkleRootAfter, 10), 32);
      bs.addNumber(block.operatorAccountID, 3);
      for (const cancel of cancels) {
        bs.addNumber(cancel.accountID, 3);
        bs.addNumber(cancel.orderTokenID, 2);
        bs.addNumber(cancel.orderID, 2);
        bs.addNumber(cancel.dualAuthAccountID, 3);
        bs.addNumber(cancel.feeTokenID, 2);
        bs.addBN(cancel.fee, 12);
        bs.addNumber(cancel.walletSplitPercentage, 1);
      }

      // Commit the block
      await this.commitBlock(operator, 4, bs.getData(), blockFilename);
    }

    this.pendingCancels[stateID] = [];
  }

  public async registerTokens() {
    const lrcAddress = this.testContext.tokenSymbolAddrMap.get("LRC");
    const LRC = this.testContext.tokenAddrInstanceMap.get(lrcAddress);

    for (const token of this.testContext.allTokens) {
      const tokenAddress = (token === null) ? this.zeroAddress : token.address;
      const symbol = this.testContext.tokenAddrSymbolMap.get(tokenAddress);
      // console.log(symbol + ": " + tokenAddress);

      if (symbol !== "ETH" && symbol !== "WETH" && symbol !== "LRC") {
        const tokenRegistrationFee = await this.tokenRegistry.getTokenRegistrationFee();
        await LRC.addBalance(this.testContext.orderOwners[0], tokenRegistrationFee);
        await LRC.approve(
          this.tokenRegistry.address,
          tokenRegistrationFee,
          {from: this.testContext.orderOwners[0]},
        );

        const tx = await this.tokenRegistry.registerToken(tokenAddress, {from: this.testContext.orderOwners[0]});
        // pjs.logInfo("\x1b[46m%s\x1b[0m", "[TokenRegistration] Gas used: " + tx.receipt.gasUsed);
      }

      const tokenID = (await this.getTokenID(tokenAddress)).toNumber();
      this.tokenAddressToIDMap.set(tokenAddress, tokenID);
      this.tokenIDToAddressMap.set(tokenID, tokenAddress);
    }
    // console.log(this.tokenIDMap);
  }

  public async getTokenID(tokenAddress: string) {
    const tokenID = await this.tokenRegistry.getTokenID(tokenAddress);
    return tokenID;
  }

  public async createNewState(
      owner: string,
      bSetupTestState: boolean = true,
      numOperators: number = 1,
      depositFeeInETH: BN = new BN(web3.utils.toWei("0.0001", "ether")),
      withdrawFeeInETH: BN = new BN(web3.utils.toWei("0.0001", "ether")),
      maxWithdrawFeeInETH: BN = new BN(web3.utils.toWei("0.001", "ether")),
      closedOperatorRegistering: boolean = false,
    ) {
    // Create the new state
    const tx = await this.exchange.createNewState(
      owner,
      depositFeeInETH,
      withdrawFeeInETH,
      maxWithdrawFeeInETH,
      closedOperatorRegistering);
    // pjs.logInfo("\x1b[46m%s\x1b[0m", "[NewState] Gas used: " + tx.receipt.gasUsed);

    const eventArr: any = await this.getEventsFromContract(this.exchange, "NewState", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.stateID];
    });
    const stateID = items[0][0].toNumber();

    if (bSetupTestState) {
      await this.setupTestState(stateID, numOperators);
    }

    return stateID;
  }

  public async registerWallet(stateID: number, owner: string) {
    // Register a wallet
    const tx = await this.exchange.registerWallet(web3.utils.toBN(stateID), {from: owner});
    // pjs.logInfo("\x1b[46m%s\x1b[0m", "[RegisterWallet] Gas used: " + tx.receipt.gasUsed);

    const eventArr: any = await this.getEventsFromContract(this.exchange, "WalletRegistered", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.walletID];
    });
    const walletID = items[0][0].toNumber();

    return walletID;
  }

  public async registerOperator(stateID: number, owner: string) {
    await this.setBalanceAndApprove(owner, "LRC", this.STAKE_AMOUNT_IN_LRC, this.operatorRegistry.address);

    // Register an operator
    const tx = await this.operatorRegistry.registerOperator(web3.utils.toBN(stateID), {from: owner});
    // pjs.logInfo("\x1b[46m%s\x1b[0m", "[RegisterOperator] Gas used: " + tx.receipt.gasUsed);

    const eventArr: any = await this.getEventsFromContract(
      this.operatorRegistry, "OperatorRegistered", web3.eth.blockNumber,
    );
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.operatorID, eventObj.args.operator];
    });
    const operatorID = items[0][0].toNumber();
    const operator = items[0][1];
    // console.log("operatorID: " + operatorID);
    assert.equal(operator, owner, "Operator owner doesn't match");

    return operatorID;
  }

  public getTokenIdFromNameOrAddress(token: string) {
    if (!token.startsWith("0x")) {
      token = this.testContext.tokenSymbolAddrMap.get(token);
    }
    const tokenID = this.tokenAddressToIDMap.get(token);
    return tokenID;
  }

  public async revertBlock(stateID: number, blockIdx: number) {
    await this.exchange.revertBlock(
      web3.utils.toBN(stateID),
      web3.utils.toBN(blockIdx),
    );
    console.log("[State " + stateID + "] Reverted to block " + (blockIdx - 1));
    this.pendingBlocks[stateID] = [];
  }

  public async withdrawFromMerkleTree(stateID: number, accountID: number, token: string) {
    const tokenID = this.getTokenIdFromNameOrAddress(token);

    const filename = "withdraw_proof.json";
    const result = childProcess.spawnSync("python3",
    ["operator/create_withdraw_proof.py", "" + stateID, "" + accountID, "" + tokenID, filename], {stdio: "inherit"});
    assert(result.status === 0, "create_withdraw_proof failed!");

    // Read in the proof
    const data = JSON.parse(fs.readFileSync(filename, "ascii"));
    // console.log(data);

    await this.exchange.withdrawFromMerkleTree(
      web3.utils.toBN(stateID),
      web3.utils.toBN(accountID),
      web3.utils.toBN(tokenID),
      data.proof.accountProof,
      data.proof.balanceProof,
      web3.utils.toBN(data.proof.account.nonce),
      web3.utils.toBN(data.proof.balance.balance),
      web3.utils.toBN(data.proof.balance.tradingHistoryRoot),
    );
  }

  public async withdrawFromPendingDeposit(stateID: number, depositBlockIdx: number, slotIdx: number) {
    await this.exchange.withdrawFromPendingDeposit(
      web3.utils.toBN(stateID),
      web3.utils.toBN(depositBlockIdx),
      web3.utils.toBN(slotIdx),
    );
  }

  public async setBalanceAndApprove(owner: string, token: string, amount: BN, contractAddress?: string) {
    if (contractAddress === undefined) {
      contractAddress = this.exchange.address;
    }
    const Token = await this.getTokenContract(token);
    await Token.setBalance(owner, amount);
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

  public async getOffchainBalance(stateID: number, accountID: number, tokenID: number) {
    const state = await this.loadState(stateID);
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

  public compareStates(stateA: State, stateB: State) {
    const accountsKeys: string[] = Object.keys(stateA.accounts);
    for (const accountKey of accountsKeys) {
      const accountA = stateA.accounts[Number(accountKey)];
      const accountB = stateB.accounts[Number(accountKey)];

      for (const tokenID of Object.keys(accountA.balances)) {
        const balanceValueA = accountA.balances[Number(tokenID)];
        const balanceValueB = accountB.balances[Number(tokenID)];

        for (const orderID of Object.keys(balanceValueA.tradeHistory)) {
          const tradeHistoryValueA = balanceValueA.tradeHistory[Number(orderID)];
          const tradeHistoryValueB = balanceValueA.tradeHistory[Number(orderID)];

          assert(tradeHistoryValueA.filled.eq(tradeHistoryValueB.filled));
          assert(tradeHistoryValueA.cancelled === tradeHistoryValueB.cancelled);
        }
        assert(balanceValueA.balance.eq(balanceValueB.balance));
      }
      assert.equal(accountA.accountID, accountB.accountID);
      assert.equal(accountA.walletID, accountB.walletID);
      assert.equal(accountA.publicKeyX, accountB.publicKeyX);
      assert.equal(accountA.publicKeyY, accountB.publicKeyY);
      assert.equal(accountA.nonce, accountB.nonce);
    }
  }

  public validateRingSettlements(ringBlock: RingBlock, stateBefore: State, stateAfter: State) {
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
      this.logFilledAmountsRing(ring, latestState, simulatorReport.stateAfter);
      latestState = simulatorReport.stateAfter;
    }

    // Verify resulting state
    this.compareStates(stateAfter, latestState);
    console.log("----------------------------------------------------");
  }

  public validateDeposits(deposits: Deposit[], stateBefore: State, stateAfter: State) {
    console.log("----------------------------------------------------");
    let latestState = stateBefore;
    for (const deposit of deposits) {
      const simulator = new Simulator();
      const simulatorReport = simulator.deposit(deposit, latestState);

      let accountBefore = latestState.accounts[deposit.accountID];
      const accountAfter = simulatorReport.stateAfter.accounts[deposit.accountID];

      let bNewAccount = false;
      if (accountBefore === undefined) {
        const balances: {[key: number]: Balance} = {};
        for (let i = 0; i < 2 ** 12; i++) {
          balances[i] = {
            balance: new BN(0),
            tradeHistory: {},
          };
        }
        const emptyAccount: Account = {
          accountID: deposit.accountID,
          walletID: 0,
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
      if (accountBefore.walletID !== accountAfter.walletID) {
        console.log("walletID: " + accountBefore.walletID + " -> " + accountAfter.walletID);
      }
      if (accountBefore.nonce !== accountAfter.nonce) {
        console.log("nonce: " + accountBefore.nonce + " -> " + accountAfter.nonce);
      }
      for (let i = 0; i < 2 ** 12; i++) {
        if (!accountBefore.balances[i].balance.eq(accountAfter.balances[i].balance)) {
          this.prettyPrintBalanceChange(deposit.accountID, i, accountBefore.balances[i].balance,
                                                              accountAfter.balances[i].balance);
        }
      }

      latestState = simulatorReport.stateAfter;
    }

    // Verify resulting state
    this.compareStates(stateAfter, latestState);
    console.log("----------------------------------------------------");
  }

  public validateWithdrawals(withdrawBlock: WithdrawBlock, stateBefore: State, stateAfter: State) {
    console.log("----------------------------------------------------");
    /*const operatorAccountID = withdrawBlock.operatorAccountID;
    let latestState = stateBefore;
    for (const withdrawal of withdrawBlock.withdrawals) {
      const simulator = new Simulator();
      const simulatorReport = simulator.withdraw(withdrawBlock, latestState);

      let accountBefore = latestState.accounts[withdrawal.accountID];
      const accountAfter = simulatorReport.stateAfter.accounts[withdrawal.accountID];

      this.prettyPrintBalanceChange(
        withdrawal.accountID, withdrawal.tokenID,
        accountBefore.balances[i].balance,
        accountAfter.balances[i].balance,
      );

      latestState = simulatorReport.stateAfter;
    }

    // Verify resulting state
    this.compareStates(stateAfter, latestState);*/
    console.log("----------------------------------------------------");
  }

  public async loadStateForRingBlock(stateID: number, blockIdx: number, ringBlock: RingBlock) {
    const state = await this.loadState(stateID, blockIdx);
    const orders: OrderInfo[] = [];
    for (const ring of ringBlock.rings) {
      orders.push(ring.orderA);
      orders.push(ring.orderB);
    }
    for (const order of orders) {
      // Make sure the trading history for the orders exists
      if (!state.accounts[order.accountID].balances[order.tokenIdS].tradeHistory[order.orderID]) {
        state.accounts[order.accountID].balances[order.tokenIdS].tradeHistory[order.orderID] = {
          filled: new BN(0),
          cancelled: false,
        };
      }
    }
    return state;
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
    const [exchange, tokenRegistry, operatorRegistry, blockVerifier, lrcToken] = await Promise.all([
        this.contracts.Exchange.deployed(),
        this.contracts.TokenRegistry.deployed(),
        this.contracts.OperatorRegistry.deployed(),
        this.contracts.BlockVerifier.deployed(),
        this.contracts.LRCToken.deployed(),
      ]);

    this.exchange = exchange;
    this.tokenRegistry = tokenRegistry;
    this.operatorRegistry = operatorRegistry;
    this.blockVerifier = blockVerifier;

    const currBlockNumber = await web3.eth.getBlockNumber();
    const currBlockTimestamp = (await web3.eth.getBlock(currBlockNumber)).timestamp;
    return new Context(currBlockNumber,
                       currBlockTimestamp,
                       this.contracts.LRCToken.address);
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

  private logFilledAmountsRing(ring: RingInfo, stateBefore: State, stateAfter: State) {
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
    const before = accountBefore.balances[order.tokenIdS].tradeHistory[order.orderID];
    const after = accountAfter.balances[order.tokenIdS].tradeHistory[order.orderID];
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

}
