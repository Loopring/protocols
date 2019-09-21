import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import fs = require("fs");
import * as pjs from "protocol2-js";
import util = require("util");
import { Artifacts } from "../util/Artifacts";
import { FeePayments } from "./feePayments";
import { ExchangeTestContext } from "./testExchangeContext";

export class ExchangeTestUtil {
  public context: pjs.Context;
  public testContext: ExchangeTestContext;
  public ringSubmitter: any;

  private contracts = new Artifacts(artifacts);

  public async initialize(accounts: string[]) {
    this.context = await this.createContractContext();
    this.testContext = await this.createExchangeTestContext(accounts);
    await this.authorizeTradeDelegate();
    await this.authorizeTradeHistory();
    await this.approveTradeDelegate();
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

  public async getRingMinedEvents(fromBlock: number) {
    const parseFillsData = (data: string) => {
      const b = new pjs.Bitstream(data);
      const fillSize = 8 * 32;
      const numFills = b.length() / fillSize;
      const fills: pjs.Fill[] = [];
      for (let offset = 0; offset < b.length(); offset += fillSize) {
        const fill: pjs.Fill = {
          orderHash: "0x" + b.extractBytes32(offset).toString("hex"),
          owner: "0x" + b.extractBytes32(offset + 32).toString("hex").slice(24),
          tokenS: "0x" + b.extractBytes32(offset + 64).toString("hex").slice(24),
          amountS: b.extractUint(offset + 96),
          split: b.extractUint(offset + 128),
          feeAmount: b.extractUint(offset + 160),
          feeAmountS: b.extractUint(offset + 192),
          feeAmountB: b.extractUint(offset + 224),
        };
        fills.push(fill);
      }
      return fills;
    };
    const eventArr: any = await this.getEventsFromContract(this.ringSubmitter, "RingMined", fromBlock);
    const ringMinedEvents = eventArr.map((eventObj: any) => {
      const ringMinedEvent: pjs.RingMinedEvent = {
        ringIndex: new BigNumber(eventObj.args._ringIndex.toString()),
        ringHash: eventObj.args._ringHash,
        feeRecipient: eventObj.args._feeRecipient,
        fills: parseFillsData(eventObj.args._fills),
      };
      return ringMinedEvent;
    });
    return ringMinedEvents;
  }

  public async getInvalidRingEvents(fromBlock: number) {
    const eventArr: any = await this.getEventsFromContract(this.ringSubmitter, "InvalidRing", fromBlock);
    const invalidRingEvents = eventArr.map((eventObj: any) => {
      const invalidRingEvent: pjs.InvalidRingEvent = {
        ringHash: eventObj.args._ringHash,
      };
      return invalidRingEvent;
    });
    return invalidRingEvents;
  }

  public async watchAndPrintEvent(contract: any, eventName: string) {
    const events: any = await this.getEventsFromContract(contract, eventName, 0);

    events.forEach((e: any) => {
      pjs.logDebug("event:", util.inspect(e.args, false, null));
    });
  }

  public logDetailedTokenTransfer(addressBook: { [id: string]: string; },
                                  payment: pjs.DetailedTokenTransfer,
                                  depth: number = 0) {
    if (payment.amount === 0 && payment.subPayments.length === 0) {
      return;
    }
    const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(payment.token);
    const decimals = this.testContext.tokenAddrDecimalsMap.get(payment.token);
    const whiteSpace = " ".repeat(depth);
    const description = payment.description ? payment.description : "";
    const amount = (payment.amount / (10 ** decimals));
    if (payment.subPayments.length === 0) {
      const toName =  addressBook[payment.to];
      pjs.logDebug(whiteSpace + "- " + " [" + description + "] " + amount + " " + tokenSymbol + " -> " + toName);
    } else {
      pjs.logDebug(whiteSpace + "+ " + " [" + description + "] " + amount + " " + tokenSymbol);
      for (const subPayment of payment.subPayments) {
        this.logDetailedTokenTransfer(addressBook, subPayment, depth + 1);
      }
    }
  }

  public logDetailedTokenTransfers(ringsInfo: pjs.RingsInfo, report: pjs.SimulatorReport) {
    const addressBook = this.getAddressBook(ringsInfo);
    for (const [r, ring] of report.payments.rings.entries()) {
      pjs.logDebug("# Payments for ring " + r + ": ");
      for (const [o, order] of ring.orders.entries()) {
        pjs.logDebug("## Order " + o + ": ");
        for (const payment of order.payments) {
          this.logDetailedTokenTransfer(addressBook, payment, 1);
        }
      }
    }
  }

  public setPrimaryTokenForOrders(orders: pjs.OrderInfo[]) {
    return orders.map((order: pjs.OrderInfo) => {
      const primaryToken = order.tokenS < order.tokenB ? order.tokenS : order.tokenB;

      return {
        ...order,
        trancheB: primaryToken,
      };
    });
  }

  public async setupRings(ringsInfo: pjs.RingsInfo) {
    if (ringsInfo.transactionOrigin === undefined) {
      ringsInfo.transactionOrigin = this.testContext.transactionOrigin;
      ringsInfo.feeRecipient = this.testContext.feeRecipient;
      ringsInfo.miner = this.testContext.miner;
      ringsInfo.signerPrivateKey = this.getPrivateKey(this.testContext.miner);
    } else {
      if (!ringsInfo.transactionOrigin.startsWith("0x")) {
        const accountIndex = parseInt(ringsInfo.transactionOrigin, 10);
        assert(accountIndex >= 0 && accountIndex < this.testContext.orderOwners.length, "Invalid owner index");
        ringsInfo.transactionOrigin = this.testContext.orderOwners[accountIndex];
        ringsInfo.feeRecipient = undefined;
        ringsInfo.miner = undefined;
      }
    }
    ringsInfo.orders = this.setPrimaryTokenForOrders(ringsInfo.orders);
    for (const [i, order] of ringsInfo.orders.entries()) {
      await this.setupOrder(order, i);
    }
  }

  public async setupOrder(order: pjs.OrderInfo, index: number) {
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
    if (order.feeToken && !order.feeToken.startsWith("0x")) {
      order.feeToken = this.testContext.tokenSymbolAddrMap.get(order.feeToken);
    }
    if (order.feeAmount === undefined) {
      order.feeAmount = 1e18;
    }
    if (!order.dualAuthSignAlgorithm) {
      order.dualAuthSignAlgorithm = pjs.SignAlgorithm.Ethereum;
    }
    // no dualAuthAddr for onChain order
    if (!order.onChain && order.dualAuthAddr && !order.dualAuthAddr.startsWith("0x")) {
      const dualAuthorIndex = parseInt(order.dualAuthAddr, 10);
      assert(dualAuthorIndex >= 0 && dualAuthorIndex < this.testContext.orderDualAuthAddrs.length,
             "Invalid dual author index");
      order.dualAuthAddr = this.testContext.orderDualAuthAddrs[dualAuthorIndex];
    }
    if (!order.onChain &&
        order.dualAuthAddr === undefined &&
        order.dualAuthSignAlgorithm !== pjs.SignAlgorithm.None) {
      const accountIndex = index % this.testContext.orderDualAuthAddrs.length;
      order.dualAuthAddr = this.testContext.orderDualAuthAddrs[accountIndex];
      order.dualAuthAddr = this.testContext.orderDualAuthAddrs[accountIndex];
    }
    if (order.dualAuthAddr) {
      order.dualAuthPrivateKey = this.getPrivateKey(order.dualAuthAddr);
    }
    if (!order.allOrNone) {
      order.allOrNone = false;
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

    if (order.walletAddr && !order.walletAddr.startsWith("0x")) {
      const walletIndex = parseInt(order.walletAddr, 10);
      assert(walletIndex >= 0 && walletIndex < this.testContext.wallets.length,
             "Invalid wallet index");
      order.walletAddr = this.testContext.wallets[walletIndex];
    }
    if (order.walletAddr === undefined) {
      order.walletAddr = this.testContext.wallets[0];
    }
    if (order.walletAddr && order.walletSplitPercentage === undefined) {
      order.walletSplitPercentage = ((index + 1) * 10) % 100;
    }
    if (order.tokenRecipient !== undefined && !order.tokenRecipient.startsWith("0x")) {
      const accountIndex = parseInt(order.tokenRecipient, 10);
      assert(accountIndex >= 0 && accountIndex < this.testContext.allOrderTokenRecipients.length,
             "Invalid token recipient index");
      order.tokenRecipient = this.testContext.allOrderTokenRecipients[accountIndex];
    }
    if (order.signAlgorithm === undefined) {
      const signAlgorithmIndex = index % 2;
      order.signAlgorithm = (signAlgorithmIndex === 0) ? pjs.SignAlgorithm.Ethereum : pjs.SignAlgorithm.EIP712;
      order.signerPrivateKey = this.getPrivateKey(order.owner);
    }
    if (order.signAlgorithm === pjs.SignAlgorithm.EIP712) {
      order.signerPrivateKey = this.getPrivateKey(order.owner);
    }
    order.signerPrivateKey = this.getPrivateKey(order.owner);
    if (order.trancheB && !order.trancheB.startsWith("0x")) {
      const tokenAddress = this.testContext.tokenSymbolAddrMap.get(order.trancheB).replace("0x", "");
      order.trancheB = "0x" + "0".repeat(24) + tokenAddress;
    }
    // Fill in defaults (default, so these will not get serialized)
    order.version = 0;
    order.validUntil = order.validUntil ? order.validUntil : 0;
    order.tokenRecipient = order.tokenRecipient ? order.tokenRecipient : order.owner;
    order.feeToken = order.feeToken ? order.feeToken : this.context.lrcAddress;
    order.feeAmount = order.feeAmount ? order.feeAmount : 0;
    order.waiveFeePercentage = order.waiveFeePercentage ? order.waiveFeePercentage : 0;
    order.tokenSFeePercentage = order.tokenSFeePercentage ? order.tokenSFeePercentage : 0;
    order.tokenBFeePercentage = order.tokenBFeePercentage ? order.tokenBFeePercentage : 0;
    order.walletSplitPercentage = order.walletSplitPercentage ? order.walletSplitPercentage : 0;
    order.tokenTypeS = order.tokenTypeS ? order.tokenTypeS : pjs.TokenType.ERC20;
    order.tokenTypeB = order.tokenTypeB ? order.tokenTypeB : pjs.TokenType.ERC20;
    order.tokenTypeFee = order.tokenTypeFee ? order.tokenTypeFee : pjs.TokenType.ERC20;
    order.trancheS = order.trancheS ? order.trancheS : "0x" + "0".repeat(64);
    order.trancheB = order.trancheB ? order.trancheB : "0x" + "0".repeat(64);
    order.transferDataS = order.transferDataS ? order.transferDataS : "0x";

    // setup initial balances:
    await this.setOrderBalances(order);
  }

  public async setOrderBalances(order: pjs.OrderInfo) {
    const tokenS = this.testContext.tokenAddrInstanceMap.get(order.tokenS);
    const balanceS = (order.balanceS !== undefined) ? order.balanceS : order.amountS;
    await tokenS.setBalance(order.owner, web3.utils.toBN(new BigNumber(balanceS)));

    const feeToken = order.feeToken ? order.feeToken : this.context.lrcAddress;
    const balanceFee = (order.balanceFee !== undefined) ? order.balanceFee : order.feeAmount;
    if (feeToken === order.tokenS) {
      tokenS.addBalance(order.owner, web3.utils.toBN(new BigNumber(balanceFee)));
    } else {
      const tokenFee = this.testContext.tokenAddrInstanceMap.get(feeToken);
      await tokenFee.setBalance(order.owner, web3.utils.toBN(new BigNumber(balanceFee)));
    }

    if (order.balanceB) {
      const tokenB = this.testContext.tokenAddrInstanceMap.get(order.tokenB);
      await tokenB.setBalance(order.owner, web3.utils.toBN(new BigNumber(order.balanceB)));
    }
  }

  public async getFilled(hash: Buffer) {
    return new BigNumber(
      (await this.context.tradeHistory.methods.filled("0x" + hash.toString("hex")).call()).toString(),
    ).toNumber();
  }

  public async checkFilled(hash: Buffer, expected: number) {
    const filled = await this.getFilled(hash);
    this.assertNumberEqualsWithPrecision(filled, expected);
  }

  public assertEqualsRingsInfo(ringsInfoA: pjs.RingsInfo, ringsInfoB: pjs.RingsInfo) {
    // Revert defaults back to undefined
    ringsInfoA.miner = (ringsInfoA.miner === ringsInfoA.feeRecipient) ? undefined : ringsInfoA.miner;
    ringsInfoB.miner = (ringsInfoB.miner === ringsInfoB.feeRecipient) ? undefined : ringsInfoB.miner;

    // Blacklist properties we don't want to check.
    // We don't whitelist because we might forget to add them here otherwise.
    const ringsInfoPropertiesToSkip = ["description", "signAlgorithm", "hash", "expected", "signerPrivateKey"];
    const orderPropertiesToSkip = [
      "maxAmountS", "fillAmountS", "fillAmountB", "fillAmountFee", "splitS", "brokerInterceptor",
      "valid", "hash", "delegateContract", "signAlgorithm", "dualAuthSignAlgorithm", "index", "lrcAddress",
      "balanceS", "balanceFee", "tokenSpendableS", "tokenSpendableFee",
      "brokerSpendableS", "brokerSpendableFee", "onChain", "balanceB", "signerPrivateKey",
      "trancheB", "dualAuthPrivateKey",
    ];

    // Make sure to get the keys from both objects to make sure we get all keys defined in both
    for (const key of [...Object.keys(ringsInfoA), ...Object.keys(ringsInfoB)]) {
      if (ringsInfoPropertiesToSkip.every((x) => x !== key)) {
        if (key === "rings") {
          assert.equal(ringsInfoA.rings.length, ringsInfoB.rings.length,
                       "Number of rings does not match");
          for (let r = 0; r < ringsInfoA.rings.length; r++) {
            assert.equal(ringsInfoA.rings[r].length, ringsInfoB.rings[r].length,
                         "Number of orders in rings does not match");
            for (let o = 0; o < ringsInfoA.rings[r].length; o++) {
              assert.equal(ringsInfoA.rings[r][o], ringsInfoB.rings[r][o],
                           "Order indices in rings do not match");
            }
          }
        } else if (key === "orders") {
          assert.equal(ringsInfoA.orders.length, ringsInfoB.orders.length,
                       "Number of orders does not match");
          for (let o = 0; o < ringsInfoA.orders.length; o++) {
            for (const orderKey of [...Object.keys(ringsInfoA.orders[o]), ...Object.keys(ringsInfoB.orders[o])]) {
              if (orderPropertiesToSkip.every((x) => x !== orderKey)) {
                assert.equal(ringsInfoA.orders[o][orderKey], ringsInfoB.orders[o][orderKey],
                             "Order property '" + orderKey + "' does not match");
              }
            }
          }
        } else {
            assert.equal(ringsInfoA[key], ringsInfoB[key],
                         "RingInfo property '" + key + "' does not match");
        }
      }
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
    addAddress(addressBook, this.context.feeHolder.options.address, "FeeHolder");
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

  public assertRingMinedEvents(ringMinedEventsContract: pjs.RingMinedEvent[],
                               ringMinedEventsSimulator: pjs.RingMinedEvent[]) {
    assert.equal(ringMinedEventsContract.length, ringMinedEventsSimulator.length,
                 "Number of RingMined events does not match");
    for (let i = 0; i < ringMinedEventsContract.length; i++) {
      const contractEvent = ringMinedEventsContract[i];
      const simulatorEvent = ringMinedEventsSimulator[i];
      // assert(contractEvent.ringIndex.eq(simulatorEvent.ringIndex), "ringIndex does not match");
      assert.equal(contractEvent.ringHash, simulatorEvent.ringHash, "ringHash does not match");
      assert.equal(contractEvent.feeRecipient.toLowerCase(), simulatorEvent.feeRecipient.toLowerCase(),
                   "feeRecipient does not match");
      assert.equal(contractEvent.fills.length, simulatorEvent.fills.length, "fills length does not match");
      for (let f = 0; f < contractEvent.fills.length; f++) {
        const contractFill = contractEvent.fills[f];
        const simulatorFill = simulatorEvent.fills[f];
        assert.equal(contractFill.orderHash, simulatorFill.orderHash, "orderHash does not match");
        assert.equal(contractFill.owner.toLowerCase(), simulatorFill.owner.toLowerCase(),
                     "owner does not match");
        assert.equal(contractFill.tokenS.toLowerCase(), simulatorFill.tokenS.toLowerCase(),
                     "tokenS does not match");
        assert(contractFill.amountS.eq(simulatorFill.amountS), "amountS does not match");
        assert(contractFill.split.eq(simulatorFill.split), "split does not match");
        assert(contractFill.feeAmount.eq(simulatorFill.feeAmount), "feeAmount does not match");
        assert(contractFill.feeAmountS.eq(simulatorFill.feeAmountS), "feeAmountS does not match");
        assert(contractFill.feeAmountB.eq(simulatorFill.feeAmountB), "feeAmountB does not match");
      }
    }
  }

  public assertInvalidRingEvents(invalidRingEventsContract: pjs.InvalidRingEvent[],
                                 invalidRingEventsSimulator: pjs.InvalidRingEvent[]) {
    assert.equal(invalidRingEventsContract.length, invalidRingEventsSimulator.length,
                 "Number of InvalidRing events does not match");
    for (let i = 0; i < invalidRingEventsContract.length; i++) {
      const contractEvent = invalidRingEventsContract[i];
      const simulatorEvent = invalidRingEventsSimulator[i];
      assert.equal(contractEvent.ringHash, simulatorEvent.ringHash, "ringHash does not match");
    }
  }

  public async assertFeeBalances(ringsInfo: pjs.RingsInfo,
                                 feeBalancesBefore: { [id: string]: any; },
                                 feeBalancesAfter: { [id: string]: any; }) {
    const addressBook = this.getAddressBook(ringsInfo);
    pjs.logDebug("Fee balances:");
    for (const token of Object.keys(feeBalancesAfter)) {
      for (const owner of Object.keys(feeBalancesAfter[token])) {
        const balanceFromSimulator = feeBalancesAfter[token][owner];
        const balanceFromContract =
          new BigNumber((await this.context.feeHolder.methods.feeBalances(token, owner).call()).toString());
        if (!feeBalancesBefore[token][owner].eq(feeBalancesAfter[token][owner])) {
          const ownerName = addressBook[owner] ? addressBook[owner] : owner;
          const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(token);
          const decimals = this.testContext.tokenAddrDecimalsMap.get(token);
          pjs.logDebug(ownerName + ": " +
                      balanceFromContract.toNumber()  / (10 ** decimals) + " " + tokenSymbol + " " +
                      "(Simulator: " + balanceFromSimulator  / (10 ** decimals) + ")");
        }
        assert(balanceFromContract.eq(balanceFromSimulator), "Fee balance doesn't match");
      }
    }
  }

  public async assertFilledAmounts(ringsInfo: pjs.RingsInfo,
                                   filledAmounts: { [hash: string]: BigNumber; }) {
    const addressBook = this.getAddressBook(ringsInfo);
    pjs.logDebug("Filled amounts:");
    for (const hash of Object.keys(filledAmounts)) {
      let hashOrder: pjs.OrderInfo = null;
      for (const order of ringsInfo.orders) {
        if (order.hash.toString("hex") === hash) {
          hashOrder = order;
        }
      }
      const filledFromSimulator = filledAmounts[hash];
      const filledFromContract = new BigNumber(
        (await this.context.tradeHistory.methods.filled("0x" + hash).call()).toString(),
      );
      let percentageFilled = 0;
      let decimals = 18;
      if (hashOrder) {
        percentageFilled = filledFromContract.toNumber() * 100 / hashOrder.amountS;
        decimals = this.testContext.tokenAddrDecimalsMap.get(hashOrder.tokenS);
      }
      const hashName = addressBook[hash];
      pjs.logDebug(hashName + ": " + filledFromContract.toNumber() / (10 ** decimals) +
                  " (Simulator: " + filledFromSimulator.toNumber() / (10 ** decimals) + ")" +
                  " (" + percentageFilled + "%)");
      assert(filledFromContract.eq(filledFromSimulator), "Filled amount doesn't match");
    }
  }

  public async assertOrdersValid(orders: pjs.OrderInfo[], expectedValidValues: boolean[]) {
    assert.equal(orders.length, expectedValidValues.length, "Array sizes need to match");

    const bitstream = new pjs.Bitstream();
    for (const order of orders) {
      const broker = order.broker ? order.broker : order.owner;
      bitstream.addAddress(broker, 32);
      bitstream.addAddress(order.owner, 32);
      bitstream.addHex(order.hash.toString("hex"));
      bitstream.addNumber(order.validSince, 32);
      bitstream.addHex(pjs.xor(order.tokenS, order.tokenB, 20).slice(2));
      bitstream.addNumber(0, 12);
    }

    const fills = await this.context.tradeHistory.methods.batchGetFilledAndCheckCancelled(
      bitstream.getBytes32Array(),
    ).call();

    const cancelledValue = new BN("F".repeat(64), 16);
    for (const [i, order] of orders.entries()) {
      const fillBN = new BN(new BigNumber(fills[i].toString(16)).toString(16), 16);
      assert.equal(!fillBN.eq(cancelledValue), expectedValidValues[i], "Order cancelled status incorrect");
    }
  }

  public async registerOrderBrokerChecked(user: string, broker: string, interceptor: string) {
    const brokerRegistry = await this.contracts.BrokerRegistry.at(this.context.orderBrokerRegistry.options.address);
    await brokerRegistry.registerBroker(broker, interceptor, {from: user});
    await this.assertOrderBrokerRegistered(user, broker, interceptor);
  }

  public async unregisterOrderBrokerChecked(user: string, broker: string) {
    const brokerRegistry = await this.contracts.BrokerRegistry.at(this.context.orderBrokerRegistry.options.address);
    await brokerRegistry.unregisterBroker(broker, {from: user});
    await this.assertOrderBrokerNotRegistered(user, broker);
  }

  public async assertOrderBrokerRegistered(user: string, broker: string, interceptor: string) {
    const brokerRegistry = await this.contracts.BrokerRegistry.at(this.context.orderBrokerRegistry.options.address);
    const returnValue = await brokerRegistry.getBroker(user, broker);
    assert(returnValue.registered, "interceptor should be registered.");
    assert.equal(interceptor, returnValue.interceptor, "get wrong interceptor");
  }

  public async assertOrderBrokerNotRegistered(user: string, broker: string) {
    const brokerRegistry = await this.contracts.BrokerRegistry.at(this.context.orderBrokerRegistry.options.address);
    const returnValue = await brokerRegistry.getBroker(user, broker);
    assert(!returnValue.registered, "interceptor should not be registered.");
  }

  public async deserializeRing(ringsInfo: pjs.RingsInfo) {
    const ringsGenerator = new pjs.RingsGenerator(this.context);
    await ringsGenerator.setupRingsAsync(ringsInfo);
    const bs = ringsGenerator.toSubmitableParam(ringsInfo);
    return bs;
  }

  public async submitRings(ringsInfo: pjs.RingsInfo,
                           dummyExchange?: any,
                           submitter?: any) {
    if (dummyExchange !== undefined) {
      // Add an initial fee payment to all addresses to make gas use more realistic
      // (gas cost to change variable in storage: zero -> non-zero: 20,000 gas, non-zero -> non-zero: 5,000 gas)
      // Addresses getting fees will be getting a lot of fees so a balance of 0 is not realistic
      const feePayments = new FeePayments();
      for (const order of ringsInfo.orders) {
        // All tokens that could be paid to all recipients for this order
        const tokens = [order.feeToken, order.tokenS, order.tokenB];
        const feeRecipients = [order.owner, ringsInfo.feeRecipient,
                               this.context.feeHolder.options.address, order.walletAddr];
        for (const token of tokens) {
          for (const feeRecipient of feeRecipients) {
            if (feeRecipient) {
              feePayments.add(feeRecipient, token, web3.utils.toBN(1));
            }
          }
        }
        const minerFeeRecipient = ringsInfo.feeRecipient ? ringsInfo.feeRecipient : ringsInfo.transactionOrigin;
        // Add balances to the feeHolder contract
        for (const token of tokens) {
          const Token = this.testContext.tokenAddrInstanceMap.get(token);
          await Token.setBalance(this.context.feeHolder.options.address, 1);
          await Token.addBalance(minerFeeRecipient, 1);
        }
        // Add a balance to the owner balances
        // const TokenB = this.testContext.tokenAddrInstanceMap.get(order.tokenB);
        // await TokenB.setBalance(order.owner, 1);
      }
      await dummyExchange.batchAddFeeBalances(feePayments.getData());
    }

    const ringsGenerator = new pjs.RingsGenerator(this.context);
    await ringsGenerator.setupRingsAsync(ringsInfo);
    const bs = ringsGenerator.toSubmitableParam(ringsInfo);

    // const simulator = new pjs.ProtocolSimulator(this.context);
    const txOrigin = ringsInfo.transactionOrigin ? ringsInfo.transactionOrigin :
                                                   this.testContext.transactionOrigin;
    // const deserializedRingsInfo = simulator.deserialize(bs, txOrigin);
    // this.assertEqualsRingsInfo(deserializedRingsInfo, ringsInfo);
    // let report: any = {
    //   reverted: true,
    //   ringMinedEvents: [],
    //   invalidRingEvents: [],
    //   transferItems: [],
    //   feeBalancesBefore: [],
    //   feeBalancesAfter: [],
    //   filledAmountsBefore: [],
    //   filledAmountsAfter: [],
    //   balancesBefore: [],
    //   balancesAfter: [],
    //   payments: {rings: []},
    // };
    let tx = null;
    // try {
    //   report = await simulator.simulateAndReport(deserializedRingsInfo);
    //   this.logDetailedTokenTransfers(ringsInfo, report);
    // } catch (err) {
    //   pjs.logDebug("Simulator reverted -> " + err);
    //   report.revertMessage = err.message;
    // }

    // pjs.logDebug("shouldThrow:", report.reverted);

    const ringSubmitter = submitter ? submitter : this.ringSubmitter;
    // if (report.reverted) {
    //   tx = await pjs.expectThrow(
    //     ringSubmitter.submitRings(web3.utils.hexToBytes(bs), {from: txOrigin}),
    //     report.revertMessage,
    //   );
    // } else {
    tx = await ringSubmitter.submitRings(web3.utils.hexToBytes(bs), {from: txOrigin});
    pjs.logInfo("\x1b[46m%s\x1b[0m", "gas used: " + tx.receipt.gasUsed);
    // }
    const transferItems = await this.getTransferEvents(this.testContext.allTokens, web3.eth.blockNumber);
    const ringMinedEvents = await this.getRingMinedEvents(web3.eth.blockNumber);
    const invalidRingEvents = await this.getInvalidRingEvents(web3.eth.blockNumber);
    // this.assertTransfers(deserializedRingsInfo, transferEvents, report.transferItems);
    // this.assertRingMinedEvents(ringMinedEvents, report.ringMinedEvents);
    // this.assertInvalidRingEvents(invalidRingEvents, report.invalidRingEvents);
    // await this.assertFeeBalances(deserializedRingsInfo, report.feeBalancesBefore, report.feeBalancesAfter);
    // await this.assertFilledAmounts(deserializedRingsInfo, report.filledAmountsAfter);

    // const addressBook = this.getAddressBook(ringsInfo);
    // const protocolValidator = new pjs.ProtocolValidator(this.context);
    // await protocolValidator.verifyTransaction(ringsInfo, report, addressBook);

    // await this.watchAndPrintEvent(this.ringSubmitter, "LogUint");

    return {tx, report: { transferItems, ringMinedEvents, invalidRingEvents }};
  }

  public async submitRingsAndSimulate(ringsInfo: pjs.RingsInfo,
                                      dummyExchange?: any,
                                      submitter?: any) {
    if (dummyExchange !== undefined) {
      // Add an initial fee payment to all addresses to make gas use more realistic
      // (gas cost to change variable in storage: zero -> non-zero: 20,000 gas, non-zero -> non-zero: 5,000 gas)
      // Addresses getting fees will be getting a lot of fees so a balance of 0 is not realistic
      const feePayments = new FeePayments();
      for (const order of ringsInfo.orders) {
        // All tokens that could be paid to all recipients for this order
        const tokens = [order.feeToken, order.tokenS, order.tokenB];
        const feeRecipients = [order.owner, ringsInfo.feeRecipient,
                               this.context.feeHolder.options.address, order.walletAddr];
        for (const token of tokens) {
          for (const feeRecipient of feeRecipients) {
            if (feeRecipient) {
              feePayments.add(feeRecipient, token, web3.utils.toBN(1));
            }
          }
        }
        const minerFeeRecipient = ringsInfo.feeRecipient ? ringsInfo.feeRecipient : ringsInfo.transactionOrigin;
        // Add balances to the feeHolder contract
        for (const token of tokens) {
          const Token = this.testContext.tokenAddrInstanceMap.get(token);
          await Token.setBalance(this.context.feeHolder.options.address, 1);
          await Token.addBalance(minerFeeRecipient, 1);
        }
        // Add a balance to the owner balances
        // const TokenB = this.testContext.tokenAddrInstanceMap.get(order.tokenB);
        // await TokenB.setBalance(order.owner, 1);
      }
      await dummyExchange.batchAddFeeBalances(feePayments.getData());
    }

    const ringsGenerator = new pjs.RingsGenerator(this.context);
    await ringsGenerator.setupRingsAsync(ringsInfo);
    const bs = ringsGenerator.toSubmitableParam(ringsInfo);

    const simulator = new pjs.ProtocolSimulator(this.context);
    const txOrigin = ringsInfo.transactionOrigin ? ringsInfo.transactionOrigin :
                                                   this.testContext.transactionOrigin;
    const deserializedRingsInfo = simulator.deserialize(bs, txOrigin);
    this.assertEqualsRingsInfo(deserializedRingsInfo, ringsInfo);
    let report: any = {
      reverted: true,
      ringMinedEvents: [],
      invalidRingEvents: [],
      transferItems: [],
      feeBalancesBefore: [],
      feeBalancesAfter: [],
      filledAmountsBefore: [],
      filledAmountsAfter: [],
      balancesBefore: [],
      balancesAfter: [],
      payments: {rings: []},
    };
    let tx = null;
    try {
      report = await simulator.simulateAndReport(deserializedRingsInfo);
      this.logDetailedTokenTransfers(ringsInfo, report);
    } catch (err) {
      pjs.logDebug("Simulator reverted -> " + err);
      report.revertMessage = err.message;
    }

    pjs.logDebug("shouldThrow:", report.reverted);

    const ringSubmitter = submitter ? submitter : this.ringSubmitter;
    if (report.reverted) {
      tx = await pjs.expectThrow(
        ringSubmitter.submitRings(web3.utils.hexToBytes(bs), {from: txOrigin}),
        report.revertMessage,
      );
    } else {
      tx = await ringSubmitter.submitRings(web3.utils.hexToBytes(bs), {from: txOrigin});
      pjs.logInfo("\x1b[46m%s\x1b[0m", "gas used: " + tx.receipt.gasUsed);
    }
    const transferEvents = await this.getTransferEvents(this.testContext.allTokens, web3.eth.blockNumber);
    const ringMinedEvents = await this.getRingMinedEvents(web3.eth.blockNumber);
    const invalidRingEvents = await this.getInvalidRingEvents(web3.eth.blockNumber);
    this.assertTransfers(deserializedRingsInfo, transferEvents, report.transferItems);
    this.assertRingMinedEvents(ringMinedEvents, report.ringMinedEvents);
    this.assertInvalidRingEvents(invalidRingEvents, report.invalidRingEvents);
    await this.assertFeeBalances(deserializedRingsInfo, report.feeBalancesBefore, report.feeBalancesAfter);
    await this.assertFilledAmounts(deserializedRingsInfo, report.filledAmountsAfter);

    const addressBook = this.getAddressBook(ringsInfo);
    const protocolValidator = new pjs.ProtocolValidator(this.context);
    await protocolValidator.verifyTransaction(ringsInfo, report, addressBook);

    // await this.watchAndPrintEvent(this.ringSubmitter, "LogUint");

    return {tx, report};
  }

  public sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public async authorizeTradeDelegate() {
    const alreadyAuthorized = await this.context.tradeDelegate.methods.isAddressAuthorized(
      this.ringSubmitter.address,
    ).call();
    if (!alreadyAuthorized) {
      await this.context.tradeDelegate.methods.authorizeAddress(
        this.ringSubmitter.address,
      ).send({from: this.testContext.deployer});
    }
  }

  public async authorizeTradeHistory() {
    const alreadyAuthorized = await this.context.tradeHistory.methods.isAddressAuthorized(
      this.ringSubmitter.address,
    ).call();
    if (!alreadyAuthorized) {
      await this.context.tradeHistory.methods.authorizeAddress(
        this.ringSubmitter.address,
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

  public async lockLRC(user: string, targetRebateRate: number) {
    const LRC = await this.contracts.DummyToken.at(this.context.lrcAddress);
    const burnRateTable = await this.contracts.BurnRateTable.deployed();
    const totalLRCSupply = await LRC.totalSupply();

    // Calculate the needed funds to upgrade the tier
    const LOCK_BASE_PERCENTAGE = (await this.context.burnRateTable.LOCK_BASE_PERCENTAGE()).toNumber();
    const maxLockPercentage = (await this.context.burnRateTable.MAX_LOCK_PERCENTAGE()).toNumber();
    const maxLockAmount = Math.floor(totalLRCSupply * maxLockPercentage / LOCK_BASE_PERCENTAGE);

    // How much we need to lock to get the target rebate rate
    const lockAmount = maxLockAmount * targetRebateRate;

    await LRC.transfer(user, lockAmount, {from: this.testContext.deployer});
    await LRC.approve(this.context.burnRateTable.address, lockAmount, {from: user});

    await burnRateTable.lock(lockAmount, {from: user});
  }

  public async cleanTradeHistory() {
    const tradeHistory = await this.contracts.TradeHistory.new();
    const brokerRegistry = await this.contracts.BrokerRegistry.new();
    this.ringSubmitter = await this.contracts.RingSubmitter.new(
      this.context.lrcAddress,
      this.contracts.WETHToken.address,
      this.context.tradeDelegate.options.address,
      tradeHistory.address,
      brokerRegistry.address,
      this.context.orderRegistry.options.address,
      this.context.feeHolder.options.address,
      this.context.orderBook.options.address,
      this.context.burnRateTable.options.address,
    );

    const orderBrokerRegistryAddress = await this.ringSubmitter.orderBrokerRegistryAddress();
    // const minerBrokerRegistryAddress = await this.ringSubmitter.minerBrokerRegistryAddress();
    const feePercentageBase = (await this.ringSubmitter.FEE_PERCENTAGE_BASE()).toNumber();
    const ringIndex = (await this.ringSubmitter.ringIndex()).toNumber();

    const currBlockNumber = await web3.eth.getBlockNumber();
    const currBlockTimestamp = (await web3.eth.getBlock(currBlockNumber)).timestamp;
    this.context = new pjs.Context(currBlockNumber,
                                   currBlockTimestamp,
                                   this.context.tradeDelegate.options.address,
                                   tradeHistory.address,
                                   orderBrokerRegistryAddress,
                                   this.context.orderRegistry.options.address,
                                   this.context.feeHolder.options.address,
                                   this.context.orderBook.options.address,
                                   this.context.burnRateTable.options.address,
                                   this.context.lrcAddress,
                                   feePercentageBase,
                                   ringIndex);
    await this.authorizeTradeDelegate();
    await this.authorizeTradeHistory();
  }

  private getPrivateKey(address: string) {
    const textData = fs.readFileSync("./ganache_account_keys.txt", "ascii");
    const data = JSON.parse(textData);
    return data.private_keys[address.toLowerCase()];
  }

  // private functions:
  private async createContractContext() {
    const [ringSubmitter, tradeDelegate, tradeHistory, orderRegistry,
           feeHolder, orderBook, burnRateTable, lrcToken] = await Promise.all([
        this.contracts.RingSubmitter.deployed(),
        this.contracts.TradeDelegate.deployed(),
        this.contracts.TradeHistory.deployed(),
        this.contracts.OrderRegistry.deployed(),
        this.contracts.FeeHolder.deployed(),
        this.contracts.OrderBook.deployed(),
        this.contracts.BurnRateTable.deployed(),
        this.contracts.LRCToken.deployed(),
      ]);

    this.ringSubmitter = ringSubmitter;

    const orderBrokerRegistryAddress = await ringSubmitter.orderBrokerRegistryAddress();
    const feePercentageBase = (await ringSubmitter.FEE_PERCENTAGE_BASE()).toNumber();
    const ringIndex = (await ringSubmitter.ringIndex()).toNumber();

    const currBlockNumber = await web3.eth.getBlockNumber();
    const currBlockTimestamp = (await web3.eth.getBlock(currBlockNumber)).timestamp;
    return new pjs.Context(currBlockNumber,
                           currBlockTimestamp,
                           this.contracts.TradeDelegate.address,
                           this.contracts.TradeHistory.address,
                           orderBrokerRegistryAddress,
                           this.contracts.OrderRegistry.address,
                           this.contracts.FeeHolder.address,
                           this.contracts.OrderBook.address,
                           this.contracts.BurnRateTable.address,
                           this.contracts.LRCToken.address,
                           feePercentageBase,
                           ringIndex);
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
