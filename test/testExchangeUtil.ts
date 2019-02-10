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
import { ExchangeTestContext } from "./testExchangeContext";
import { Block, Deposit, OrderInfo, RingInfo, RingsInfo, Withdrawal } from "./types";

export class ExchangeTestUtil {
  public context: Context;
  public testContext: ExchangeTestContext;
  public exchange: any;

  private contracts = new Artifacts(artifacts);

  private tokenIDMap = new Map<string, number>();

  private pendingDeposits: Deposit[] = [];
  private pendingWithdrawals: Withdrawal[] = [];

  private pendingBlocks: Block[] = [];

  private zeroAddress = "0x" + "00".repeat(20);

  public async initialize(accounts: string[]) {
    this.context = await this.createContractContext();
    this.testContext = await this.createExchangeTestContext(accounts);
    await this.cleanTradeHistory();
    await this.registerTokens();

    this.deposit(
      this.zeroAddress,
      (await this.exchange.DEFAULT_ACCOUNT_SECRETKEY()).toString(),
      (await this.exchange.DEFAULT_ACCOUNT_PUBLICKEY_X()).toString(),
      (await this.exchange.DEFAULT_ACCOUNT_PUBLICKEY_Y()).toString(),
      0,
      this.zeroAddress,
      0,
    );
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

  public async setupRings(ringsInfo: RingsInfo) {

    const lrcAddress = this.testContext.tokenSymbolAddrMap.get("LRC");
    const LRC = this.testContext.tokenAddrInstanceMap.get(lrcAddress);

    // Make an account for the operator
    const keyPairO = this.getKeyPairEDDSA();
    const operator = await this.deposit(this.testContext.miner,
                                        keyPairO.secretKey, keyPairO.publicKeyX, keyPairO.publicKeyY,
                                        0, lrcAddress, 0);
    ringsInfo.operator = operator;

    // Make an account for the ringmatcher
    const keyPairM = this.getKeyPairEDDSA();
    await LRC.addBalance(this.testContext.miner, web3.utils.toBN(new BigNumber(10000)));
    const miner = await this.deposit(this.testContext.miner,
                                     keyPairM.secretKey, keyPairM.publicKeyX, keyPairM.publicKeyY,
                                     0, lrcAddress, 10000);

    for (const [i, ring] of ringsInfo.rings.entries()) {
      ring.miner = miner;
      ring.fee = ring.fee ? ring.fee : 1;
      await this.setupOrder(ring.orderA, i);
      await this.setupOrder(ring.orderB, i);
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

    order.wallet = order.wallet ? order.wallet : this.testContext.wallets[0];

    // Fill in defaults (default, so these will not get serialized)
    order.version = 0;
    order.validUntil = order.validUntil ? order.validUntil : 0;
    order.tokenF = order.tokenF ? order.tokenF : this.context.lrcAddress;
    order.amountF = order.amountF ? order.amountF : 0;

    order.allOrNone = order.allOrNone ? order.allOrNone : false;
    order.walletSplitPercentage = order.walletSplitPercentage ? order.walletSplitPercentage : 50;

    order.waiveFeePercentage = order.waiveFeePercentage ? order.waiveFeePercentage : 50;

    order.walletID = order.walletID ? order.walletID : 0;
    order.orderID = order.orderID ? order.orderID : order.index;

    order.tokenIdS = this.tokenIDMap.get(order.tokenS);
    order.tokenIdB = this.tokenIDMap.get(order.tokenB);
    order.tokenIdF = this.tokenIDMap.get(order.tokenF);

    // setup initial balances:
    await this.setOrderBalances(order);
  }

  public async setOrderBalances(order: OrderInfo) {
    const keyPair = this.getKeyPairEDDSA();

    const tokenS = this.testContext.tokenAddrInstanceMap.get(order.tokenS);
    const balanceS = (order.balanceS !== undefined) ? order.balanceS : order.amountS;
    await tokenS.setBalance(order.owner, web3.utils.toBN(new BigNumber(balanceS)));
    order.accountS = await this.deposit(order.owner, keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                        order.walletID, order.tokenS, balanceS);

    const balanceF = (order.balanceF !== undefined) ? order.balanceF : order.amountF;
    if (order.tokenF === order.tokenS) {
      tokenS.addBalance(order.owner, web3.utils.toBN(new BigNumber(balanceF)));
    } else {
      const tokenF = this.testContext.tokenAddrInstanceMap.get(order.tokenF);
      await tokenF.setBalance(order.owner, web3.utils.toBN(new BigNumber(balanceF)));
      order.accountF = await this.deposit(order.owner, keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                          order.walletID, order.tokenF, balanceF);
    }

    const balanceB = (order.balanceB !== undefined) ? order.balanceB : 0;
    if (order.balanceB) {
      const tokenB = this.testContext.tokenAddrInstanceMap.get(order.tokenB);
      await tokenB.setBalance(order.owner, web3.utils.toBN(new BigNumber(order.balanceB)));
    }
    order.accountB = await this.deposit(order.owner, keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                        order.walletID, order.tokenB, balanceB);

    // Make an account for the wallet
    const keyPairW = this.getKeyPairEDDSA();
    order.walletF = await this.deposit(order.wallet, keyPairW.secretKey, keyPairW.publicKeyX, keyPairW.publicKeyY,
                                       order.walletID, order.tokenF, 0);

    // Make accounts for the miner (margin + fee)
    const keyPairM = this.getKeyPairEDDSA();
    order.minerS = await this.deposit(this.testContext.miner,
                                      keyPairM.secretKey, keyPairM.publicKeyX, keyPairM.publicKeyY,
                                      0, order.tokenS, 0);
    order.minerF = await this.deposit(this.testContext.miner,
                                      keyPairM.secretKey, keyPairM.publicKeyX, keyPairM.publicKeyY,
                                      0, order.tokenF, 0);
  }

  public getAddressBook(ringsInfo: RingsInfo) {
    const addAddress = (addrBook: { [id: string]: any; }, address: string, name: string) => {
      addrBook[address] = (addrBook[address] ? addrBook[address] + "=" : "") + name;
    };

    const addressBook: { [id: string]: string; } = {};
    for (const ring of ringsInfo.rings) {
      const orders = [ring.orderA, ring.orderB];
      for (const [i, order] of orders.entries()) {
        addAddress(addressBook, order.owner, "Owner[" + i + "]");
        if (order.owner !== order.tokenRecipient) {
          addAddress(addressBook, order.tokenRecipient, "TokenRecipient[" + i + "]");
        }
        addAddress(addressBook, order.walletAddr, "Wallet[" + i + "]");
        // addAddress(addressBook, order.hash.toString("hex"), "Hash[" + i + "]");
      }
    }
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

  public async deposit(owner: string, secretKey: string, publicKeyX: string, publicKeyY: string,
                       walletID: number, token: string, amount: number) {
    let numAvailableSlots = (await this.exchange.getNumAvailableDepositSlots()).toNumber();
    console.log("Open slots: " + numAvailableSlots);
    if (numAvailableSlots === 0) {
        const timeToWait = (await this.exchange.MIN_TIME_OPEN_DEPOSIT_BLOCK()).toNumber();
        console.log(timeToWait);
        await this.advanceBlockTimestamp(timeToWait);

        numAvailableSlots = (await this.exchange.getNumAvailableDepositSlots()).toNumber();
        console.log("Open slots after: " + numAvailableSlots);
        assert(numAvailableSlots > 0, "numAvailableSlots > 0");
    }

    const txOrigin = (owner === this.zeroAddress) ? this.testContext.orderOwners[0] : owner;

    if (amount > 0) {
      const Token = this.testContext.tokenAddrInstanceMap.get(token);
      await Token.approve(
        this.exchange.address,
        web3.utils.toBN(new BigNumber(amount)),
        {from: txOrigin},
      );
    }

    // Submit the deposits
    const depositFee = await this.exchange.DEPOSIT_FEE_IN_ETH();
    const tx = await this.exchange.deposit(
      new BN(0xFFFFFF),
      owner,
      new BN(publicKeyX),
      new BN(publicKeyY),
      web3.utils.toBN(walletID),
      token,
      web3.utils.toBN(amount),
      {from: txOrigin, value: depositFee},
    );
    pjs.logInfo("\x1b[46m%s\x1b[0m", "[Deposit] Gas used: " + tx.receipt.gasUsed);

    /*const depositHash = await this.exchange.getDepositHash(web3.utils.toBN(0));
    console.log("DepositHash: ");
    console.log(depositHash.toString(16));*/

    const eventArr: any = await this.getEventsFromContract(this.exchange, "Deposit", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      // console.log(eventObj);
      return [eventObj.args.account, eventObj.args.depositBlockIdx];
    });
    const accountID = items[0][0].toNumber();
    const depositBlockIdx = items[0][1].toNumber();
    console.log(accountID);
    console.log(depositBlockIdx);

    this.addDeposit(this.pendingDeposits, depositBlockIdx, accountID,
                    secretKey, publicKeyX, publicKeyY,
                    walletID, this.tokenIDMap.get(token), amount);
    return accountID;
  }

  public async withdraw(account: number, amount: number) {
    this.addWithdrawal(this.pendingWithdrawals, account, amount);
  }

  public addDeposit(deposits: Deposit[], depositBlockIdx: number, accountID: number,
                    secretKey: string, publicKeyX: string, publicKeyY: string,
                    walletID: number, tokenID: number, balance: number) {
    deposits.push({accountID, depositBlockIdx, secretKey, publicKeyX, publicKeyY, walletID, tokenID, balance});
  }

  public addWithdrawal(withdrawals: Withdrawal[], account: number, amount: number) {
    withdrawals.push({account, amount});
  }

  public ensureDirectoryExists(filePath: string) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
      return true;
    }
    this.ensureDirectoryExists(dirname);
    fs.mkdirSync(dirname);
  }

  public async createBlock(blockType: number, data: string) {
    const nextBlockIdx = (await this.exchange.getBlockIdx()).toNumber() + 1;
    const inputFilename = "./blocks/block_" + nextBlockIdx + "_info.json";
    const outputFilename = "./blocks/block_" + nextBlockIdx + ".json";

    this.ensureDirectoryExists(inputFilename);
    fs.writeFileSync(inputFilename, data, "utf8");

    childProcess.spawnSync(
      "python3",
      ["operator/create_block.py", "" + blockType, inputFilename, outputFilename],
      {stdio: "inherit"},
    );

    return outputFilename;
  }

  public async commitBlock(blockType: number, data: string, filename: string) {
    // Hash all public inputs to a singe value
    // const publicDataHash = ethUtil.sha256(data);
    // console.log("DataJS: " + data);
    // console.log(publicDataHash.toString("hex"));

    const tokensBlockIdx = (await this.exchange.getBurnRateBlockIdx()).toNumber();

    const tx = await this.exchange.commitBlock(
      web3.utils.toBN(blockType),
      web3.utils.toBN(tokensBlockIdx),
      web3.utils.hexToBytes(data),
    );
    pjs.logInfo("\x1b[46m%s\x1b[0m", "[commitBlock] Gas used: " + tx.receipt.gasUsed);

    const blockIdx = (await this.exchange.getBlockIdx()).toNumber();
    const block: Block = {
      blockIdx,
      filename,
    };
    this.pendingBlocks.push(block);
  }

  public async verifyBlock(blockIdx: number, blockFilename: string) {
    const proofFilename = "./blocks/block_" + blockIdx + "_proof.json";
    childProcess.spawnSync(
      "build/circuit/dex_circuit",
      ["-prove", blockFilename, proofFilename],
      {stdio: "inherit"},
    );

    // Read the verification key and set it in the smart contract
    const jVK = fs.readFileSync("vk.json", "ascii");
    const vk = JSON.parse(jVK);
    const vkFlattened = this.flattenVK(vk);
    await this.exchange.setVerifyingKey(vkFlattened[0], vkFlattened[1]);

    // Read the proof
    const jProof = fs.readFileSync(proofFilename, "ascii");
    const proof = JSON.parse(jProof);
    const proofFlattened = this.flattenProof(proof);
    // console.log(proof);
    // console.log(this.flattenProof(proof));

    const tx = await this.exchange.verifyBlock(web3.utils.toBN(blockIdx), proofFlattened);
    pjs.logInfo("\x1b[46m%s\x1b[0m", "[verifyBlock] Gas used: " + tx.receipt.gasUsed);

    return proofFilename;
  }

  public async verifyAllPendingBlocks() {
    for (const block of this.pendingBlocks) {
      await this.verifyBlock(block.blockIdx, block.filename);
    }
    this.pendingBlocks = [];
  }

  public async submitDeposits() {
    if (this.pendingDeposits.length === 0) {
      return;
    }

    const numBlocks = Math.floor((this.pendingDeposits.length + 7) / 8);
    for (let i = 0; i < numBlocks; i++) {

      const deposits: Deposit[] = [];
      let isFull = true;
      // Get all deposits for the block
      for (let b = i * 8; b < (i + 1) * 8; b++) {
          if (b < this.pendingDeposits.length) {
            deposits.push(this.pendingDeposits[b]);
          } else {
            const dummyDeposit: Deposit = {
              depositBlockIdx: deposits[0].depositBlockIdx,
              accountID: 0,
              secretKey: (await this.exchange.DEFAULT_ACCOUNT_SECRETKEY()).toString(),
              publicKeyX: (await this.exchange.DEFAULT_ACCOUNT_PUBLICKEY_X()).toString(),
              publicKeyY: (await this.exchange.DEFAULT_ACCOUNT_PUBLICKEY_Y()).toString(),
              walletID: 0,
              tokenID: 0,
              balance: 0,
            };
            deposits.push(dummyDeposit);
            isFull = false;
          }
      }
      assert(deposits.length === 8);

      let timeToWait = (await this.exchange.MIN_TIME_CLOSED_DEPOSIT_BLOCK_UNTIL_COMMITTABLE()).toNumber();
      if (!isFull) {
        timeToWait += (await this.exchange.MAX_TIME_OPEN_DEPOSIT_BLOCK()).toNumber();
      }
      await this.advanceBlockTimestamp(timeToWait);

      const jDepositsInfo = JSON.stringify(deposits, null, 4);
      const blockFilename = await this.createBlock(1, jDepositsInfo);
      const jDeposits = fs.readFileSync(blockFilename, "ascii");
      const jdeposits = JSON.parse(jDeposits);
      const bs = new pjs.Bitstream();
      bs.addBigNumber(new BigNumber(jdeposits.accountsMerkleRootBefore, 10), 32);
      bs.addBigNumber(new BigNumber(jdeposits.accountsMerkleRootAfter, 10), 32);
      bs.addNumber(0, 32);
      // const depositHash = await this.exchange.getDepositHash(web3.utils.toBN(0));
      // bs.addNumber(depositHash.toString(16));

      // Commit the block
      await this.commitBlock(1, bs.getData(), blockFilename);
    }

    this.pendingDeposits = [];
  }

  public async submitWithdrawals() {
    if (this.pendingWithdrawals.length === 0) {
      return;
    }

    const jWithdrawalsInfo = JSON.stringify(this.pendingWithdrawals, null, 4);
    const blockFilename = await this.createBlock(2, jWithdrawalsInfo);
    const jWithdrawals = fs.readFileSync(blockFilename, "ascii");
    const jwithdrawals = JSON.parse(jWithdrawals);
    const bs = new pjs.Bitstream();
    bs.addBigNumber(new BigNumber(jwithdrawals.accountsMerkleRootBefore, 10), 32);
    bs.addBigNumber(new BigNumber(jwithdrawals.accountsMerkleRootAfter, 10), 32);
    for (const withdrawal of this.pendingWithdrawals) {
      bs.addNumber(withdrawal.account, 3);
      bs.addNumber(withdrawal.amount, 12);
    }

    // Commit the block
    await this.commitBlock(2, bs.getData(), blockFilename);
    const blockIdx = (await this.exchange.getBlockIdx()).toNumber();

    // We need to verify all blocks before and including the withdraw block before
    // we can withdraw the tokens from the block
    /*await this.verifyAllPendingBlocks();

    for (let i = 0; i < this.pendingWithdrawals.length; i++) {
      const withdrawal = this.pendingWithdrawals[i];
      const txw = await this.exchange.withdraw(
        web3.utils.toBN(blockIdx),
        web3.utils.toBN(i),
      );

      const eventArr: any = await this.getEventsFromContract(this.exchange, "Withdraw", web3.eth.blockNumber);
      const items = eventArr.map((eventObj: any) => {
        return [eventObj.args.owner, eventObj.args.tokenAddress, eventObj.args.amount];
      });
      const owner = items[0][0];
      const token = items[0][1];
      const amount = items[0][2].toNumber();
      console.log("Withdrawn: " + owner + ": " + amount + " " + token);
    }*/

    this.pendingWithdrawals = [];
  }

  public async submitRings(ringsInfo: RingsInfo) {
    // First create the accounts and deposit the tokens
    await this.submitDeposits();

    // Generate the token transfers for the ring
    const blockNumber = await web3.eth.getBlockNumber();
    ringsInfo.timestamp = (await web3.eth.getBlock(blockNumber)).timestamp + 30;

    // Create the block
    const blockFilename = await this.createBlock(0, JSON.stringify(ringsInfo, null, 4));

    // Read in the block
    const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

    const bs = new pjs.Bitstream();
    bs.addBigNumber(new BigNumber(block.accountsMerkleRootBefore, 10), 32);
    bs.addBigNumber(new BigNumber(block.accountsMerkleRootAfter, 10), 32);
    bs.addBigNumber(new BigNumber(block.tradingHistoryMerkleRootBefore, 10), 32);
    bs.addBigNumber(new BigNumber(block.tradingHistoryMerkleRootAfter, 10), 32);
    bs.addBigNumber(new BigNumber(block.burnRateMerkleRoot, 10), 32);
    bs.addNumber(ringsInfo.timestamp, 4);
    for (const ringSettlement of block.ringSettlements) {
      const ring = ringSettlement.ring;
      const orderA = ringSettlement.ring.orderA;
      const orderB = ringSettlement.ring.orderB;

      bs.addNumber(orderA.walletID, 2);
      bs.addNumber(orderA.orderID, 2);
      bs.addNumber(orderA.accountS, 3);
      bs.addNumber(orderB.accountB, 3);
      bs.addNumber(ring.fillS_A, 12);
      bs.addNumber(orderA.accountF, 3);
      bs.addNumber(ring.fillF_A, 12);

      bs.addNumber(orderB.walletID, 2);
      bs.addNumber(orderB.orderID, 2);
      bs.addNumber(orderB.accountS, 3);
      bs.addNumber(orderA.accountB, 3);
      bs.addNumber(ring.fillS_B, 12);
      bs.addNumber(orderB.accountF, 3);
      bs.addNumber(ring.fillF_B, 12);
    }

    // Commit the block
    await this.commitBlock(0, bs.getData(), blockFilename);

    // Withdraw some tokens that were bought
    this.withdraw(ringsInfo.rings[0].orderA.accountB, 1);
    await this.submitWithdrawals();

    assert(false);
  }

  public async registerTokens() {
    const tokenRegistrationFee = await this.exchange.TOKEN_REGISTRATION_FEE_IN_LRC();
    const lrcAddress = this.testContext.tokenSymbolAddrMap.get("LRC");
    const LRC = this.testContext.tokenAddrInstanceMap.get(lrcAddress);

    for (const token of [this.zeroAddress, ...this.testContext.allTokens]) {
      await LRC.addBalance(this.testContext.orderOwners[0], tokenRegistrationFee);
      await LRC.approve(
        this.exchange.address,
        tokenRegistrationFee,
        {from: this.testContext.orderOwners[0]},
      );

      const tokenAddress = (token === this.zeroAddress) ? this.zeroAddress : token.address;
      console.log(tokenAddress);

      const tx = await this.exchange.registerToken(tokenAddress, {from: this.testContext.orderOwners[0]});
      pjs.logInfo("\x1b[46m%s\x1b[0m", "[TokenRegistration] Gas used: " + tx.receipt.gasUsed);

      const tokensRoot = await this.exchange.getBurnRateRoot();
      console.log(tokensRoot);
      childProcess.spawnSync("python3", ["operator/add_token.py"], {stdio: "inherit"});

      this.tokenIDMap.set(tokenAddress, (await this.getTokenID(tokenAddress)).toNumber());
    }
    // console.log(this.tokenIDMap);
  }

  public async getTokenID(tokenAddress: string) {
    const tokenID = await this.exchange.getTokenID(tokenAddress);
    return tokenID;
  }

  public async cleanTradeHistory() {
    if (fs.existsSync("state.json")) {
      fs.unlinkSync("state.json");
    }
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

  private getPrivateKey(address: string) {
    const textData = fs.readFileSync("./ganache_account_keys.txt", "ascii");
    const data = JSON.parse(textData);
    return data.private_keys[address.toLowerCase()];
  }

  // private functions:
  private async createContractContext() {
    const [exchange, lrcToken] = await Promise.all([
        this.contracts.Exchange.deployed(),
        this.contracts.LRCToken.deployed(),
      ]);

    this.exchange = exchange;

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

    const [lrc, gto, rdn, rep, weth, inda, indb, test] = await Promise.all([
      this.contracts.LRCToken.deployed(),
      this.contracts.GTOToken.deployed(),
      this.contracts.RDNToken.deployed(),
      this.contracts.REPToken.deployed(),
      this.contracts.WETHToken.deployed(),
      this.contracts.INDAToken.deployed(),
      this.contracts.INDBToken.deployed(),
      this.contracts.TESTToken.deployed(),
    ]);

    const allTokens = [lrc, gto, rdn, rep, weth, inda, indb, test];

    tokenSymbolAddrMap.set("LRC", this.contracts.LRCToken.address);
    tokenSymbolAddrMap.set("GTO", this.contracts.GTOToken.address);
    tokenSymbolAddrMap.set("RDN", this.contracts.RDNToken.address);
    tokenSymbolAddrMap.set("REP", this.contracts.REPToken.address);
    tokenSymbolAddrMap.set("WETH", this.contracts.WETHToken.address);
    tokenSymbolAddrMap.set("INDA", this.contracts.INDAToken.address);
    tokenSymbolAddrMap.set("INDB", this.contracts.INDBToken.address);
    tokenSymbolAddrMap.set("TEST", this.contracts.TESTToken.address);

    for (const token of allTokens) {
      tokenAddrDecimalsMap.set(token.address, (await token.decimals()));
    }

    tokenAddrSymbolMap.set(this.contracts.LRCToken.address, "LRC");
    tokenAddrSymbolMap.set(this.contracts.GTOToken.address, "GTO");
    tokenAddrSymbolMap.set(this.contracts.RDNToken.address, "RDN");
    tokenAddrSymbolMap.set(this.contracts.REPToken.address, "REP");
    tokenAddrSymbolMap.set(this.contracts.WETHToken.address, "WETH");
    tokenAddrSymbolMap.set(this.contracts.INDAToken.address, "INDA");
    tokenAddrSymbolMap.set(this.contracts.INDBToken.address, "INDB");
    tokenAddrSymbolMap.set(this.contracts.TESTToken.address, "TEST");

    tokenAddrInstanceMap.set(this.contracts.LRCToken.address, lrc);
    tokenAddrInstanceMap.set(this.contracts.GTOToken.address, gto);
    tokenAddrInstanceMap.set(this.contracts.RDNToken.address, rdn);
    tokenAddrInstanceMap.set(this.contracts.REPToken.address, rep);
    tokenAddrInstanceMap.set(this.contracts.WETHToken.address, weth);
    tokenAddrInstanceMap.set(this.contracts.INDAToken.address, inda);
    tokenAddrInstanceMap.set(this.contracts.INDBToken.address, indb);
    tokenAddrInstanceMap.set(this.contracts.TESTToken.address, test);

    const deployer = accounts[0];
    const transactionOrigin = accounts[1];
    const feeRecipient = accounts[2];
    const miner = accounts[3];
    const orderOwners = accounts.slice(4, 14);
    const orderDualAuthAddr = accounts.slice(14, 24);
    const allOrderTokenRecipients = accounts.slice(24, 28);
    const wallets = accounts.slice(28, 32);
    const brokers =  accounts.slice(32, 36);

    return new ExchangeTestContext(deployer,
                                   transactionOrigin,
                                   feeRecipient,
                                   miner,
                                   orderOwners,
                                   orderDualAuthAddr,
                                   allOrderTokenRecipients,
                                   wallets,
                                   brokers,
                                   tokenSymbolAddrMap,
                                   tokenAddrSymbolMap,
                                   tokenAddrDecimalsMap,
                                   tokenAddrInstanceMap,
                                   allTokens);
  }

}
