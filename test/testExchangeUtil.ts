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

// JSON replacer function for BN values
function replacer(name: any, val: any) {
  if (name === "balance" || name === "amountS" || name === "amountB" || name === "amountF" || name === "amount" ) {
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

  private contracts = new Artifacts(artifacts);

  private tokenIDMap = new Map<string, number>();

  private pendingDeposits: Deposit[][] = [];
  private pendingWithdrawals: Withdrawal[] = [];

  private pendingBlocks: Block[] = [];

  private zeroAddress = "0x" + "00".repeat(20);

  private MAX_NUM_STATES: number = 16;

  public async initialize(accounts: string[]) {
    this.context = await this.createContractContext();
    this.testContext = await this.createExchangeTestContext(accounts);
    await this.cleanTradeHistory();
    await this.registerTokens();

    for (let i = 0; i < this.MAX_NUM_STATES; i++) {
      const deposits: Deposit[] = [];
      this.pendingDeposits.push(deposits);
    }

    await this.deposit(
      0,
      this.zeroAddress,
      (await this.exchange.DEFAULT_ACCOUNT_SECRETKEY()).toString(),
      (await this.exchange.DEFAULT_ACCOUNT_PUBLICKEY_X()).toString(),
      (await this.exchange.DEFAULT_ACCOUNT_PUBLICKEY_Y()).toString(),
      0,
      this.zeroAddress,
      new BN(0),
    );

    await this.registerOperator(0, this.testContext.miner);
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

    ringsInfo.stateID = ringsInfo.stateID ? ringsInfo.stateID : 0;

    const lrcAddress = this.testContext.tokenSymbolAddrMap.get("LRC");
    const LRC = this.testContext.tokenAddrInstanceMap.get(lrcAddress);

    // Make an account for the operator
    const keyPairO = this.getKeyPairEDDSA();
    const operatorAccountID = await this.deposit(ringsInfo.stateID, this.testContext.miner,
                                                 keyPairO.secretKey, keyPairO.publicKeyX, keyPairO.publicKeyY,
                                                 0, lrcAddress, new BN(0));
    ringsInfo.operatorAccountID = operatorAccountID;

    // Make an account for the ringmatcher
    const keyPairM = this.getKeyPairEDDSA();
    await LRC.addBalance(this.testContext.miner, web3.utils.toBN(new BigNumber(10000)));
    const minerAccountID = await this.deposit(ringsInfo.stateID, this.testContext.miner,
                                              keyPairM.secretKey, keyPairM.publicKeyX, keyPairM.publicKeyY,
                                              0, lrcAddress, new BN(10000));

    let orderIndex = 0;
    for (const [i, ring] of ringsInfo.rings.entries()) {
      ring.minerID = ring.minerID ? ring.minerID : 0;
      ring.minerAccountID = minerAccountID;
      ring.fee = ring.fee ? ring.fee : 1;
      await this.setupOrder(ring.orderA, orderIndex++);
      await this.setupOrder(ring.orderB, orderIndex++);
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
    order.amountF = order.amountF ? order.amountF : new BN(0);

    order.allOrNone = order.allOrNone ? order.allOrNone : false;
    order.walletSplitPercentage = order.walletSplitPercentage ? order.walletSplitPercentage : 50;

    order.waiveFeePercentage = order.waiveFeePercentage ? order.waiveFeePercentage : 50;

    order.walletID = order.walletID ? order.walletID : 0;
    order.orderID = order.orderID ? order.orderID : order.index;

    order.stateID = order.stateID ? order.stateID : 0;

    order.tokenIdS = this.tokenIDMap.get(order.tokenS);
    order.tokenIdB = this.tokenIDMap.get(order.tokenB);
    order.tokenIdF = this.tokenIDMap.get(order.tokenF);

    // setup initial balances:
    await this.setOrderBalances(order);
  }

  public async setOrderBalances(order: OrderInfo) {
    const keyPair = this.getKeyPairEDDSA();

    const balanceS = (order.balanceS !== undefined) ? order.balanceS : order.amountS;
    order.accountID = await this.deposit(order.stateID, order.owner,
                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                         order.walletID, order.tokenS, balanceS);

    const balanceF = (order.balanceF !== undefined) ? order.balanceF : order.amountF;
    order.accountID = await this.deposit(order.stateID, order.owner,
                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                         order.walletID, order.tokenF, balanceF, order.accountID);

    const balanceB = (order.balanceB !== undefined) ? order.balanceB : new BN(0);
    order.accountID = await this.deposit(order.stateID, order.owner,
                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                         order.walletID, order.tokenB, balanceB, order.accountID);

    // Make a dual author account
    const keyPairW = this.getKeyPairEDDSA();
    order.dualAuthAccountID = await this.deposit(order.stateID, order.wallet,
                                                 keyPairW.secretKey, keyPairW.publicKeyX, keyPairW.publicKeyY,
                                                 order.walletID, order.tokenF, new BN(0));
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

  public async deposit(stateID: number, owner: string, secretKey: string, publicKeyX: string, publicKeyY: string,
                       walletID: number, token: string, amount: BN, accountID: number = 0xFFFFFF) {
    let numAvailableSlots = (await this.exchange.getNumAvailableDepositSlots(web3.utils.toBN(stateID))).toNumber();
    // console.log("Open slots: " + numAvailableSlots);
    if (numAvailableSlots === 0) {
        const timeToWait = (await this.exchange.MIN_TIME_OPEN_DEPOSIT_BLOCK()).toNumber();
        // console.log(timeToWait);
        await this.advanceBlockTimestamp(timeToWait);

        numAvailableSlots = (await this.exchange.getNumAvailableDepositSlots(web3.utils.toBN(stateID))).toNumber();
        // console.log("Open slots after: " + numAvailableSlots);
        assert(numAvailableSlots > 0, "numAvailableSlots > 0");
    }

    const txOrigin = (owner === this.zeroAddress) ? this.testContext.orderOwners[0] : owner;
    const depositFee = await this.exchange.DEPOSIT_FEE_IN_ETH();

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
          {from: txOrigin},
        );
      } else {
        ethToSend = ethToSend.add(web3.utils.toBN(amount));
      }
    }

    // Submit the deposits
    const tx = await this.exchange.deposit(
      web3.utils.toBN(stateID),
      web3.utils.toBN(accountID),
      owner,
      new BN(publicKeyX),
      new BN(publicKeyY),
      web3.utils.toBN(walletID),
      token,
      web3.utils.toBN(amount),
      {from: txOrigin, value: ethToSend},
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
    const eventAccountID = items[0][0].toNumber();
    const depositBlockIdx = items[0][1].toNumber();
    // console.log(accountID);
    // console.log(depositBlockIdx);

    this.addDeposit(this.pendingDeposits[stateID], depositBlockIdx, eventAccountID,
                    secretKey, publicKeyX, publicKeyY,
                    walletID, this.tokenIDMap.get(token), amount);
    return eventAccountID;
  }

  public async withdraw(accountID: number, tokenID: number, amount: BN) {
    this.addWithdrawal(this.pendingWithdrawals, accountID, tokenID, amount);
  }

  public addDeposit(deposits: Deposit[], depositBlockIdx: number, accountID: number,
                    secretKey: string, publicKeyX: string, publicKeyY: string,
                    walletID: number, tokenID: number, amount: BN) {
    deposits.push({accountID, depositBlockIdx, secretKey, publicKeyX, publicKeyY, walletID, tokenID, amount});
  }

  public addWithdrawal(withdrawals: Withdrawal[], accountID: number, tokenID: number, amount: BN) {
    withdrawals.push({accountID, tokenID, amount});
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
      ["operator/create_block.py", "" + stateID, "" + blockType, inputFilename, outputFilename],
      {stdio: "inherit"},
    );
    assert(result.status === 0, "create_block failed: " + blockType);

    return outputFilename;
  }

  public async commitBlock(blockType: number, data: string, filename: string) {
    // Hash all public inputs to a singe value
    // const publicDataHash = ethUtil.sha256(data);
    // console.log("DataJS: " + data);
    // console.log(publicDataHash.toString("hex"));

    const tokensBlockIdx = (await this.tokenRegistry.getBurnRateBlockIdx()).toNumber();

    const bitstream = new pjs.Bitstream(data);
    const stateID = bitstream.extractUint16(0);

    const tx = await this.exchange.commitBlock(
      web3.utils.toBN(blockType),
      web3.utils.toBN(tokensBlockIdx),
      web3.utils.hexToBytes(data),
      {from: this.testContext.miner},
    );
    pjs.logInfo("\x1b[46m%s\x1b[0m", "[commitBlock] Gas used: " + tx.receipt.gasUsed);

    const blockIdx = (await this.exchange.getBlockIdx(web3.utils.toBN(stateID))).toNumber();
    const block: Block = {
      blockIdx,
      filename,
    };
    this.pendingBlocks.push(block);
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
      verificationKeyFilename += "withdraw";
    } else if (block.blockType === 3) {
      verificationKeyFilename += "cancel";
    }

    verificationKeyFilename += "_" + block.numElements + "_vk.json";

    // Read the verification key and set it in the smart contract
    const vk = JSON.parse(fs.readFileSync(verificationKeyFilename, "ascii"));
    const vkFlattened = this.flattenVK(vk);
    await this.exchange.setVerifyingKey(vkFlattened[0], vkFlattened[1]);

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
    pjs.logInfo("\x1b[46m%s\x1b[0m", "[verifyBlock] Gas used: " + tx.receipt.gasUsed);

    return proofFilename;
  }

  public async verifyAllPendingBlocks() {
    for (const block of this.pendingBlocks) {
      await this.verifyBlock(block.blockIdx, block.filename);
    }
    this.pendingBlocks = [];
  }

  public async submitDeposits(stateID: number) {
    if (this.pendingDeposits[stateID].length === 0) {
      return;
    }

    const pendingDeposits = this.pendingDeposits[stateID];

    const numBlocks = Math.floor((pendingDeposits.length + 7) / 8);
    for (let i = 0; i < numBlocks; i++) {

      const deposits: Deposit[] = [];
      let isFull = true;
      // Get all deposits for the block
      for (let b = i * 8; b < (i + 1) * 8; b++) {
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
      assert(deposits.length === 8);

      let timeToWait = (await this.exchange.MIN_TIME_CLOSED_DEPOSIT_BLOCK_UNTIL_COMMITTABLE()).toNumber();
      if (!isFull) {
        timeToWait += (await this.exchange.MAX_TIME_OPEN_DEPOSIT_BLOCK()).toNumber();
      }
      await this.advanceBlockTimestamp(timeToWait);

      const jDepositsInfo = JSON.stringify(deposits, replacer, 4);
      const blockFilename = await this.createBlock(stateID, 1, jDepositsInfo);
      const jDeposits = fs.readFileSync(blockFilename, "ascii");
      const jdeposits = JSON.parse(jDeposits);
      const bs = new pjs.Bitstream();
      bs.addNumber(jdeposits.stateID, 2);
      bs.addBigNumber(new BigNumber(jdeposits.merkleRootBefore, 10), 32);
      bs.addBigNumber(new BigNumber(jdeposits.merkleRootAfter, 10), 32);
      bs.addNumber(jdeposits.stateID, 32);
      // const depositHash = await this.exchange.getDepositHash(web3.utils.toBN(0));
      // bs.addNumber(depositHash.toString(16));

      // Commit the block
      await this.commitBlock(1, bs.getData(), blockFilename);
    }

    this.pendingDeposits[stateID] = [];
  }

  public async submitWithdrawals(ringsInfo: RingsInfo) {
    if (this.pendingWithdrawals.length === 0) {
      return;
    }

    console.log(this.pendingWithdrawals);
    const jWithdrawalsInfo = JSON.stringify(this.pendingWithdrawals, replacer, 4);
    const blockFilename = await this.createBlock(ringsInfo.stateID, 2, jWithdrawalsInfo);
    const jWithdrawals = fs.readFileSync(blockFilename, "ascii");
    const jwithdrawals = JSON.parse(jWithdrawals);
    const stateID = jwithdrawals.stateID;
    const bs = new pjs.Bitstream();
    bs.addNumber(jwithdrawals.stateID, 2);
    bs.addBigNumber(new BigNumber(jwithdrawals.merkleRootBefore, 10), 32);
    bs.addBigNumber(new BigNumber(jwithdrawals.merkleRootAfter, 10), 32);
    for (const withdrawal of this.pendingWithdrawals) {
      bs.addNumber(withdrawal.accountID, 3);
      bs.addNumber(withdrawal.tokenID, 2);
      bs.addBN(withdrawal.amount, 12);
    }

    // Commit the block
    await this.commitBlock(2, bs.getData(), blockFilename);
    const blockIdx = (await this.exchange.getBlockIdx(web3.utils.toBN(stateID))).toNumber();

    // We need to verify all blocks before and including the withdraw block before
    // we can withdraw the tokens from the block
    await this.verifyAllPendingBlocks();

    const addressBook = this.getAddressBook(ringsInfo);
    for (let i = 0; i < this.pendingWithdrawals.length; i++) {
      const withdrawal = this.pendingWithdrawals[i];
      const txw = await this.exchange.withdraw(
        web3.utils.toBN(stateID),
        web3.utils.toBN(blockIdx),
        web3.utils.toBN(i),
      );

      const eventArr: any = await this.getEventsFromContract(this.exchange, "Withdraw", web3.eth.blockNumber);
      const items = eventArr.map((eventObj: any) => {
        return [eventObj.args.to, eventObj.args.tokenAddress, eventObj.args.amount];
      });
      const to = addressBook[items[0][0]];
      const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(items[0][1]);
      const decimals = this.testContext.tokenAddrDecimalsMap.get(items[0][1]);
      const amount = items[0][2].div(web3.utils.toBN(10 ** decimals)).toString(10);
      console.log("Withdrawn: " + to + ": " + amount + " " + tokenSymbol);
    }

    this.pendingWithdrawals = [];
  }

  public async submitRings(ringsInfo: RingsInfo) {
    // First create the accounts and deposit the tokens
    await this.submitDeposits(ringsInfo.stateID);

    // Generate the token transfers for the ring
    const blockNumber = await web3.eth.getBlockNumber();
    ringsInfo.stateID = ringsInfo.stateID ? ringsInfo.stateID : 0;
    ringsInfo.timestamp = (await web3.eth.getBlock(blockNumber)).timestamp + 30;

    // Create the block
    const blockFilename = await this.createBlock(ringsInfo.stateID, 0, JSON.stringify(ringsInfo, replacer, 4));

    // Read in the block
    const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

    const bs = new pjs.Bitstream();
    bs.addNumber(block.stateID, 2);
    bs.addBigNumber(new BigNumber(block.merkleRootBefore, 10), 32);
    bs.addBigNumber(new BigNumber(block.merkleRootAfter, 10), 32);
    bs.addBigNumber(new BigNumber(block.burnRateMerkleRoot, 10), 32);
    bs.addNumber(ringsInfo.timestamp, 4);
    for (const ringSettlement of block.ringSettlements) {
      const ring = ringSettlement.ring;
      const orderA = ringSettlement.ring.orderA;
      const orderB = ringSettlement.ring.orderB;

      // bs.addNumber(orderA.walletID, 2);
      bs.addNumber(orderA.accountID, 3);
      bs.addNumber(orderA.orderID, 2);
      bs.addNumber(ring.fillS_A, 12);
      bs.addNumber(ring.fillF_A, 12);

      // bs.addNumber(orderB.walletID, 2);
      bs.addNumber(orderB.accountID, 3);
      bs.addNumber(orderB.orderID, 2);
      bs.addNumber(ring.fillS_B, 12);
      bs.addNumber(ring.fillF_B, 12);
    }

    // Commit the block
    await this.commitBlock(0, bs.getData(), blockFilename);
  }

  public async registerTokens() {
    const tokenRegistrationFee = await this.tokenRegistry.TOKEN_REGISTRATION_FEE_IN_LRC();
    const lrcAddress = this.testContext.tokenSymbolAddrMap.get("LRC");
    const LRC = this.testContext.tokenAddrInstanceMap.get(lrcAddress);

    for (const token of this.testContext.allTokens) {
      await LRC.addBalance(this.testContext.orderOwners[0], tokenRegistrationFee);
      await LRC.approve(
        this.tokenRegistry.address,
        tokenRegistrationFee,
        {from: this.testContext.orderOwners[0]},
      );

      const tokenAddress = (token === null) ? this.zeroAddress : token.address;
      console.log(tokenAddress);

      const tx = await this.tokenRegistry.registerToken(tokenAddress, {from: this.testContext.orderOwners[0]});
      pjs.logInfo("\x1b[46m%s\x1b[0m", "[TokenRegistration] Gas used: " + tx.receipt.gasUsed);

      const tokensRoot = await this.tokenRegistry.getBurnRateRoot();
      // console.log(tokensRoot);
      const result = childProcess.spawnSync("python3", ["operator/add_token.py"], {stdio: "inherit"});
      assert(result.status === 0, "add_token failed: " + tokenAddress);

      this.tokenIDMap.set(tokenAddress, (await this.getTokenID(tokenAddress)).toNumber());
    }
    // console.log(this.tokenIDMap);
  }

  public async getTokenID(tokenAddress: string) {
    const tokenID = await this.tokenRegistry.getTokenID(tokenAddress);
    return tokenID;
  }

  public async createNewState(owner: string) {
    const fee = await this.exchange.NEW_STATE_CREATION_FEE_IN_LRC();
    await this.setBalanceAndApproveLRC(owner, fee);

    // Create the new state
    const tx = await this.exchange.createNewState({from: owner});
    pjs.logInfo("\x1b[46m%s\x1b[0m", "[NewState] Gas used: " + tx.receipt.gasUsed);

    const eventArr: any = await this.getEventsFromContract(this.exchange, "NewState", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.stateID];
    });
    const stateID = items[0][0].toNumber();

    // Add default user (TODO: move onchain)
    await this.deposit(
      stateID,
      this.zeroAddress,
      (await this.exchange.DEFAULT_ACCOUNT_SECRETKEY()).toString(),
      (await this.exchange.DEFAULT_ACCOUNT_PUBLICKEY_X()).toString(),
      (await this.exchange.DEFAULT_ACCOUNT_PUBLICKEY_Y()).toString(),
      0,
      this.zeroAddress,
      new BN(0),
    );

    return stateID;
  }

  public async registerOperator(stateID: number, owner: string) {
    const fee = await this.exchange.NEW_STATE_CREATION_FEE_IN_LRC();
    await this.setBalanceAndApproveLRC(owner, fee);

    // Create the new state
    const tx = await this.exchange.registerOperator(web3.utils.toBN(stateID), fee, {from: owner});
    pjs.logInfo("\x1b[46m%s\x1b[0m", "[NewState] Gas used: " + tx.receipt.gasUsed);

    const eventArr: any = await this.getEventsFromContract(this.exchange, "OperatorRegistered", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.operatorID];
    });
    const operatorID = items[0][0].toNumber();

    return operatorID;
  }

  public async setBalanceAndApproveLRC(owner: string, amount: BN) {
    const lrcAddress = this.testContext.tokenSymbolAddrMap.get("LRC");
    const LRC = this.testContext.tokenAddrInstanceMap.get(lrcAddress);
    await LRC.setBalance(owner, amount);
    await LRC.approve(this.exchange.address, amount, {from: owner});
  }

  public async cleanTradeHistory() {
    if (fs.existsSync("state_global.json")) {
      fs.unlinkSync("state_global.json");
    }
    for (let i = 0; i < this.MAX_NUM_STATES; i++) {
      const stateFile = "state_" + i + ".json";
      if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
      }
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
    const [exchange, tokenRegistry, lrcToken] = await Promise.all([
        this.contracts.Exchange.deployed(),
        this.contracts.TokenRegistry.deployed(),
        this.contracts.LRCToken.deployed(),
      ]);

    this.exchange = exchange;
    this.tokenRegistry = tokenRegistry;

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

    const [eth, lrc, gto, rdn, rep, weth, inda, indb, test] = await Promise.all([
      null,
      this.contracts.LRCToken.deployed(),
      this.contracts.GTOToken.deployed(),
      this.contracts.RDNToken.deployed(),
      this.contracts.REPToken.deployed(),
      this.contracts.WETHToken.deployed(),
      this.contracts.INDAToken.deployed(),
      this.contracts.INDBToken.deployed(),
      this.contracts.TESTToken.deployed(),
    ]);

    const allTokens = [eth, lrc, gto, rdn, rep, weth, inda, indb, test];

    tokenSymbolAddrMap.set("ETH", this.zeroAddress);
    tokenSymbolAddrMap.set("LRC", this.contracts.LRCToken.address);
    tokenSymbolAddrMap.set("GTO", this.contracts.GTOToken.address);
    tokenSymbolAddrMap.set("RDN", this.contracts.RDNToken.address);
    tokenSymbolAddrMap.set("REP", this.contracts.REPToken.address);
    tokenSymbolAddrMap.set("WETH", this.contracts.WETHToken.address);
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
    tokenAddrSymbolMap.set(this.contracts.LRCToken.address, "LRC");
    tokenAddrSymbolMap.set(this.contracts.GTOToken.address, "GTO");
    tokenAddrSymbolMap.set(this.contracts.RDNToken.address, "RDN");
    tokenAddrSymbolMap.set(this.contracts.REPToken.address, "REP");
    tokenAddrSymbolMap.set(this.contracts.WETHToken.address, "WETH");
    tokenAddrSymbolMap.set(this.contracts.INDAToken.address, "INDA");
    tokenAddrSymbolMap.set(this.contracts.INDBToken.address, "INDB");
    tokenAddrSymbolMap.set(this.contracts.TESTToken.address, "TEST");

    tokenAddrInstanceMap.set(this.zeroAddress, null);
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
