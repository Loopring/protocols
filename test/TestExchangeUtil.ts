import BN = require("bn.js");
import * as pjs from "protocol2-js";
import util = require("util");
import { FeePayments } from "./feePayments";
import { ringsInfoList } from "./rings_config";

export class ExchangeTestContext {
  public orderOwners: string[];
  public orderDualAuthAddrs: string[];
  public wallet1: string;
  public allOrderTokenRecipients: string[];

  public tokenSymbolAddrMap: Map<string, string>;
  public tokenAddrSymbolMap: Map<string, string>;
  public tokenAddrInstanceMap: Map<string, any>;

}

export class ExchangeTestUtil {
  public context: pjs.Context;
  public testContext: ExchangeTestContext;

  constructor(context: pjs.Context, testContext: ExchangeTestContext) {
    this.context = context;
    this.testContext = testContext;
  }

  public assertNumberEqualsWithPrecision(n1: number, n2: number, precision: number = 8) {
    const numStr1 = (n1 / 1e18).toFixed(precision);
    const numStr2 = (n2 / 1e18).toFixed(precision);

    return assert.equal(Number(numStr1), Number(numStr2));
  }

  public async getEventsFromContract(contract: any, eventName: string, fromBlock: number) {
    return new Promise((resolve, reject) => {
      if (!contract[eventName]) {
        throw Error("TypeError: contract[eventName] is not a function: " + eventName);
      }

      const events = contract[eventName]({}, { fromBlock, toBlock: "latest" });
      events.watch();
      events.get((error: any, event: any) => {
        if (!error) {
          resolve(event);
        } else {
          throw Error("Failed to find filtered event: " + error);
        }
      });
      events.stopWatching();
    });
  }

  public async getTransferEvents(tokens: any[], fromBlock: number) {
    let transferItems: Array<[string, string, string, number]> = [];
    for (const tokenContractInstance of tokens) {
      const eventArr: any = await this.getEventsFromContract(tokenContractInstance, "Transfer", fromBlock);
      const items = eventArr.map((eventObj: any) => {
        return [tokenContractInstance.address, eventObj.args.from, eventObj.args.to, eventObj.args.value.toNumber()];
      });
      transferItems = transferItems.concat(items);
    }

    return transferItems;
  }

  public async watchAndPrintEvent(contract: any, eventName: string) {
    const events: any = await this.getEventsFromContract(contract, eventName, 0);

    events.forEach((e: any) => {
      console.log("event:", util.inspect(e.args, false, null));
    });
  }

  public logDetailedTokenTransfer(addressBook: { [id: string]: string; }, payment: pjs.DetailedTokenTransfer, depth: number = 0) {
    if (payment.amount === 0 && payment.subPayments.length === 0) {
      return;
    }
    const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(payment.token);
    const whiteSpace = " ".repeat(depth);
    const description = payment.description ? payment.description : "";
    const amount = (payment.amount / 1e18);
    if (payment.subPayments.length === 0) {
      const toName =  addressBook[payment.to];
      console.log(whiteSpace + "- "  + " [" + description + "] " +  amount + " " + tokenSymbol + " -> " + toName);
    } else {
      console.log(whiteSpace + "+ " + " [" + description + "] " + amount + " " + tokenSymbol);
      for (const subPayment of payment.subPayments) {
        this.logDetailedTokenTransfer(addressBook, subPayment, depth + 1);
      }
    }
  }

  public logDetailedTokenTransfers(ringsInfo: pjs.RingsInfo, report: pjs.SimulatorReport) {
    const addressBook = this.getAddressBook(ringsInfo);
    for (const [r, ring] of report.payments.rings.entries()) {
      console.log("# Payments for ring " + r + ": ");
      for (const [o, order] of ring.orders.entries()) {
        console.log("## Order " + o + ": ");
        for (const payment of order.payments) {
          this.logDetailedTokenTransfer(addressBook, payment, 1);
        }
      }
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
    if (order.feePercentage === undefined && order.feeAmount > 0) {
      order.feePercentage = 20;  // == 2.0%
    }
    if (!order.dualAuthSignAlgorithm) {
      order.dualAuthSignAlgorithm = pjs.SignAlgorithm.Ethereum;
    }
    if (order.dualAuthAddr === undefined && order.dualAuthSignAlgorithm !== pjs.SignAlgorithm.None) {
      const accountIndex = index % this.testContext.orderDualAuthAddrs.length;
      order.dualAuthAddr = this.testContext.orderDualAuthAddrs[accountIndex];
    }
    if (!order.allOrNone) {
      order.allOrNone = false;
    }
    if (!order.validSince) {
      // Set the order validSince time to a bit before the current timestamp;
      order.validSince = web3.eth.getBlock(web3.eth.blockNumber).timestamp - 1000;
    }
    if (order.walletAddr === undefined) {
      order.walletAddr = this.testContext.wallet1;
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
    // Fill in defaults (default, so these will not get serialized)
    order.tokenRecipient = order.tokenRecipient ? order.tokenRecipient : order.owner;
    order.feeToken = order.feeToken ? order.feeToken : this.context.lrcAddress;
    order.feeAmount = order.feeAmount ? order.feeAmount : 0;
    order.feePercentage = order.feePercentage ? order.feePercentage : 0;
    order.waiveFeePercentage = order.waiveFeePercentage ? order.waiveFeePercentage : 0;
    order.tokenSFeePercentage = order.tokenSFeePercentage ? order.tokenSFeePercentage : 0;
    order.tokenBFeePercentage = order.tokenBFeePercentage ? order.tokenBFeePercentage : 0;
    order.walletSplitPercentage = order.walletSplitPercentage ? order.walletSplitPercentage : 0;

    // setup initial balances:
    await this.setOrderBalances(order);
  }

  public async setOrderBalances(order: pjs.OrderInfo) {
    const tokenS = this.testContext.tokenAddrInstanceMap.get(order.tokenS);
    const balanceS = (order.balanceS !== undefined) ? order.balanceS : order.amountS;
    await tokenS.setBalance(order.owner, balanceS);

    const feeToken = order.feeToken ? order.feeToken : this.context.lrcAddress;
    const balanceFee = (order.balanceFee !== undefined) ? order.balanceFee : order.feeAmount;
    if (feeToken === order.tokenS) {
      tokenS.addBalance(order.owner, balanceFee);
    } else {
      const tokenFee = this.testContext.tokenAddrInstanceMap.get(feeToken);
      await tokenFee.setBalance(order.owner, balanceFee);
    }
  }

  public assertEqualsRingsInfo(ringsInfoA: pjs.RingsInfo, ringsInfoB: pjs.RingsInfo) {
    // Revert defaults back to undefined
    ringsInfoA.miner = (ringsInfoA.miner === ringsInfoA.feeRecipient) ? undefined : ringsInfoA.miner;
    ringsInfoB.miner = (ringsInfoB.miner === ringsInfoB.feeRecipient) ? undefined : ringsInfoB.miner;

    // Blacklist properties we don't want to check.
    // We don't whitelist because we might forget to add them here otherwise.
    const ringsInfoPropertiesToSkip = ["description", "signAlgorithm", "hash"];
    const orderPropertiesToSkip = [
      "maxAmountS", "fillAmountS", "fillAmountB", "fillAmountFee", "splitS", "brokerInterceptor",
      "valid", "hash", "delegateContract", "signAlgorithm", "dualAuthSignAlgorithm", "index", "lrcAddress",
      "balanceS", "balanceFee", "tokenSpendableS", "tokenSpendableFee",
      "brokerSpendableS", "brokerSpendableFee",
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
    const addAddress = (addressBook: { [id: string]: any; }, address: string, name: string) => {
      addressBook[address] = (addressBook[address] ? addressBook[address] + "=" : "") + name;
    };

    const addressBook: { [id: string]: string; } = {};
    addAddress(addressBook, ringsInfo.feeRecipient, "Miner");
    addAddress(addressBook, this.context.feeHolder.address, "Tax");
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
                         tranferEvents: Array<[string, string, string, number]>,
                         transferList: pjs.TransferItem[]) {
    const transfersFromSimulator: Array<[string, string, string, number]> = [];
    transferList.forEach((item) => transfersFromSimulator.push([item.token, item.from, item.to, item.amount]));
    const sorter = (a: [string, string, string, number], b: [string, string, string, number]) => {
      if (a[0] === b[0]) {
        if (a[1] === b[1]) {
          if (a[2] === b[2]) {
            return a[3] - b[3];
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
    console.log("transfer items from simulator:");
    transfersFromSimulator.forEach((t) => {
      const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(t[0]);
      const fromName = addressBook[t[1]];
      const toName = addressBook[t[2]];
      console.log(fromName + " -> " + toName + " : " + t[3] / 1e18 + " " + tokenSymbol);
    });
    console.log("transfer items from contract:");
    tranferEvents.forEach((t) => {
      const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(t[0]);
      const fromName = addressBook[t[1]];
      const toName = addressBook[t[2]];
      console.log(fromName + " -> " + toName + " : " + t[3] / 1e18 + " " + tokenSymbol);
    });
    assert.equal(tranferEvents.length, transfersFromSimulator.length, "transfer amounts not match");
    for (let i = 0; i < tranferEvents.length; i++) {
      const transferFromEvent = tranferEvents[i];
      const transferFromSimulator = transfersFromSimulator[i];
      assert.equal(transferFromEvent[0], transferFromSimulator[0]);
      assert.equal(transferFromEvent[1], transferFromSimulator[1]);
      assert.equal(transferFromEvent[2], transferFromSimulator[2]);
      this.assertNumberEqualsWithPrecision(transferFromEvent[3], transferFromSimulator[3]);
    }
  }

  public async assertFeeBalances(ringsInfo: pjs.RingsInfo, feeBalances: { [id: string]: any; }) {
    const addressBook = this.getAddressBook(ringsInfo);
    console.log("Fee balances:");
    for (const token of Object.keys(feeBalances)) {
      for (const owner of Object.keys(feeBalances[token])) {
        const balanceFromSimulator = feeBalances[token][owner];
        const balanceFromContract = await this.context.feeHolder.feeBalances(token, owner);
        const ownerName = addressBook[owner] ? addressBook[owner] : owner;
        const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(token);
        console.log(ownerName + ": " +
                    balanceFromContract  / 1e18 + " " + tokenSymbol + " " +
                    "(Simulator: " + balanceFromSimulator  / 1e18 + ")");
        this.assertNumberEqualsWithPrecision(balanceFromContract, balanceFromSimulator);
      }
    }
  }

  public async assertFilledAmounts(ringsInfo: pjs.RingsInfo,
                                   context: pjs.Context,
                                   filledAmounts: { [hash: string]: number; }) {
    const addressBook = this.getAddressBook(ringsInfo);
    console.log("Filled amounts:");
    for (const hash of Object.keys(filledAmounts)) {
      let hashOrder: pjs.OrderInfo = null;
      for (const order of ringsInfo.orders) {
        if (order.hash.toString("hex") === hash) {
          hashOrder = order;
        }
      }
      const filledFromSimulator = filledAmounts[hash];
      const filledFromContract = await this.context.tradeDelegate.filled("0x" + hash).toNumber();
      let percentageFilled = 0;
      if (hashOrder) {
        percentageFilled = filledFromContract * 100 / hashOrder.amountS;
      }
      const hashName = addressBook[hash];
      console.log(hashName + ": " + filledFromContract / 1e18 +
                  " (Simulator: " + filledFromSimulator / 1e18 + ")" +
                  " (" + percentageFilled + "%)");
      this.assertNumberEqualsWithPrecision(filledFromContract, filledFromSimulator);
    }
  }

  public async assertOrdersValid(orders: pjs.OrderInfo[], expectedValidValues: boolean[]) {
    assert.equal(orders.length, expectedValidValues.length, "Array sizes need to match");

    const bitstream = new pjs.Bitstream();
    for (const order of orders) {
      bitstream.addAddress(order.owner, 32);
      bitstream.addHex(order.hash.toString("hex"));
      bitstream.addNumber(order.validSince, 32);
      bitstream.addHex(pjs.xor(order.tokenS, order.tokenB, 20).slice(2));
      bitstream.addNumber(0, 12);
    }

    const ordersValid = await this.context.tradeDelegate.batchCheckCutoffsAndCancelled(bitstream.getBytes32Array());

    const bits = new BN(ordersValid.toString(16), 16);
    for (const [i, order] of orders.entries()) {
        assert.equal(bits.testn(i), expectedValidValues[i], "Order cancelled status incorrect");
    }
  }

}
