import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import promisify = require("es6-promisify");
import abi = require("ethereumjs-abi");
import ethUtil = require("ethereumjs-util");
import * as _ from "lodash";
import * as psc from "protocol2-js";
import util = require("util");
import tokenInfos = require("../migrations/config/tokens.js");
import { ringsInfoList } from "./rings_config";

const {
  RingSubmitter,
  TokenRegistry,
  SymbolRegistry,
  BrokerRegistry,
  OrderRegistry,
  MinerRegistry,
  TradeDelegate,
  FeeHolder,
  DummyToken,
  OrderBook,
} = new psc.Artifacts(artifacts);

contract("Exchange_Submit", (accounts: string[]) => {
  const deployer = accounts[0];
  const transactionOrigin = accounts[1];
  const miner = accounts[2];
  const wallet1 = accounts[3];
  const broker1 = accounts[4];
  const orderOwners = accounts.slice(5, 9);
  const orderDualAuthAddr = accounts.slice(9, 13);
  const allOrderTokenRecipients = accounts.slice(13, 17);

  let ringSubmitter: any;
  let tokenRegistry: any;
  let symbolRegistry: any;
  let tradeDelegate: any;
  let orderRegistry: any;
  let minerRegistry: any;
  let feeHolder: any;
  let orderBook: any;
  let orderBrokerRegistryAddress: string;
  let minerBrokerRegistryAddress: string;
  let lrcAddress: string;
  let wethAddress: string;
  let feePercentageBase: number;
  let tax: psc.Tax;

  const tokenSymbolAddrMap = new Map();
  const tokenInstanceMap = new Map();
  const allTokenSymbols = tokenInfos.development.map((t) => t.symbol);
  const allTokens: any[] = [];

  const assertNumberEqualsWithPrecision = (n1: number, n2: number, precision: number = 8) => {
    const numStr1 = (n1 / 1e18).toFixed(precision);
    const numStr2 = (n2 / 1e18).toFixed(precision);

    return assert.equal(Number(numStr1), Number(numStr2));
  };

  const getEventsFromContract = async (contract: any, eventName: string, fromBlock: number) => {
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
  };

  const getTransferEvents = async (tokens: any[], fromBlock: number) => {
    let transferItems: Array<[string, string, string, number]> = [];
    for (const tokenContractInstance of tokens) {
      const eventArr: any = await getEventsFromContract(tokenContractInstance, "Transfer", fromBlock);
      const items = eventArr.map((eventObj: any) => {
        return [tokenContractInstance.address, eventObj.args.from, eventObj.args.to, eventObj.args.value.toNumber()];
      });
      transferItems = transferItems.concat(items);
    }

    return transferItems;
  };

  const watchAndPrintEvent = async (contract: any, eventName: string) => {
    const events: any = await getEventsFromContract(contract, eventName, 0);

    events.forEach((e: any) => {
      console.log("event:", util.inspect(e.args, false, null));
    });
  };

  const getDefaultContext = () => {
    const currBlockNumber = web3.eth.blockNumber;
    const currBlockTimestamp = web3.eth.getBlock(currBlockNumber).timestamp;
    // Pass in the block number and the block time stamp so we can more accurately reproduce transactions
    const context = new psc.Context(currBlockNumber,
                                    currBlockTimestamp,
                                    TokenRegistry.address,
                                    tradeDelegate.address,
                                    orderBrokerRegistryAddress,
                                    minerBrokerRegistryAddress,
                                    OrderRegistry.address,
                                    MinerRegistry.address,
                                    feeHolder.address,
                                    orderBook.address,
                                    lrcAddress,
                                    tax,
                                    feePercentageBase);
    return context;
  };

  const submitRingsAndSimulate = async (context: psc.Context, ringsInfo: psc.RingsInfo, eventFromBlock: number) => {
    const ringsGenerator = new psc.RingsGenerator(context);
    await ringsGenerator.setupRingsAsync(ringsInfo);
    const bs = ringsGenerator.toSubmitableParam(ringsInfo);

    const simulator = new psc.ProtocolSimulator(context);
    const txOrigin = ringsInfo.transactionOrigin ? ringsInfo.transactionOrigin : transactionOrigin;
    const deserializedRingsInfo = simulator.deserialize(bs, txOrigin);
    assertEqualsRingsInfo(deserializedRingsInfo, ringsInfo);
    let shouldThrow = false;
    let report: any = {
      ringMinedEvents: [],
      transferItems: [],
      feeBalances: [],
      filledAmounts: [],
    };
    let tx = null;
    try {
      report = await simulator.simulateAndReport(deserializedRingsInfo);
    } catch {
      shouldThrow = true;
    }
    if (shouldThrow) {
      tx = await psc.expectThrow(ringSubmitter.submitRings(bs, {from: txOrigin}));
    } else {
      tx = await ringSubmitter.submitRings(bs, {from: txOrigin});
      console.log("gas used: ", tx.receipt.gasUsed);
    }
    const transferEvents = await getTransferEvents(allTokens, eventFromBlock);
    assertTransfers(transferEvents, report.transferItems);
    await assertFeeBalances(report.feeBalances);
    await assertFilledAmounts(context, report.filledAmounts);

    // await watchAndPrintEvent(tradeDelegate, "LogTrans");
    // await watchAndPrintEvent(ringSubmitter, "LogUint3");
    // await watchAndPrintEvent(ringSubmitter, "LogAddress");

    return {tx, report};
  };

  const setupOrder = async (order: psc.OrderInfo, index: number, limitFeeTokenAmount?: boolean) => {
    if (order.owner === undefined) {
      const accountIndex = index % orderOwners.length;
      order.owner = orderOwners[accountIndex];
    } else if (order.owner !== undefined && !order.owner.startsWith("0x")) {
      const accountIndex = parseInt(order.owner, 10);
      assert(accountIndex >= 0 && accountIndex < orderOwners.length, "Invalid owner index");
      order.owner = orderOwners[accountIndex];
    }
    if (!order.tokenS.startsWith("0x")) {
      order.tokenS = await symbolRegistry.getAddressBySymbol(order.tokenS);
    }
    if (!order.tokenB.startsWith("0x")) {
      order.tokenB = await symbolRegistry.getAddressBySymbol(order.tokenB);
    }
    if (order.feeToken && !order.feeToken.startsWith("0x")) {
      order.feeToken = await symbolRegistry.getAddressBySymbol(order.feeToken);
    }
    if (order.feeAmount === undefined) {
      order.feeAmount = 1e18;
    }
    if (order.feePercentage === undefined && order.feeAmount > 0) {
      order.feePercentage = 20;  // == 2.0%
    }
    if (!order.dualAuthSignAlgorithm) {
      order.dualAuthSignAlgorithm = psc.SignAlgorithm.Ethereum;
    }
    if (order.dualAuthAddr === undefined && order.dualAuthSignAlgorithm !== psc.SignAlgorithm.None) {
      const accountIndex = index % orderDualAuthAddr.length;
      order.dualAuthAddr = orderDualAuthAddr[accountIndex];
    }
    if (!order.allOrNone) {
      order.allOrNone = false;
    }
    if (!order.validSince) {
      // Set the order validSince time to a bit before the current timestamp;
      order.validSince = web3.eth.getBlock(web3.eth.blockNumber).timestamp - 1000;
    }
    if (!order.walletAddr && index > 0) {
      order.walletAddr = wallet1;
    }
    if (order.tokenRecipient !== undefined && !order.tokenRecipient.startsWith("0x")) {
      const accountIndex = parseInt(order.tokenRecipient, 10);
      assert(accountIndex >= 0 && accountIndex < allOrderTokenRecipients.length, "Invalid token recipient index");
      order.tokenRecipient = allOrderTokenRecipients[accountIndex];
    }
    // Fill in defaults (default, so these will not get serialized)
    order.tokenRecipient = order.tokenRecipient ? order.tokenRecipient : order.owner;
    order.feeToken = order.feeToken ? order.feeToken : lrcAddress;
    order.feeAmount = order.feeAmount ? order.feeAmount : 0;
    order.feePercentage = order.feePercentage ? order.feePercentage : 0;
    order.waiveFeePercentage = order.waiveFeePercentage ? order.waiveFeePercentage : 0;
    order.tokenSFeePercentage = order.tokenSFeePercentage ? order.tokenSFeePercentage : 0;
    order.tokenBFeePercentage = order.tokenBFeePercentage ? order.tokenBFeePercentage : 0;
    order.walletSplitPercentage = order.walletSplitPercentage ? order.walletSplitPercentage : 0;

    // setup initial balances:
    const tokenS = await DummyToken.at(order.tokenS);
    await tokenS.setBalance(order.owner, (order.balanceS !== undefined) ? order.balanceS : order.amountS);
    if (!limitFeeTokenAmount) {
      const feeToken = order.feeToken ? order.feeToken : lrcAddress;
      const balanceFee = (order.balanceFee !== undefined) ? order.balanceFee : (order.feeAmount * 2);
      if (feeToken === order.tokenS) {
        tokenS.addBalance(order.owner, balanceFee);
      } else {
        const tokenFee = await DummyToken.at(feeToken);
        await tokenFee.setBalance(order.owner, balanceFee);
      }
    }
  };

  const assertEqualsRingsInfo = (ringsInfoA: psc.RingsInfo, ringsInfoB: psc.RingsInfo) => {
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
  };

  const assertTransfers =
    (tranferEvents: Array<[string, string, string, number]>, transferList: psc.TransferItem[]) => {
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
    console.log("transfer items from simulator:");
    transfersFromSimulator.forEach((t) => console.log(t[0], ":" , t[1], "->", t[2], ":", t[3] / 1e18));
    console.log("transfer items from contract:");
    tranferEvents.forEach((t) => console.log(t[0], ":" , t[1], "->", t[2], ":", t[3] / 1e18));
    assert.equal(tranferEvents.length, transfersFromSimulator.length, "transfer amounts not match");
    for (let i = 0; i < tranferEvents.length; i++) {
      const transferFromEvent = tranferEvents[i];
      const transferFromSimulator = transfersFromSimulator[i];
      assert.equal(transferFromEvent[0], transferFromSimulator[0]);
      assert.equal(transferFromEvent[1], transferFromSimulator[1]);
      assert.equal(transferFromEvent[2], transferFromSimulator[2]);
      assertNumberEqualsWithPrecision(transferFromEvent[3], transferFromSimulator[3]);
    }
  };

  const assertFeeBalances = async (feeBalances: { [id: string]: any; }) => {
    console.log("Fee balances:");
    for (const token of Object.keys(feeBalances)) {
      for (const owner of Object.keys(feeBalances[token])) {
        const balanceFromSimulator = feeBalances[token][owner];
        const balanceFromContract = await feeHolder.feeBalances(token, owner);
        console.log("Token: " + token + ", Owner: " + owner + ": " +
          balanceFromContract  / 1e18 + " == " + balanceFromSimulator  / 1e18);
        assertNumberEqualsWithPrecision(balanceFromContract, balanceFromSimulator);
      }
    }
  };

  const assertFilledAmounts = async (context: psc.Context, filledAmounts: { [hash: string]: number; }) => {
    console.log("Filled amounts:");
    for (const hash of Object.keys(filledAmounts)) {
      const filledFromSimulator = filledAmounts[hash];
      const filledFromContract = await context.tradeDelegate.filled("0x" + hash).toNumber();
      console.log(hash + ": " + filledFromContract / 1e18 + " == " + filledFromSimulator / 1e18);
      assertNumberEqualsWithPrecision(filledFromContract, filledFromSimulator);
    }
  };

  const assertOrdersValid = async (orders: psc.OrderInfo[], expectedValidValues: boolean[]) => {
    assert.equal(orders.length, expectedValidValues.length, "Array sizes need to match");

    const bitstream = new psc.Bitstream();
    for (const order of orders) {
      bitstream.addAddress(order.owner, 32);
      bitstream.addHex(order.hash.toString("hex"));
      bitstream.addNumber(order.validSince, 32);
      bitstream.addHex(psc.xor(order.tokenS, order.tokenB, 20).slice(2));
      bitstream.addNumber(0, 12);
    }

    const ordersValid = await tradeDelegate.batchCheckCutoffsAndCancelled(bitstream.getBytes32Array());

    const bits = new BN(ordersValid.toString(16), 16);
    for (const [i, order] of orders.entries()) {
        assert.equal(bits.testn(i), expectedValidValues[i], "Order cancelled status incorrect");
    }
  };

  // const cleanTradeHistory = async () => {
  //   // This will re-deploy the TradeDelegate contract (and thus the RingSubmitter contract as well)
  //   // so all trade history is reset
  //   tradeDelegate = await TradeDelegate.new();
  //   feeHolder = await FeeHolder.new(tradeDelegate.address);
  //   ringSubmitter = await RingSubmitter.new(
  //     lrcAddress,
  //     wethAddress,
  //     TokenRegistry.address,
  //     tradeDelegate.address,
  //     orderBrokerRegistryAddress,
  //     minerBrokerRegistryAddress,
  //     OrderRegistry.address,
  //     MinerRegistry.address,
  //     feeHolder.address,
  //     orderBook.address,
  //   );
  //   await initializeTradeDelegate();
  // };

  const initializeTradeDelegate = async () => {
    await tradeDelegate.authorizeAddress(ringSubmitter.address, {from: deployer});

    for (const token of allTokens) {
      // approve once for all orders:
      for (const orderOwner of orderOwners) {
        await token.approve(tradeDelegate.address, 1e32, {from: orderOwner});
      }
    }
  };

  before( async () => {
    [ringSubmitter, tokenRegistry, symbolRegistry, tradeDelegate, orderRegistry,
     minerRegistry, feeHolder, orderBook] = await Promise.all([
       RingSubmitter.deployed(),
       TokenRegistry.deployed(),
       SymbolRegistry.deployed(),
       TradeDelegate.deployed(),
       OrderRegistry.deployed(),
       MinerRegistry.deployed(),
       FeeHolder.deployed(),
       OrderBook.deployed(),
     ]);

    lrcAddress = await symbolRegistry.getAddressBySymbol("LRC");
    wethAddress = await symbolRegistry.getAddressBySymbol("WETH");

    // Get the different brokers from the ringSubmitter
    orderBrokerRegistryAddress = await ringSubmitter.orderBrokerRegistryAddress();
    minerBrokerRegistryAddress = await ringSubmitter.minerBrokerRegistryAddress();

    // Dummy data
    const minerBrokerRegistry = BrokerRegistry.at(minerBrokerRegistryAddress);
    await minerBrokerRegistry.registerBroker(miner, "0x0", {from: miner});

    for (const sym of allTokenSymbols) {
      const addr = await symbolRegistry.getAddressBySymbol(sym);
      tokenSymbolAddrMap.set(sym, addr);
      const token = await DummyToken.at(addr);
      allTokens.push(token);
    }

    feePercentageBase = (await ringSubmitter.FEE_AND_TAX_PERCENTAGE_BASE()).toNumber();
    tax = new psc.Tax((await ringSubmitter.TAX_MATCHING_CONSUMER_LRC()).toNumber(),
                      (await ringSubmitter.TAX_MATCHING_CONSUMER_ETH()).toNumber(),
                      (await ringSubmitter.TAX_MATCHING_CONSUMER_OTHER()).toNumber(),
                      (await ringSubmitter.TAX_MATCHING_INCOME_LRC()).toNumber(),
                      (await ringSubmitter.TAX_MATCHING_INCOME_ETH()).toNumber(),
                      (await ringSubmitter.TAX_MATCHING_INCOME_OTHER()).toNumber(),
                      (await ringSubmitter.TAX_P2P_CONSUMER_LRC()).toNumber(),
                      (await ringSubmitter.TAX_P2P_CONSUMER_ETH()).toNumber(),
                      (await ringSubmitter.TAX_P2P_CONSUMER_OTHER()).toNumber(),
                      (await ringSubmitter.TAX_P2P_INCOME_LRC()).toNumber(),
                      (await ringSubmitter.TAX_P2P_INCOME_ETH()).toNumber(),
                      (await ringSubmitter.TAX_P2P_INCOME_OTHER()).toNumber(),
                      (await ringSubmitter.FEE_AND_TAX_PERCENTAGE_BASE()).toNumber(),
                      lrcAddress,
                      wethAddress);

    await initializeTradeDelegate();
  });

  describe("submitRing", () => {

    // We don't want to reset the trading history between each test here, so do it once at the beginning
    // to make sure no order is cancelled
    // before(async () => {
    //   await cleanTradeHistory();
    // });

    for (const ringsInfo of ringsInfoList) {
      it(ringsInfo.description, async () => {
        if (ringsInfo.transactionOrigin === undefined) {
          ringsInfo.transactionOrigin = transactionOrigin;
          ringsInfo.feeRecipient = miner;
          ringsInfo.miner = miner;
        } else {
          if (!ringsInfo.transactionOrigin.startsWith("0x")) {
            const accountIndex = parseInt(ringsInfo.transactionOrigin, 10);
            assert(accountIndex >= 0 && accountIndex < orderOwners.length, "Invalid owner index");
            ringsInfo.transactionOrigin = orderOwners[accountIndex];
          }
          ringsInfo.feeRecipient = undefined;
          ringsInfo.miner = undefined;
        }
        for (const [i, order] of ringsInfo.orders.entries()) {
          await setupOrder(order, i);
        }
        const context = getDefaultContext();
        await submitRingsAndSimulate(context, ringsInfo, web3.eth.blockNumber);
      });
    }
  });

});
