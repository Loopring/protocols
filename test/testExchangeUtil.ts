import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import childProcess = require("child_process");
import ethUtil = require("ethereumjs-util");
import fs = require("fs");
import * as pjs from "protocol2-js";
import util = require("util");
import { Artifacts } from "../util/Artifacts";
import { Context } from "./context";
import { ExchangeTestContext } from "./testExchangeContext";
import { OrderInfo, RingInfo, RingsInfo, TokenTransfer } from "./types";

export class ExchangeTestUtil {
  public context: Context;
  public testContext: ExchangeTestContext;
  public exchange: any;

  private contracts = new Artifacts(artifacts);

  public async initialize(accounts: string[]) {
    this.context = await this.createContractContext();
    this.testContext = await this.createExchangeTestContext(accounts);
    await this.authorizeTradeDelegate();
    await this.approveTradeDelegate();
    await this.cleanTradeHistory();
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
    let transferItems: Array<[string, string, string, BigNumber]> = [];
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
    const events: any = await this.getEventsFromContract(contract, eventName, 0);

    events.forEach((e: any) => {
      pjs.logDebug("event:", util.inspect(e.args, false, null));
    });
  }

  public async setupRings(ringsInfo: RingsInfo) {
    for (const [i, ring] of ringsInfo.rings.entries()) {
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
      order.validSince = (await web3.eth.getBlock(blockNumber)).timestamp - 1000;
    }
    if (!order.validUntil && (order.index % 2) === 1) {
      // Set the order validUntil time to a bit after the current timestamp;
      const blockNumber = await web3.eth.getBlockNumber();
      order.validUntil = (await web3.eth.getBlock(blockNumber)).timestamp + 2500;
    }

    // Fill in defaults (default, so these will not get serialized)
    order.version = 0;
    order.validUntil = order.validUntil ? order.validUntil : 0;
    order.tokenF = order.tokenF ? order.tokenF : this.context.lrcAddress;
    order.amountF = order.amountF ? order.amountF : 0;

    // setup initial balances:
    await this.setOrderBalances(order);
  }

  public async setOrderBalances(order: pjs.OrderInfo) {
    const tokenS = this.testContext.tokenAddrInstanceMap.get(order.tokenS);
    const balanceS = (order.balanceS !== undefined) ? order.balanceS : order.amountS;
    await tokenS.setBalance(order.owner, web3.utils.toBN(new BigNumber(balanceS)));

    const balanceF = (order.balanceF !== undefined) ? order.balanceF : order.amountF;
    if (order.tokenF === order.tokenS) {
      tokenS.addBalance(order.owner, web3.utils.toBN(new BigNumber(balanceF)));
    } else {
      const tokenF = this.testContext.tokenAddrInstanceMap.get(order.tokenF);
      await tokenF.setBalance(order.owner, web3.utils.toBN(new BigNumber(balanceF)));
    }

    if (order.balanceB) {
      const tokenB = this.testContext.tokenAddrInstanceMap.get(order.tokenB);
      await tokenB.setBalance(order.owner, web3.utils.toBN(new BigNumber(order.balanceB)));
    }
  }

  public getAddressBook(ringsInfo: pjs.RingsInfo) {
    const addAddress = (addrBook: { [id: string]: any; }, address: string, name: string) => {
      addrBook[address] = (addrBook[address] ? addrBook[address] + "=" : "") + name;
    };

    const addressBook: { [id: string]: string; } = {};
    const feeRecipient = ringsInfo.feeRecipient ? ringsInfo.feeRecipient  : ringsInfo.transactionOrigin;
    const miner = ringsInfo.miner ? ringsInfo.miner : feeRecipient;
    addAddress(addressBook, ringsInfo.transactionOrigin, "Tx.origin");
    addAddress(addressBook, miner, "Miner");
    addAddress(addressBook, feeRecipient, "FeeRecipient");
    for (const [i, order] of ringsInfo.orders.entries()) {
      addAddress(addressBook, order.owner, "Owner[" + i + "]");
      if (order.owner !== order.tokenRecipient) {
        addAddress(addressBook, order.tokenRecipient, "TokenRecipient[" + i + "]");
      }
      addAddress(addressBook, order.walletAddr, "Wallet[" + i + "]");
      addAddress(addressBook, order.hash.toString("hex"), "Hash[" + i + "]");
    }
    return addressBook;
  }

  public assertTransfers(ringsInfo: pjs.RingsInfo,
                         tranferEvents: Array<[string, string, string, BigNumber]>,
                         transferList: pjs.TransferItem[]) {
    const transfersFromSimulator: Array<[string, string, string, BigNumber]> = [];
    transferList.forEach((item) => transfersFromSimulator.push([item.token, item.from, item.to, item.amount]));
    const sorter = (a: [string, string, string, BigNumber], b: [string, string, string, BigNumber]) => {
      if (a[0] === b[0]) {
        if (a[1] === b[1]) {
          if (a[2] === b[2]) {
            return a[3].minus(b[3]).toNumber();
          } else {
            return a[2] > b[2] ? 1 : -1;
          }
        } else {
          return a[1] > b[1] ? 1 : -1;
        }
      } else {
        return a[0] > b[0] ? 1 : -1;
      }
    };

    transfersFromSimulator.sort(sorter);
    tranferEvents.sort(sorter);
    const addressBook = this.getAddressBook(ringsInfo);
    pjs.logDebug("transfer items from simulator:");
    transfersFromSimulator.forEach((t) => {
      const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(t[0]);
      const decimals = this.testContext.tokenAddrDecimalsMap.get(t[0]);
      const fromName = addressBook[t[1]];
      const toName = addressBook[t[2]];
      pjs.logDebug(fromName + " -> " + toName + " : " + t[3].toNumber() / (10 ** decimals) + " " + tokenSymbol);
    });
    pjs.logDebug("transfer items from contract:");
    tranferEvents.forEach((t) => {
      const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(t[0]);
      const decimals = this.testContext.tokenAddrDecimalsMap.get(t[0]);
      const fromName = addressBook[t[1]];
      const toName = addressBook[t[2]];
      pjs.logDebug(fromName + " -> " + toName + " : " +
        (new BigNumber(t[3].toString()).toNumber() / (10 ** decimals)) + " " + tokenSymbol);
    });
    assert.equal(tranferEvents.length, transfersFromSimulator.length, "Number of transfers do not match");
    for (let i = 0; i < tranferEvents.length; i++) {
      const transferFromEvent = tranferEvents[i];
      const transferFromSimulator = transfersFromSimulator[i];
      assert.equal(transferFromEvent[0], transferFromSimulator[0]);
      assert.equal(transferFromEvent[1], transferFromSimulator[1]);
      assert.equal(transferFromEvent[2], transferFromSimulator[2]);
      assert(new BigNumber(transferFromEvent[3].toString()).eq(transferFromSimulator[3]),
             "Transfer amount does not match");
    }
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

  public addTokenTransfer(transfers: TokenTransfer[], token: string, from: string, to: string, amount: number) {
    transfers.push({token, from, to, amount});
  }

  public async settleRing(transfers: TokenTransfer[], ring: RingInfo) {
    const orderA = ring.orderA;
    const orderB = ring.orderB;

    ring.fillS_A = orderA.amountS / 100;
    ring.fillB_A = orderA.amountB / 100;
    ring.fillF_A = orderA.amountF / 100;
    ring.fillS_B = orderB.amountS / 100;
    ring.fillB_B = orderB.amountB / 100;
    ring.fillF_B = orderB.amountF / 100;

    this.addTokenTransfer(transfers, orderA.tokenS, orderA.owner, orderB.owner, ring.fillS_A);
    this.addTokenTransfer(transfers, orderA.tokenF, orderA.owner, orderB.owner, ring.fillF_A);
    this.addTokenTransfer(transfers, orderB.tokenS, orderB.owner, orderA.owner, ring.fillS_B);
    this.addTokenTransfer(transfers, orderB.tokenF, orderB.owner, orderA.owner, ring.fillF_B);
  }

  public async settleRings(ringsInfo: RingsInfo) {
    const transfers: TokenTransfer[] = [];
    for (const ring of ringsInfo.rings) {
      this.settleRing(transfers, ring);
    }
    return transfers;
  }

  public async submitRings(ringsInfo: RingsInfo) {
    // Generate the token transfers for the ring
    const transfers = await this.settleRings(ringsInfo);

    // Write out the rings info
    const jRingsInfo = JSON.stringify(ringsInfo, null, 4);
    fs.writeFileSync("rings_info.json", jRingsInfo, "utf8");

    // Generate the proof
    childProcess.spawnSync("python3", ["generate_proof.py"], {stdio: "inherit"});

    // Read the proof
    const jProof = fs.readFileSync("proof.json", "ascii");
    const proof = JSON.parse(jProof);
    const proofFlattened = this.flattenProof(proof);
    // console.log(proof);
    // console.log(this.flattenProof(proof));

    const jRings = fs.readFileSync("rings.json", "ascii");
    const rings = JSON.parse(jRings);

    const bs = new pjs.Bitstream();
    // console.log(rings.rootBefore);
    bs.addBigNumber(new BigNumber(rings.merkleRootBefore, 10), 32);
    bs.addBigNumber(new BigNumber(rings.merkleRootAfter, 10), 32);
    for (const transfer of transfers) {
      bs.addAddress(transfer.token, 20);
      bs.addAddress(transfer.from, 20);
      bs.addAddress(transfer.to, 20);
      bs.addNumber(transfer.amount, 16);
    }

    // Hash all public inputs to a singe value
    const publicDataHash = ethUtil.sha256(bs.getData());
    // console.log("DataJS: " + bs.getData());
    // console.log(publicDataHash.toString("hex"));
    ringsInfo.publicDataHash = publicDataHash.toString("hex");

    // Read the verification key and set it in the smart contract
    const jVK = fs.readFileSync("vk.json", "ascii");
    const vk = JSON.parse(jVK);
    const vkFlattened = this.flattenVK(vk);
    await this.exchange.setVerifyingKey(vkFlattened[0], vkFlattened[1]);

    // Submit the rings
    const tx = await this.exchange.submitRings(web3.utils.hexToBytes(bs.getData()), proofFlattened);
    pjs.logInfo("\x1b[46m%s\x1b[0m", "Gas used: " + tx.receipt.gasUsed);

    // const transferEvents = await this.getTransferEvents(this.testContext.allTokens, web3.eth.blockNumber);
    // this.assertTransfers(ringsInfo, transferEvents, report.transferItems);

    return tx;
  }

  public async authorizeTradeDelegate() {
    const alreadyAuthorized = await this.context.tradeDelegate.methods.isAddressAuthorized(
      this.exchange.address,
    ).call();
    if (!alreadyAuthorized) {
      await this.context.tradeDelegate.methods.authorizeAddress(
        this.exchange.address,
      ).send({from: this.testContext.deployer});
    }
  }

  public async approveTradeDelegate() {
    for (const token of this.testContext.allTokens) {
      // approve once for all orders:
      for (const orderOwner of this.testContext.orderOwners) {
        await token.approve(this.context.tradeDelegate.options.address,
                            web3.utils.toBN(new BigNumber(1e31)),
                            {from: orderOwner});
      }
    }
  }

  public async cleanTradeHistory() {
    if (fs.existsSync("dex.json")) {
      fs.unlinkSync("dex.json");
    }
  }

  private getPrivateKey(address: string) {
    const textData = fs.readFileSync("./ganache_account_keys.txt", "ascii");
    const data = JSON.parse(textData);
    return data.private_keys[address.toLowerCase()];
  }

  // private functions:
  private async createContractContext() {
    const [exchange, tradeDelegate, lrcToken] = await Promise.all([
        this.contracts.Exchange.deployed(),
        this.contracts.TradeDelegate.deployed(),
        this.contracts.LRCToken.deployed(),
      ]);

    this.exchange = exchange;

    const currBlockNumber = await web3.eth.getBlockNumber();
    const currBlockTimestamp = (await web3.eth.getBlock(currBlockNumber)).timestamp;
    return new Context(currBlockNumber,
                       currBlockTimestamp,
                       this.contracts.TradeDelegate.address,
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
