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
import { Account, Balance, Block, Cancel, CancelBlock, Deposit, DepositBlock, DepositInfo, DetailedTokenTransfer,
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

  public loopringV3: any;
  public exchangeDeployer: any;
  public blockVerifier: any;
  public exchangeHelper: any;

  public lrcAddress: string;
  public wethAddress: string;

  public exchange: any;

  public minerAccountID: number[] = [];
  public feeRecipientAccountID: number[] = [];

  public operators: Operator[] = [];
  public wallets: Wallet[][] = [];

  public MAX_PROOF_GENERATION_TIME_IN_SECONDS: number;
  public MAX_AGE_REQUEST_UNTIL_WITHDRAWMODE: number;
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

  private dualAuthKeyPair: any;

  public async initialize(accounts: string[]) {
    this.context = await this.createContractContext();
    this.testContext = await this.createExchangeTestContext(accounts);

    this.dualAuthKeyPair = this.getKeyPairEDDSA();

    // Initialize Loopring
    await this.loopringV3.updateSettings(
      this.lrcAddress,
      this.wethAddress,
      this.exchangeDeployer.address,
      this.exchangeHelper.address,
      this.blockVerifier.address,
      new BN(web3.utils.toWei("1000", "ether")),
      new BN(0),
      new BN(web3.utils.toWei("0.02", "ether")),
      {from: this.testContext.deployer},
    );

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

      const wallets: Wallet[] = [];
      this.wallets.push(wallets);

      const pendingBlocks: Block[] = [];
      this.pendingBlocks.push(pendingBlocks);
    }

    await this.createExchange(
      this.testContext.deployer,
      true,
      new BN(web3.utils.toWei("0.001", "ether")),
      new BN(web3.utils.toWei("0.001", "ether")),
    );

    this.MAX_PROOF_GENERATION_TIME_IN_SECONDS = (await this.exchange.MAX_PROOF_GENERATION_TIME_IN_SECONDS()).toNumber();
    this.MAX_AGE_REQUEST_UNTIL_WITHDRAWMODE = (await this.exchange.MAX_AGE_REQUEST_UNTIL_WITHDRAWMODE()).toNumber();
    this.STAKE_AMOUNT_IN_LRC = new BN(0);
    this.MIN_TIME_UNTIL_OPERATOR_CAN_WITHDRAW = 0;
  }

  public async setupTestState(realmID: number) {
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
                                           this.zeroAddress, new BN(0));

    const operator: Operator = {
      owner,
      accountID: depositInfo.accountID,
    };
    return operator;
  }

  public async createWallet(realmID: number, owner: string) {
    // Make a dual author account for the wallet
    const keyPair = this.getKeyPairEDDSA();
    const walletDeposit = await this.deposit(realmID, owner,
                                             keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
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
                                                   "0", "0", "0",
                                                   lrcAddress, new BN(0));

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
    if (balanceF.gt(0)) {
      await this.deposit(order.realmID, order.owner,
                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                         order.tokenF, balanceF, order.accountID);
    }

    const balanceB = (order.balanceB !== undefined) ? order.balanceB : new BN(0);
    if (balanceB.gt(0)) {
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
    const tokenID = this.tokenAddressToIDMap.get(token);

    let numAvailableSlots = (await this.exchange.getNumAvailableDepositSlots()).toNumber();
    // console.log("numAvailableSlots: " + numAvailableSlots);
    if (numAvailableSlots === 0) {
        const timeToWait = (await this.exchange.MIN_TIME_BLOCK_OPEN()).toNumber();
        await this.advanceBlockTimestamp(timeToWait);
        numAvailableSlots = (await this.exchange.getNumAvailableDepositSlots()).toNumber();
        assert(numAvailableSlots > 0, "numAvailableSlots > 0");
        // console.log("numAvailableSlots: " + numAvailableSlots);
    }

    const depositFee = await this.exchange.getDepositFee();

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
      const tx = await this.exchange.updateAccount(
        new BN(publicKeyX),
        new BN(publicKeyY),
        token,
        web3.utils.toBN(amount),
        {from: owner, value: ethToSend},
      );
      // pjs.logInfo("\x1b[46m%s\x1b[0m", "[Deposit] Gas used: " + tx.receipt.gasUsed);
    } else {
      const tx = await this.exchange.createAccount(
        new BN(publicKeyX),
        new BN(publicKeyY),
        token,
        web3.utils.toBN(amount),
        {from: owner, value: ethToSend},
      );
      // pjs.logInfo("\x1b[46m%s\x1b[0m", "[DepositAndCreate] Gas used: " + tx.receipt.gasUsed);
    }

    const eventArr: any = await this.getEventsFromContract(this.exchange, "Deposit", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.accountID, eventObj.args.depositIdx];
    });

    const depositInfo: DepositInfo = {
      accountID: items[0][0].toNumber(),
      depositBlockIdx: items[0][1].toNumber(),
      slotIdx: 0,
    };

    this.addDeposit(this.pendingDeposits[realmID], depositInfo.depositBlockIdx, depositInfo.accountID,
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

    let numAvailableSlots = (await this.exchange.getNumAvailableWithdrawSlots()).toNumber();
    // console.log("numAvailableSlots: " + numAvailableSlots);
    if (numAvailableSlots === 0) {
        const timeToWait = (await this.exchange.MIN_TIME_BLOCK_OPEN()).toNumber();
        await this.advanceBlockTimestamp(timeToWait);
        numAvailableSlots = (await this.exchange.getNumAvailableWithdrawSlots()).toNumber();
        // console.log("numAvailableSlots: " + numAvailableSlots);
        assert(numAvailableSlots > 0, "numAvailableSlots > 0");
    }

    const withdrawFee = await this.exchange.getWithdrawFee();

    // Submit the withdraw request
    const tx = await this.exchange.withdraw(
      token,
      web3.utils.toBN(amount),
      {from: owner, value: withdrawFee},
    );
    pjs.logInfo("\x1b[46m%s\x1b[0m", "[WithdrawRequest] Gas used: " + tx.receipt.gasUsed);

    const eventArr: any = await this.getEventsFromContract(this.exchange, "WithdrawRequest", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.requestIdx];
    });
    const withdrawBlockIdx = items[0][0].toNumber();
    const slotIdx = 0;

    this.addWithdrawalRequest(this.pendingOnchainWithdrawalRequests[realmID],
                              accountID, tokenID, amount, 0, tokenID, new BN(0), 0, withdrawBlockIdx, slotIdx);
    return this.pendingOnchainWithdrawalRequests[realmID][this.pendingOnchainWithdrawalRequests[realmID].length - 1];
  }

  public addDeposit(deposits: Deposit[], depositBlockIdx: number, accountID: number,
                    secretKey: string, publicKeyX: string, publicKeyY: string,
                    tokenID: number, amount: BN) {
    deposits.push({accountID, depositBlockIdx, secretKey, publicKeyX, publicKeyY, tokenID, amount});
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
                              withdrawBlockIdx?: number, slotIdx?: number) {
    withdrawalRequests.push({accountID, tokenID, amount, walletAccountID,
                             feeTokenID, fee, walletSplitPercentage, withdrawBlockIdx, slotIdx});
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
    const nextBlockIdx = (await this.exchange.getBlockIdx()).toNumber() + 1;
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

  public async commitBlock(operator: Operator, blockType: number, data: string, filename: string) {
    const bitstream = new pjs.Bitstream(data);
    const realmID = bitstream.extractUint32(0);

    // const activeOperator = await this.getActiveOperator(realmID);
    // assert.equal(activeOperator.operatorID, operator.operatorID);
    // console.log("Active operator: " + activeOperator.owner + " " + activeOperator.operatorID);
    const tx = await this.exchange.commitBlock(
      web3.utils.toBN(blockType),
      web3.utils.hexToBytes(data),
      {from: operator.owner},
    );
    // pjs.logInfo("\x1b[46m%s\x1b[0m", "[commitBlock] Gas used: " + tx.receipt.gasUsed);

    const blockIdx = (await this.exchange.getBlockIdx()).toNumber();
    const block: Block = {
      blockIdx,
      filename,
      operator,
    };
    this.pendingBlocks[realmID].push(block);
    return block;
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
      web3.utils.toBN(blockIdx),
      proofFlattened,
    );
    // pjs.logInfo("\x1b[46m%s\x1b[0m", "[verifyBlock] Gas used: " + tx.receipt.gasUsed);

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

    const numDepositsPerBlock = (await this.exchange.NUM_DEPOSITS_IN_BLOCK()).toNumber();
    const numBlocks = Math.floor((pendingDeposits.length + numDepositsPerBlock - 1) / numDepositsPerBlock);
    for (let i = 0; i < numBlocks; i++) {
      const deposits: Deposit[] = [];
      let isFull = true;
      let numRequestsProcessed = 0;

      // Get all deposits for the block
      for (let b = i * numDepositsPerBlock; b < (i + 1) * numDepositsPerBlock; b++) {
          if (b < pendingDeposits.length) {
            deposits.push(pendingDeposits[b]);
            numRequestsProcessed++;
          } else {
            const dummyDeposit: Deposit = {
              depositBlockIdx: deposits[0].depositBlockIdx,
              accountID: 0,
              secretKey: (await this.exchange.DEFAULT_ACCOUNT_SECRETKEY()).toString(),
              publicKeyX: (await this.exchange.DEFAULT_ACCOUNT_PUBLICKEY_X()).toString(),
              publicKeyY: (await this.exchange.DEFAULT_ACCOUNT_PUBLICKEY_Y()).toString(),
              tokenID: 0,
              amount: new BN(0),
            };
            deposits.push(dummyDeposit);
            isFull = false;
          }
      }
      assert(deposits.length === numDepositsPerBlock);

      const startIndex = (await this.exchange.getLastUnprocessedDepositRequestIndex()).toNumber();
      // console.log("startIndex: " + startIndex);
      // console.log("numRequestsProcessed: " + numRequestsProcessed);
      const requestData = await this.exchange.getDepositRequestInfo(startIndex - 1);
      // console.log(requestData);

      const depositBlock: DepositBlock = {
        startHash: new BN(requestData.accumulatedHash.slice(2), 16),
        deposits,
        startIndex,
        count: numRequestsProcessed,
      };

      // Store state before
      const currentBlockIdx = (await this.exchange.getBlockIdx()).toNumber();
      const stateBefore = await this.loadRealm(realmID, currentBlockIdx);

      const [blockIdx, blockFilename] = await this.createBlock(realmID, 1, JSON.stringify(depositBlock, replacer, 4));

      // Store state after
      const stateAfter = await this.loadRealm(realmID, currentBlockIdx + 1);

      // Validate state change
      // this.validateDeposits(deposits, stateBefore, stateAfter);

      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));
      const bs = new pjs.Bitstream();
      bs.addNumber(block.realmID, 4);
      bs.addBigNumber(new BigNumber(block.merkleRootBefore, 10), 32);
      bs.addBigNumber(new BigNumber(block.merkleRootAfter, 10), 32);
      bs.addNumber(0, 32);
      bs.addNumber(0, 32);
      bs.addNumber(startIndex, 4);
      bs.addNumber(numRequestsProcessed, 4);

      // Commit the block
      const operator = await this.getActiveOperator(realmID);
      const blockInfo = await this.commitBlock(operator, 1, bs.getData(), blockFilename);

      blockInfos.push(blockInfo);
    }

    this.pendingDeposits[realmID] = [];

    return blockInfos;
  }

  public async loadRealm(realmID: number, blockIdx?: number) {
    // Read in the state
    if (blockIdx === undefined) {
      blockIdx = (await this.exchange.getBlockIdx()).toNumber();
    }
    const accounts: {[key: number]: Account} = {};
    if (blockIdx > 0) {
      const stateFile = "states/state_" + realmID + "_" + blockIdx + ".json";
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
          publicKeyX: jAccount.publicKeyX,
          publicKeyY: jAccount.publicKeyY,
          nonce: jAccount.nonce,
          balances,
        };
        accounts[Number(accountKey)] = account;
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

  public async commitWithdrawalRequests(onchain: boolean, realmID: number) {
    let pendingWithdrawals: WithdrawalRequest[];
    if (onchain) {
      pendingWithdrawals = this.pendingOnchainWithdrawalRequests[realmID];
    } else {
      pendingWithdrawals = this.pendingOffchainWithdrawalRequests[realmID];
    }
    if (pendingWithdrawals.length === 0) {
      return;
    }

    const blockType = onchain ? 2 : 3;

    const numWithdrawsPerBlock = (await this.exchange.NUM_WITHDRAWALS_IN_BLOCK()).toNumber();
    const numBlocks = Math.floor((pendingWithdrawals.length + numWithdrawsPerBlock - 1) / numWithdrawsPerBlock);
    for (let i = 0; i < numBlocks; i++) {
      const withdrawalRequests: WithdrawalRequest[] = [];
      let numRequestsProcessed = 0;
      // Get all withdrawals for the block
      for (let b = i * numWithdrawsPerBlock; b < (i + 1) * numWithdrawsPerBlock; b++) {
        if (b < pendingWithdrawals.length) {
          withdrawalRequests.push(pendingWithdrawals[b]);
          numRequestsProcessed++;
        } else {
          const dummyWithdrawalRequest: WithdrawalRequest = {
            accountID: 0,
            tokenID: 0,
            amount: new BN(0),
            walletAccountID: 1,
            feeTokenID: 0,
            fee: new BN(0),
            walletSplitPercentage: 0,
          };
          withdrawalRequests.push(dummyWithdrawalRequest);
        }
      }
      assert(withdrawalRequests.length === numWithdrawsPerBlock);

      const startIndex = (await this.exchange.getLastUnprocessedWithdrawRequestIndex()).toNumber();
      // console.log("startIndex: " + startIndex);
      // console.log("numRequestsProcessed: " + numRequestsProcessed);
      const requestData = await this.exchange.getWithdrawRequestInfo(startIndex - 1);
      // console.log(requestData);

      const operator = await this.getActiveOperator(realmID);
      const withdrawalBlock: WithdrawBlock = {
        withdrawals: withdrawalRequests,
        operatorAccountID: operator.accountID,
        startHash: onchain ? new BN(requestData.accumulatedHash.slice(2), 16) : new BN(0),
        startIndex: onchain ? startIndex : 0,
        count: onchain ? numRequestsProcessed : 0,
      };

      // Store state before
      const currentBlockIdx = (await this.exchange.getBlockIdx()).toNumber();
      const stateBefore = await this.loadRealm(realmID, currentBlockIdx);

      const jWithdrawalsInfo = JSON.stringify(withdrawalBlock, replacer, 4);
      const [blockIdx, blockFilename] = await this.createBlock(realmID, blockType, jWithdrawalsInfo);

      // Store state after
      const stateAfter = await this.loadRealm(realmID, currentBlockIdx + 1);

      // Validate state change
      this.validateWithdrawals(withdrawalBlock, stateBefore, stateAfter);

      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));
      const bs = new pjs.Bitstream();
      bs.addNumber(block.realmID, 4);
      bs.addBigNumber(new BigNumber(block.merkleRootBefore, 10), 32);
      bs.addBigNumber(new BigNumber(block.merkleRootAfter, 10), 32);
      bs.addNumber(block.operatorAccountID, 3);
      bs.addNumber(0, 32);
      bs.addNumber(0, 32);
      bs.addNumber(startIndex, 4);
      bs.addNumber(numRequestsProcessed, 4);
      for (const withdrawal of block.withdrawals) {
        bs.addNumber(withdrawal.accountID, 3);
        bs.addNumber(withdrawal.tokenID, 2);
        bs.addBN(web3.utils.toBN(withdrawal.amountWithdrawn), 12);
      }
      if (!onchain) {
        for (const withdrawal of block.withdrawals) {
          bs.addNumber(withdrawal.walletAccountID, 3);
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
                realmID,
                orderID: 0,
                accountID: 0,
                walletAccountID: 0,

                dualAuthPublicKeyX: this.dualAuthKeyPair.publicKeyX,
                dualAuthPublicKeyY: this.dualAuthKeyPair.publicKeyY,
                dualAuthSecretKey: this.dualAuthKeyPair.secretKey,

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
                realmID,
                orderID: 0,
                accountID: 0,
                walletAccountID: 0,

                dualAuthPublicKeyX: this.dualAuthKeyPair.publicKeyX,
                dualAuthPublicKeyY: this.dualAuthKeyPair.publicKeyY,
                dualAuthSecretKey: this.dualAuthKeyPair.secretKey,

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
            minerAccountID: this.minerAccountID[realmID],
            feeRecipientAccountID: this.feeRecipientAccountID[realmID],
            tokenID: 0,
            fee: new BN(0),
          };
          rings.push(dummyRing);
        }
      }
      assert(rings.length === numRingsPerBlock);

      const operator = await this.getActiveOperator(realmID);
      const ringBlock: RingBlock = {
        rings,
        timestamp,
        realmID,
        operatorAccountID: operator.accountID,
      };

      // Store state before
      const currentBlockIdx = (await this.exchange.getBlockIdx()).toNumber();
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
          bs.addNumber(order.walletAccountID, 3);
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
            walletAccountID: 1,
            feeTokenID: 0,
            fee: new BN(0),
            walletSplitPercentage: 0,
          };
          cancels.push(dummyCancel);
        }
      }
      assert(cancels.length === numCancelsPerBlock);

      const operator = await this.getActiveOperator(realmID);
      const cancelBlock: CancelBlock = {
        cancels,
        operatorAccountID: operator.accountID,
      };

      // Create the block
      const [blockIdx, blockFilename] = await this.createBlock(realmID, 4, JSON.stringify(cancelBlock, replacer, 4));

      // Read in the block
      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

      const bs = new pjs.Bitstream();
      bs.addNumber(block.realmID, 4);
      bs.addBigNumber(new BigNumber(block.merkleRootBefore, 10), 32);
      bs.addBigNumber(new BigNumber(block.merkleRootAfter, 10), 32);
      bs.addNumber(block.operatorAccountID, 3);
      for (const cancel of cancels) {
        bs.addNumber(cancel.accountID, 3);
        bs.addNumber(cancel.orderTokenID, 2);
        bs.addNumber(cancel.orderID, 2);
        bs.addNumber(cancel.walletAccountID, 3);
        bs.addNumber(cancel.feeTokenID, 2);
        bs.addBN(cancel.fee, 12);
        bs.addNumber(cancel.walletSplitPercentage, 1);
      }

      // Commit the block
      await this.commitBlock(operator, 4, bs.getData(), blockFilename);
    }

    this.pendingCancels[realmID] = [];
  }

  public async registerTokens() {
    const lrcAddress = this.testContext.tokenSymbolAddrMap.get("LRC");
    const LRC = this.testContext.tokenAddrInstanceMap.get(lrcAddress);

    for (const token of this.testContext.allTokens) {
      const tokenAddress = (token === null) ? this.zeroAddress : token.address;
      const symbol = this.testContext.tokenAddrSymbolMap.get(tokenAddress);
      // console.log(symbol + ": " + tokenAddress);

      if (symbol !== "ETH" && symbol !== "WETH" && symbol !== "LRC") {
        const tx = await this.exchange.registerToken(tokenAddress, {from: this.testContext.orderOwners[0]});
        // pjs.logInfo("\x1b[46m%s\x1b[0m", "[TokenRegistration] Gas used: " + tx.receipt.gasUsed);
      }

      const tokenID = (await this.getTokenID(tokenAddress)).toNumber();
      this.tokenAddressToIDMap.set(tokenAddress, tokenID);
      this.tokenIDToAddressMap.set(tokenID, tokenAddress);
    }
    // console.log(this.tokenIDMap);
  }

  public async getTokenID(tokenAddress: string) {
    const tokenID = await this.exchange.getTokenID(tokenAddress);
    return tokenID;
  }

  public async getAccountID(owner: string) {
    try {
      return await this.exchange.getAccountID(owner);
    } catch {
      return undefined;
    }
  }

  public async createExchange(
      owner: string,
      bSetupTestState: boolean = true,
      depositFeeInETH: BN = new BN(web3.utils.toWei("0.0001", "ether")),
      withdrawFeeInETH: BN = new BN(web3.utils.toWei("0.0001", "ether")),
    ) {

    const exchangeCreationCostLRC = await this.loopringV3.exchangeCreationCostLRC();

    // Send enough tokens to the owner so the Exchange can be created
    const lrcAddress = this.testContext.tokenSymbolAddrMap.get("LRC");
    const LRC = this.testContext.tokenAddrInstanceMap.get(lrcAddress);
    await LRC.addBalance(owner, exchangeCreationCostLRC);
    await LRC.approve(this.loopringV3.address, exchangeCreationCostLRC, {from: owner});

    // Create the new exchange
    const tx = await this.loopringV3.createExchange(owner, {from: owner});
    pjs.logInfo("\x1b[46m%s\x1b[0m", "[CreateExchange] Gas used: " + tx.receipt.gasUsed);

    const eventArr: any = await this.getEventsFromContract(this.loopringV3, "ExchangeCreated", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.exchangeAddress];
    });
    const exchangeAddress = items[0][0];
    const realmID = 1;

    this.exchange = await this.contracts.Exchange.at(exchangeAddress);

    await this.registerTokens();

    await this.exchange.setFees(depositFeeInETH, withdrawFeeInETH);

    if (bSetupTestState) {
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

  public async revertBlock(realmID: number, blockIdx: number) {
    await this.exchange.revertBlock(
      web3.utils.toBN(realmID),
      web3.utils.toBN(blockIdx),
    );
    console.log("[State " + realmID + "] Reverted to block " + (blockIdx - 1));
    this.pendingBlocks[realmID] = [];
  }

  public async withdrawFromMerkleTree(owner: string, token: string) {
    const accountID = await this.getAccountID(owner);
    const tokenID = this.getTokenIdFromNameOrAddress(token);

    const realmID = 1;

    const blockIdx = (await this.exchange.getBlockIdx()).toNumber();
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
      data.proof.accountProof,
      data.proof.balanceProof,
      web3.utils.toBN(data.proof.account.nonce),
      web3.utils.toBN(data.proof.balance.balance),
      web3.utils.toBN(data.proof.balance.tradingHistoryRoot),
    );
    pjs.logInfo("\x1b[46m%s\x1b[0m", "[WithdrawFromMerkleTree] Gas used: " + tx.receipt.gasUsed);
  }

  public async withdrawFromPendingDeposit(realmID: number, depositBlockIdx: number, slotIdx: number) {
    await this.exchange.withdrawFromPendingDeposit(
      web3.utils.toBN(realmID),
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

  public compareStates(stateA: Realm, stateB: Realm) {
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
      assert.equal(accountA.publicKeyX, accountB.publicKeyX);
      assert.equal(accountA.publicKeyY, accountB.publicKeyY);
      assert.equal(accountA.nonce, accountB.nonce);
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
        for (let i = 0; i < 2 ** 12; i++) {
          balances[i] = {
            balance: new BN(0),
            tradeHistory: {},
          };
        }
        const emptyAccount: Account = {
          accountID: deposit.accountID,
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
      for (let i = 0; i < 2 ** 12; i++) {
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

  public validateWithdrawals(withdrawBlock: WithdrawBlock, stateBefore: Realm, stateAfter: Realm) {
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

  public async loadRealmForRingBlock(realmID: number, blockIdx: number, ringBlock: RingBlock) {
    const state = await this.loadRealm(realmID, blockIdx);
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
    const [loopringV3, exchangeDeployer, exchangeHelper, blockVerifier, lrcToken, wethToken] = await Promise.all([
        this.contracts.LoopringV3.deployed(),
        this.contracts.ExchangeDeployer.deployed(),
        this.contracts.ExchangeHelper.deployed(),
        this.contracts.BlockVerifier.deployed(),
        this.contracts.LRCToken.deployed(),
        this.contracts.WETHToken.deployed(),
      ]);

    this.loopringV3 = loopringV3;
    this.exchangeDeployer = exchangeDeployer;
    this.exchangeHelper = exchangeHelper;
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
