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
import { Block, Cancel, CancelBlock, Deposit, OrderInfo,
         RingBlock, RingInfo, Withdrawal, WithdrawalRequest, WithdrawBlock } from "./types";

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
  public blockVerifier: any;

  public operatorAccountID: number;
  public minerAccountID: number;

  private contracts = new Artifacts(artifacts);

  private tokenAddressToIDMap = new Map<string, number>();
  private tokenIDToAddressMap = new Map<number, string>();

  private pendingRings: RingInfo[][] = [];
  private pendingDeposits: Deposit[][] = [];
  private pendingOffchainWithdrawalRequests: WithdrawalRequest[][] = [];
  private pendingOnchainWithdrawalRequests: WithdrawalRequest[][] = [];
  private pendingCancels: Cancel[][] = [];

  private pendingWithdrawals: Withdrawal[] = [];

  private pendingBlocks: Block[] = [];

  private zeroAddress = "0x" + "00".repeat(20);

  private MAX_MUM_WALLETS: number;
  private MAX_NUM_STATES: number = 16;

  private orderIDGenerator: number = 0;

  private addressBook: { [id: string]: string; } = {};

  public async initialize(accounts: string[]) {
    this.context = await this.createContractContext();
    this.testContext = await this.createExchangeTestContext(accounts);
    await this.cleanTradeHistory();
    await this.registerTokens();

    this.MAX_MUM_WALLETS = (await this.exchange.MAX_NUM_WALLETS()).toNumber();

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

    await this.deposit(
      0,
      this.zeroAddress,
      (await this.exchange.DEFAULT_ACCOUNT_SECRETKEY()).toString(),
      (await this.exchange.DEFAULT_ACCOUNT_PUBLICKEY_X()).toString(),
      (await this.exchange.DEFAULT_ACCOUNT_PUBLICKEY_Y()).toString(),
      this.MAX_MUM_WALLETS + 0,
      this.zeroAddress,
      new BN(0),
    );

    this.operatorAccountID = await this.createOperator(0);
    this.minerAccountID = await this.createRingMatcher(0);
  }

  public async createOperator(stateID: number) {
    const lrcAddress = this.testContext.tokenSymbolAddrMap.get("LRC");

    // Make an account for the operator
    const keyPairO = this.getKeyPairEDDSA();
    const operatorAccountID = await this.deposit(stateID, this.testContext.miner,
                                                 keyPairO.secretKey, keyPairO.publicKeyX, keyPairO.publicKeyY,
                                                 0, lrcAddress, new BN(0));

    await this.registerOperator(stateID, this.testContext.miner);
    return operatorAccountID;
  }

  public async createRingMatcher(stateID: number) {
    const lrcAddress = this.testContext.tokenSymbolAddrMap.get("LRC");
    const LRC = this.testContext.tokenAddrInstanceMap.get(lrcAddress);

    // Make an account for the ringmatcher
    const keyPairM = this.getKeyPairEDDSA();
    await LRC.addBalance(this.testContext.miner, web3.utils.toBN(new BigNumber(10000)));
    const minerAccountID = await this.deposit(stateID, this.testContext.miner,
                                              keyPairM.secretKey, keyPairM.publicKeyX, keyPairM.publicKeyY,
                                              0, lrcAddress, new BN(10000));
    return minerAccountID;
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

  public async setupRing(ring: RingInfo) {
    ring.minerAccountID = this.minerAccountID;
    ring.fee = ring.fee ? ring.fee : 1;
    await this.setupOrder(ring.orderA, this.orderIDGenerator++);
    await this.setupOrder(ring.orderB, this.orderIDGenerator++);
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
    order.orderID = order.orderID ? order.orderID : index;

    order.stateID = order.stateID ? order.stateID : 0;

    order.tokenIdS = this.tokenAddressToIDMap.get(order.tokenS);
    order.tokenIdB = this.tokenAddressToIDMap.get(order.tokenB);
    order.tokenIdF = this.tokenAddressToIDMap.get(order.tokenF);

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
                                                 this.MAX_MUM_WALLETS + order.walletID, order.tokenF, new BN(0));
  }

  public getAddressBook(ring: RingInfo) {
    const addAddress = (addrBook: { [id: string]: any; }, address: string, name: string) => {
      addrBook[address] = (addrBook[address] ? addrBook[address] + "=" : "") + name;
    };

    const orders = [ring.orderA, ring.orderB];
    for (const [i, order] of orders.entries()) {
      addAddress(this.addressBook, order.owner, "Owner[" + i + "]");
      addAddress(this.addressBook, order.walletAddr, "Wallet[" + i + "]");
      // addAddress(addressBook, order.hash.toString("hex"), "Hash[" + i + "]");
    }
    return this.addressBook;
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
    if (numAvailableSlots === 0) {
        const timeToWait = (await this.exchange.MIN_TIME_OPEN_DEPOSIT_BLOCK()).toNumber();
        await this.advanceBlockTimestamp(timeToWait);
        numAvailableSlots = (await this.exchange.getNumAvailableDepositSlots(web3.utils.toBN(stateID))).toNumber();
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

    const eventArr: any = await this.getEventsFromContract(this.exchange, "Deposit", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.accountID, eventObj.args.depositBlockIdx];
    });
    const eventAccountID = items[0][0].toNumber();
    const depositBlockIdx = items[0][1].toNumber();

    this.addDeposit(this.pendingDeposits[stateID], depositBlockIdx, eventAccountID,
                    secretKey, publicKeyX, publicKeyY,
                    walletID, this.tokenAddressToIDMap.get(token), amount);
    return eventAccountID;
  }

  public async requestWithdrawalOffchain(stateID: number, accountID: number, tokenID: number, amount: BN,
                                         feeToken: string, fee: BN) {
    if (!feeToken.startsWith("0x")) {
      feeToken = this.testContext.tokenSymbolAddrMap.get(feeToken);
    }
    const feeTokenID = this.tokenAddressToIDMap.get(feeToken);
    this.addWithdrawalRequest(this.pendingOffchainWithdrawalRequests[stateID], accountID, tokenID, amount,
                              feeTokenID, fee);
  }

  public async requestWithdrawalOnchain(stateID: number, accountID: number, tokenID: number,
                                        amount: BN, owner: string) {
    let numAvailableSlots = (await this.exchange.getNumAvailableWithdrawSlots(web3.utils.toBN(stateID))).toNumber();
    console.log("numAvailableSlots: " + numAvailableSlots);
    if (numAvailableSlots === 0) {
        const timeToWait = (await this.exchange.MIN_TIME_OPEN_DEPOSIT_BLOCK()).toNumber();
        await this.advanceBlockTimestamp(timeToWait);
        numAvailableSlots = (await this.exchange.getNumAvailableWithdrawSlots(web3.utils.toBN(stateID))).toNumber();
        console.log("numAvailableSlots: " + numAvailableSlots);
        assert(numAvailableSlots > 0, "numAvailableSlots > 0");
    }

    const txOrigin = (owner === this.zeroAddress) ? this.testContext.orderOwners[0] : owner;
    const withdrawFee = await this.exchange.WITHDRAW_FEE_IN_ETH();

    // Submit the withdraw request
    const tx = await this.exchange.requestWithdraw(
      web3.utils.toBN(stateID),
      web3.utils.toBN(accountID),
      web3.utils.toBN(tokenID),
      web3.utils.toBN(amount),
      {from: txOrigin, value: withdrawFee},
    );
    pjs.logInfo("\x1b[46m%s\x1b[0m", "[WithdrawRequest] Gas used: " + tx.receipt.gasUsed);

    const eventArr: any = await this.getEventsFromContract(this.exchange, "WithdrawRequest", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.withdrawBlockIdx];
    });
    const withdrawBlockIdx = items[0][0].toNumber();

    this.addWithdrawalRequest(this.pendingOnchainWithdrawalRequests[stateID],
                              accountID, tokenID, amount, tokenID, new BN(0), withdrawBlockIdx);
  }

  public addDeposit(deposits: Deposit[], depositBlockIdx: number, accountID: number,
                    secretKey: string, publicKeyX: string, publicKeyY: string,
                    walletID: number, tokenID: number, amount: BN) {
    deposits.push({accountID, depositBlockIdx, secretKey, publicKeyX, publicKeyY, walletID, tokenID, amount});
  }

  public addCancel(cancels: Cancel[], accountID: number, orderTokenID: number, orderID: number,
                   feeTokenID: number, fee: BN) {
    cancels.push({accountID, orderTokenID, orderID, feeTokenID, fee});
  }

  public cancelOrderID(stateID: number, accountID: number,
                       orderTokenID: number, orderID: number,
                       feeTokenID: number, fee: BN) {
    this.addCancel(this.pendingCancels[stateID], accountID, orderTokenID, orderID, feeTokenID, fee);
  }

  public cancelOrder(order: OrderInfo, feeToken: string, fee: BN) {
    if (!feeToken.startsWith("0x")) {
      feeToken = this.testContext.tokenSymbolAddrMap.get(feeToken);
    }
    const feeTokenID = this.tokenAddressToIDMap.get(feeToken);
    this.cancelOrderID(order.stateID, order.accountID, order.tokenIdS, order.orderID, feeTokenID, fee);
  }

  public addWithdrawalRequest(withdrawalRequests: WithdrawalRequest[],
                              accountID: number, tokenID: number, amount: BN,
                              feeTokenID: number, fee: BN,
                              withdrawBlockIdx?: number) {
    withdrawalRequests.push({accountID, tokenID, amount, feeTokenID, fee, withdrawBlockIdx});
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
      ["operator/create_block.py", "" + stateID, "" + blockType, inputFilename, outputFilename],
      {stdio: "inherit"},
    );
    assert(result.status === 0, "create_block failed: " + blockType);

    return outputFilename;
  }

  public async commitBlock(blockType: number, data: string, filename: string) {
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
    pjs.logInfo("\x1b[46m%s\x1b[0m", "[verifyBlock] Gas used: " + tx.receipt.gasUsed);

    return proofFilename;
  }

  public async verifyAllPendingBlocks() {
    for (const block of this.pendingBlocks) {
      await this.verifyBlock(block.blockIdx, block.filename);
    }
    this.pendingBlocks = [];
  }

  public async commitDeposits(stateID: number) {
    const pendingDeposits = this.pendingDeposits[stateID];
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
      bs.addNumber(0, 32);

      // Commit the block
      await this.commitBlock(1, bs.getData(), blockFilename);
    }

    this.pendingDeposits[stateID] = [];
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
            feeTokenID: 0,
            fee: new BN(0),
          };
          withdrawalRequests.push(dummyWithdrawalRequest);
          isFull = false;
        }
      }
      assert(withdrawalRequests.length === numWithdrawsPerBlock);

      const operatorAccountID = this.operatorAccountID;
      const withdrawalBlock: WithdrawBlock = {
        withdrawals: withdrawalRequests,
        operatorAccountID,
      };

      if (onchain) {
        let timeToWait = (await this.exchange.MIN_TIME_CLOSED_DEPOSIT_BLOCK_UNTIL_COMMITTABLE()).toNumber();
        if (!isFull) {
          timeToWait += (await this.exchange.MAX_TIME_OPEN_DEPOSIT_BLOCK()).toNumber();
        }
        await this.advanceBlockTimestamp(timeToWait);
      }

      const jWithdrawalsInfo = JSON.stringify(withdrawalBlock, replacer, 4);
      const blockFilename = await this.createBlock(stateID, blockType, jWithdrawalsInfo);
      const jWithdrawals = fs.readFileSync(blockFilename, "ascii");
      const jwithdrawals = JSON.parse(jWithdrawals);
      const bs = new pjs.Bitstream();
      bs.addNumber(jwithdrawals.stateID, 2);
      bs.addBigNumber(new BigNumber(jwithdrawals.merkleRootBefore, 10), 32);
      bs.addBigNumber(new BigNumber(jwithdrawals.merkleRootAfter, 10), 32);
      bs.addNumber(0, 32);
      for (const withdrawal of jwithdrawals.withdrawals) {
        bs.addNumber(withdrawal.accountID, 3);
        bs.addNumber(withdrawal.tokenID, 2);
        bs.addBN(web3.utils.toBN(withdrawal.amountWithdrawn), 12);
        bs.addNumber(withdrawal.burnPercentage, 1);
      }
      if (!onchain) {
        for (const withdrawal of jwithdrawals.withdrawals) {
          bs.addNumber(withdrawal.feeTokenID, 2);
          bs.addBN(web3.utils.toBN(withdrawal.fee), 12);
        }
      }

      // Commit the block
      await this.commitBlock(blockType, bs.getData(), blockFilename);
      const blockIdx = (await this.exchange.getBlockIdx(web3.utils.toBN(stateID))).toNumber();

      // Add as a pending withdrawal
      let withdrawalIdx = 0;
      for (const withdrawalRequest of jwithdrawals.withdrawals) {
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

  public async submitPendingWithdrawals(ring: RingInfo) {
    const addressBook = this.getAddressBook(ring);

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
      const to = addressBook[items[0][0]];
      const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(tokenAddress);
      const decimals = this.testContext.tokenAddrDecimalsMap.get(tokenAddress);
      const amount = items[0][2].div(web3.utils.toBN(10 ** decimals)).toString(10);
      console.log("Withdrawn: " + to + ": " + amount + " " + tokenSymbol);
    }

    this.pendingWithdrawals = [];
  }

  public async commitRings(stateID: number, operatorAccountID?: number) {
    const pendingRings = this.pendingRings[stateID];
    if (pendingRings.length === 0) {
      return;
    }

    // Generate the token transfers for the ring
    operatorAccountID = operatorAccountID ? operatorAccountID : this.operatorAccountID;
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
            minerAccountID: this.minerAccountID,
            fee: 0,
          };
          rings.push(dummyRing);
        }
      }
      assert(rings.length === numRingsPerBlock);

      const ringBlock: RingBlock = {
        rings,
        timestamp,
        stateID,
        operatorAccountID,
      };

      // Create the block
      const blockFilename = await this.createBlock(stateID, 0, JSON.stringify(ringBlock, replacer, 4));

      // Read in the block
      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

      const bs = new pjs.Bitstream();
      bs.addNumber(stateID, 2);
      bs.addBigNumber(new BigNumber(block.merkleRootBefore, 10), 32);
      bs.addBigNumber(new BigNumber(block.merkleRootAfter, 10), 32);
      bs.addBigNumber(new BigNumber(block.burnRateMerkleRoot, 10), 32);
      bs.addNumber(ringBlock.timestamp, 4);
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
            feeTokenID: 0,
            fee: new BN(0),
          };
          cancels.push(dummyCancel);
        }
      }
      assert(cancels.length === numCancelsPerBlock);

      const operatorAccountID = this.operatorAccountID;
      const cancelBlock: CancelBlock = {
        cancels,
        operatorAccountID,
      };

      // Create the block
      const blockFilename = await this.createBlock(stateID, 4, JSON.stringify(cancelBlock, replacer, 4));

      // Read in the block
      const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

      const bs = new pjs.Bitstream();
      bs.addNumber(block.stateID, 2);
      bs.addBigNumber(new BigNumber(block.merkleRootBefore, 10), 32);
      bs.addBigNumber(new BigNumber(block.merkleRootAfter, 10), 32);
      for (const cancel of cancels) {
        bs.addNumber(cancel.accountID, 3);
        bs.addNumber(cancel.orderTokenID, 2);
        bs.addNumber(cancel.orderID, 2);
        bs.addNumber(cancel.feeTokenID, 2);
        bs.addBN(cancel.fee, 12);
      }

      // Commit the block
      await this.commitBlock(4, bs.getData(), blockFilename);
    }

    this.pendingCancels[stateID] = [];
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
    const [exchange, tokenRegistry, blockVerifier, lrcToken] = await Promise.all([
        this.contracts.Exchange.deployed(),
        this.contracts.TokenRegistry.deployed(),
        this.contracts.BlockVerifier.deployed(),
        this.contracts.LRCToken.deployed(),
      ]);

    this.exchange = exchange;
    this.tokenRegistry = tokenRegistry;
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
