import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import promisify = require("es6-promisify");
import abi = require("ethereumjs-abi");
import ethUtil = require("ethereumjs-util");
import * as _ from "lodash";
import util = require("util");
import tokenInfos = require("../migrations/config/tokens.js");
import { Artifacts } from "../util/artifacts";
import { Bitstream } from "../util/bitstream";
import { Context } from "../util/context";
import { expectThrow } from "../util/expectThrow";
import { ProtocolSimulator } from "../util/protocol_simulator";
import { Ring } from "../util/ring";
import { ringsInfoList } from "../util/rings_config";
import { RingsGenerator } from "../util/rings_generator";
import { Tax } from "../util/tax";
import { OrderInfo, RingsInfo, SignAlgorithm, TransferItem } from "../util/types";
import { xor } from "../util/xor";

const {
  Exchange,
  TokenRegistry,
  SymbolRegistry,
  BrokerRegistry,
  OrderRegistry,
  MinerRegistry,
  TradeDelegate,
  FeeHolder,
  DummyToken,
  DummyBrokerInterceptor,
} = new Artifacts(artifacts);

contract("Exchange", (accounts: string[]) => {
  const deployer = accounts[0];
  const miner = accounts[9];
  const orderOwners = accounts.slice(5, 8); // 5 ~ 7
  const orderDualAuthAddr = accounts.slice(1, 4);
  const transactionOrigin = /*miner*/ accounts[1];
  const broker1 = accounts[1];
  const wallet1 = accounts[3];

  let exchange: any;
  let tokenRegistry: any;
  let symbolRegistry: any;
  let tradeDelegate: any;
  let orderRegistry: any;
  let minerRegistry: any;
  let feeHolder: any;
  let dummyBrokerInterceptor: any;
  let orderBrokerRegistryAddress: string;
  let minerBrokerRegistryAddress: string;
  let lrcAddress: string;
  let wethAddress: string;
  let walletSplitPercentage: number;
  let feePercentageBase: number;
  let tax: Tax;

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
    const context = new Context(currBlockNumber,
                                currBlockTimestamp,
                                TokenRegistry.address,
                                tradeDelegate.address,
                                orderBrokerRegistryAddress,
                                minerBrokerRegistryAddress,
                                OrderRegistry.address,
                                MinerRegistry.address,
                                feeHolder.address,
                                lrcAddress,
                                tax,
                                feePercentageBase);
    return context;
  };

  const submitRingsAndSimulate = async (context: Context, ringsInfo: RingsInfo, eventFromBlock: number) => {
    const ringsGenerator = new RingsGenerator(context);
    await ringsGenerator.setupRingsAsync(ringsInfo);
    const bs = ringsGenerator.toSubmitableParam(ringsInfo);

    const simulator = new ProtocolSimulator(walletSplitPercentage, context);
    const txOrigin = ringsInfo.transactionOrigin ? ringsInfo.transactionOrigin : transactionOrigin;
    const deserializedRingsInfo = simulator.deserialize(bs, txOrigin);
    assertEqualsRingsInfo(deserializedRingsInfo, ringsInfo);
    const report = await simulator.simulateAndReport(deserializedRingsInfo);

    const tx = await exchange.submitRings(bs, {from: txOrigin});
    const transferEvents = await getTransferEvents(allTokens, eventFromBlock);
    assertTransfers(transferEvents, report.transferItems);
    await assertFeeBalances(report.feeBalances);
    await assertFilledAmounts(context, report.filledAmounts);

    return {tx, report};
  };

  const setupOrder = async (order: OrderInfo, index: number, limitFeeTokenAmount?: boolean) => {
    const ownerIndex = index === 0 ? index : index % orderOwners.length;
    const owner = orderOwners[ownerIndex];

    order.owner = owner;
    if (!order.tokenS.startsWith("0x")) {
      order.tokenS = await symbolRegistry.getAddressBySymbol(order.tokenS);
    }
    if (!order.tokenB.startsWith("0x")) {
      order.tokenB = await symbolRegistry.getAddressBySymbol(order.tokenB);
    }
    if (!order.feeToken) {
      order.feeToken = lrcAddress;
    } else if (!order.feeToken.startsWith("0x")) {
      order.feeToken = await symbolRegistry.getAddressBySymbol(order.feeToken);
    }
    if (!order.feeAmount) {
      order.feeAmount = 1e18;
    }
    if (!order.feePercentage) {
      order.feePercentage = 20;  // == 2.0%
    }
    if (!order.tokenSFeePercentage) {
      order.tokenSFeePercentage = 15;  // == 1.5%
    }
    if (!order.tokenBFeePercentage) {
      order.tokenBFeePercentage = 25;  // == 2.5%
    }
    if (!order.dualAuthSignAlgorithm) {
      order.dualAuthSignAlgorithm = SignAlgorithm.Ethereum;
    }
    if (order.dualAuthAddr === undefined && order.dualAuthSignAlgorithm !== SignAlgorithm.None) {
      order.dualAuthAddr = orderDualAuthAddr[ownerIndex];
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
    /*if (!order.waiveFeePercentage && index > 0) {
      order.waiveFeePercentage = -250;
    }*/

    // setup amount:
    const orderTokenS = await DummyToken.at(order.tokenS);
    await orderTokenS.addBalance(order.owner, order.amountS);
    if (!limitFeeTokenAmount) {
      const feeToken = await DummyToken.at(order.feeToken);
      await feeToken.addBalance(order.owner, order.feeAmount);
    }
  };

  const assertEqualsRingsInfo = (ringsInfoA: RingsInfo, ringsInfoB: RingsInfo) => {
    // Blacklist properties we don't want to check.
    // We don't whitelist because we might forget to add them here otherwise.
    const ringsInfoPropertiesToSkip = ["description", "signAlgorithm", "hash"];
    const orderPropertiesToSkip = [
      "maxAmountS", "fillAmountS", "fillAmountB", "fillAmountFee", "splitS", "brokerInterceptor",
      "valid", "hash", "delegateContract", "signAlgorithm", "dualAuthSignAlgorithm", "index", "lrcAddress",
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

  const assertTransfers = (tranferEvents: Array<[string, string, string, number]>, transferList: TransferItem[]) => {
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

  const assertFilledAmounts = async (context: Context, filledAmounts: { [hash: string]: number; }) => {
    console.log("Filled amounts:");
    for (const hash of Object.keys(filledAmounts)) {
      const filledFromSimulator = filledAmounts[hash];
      const filledFromContract = await context.tradeDelegate.filled("0x" + hash).toNumber();
      console.log(hash + ": " + filledFromContract / 1e18 + " == " + filledFromSimulator / 1e18);
      assertNumberEqualsWithPrecision(filledFromContract, filledFromSimulator);
    }
  };

  const assertOrdersValid = async (orders: OrderInfo[], expectedValidValues: boolean[]) => {
    assert.equal(orders.length, expectedValidValues.length, "Array sizes need to match");

    const bitstream = new Bitstream();
    for (const order of orders) {
      bitstream.addAddress(order.owner, 32);
      bitstream.addHex(order.hash.toString("hex"));
      bitstream.addNumber(order.validSince, 32);
      bitstream.addHex(xor(order.tokenS, order.tokenB, 20).slice(2));
      bitstream.addNumber(0, 12);
    }

    const ordersValid = await tradeDelegate.batchCheckCutoffsAndCancelled(bitstream.getBytes32Array());

    const bits = new BN(ordersValid.toString(16), 16);
    for (const [i, order] of orders.entries()) {
        assert.equal(bits.testn(i), expectedValidValues[i], "Order cancelled status incorrect");
    }
  };

  const registerBrokerChecked = async (user: string, broker: string, interceptor: string) => {
    const brokerRegistry = BrokerRegistry.at(orderBrokerRegistryAddress);
    await brokerRegistry.registerBroker(broker, interceptor, {from: user});
    await assertRegistered(user, broker, interceptor);
  };

  const unregisterBrokerChecked = async (user: string, broker: string) => {
    const brokerRegistry = BrokerRegistry.at(orderBrokerRegistryAddress);
    await brokerRegistry.unregisterBroker(broker, {from: user});
    await assertNotRegistered(user, broker);
  };

  const assertRegistered = async (user: string, broker: string, interceptor: string) => {
    const brokerRegistry = BrokerRegistry.at(orderBrokerRegistryAddress);
    const [isRegistered, interceptorFromContract] = await brokerRegistry.getBroker(user, broker);
    assert(isRegistered, "interceptor should be registered.");
    assert.equal(interceptor, interceptorFromContract, "get wrong interceptor");
  };

  const assertNotRegistered = async (user: string, broker: string) => {
    const brokerRegistry = BrokerRegistry.at(orderBrokerRegistryAddress);
    const [isRegistered, interceptorFromContract] = await brokerRegistry.getBroker(user, broker);
    assert(!isRegistered, "interceptor should not be registered.");
  };

  const cleanTradeHistory = async () => {
    // This will re-deploy the TradeDelegate contract (and thus the Exchange contract as well)
    // so all trade history is reset
    tradeDelegate = await TradeDelegate.new(walletSplitPercentage);
    feeHolder = await FeeHolder.new(tradeDelegate.address);
    exchange = await Exchange.new(
      lrcAddress,
      wethAddress,
      TokenRegistry.address,
      tradeDelegate.address,
      orderBrokerRegistryAddress,
      minerBrokerRegistryAddress,
      OrderRegistry.address,
      MinerRegistry.address,
      feeHolder.address,
    );
    await initializeTradeDelegate();
  };

  const initializeTradeDelegate = async () => {
    await tradeDelegate.authorizeAddress(exchange.address, {from: deployer});

    const walletSplitPercentageBN = await tradeDelegate.walletSplitPercentage();
    walletSplitPercentage = walletSplitPercentageBN.toNumber();

    for (const token of allTokens) {
      // approve once for all orders:
      for (const orderOwner of orderOwners) {
        await token.approve(tradeDelegate.address, 1e32, {from: orderOwner});
      }
    }
  };

  before( async () => {
    [exchange, tokenRegistry, symbolRegistry, tradeDelegate, orderRegistry,
      minerRegistry, feeHolder, dummyBrokerInterceptor] = await Promise.all([
      Exchange.deployed(),
      TokenRegistry.deployed(),
      SymbolRegistry.deployed(),
      TradeDelegate.deployed(),
      OrderRegistry.deployed(),
      MinerRegistry.deployed(),
      FeeHolder.deployed(),
      DummyBrokerInterceptor.deployed(),
    ]);

    lrcAddress = await symbolRegistry.getAddressBySymbol("LRC");
    wethAddress = await symbolRegistry.getAddressBySymbol("WETH");

    // Get the different brokers from the exchange
    orderBrokerRegistryAddress = await exchange.orderBrokerRegistryAddress();
    minerBrokerRegistryAddress = await exchange.minerBrokerRegistryAddress();

    // Dummy data
    const minerBrokerRegistry = BrokerRegistry.at(minerBrokerRegistryAddress);
    await minerBrokerRegistry.registerBroker(miner, "0x0", {from: miner});

    for (const sym of allTokenSymbols) {
      const addr = await symbolRegistry.getAddressBySymbol(sym);
      tokenSymbolAddrMap.set(sym, addr);
      const token = await DummyToken.at(addr);
      allTokens.push(token);
    }

    feePercentageBase = await exchange.FEE_PERCENTAGE_BASE();
    tax = new Tax(await exchange.TAX_MATCHING_CONSUMER_LRC(),
                  await exchange.TAX_MATCHING_CONSUMER_ETH(),
                  await exchange.TAX_MATCHING_CONSUMER_OTHER(),
                  await exchange.TAX_MATCHING_INCOME_LRC(),
                  await exchange.TAX_MATCHING_INCOME_ETH(),
                  await exchange.TAX_MATCHING_INCOME_OTHER(),
                  await exchange.TAX_P2P_CONSUMER_LRC(),
                  await exchange.TAX_P2P_CONSUMER_ETH(),
                  await exchange.TAX_P2P_CONSUMER_OTHER(),
                  await exchange.TAX_P2P_INCOME_LRC(),
                  await exchange.TAX_P2P_INCOME_ETH(),
                  await exchange.TAX_P2P_INCOME_OTHER(),
                  await exchange.TAX_PERCENTAGE_BASE(),
                  lrcAddress,
                  wethAddress);

    await initializeTradeDelegate();
  });

  describe("submitRing", () => {

    // We don't want to reset the trading history between each test here, so do it once at the beginning
    // to make sure no order is cancelled
    before(async () => {
      await cleanTradeHistory();
    });

    for (const ringsInfo of ringsInfoList) {
      // all configed testcases here:
      ringsInfo.transactionOrigin = transactionOrigin;
      ringsInfo.miner = miner;
      ringsInfo.feeRecipient = miner;

      it(ringsInfo.description, async () => {

        // before() is async, so any dependency we have on before() having run needs
        // to be done in async tests (see mocha docs)
        const context = getDefaultContext();

        for (const [i, order] of ringsInfo.orders.entries()) {
          await setupOrder(order, i);
        }

        const ringsGenerator = new RingsGenerator(context);
        await ringsGenerator.setupRingsAsync(ringsInfo);
        const bs = ringsGenerator.toSubmitableParam(ringsInfo);
        // console.log("bs:", bs);

        const simulator = new ProtocolSimulator(walletSplitPercentage, context);
        const deserializedRingsInfo = simulator.deserialize(bs, transactionOrigin);
        assertEqualsRingsInfo(deserializedRingsInfo, ringsInfo);
        let report: any;
        try {
          report = await simulator.simulateAndReport(deserializedRingsInfo);
          // console.log("report.transferItems:", report.transferItems);
        } catch (err) {
          console.log("simulator error:", err);
          report = {ringMinedEvents: [], transferItems: [], feeBalances: {}, filledAmounts: {}};
        }

        const eventFromBlock: number = web3.eth.blockNumber;
        const tx = await exchange.submitRings(bs, {from: transactionOrigin});
        console.log("gas used: ", tx.receipt.gasUsed);

        const transferEvents = await getTransferEvents(allTokens, eventFromBlock);
        assertTransfers(transferEvents, report.transferItems);
        await assertFeeBalances(report.feeBalances);
        await assertFilledAmounts(context, report.filledAmounts);

        // await watchAndPrintEvent(tradeDelegate, "LogTrans");
        // await watchAndPrintEvent(exchange, "LogUint3");
        // await watchAndPrintEvent(exchange, "LogAddress");
      });
    }

  });

  describe.skip("submitRing with insufficient feeAmount (will use feePercentage)", () => {
    before(async () => {
      await cleanTradeHistory();
    });

    for (const ringsInfo of ringsInfoList) {
      ringsInfo.transactionOrigin = transactionOrigin;
      ringsInfo.miner = miner;
      ringsInfo.feeRecipient = miner;

      it(ringsInfo.description, async () => {
        for (const [i, order] of ringsInfo.orders.entries()) {
          await setupOrder(order, i, true);
        }
        const context = getDefaultContext();
        await submitRingsAndSimulate(context, ringsInfo, web3.eth.blockNumber);
      });
    }
  });

  describe.skip("submitRing in P2P scenario", () => {
    before(async () => {
      await cleanTradeHistory();
    });

    for (const ringsInfo of ringsInfoList) {
      it(ringsInfo.description, async () => {
        for (const [i, order] of ringsInfo.orders.entries()) {
          await setupOrder(order, i, true);
        }
        const ringMiner = ringsInfo.orders[0].owner;
        ringsInfo.transactionOrigin = ringMiner;
        ringsInfo.miner = ringMiner;
        ringsInfo.feeRecipient = ringMiner;

        const context = getDefaultContext();
        await submitRingsAndSimulate(context, ringsInfo, web3.eth.blockNumber);
      });
    }
  });

  // Added '.skip' here so these tests are NOT run by default because they take quite
  // a bit of extra time to run. Remove it once development on submitRings is less frequent.
  describe.skip("Cancelling orders", () => {

    // Start each test case with a clean trade history otherwise state changes
    // would persist between test cases which would be hard to keep track of and
    // could potentially hide bugs
    beforeEach(async () => {
      await cleanTradeHistory();
    });

    it("should be able to cancel an order", async () => {
      const ringsInfo: RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: allTokenSymbols[0],
            tokenB: allTokenSymbols[1],
            amountS: 35e17,
            amountB: 22e17,
          },
          {
            tokenS: allTokenSymbols[1],
            tokenB: allTokenSymbols[0],
            amountS: 23e17,
            amountB: 31e17,
          },
        ],
        transactionOrigin,
        miner,
        feeRecipient: miner,
      };

      for (const [i, order] of ringsInfo.orders.entries()) {
        await setupOrder(order, i);
      }

      const context = getDefaultContext();

      // Setup the ring so we have access to the calculated hashes
      const ringsGenerator = new RingsGenerator(context);
      await ringsGenerator.setupRingsAsync(ringsInfo);

      // Cancel the second order in the ring
      const orderToCancelIdx = 1;
      const orderToCancel = ringsInfo.orders[orderToCancelIdx];
      const hashes = new Bitstream();
      hashes.addHex(orderToCancel.hash.toString("hex"));
      const cancelTx = await exchange.cancelOrders(orderToCancel.owner, hashes.getData());

      // Check the TradeDelegate contract to see if the order is indeed cancelled
      const expectedValidValues = ringsInfo.orders.map((element, index) => (index !== orderToCancelIdx));
      assertOrdersValid(ringsInfo.orders, expectedValidValues);

      // Now submit the ring to make sure it behaves as expected (should NOT throw)
      const {tx, report} = await submitRingsAndSimulate(context, ringsInfo, web3.eth.blockNumber);

      // Make sure no tokens got transferred
      assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
    });

    it("should be able to cancel all orders of a trading pair of an owner", async () => {
      const ringsInfo: RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: allTokenSymbols[2],
            tokenB: allTokenSymbols[1],
            amountS: 41e17,
            amountB: 20e17,
          },
          {
            tokenS: allTokenSymbols[1],
            tokenB: allTokenSymbols[2],
            amountS: 23e17,
            amountB: 10e17,
          },
        ],
        transactionOrigin,
        miner,
        feeRecipient: miner,
      };

      for (const [i, order] of ringsInfo.orders.entries()) {
        await setupOrder(order, i);
      }

      const context = getDefaultContext();

      // Setup the ring so we have access to the calculated hashes
      const ringsGenerator = new RingsGenerator(context);
      await ringsGenerator.setupRingsAsync(ringsInfo);

      // Cancel the first order using trading pairs
      const orderToCancelIdx = 0;
      const orderToCancel = ringsInfo.orders[orderToCancelIdx];
      const cancelTx = await exchange.cancelAllOrdersForTradingPair(
        orderToCancel.owner, orderToCancel.tokenS, orderToCancel.tokenB, orderToCancel.validSince + 500);

      // Check the TradeDelegate contract to see if the order is indeed cancelled
      const expectedValidValues = ringsInfo.orders.map((element, index) => (index !== orderToCancelIdx));
      assertOrdersValid(ringsInfo.orders, expectedValidValues);

      // Now submit the ring to make sure it behaves as expected (should NOT throw)
      const {tx, report} = await submitRingsAndSimulate(context, ringsInfo, web3.eth.blockNumber);

      // Make sure no tokens got transferred
      assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
    });

    it("should be able to cancel all orders of an owner", async () => {
      const ringsInfo: RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: allTokenSymbols[2],
            tokenB: allTokenSymbols[1],
            amountS: 57e17,
            amountB: 35e17,
          },
          {
            tokenS: allTokenSymbols[1],
            tokenB: allTokenSymbols[2],
            amountS: 12e17,
            amountB: 8e17,
          },
        ],
        transactionOrigin,
        miner,
        feeRecipient: miner,
      };

      for (const [i, order] of ringsInfo.orders.entries()) {
        await setupOrder(order, i);
      }

      const context = getDefaultContext();

      // Setup the ring so we have access to the calculated hashes
      const ringsGenerator = new RingsGenerator(context);
      await ringsGenerator.setupRingsAsync(ringsInfo);

      // Cancel the first order using trading pairs
      const orderToCancelIdx = 1;
      const orderToCancel = ringsInfo.orders[orderToCancelIdx];
      const cancelTx = await exchange.cancelAllOrders(orderToCancel.owner, orderToCancel.validSince + 500);

      // Check the TradeDelegate contract to see if the order is indeed cancelled
      const expectedValidValues = ringsInfo.orders.map((element, index) => (index !== orderToCancelIdx));
      assertOrdersValid(ringsInfo.orders, expectedValidValues);

      // Now submit the ring to make sure it behaves as expected (should NOT throw)
      const {tx, report} = await submitRingsAndSimulate(context, ringsInfo, web3.eth.blockNumber);

      // Make sure no tokens got transferred
      assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
    });

  });

  // Added '.skip' here so these tests are NOT run by default because they take quite
  // a bit of extra time to run. Remove it once development on submitRings is less frequent.
  describe.skip("Broker", () => {

    // Start each test case with a clean trade history otherwise state changes
    // would persist between test cases which would be hard to keep track of and
    // could potentially hide bugs
    beforeEach(async () => {
      await cleanTradeHistory();
    });

    it("should be able for an order to use a broker without an interceptor", async () => {
      const ringsInfo: RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: allTokenSymbols[0],
            tokenB: allTokenSymbols[1],
            amountS: 35e17,
            amountB: 22e17,
            broker: broker1,
          },
          {
            tokenS: allTokenSymbols[1],
            tokenB: allTokenSymbols[0],
            amountS: 23e17,
            amountB: 31e17,
          },
        ],
        transactionOrigin,
        miner,
        feeRecipient: miner,
      };

      for (const [i, order] of ringsInfo.orders.entries()) {
        await setupOrder(order, i);
      }

      const owner = ringsInfo.orders[0].owner;
      const context = getDefaultContext();
      const emptyAddr = "0x0000000000000000000000000000000000000000";

      // Broker not registered: submitRings should NOT throw, but no transactions should happen
      {
        const {tx, report} = await submitRingsAndSimulate(context, ringsInfo, web3.eth.blockNumber);
        assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
      }

      // Register the broker without interceptor
      await registerBrokerChecked(owner, broker1, emptyAddr);

      // Broker registered: transactions should happen
      {
        const {tx, report} = await submitRingsAndSimulate(context, ringsInfo, web3.eth.blockNumber);
        assert(report.transferItems.length > 0, "Tokens should be transfered");
      }

      // Unregister the broker
      await unregisterBrokerChecked(owner, broker1);
    });

    it("should be able to for an order to use a broker with an interceptor", async () => {
      const ringsInfo: RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: allTokenSymbols[1],
            tokenB: allTokenSymbols[2],
            amountS: 35e17,
            amountB: 22e17,
          },
          {
            tokenS: allTokenSymbols[2],
            tokenB: allTokenSymbols[1],
            amountS: 23e17,
            amountB: 31e17,
            broker: broker1,
          },
        ],
        transactionOrigin,
        miner,
        feeRecipient: miner,
      };

      for (const [i, order] of ringsInfo.orders.entries()) {
        await setupOrder(order, i);
      }

      const orderIndex = 1;
      const owner = ringsInfo.orders[orderIndex].owner;
      const amountS = ringsInfo.orders[orderIndex].amountS;
      const context = getDefaultContext();

      // Broker not registered: submitRings should NOT throw, but no transactions should happen
      {
        const {tx, report} = await submitRingsAndSimulate(context, ringsInfo, web3.eth.blockNumber);
        assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
      }

      // Register the broker with interceptor
      await registerBrokerChecked(owner, broker1, dummyBrokerInterceptor.address);

      // Make sure allowance is set to 0
      await dummyBrokerInterceptor.setAllowance(0e17);

      // Broker registered, but allowance is set to 0 so no transactions should happen
      {
        const {tx, report} = await submitRingsAndSimulate(context, ringsInfo, web3.eth.blockNumber);
        assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
      }

      // Set allowance to something less than amountS
      await dummyBrokerInterceptor.setAllowance(amountS / 3);

      // Broker registered, allowance is set to non-zero so transactions should happen
      {
        const {tx, report} = await submitRingsAndSimulate(context, ringsInfo, web3.eth.blockNumber);
        assert(report.transferItems.length > 0, "Tokens should be transfered");
      }

      // Now set the allowance large enough so that the complete order can be fulfilled
      await dummyBrokerInterceptor.setAllowance(amountS);

      // Broker registered and allowance set to a high value: transactions should happen
      {
        const {tx, report} = await submitRingsAndSimulate(context, ringsInfo, web3.eth.blockNumber);
        assert(report.transferItems.length > 0, "Tokens should be transfered");
      }

      // Unregister the broker
      await unregisterBrokerChecked(owner, broker1);
    });

    it("an order using a broker with an invalid interceptor should not fail the transaction", async () => {
      const ringsInfo: RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: allTokenSymbols[0],
            tokenB: allTokenSymbols[1],
            amountS: 35e17,
            amountB: 22e17,
          },
          {
            tokenS: allTokenSymbols[1],
            tokenB: allTokenSymbols[0],
            amountS: 23e17,
            amountB: 31e17,
            broker: broker1,
          },
        ],
        transactionOrigin,
        miner,
        feeRecipient: miner,
      };

      for (const [i, order] of ringsInfo.orders.entries()) {
        await setupOrder(order, i);
      }

      const owner = ringsInfo.orders[1].owner;
      const context = getDefaultContext();
      const invalidInterceptorAddress = TokenRegistry.address;

      // Register the broker with interceptor
      await registerBrokerChecked(owner, broker1, invalidInterceptorAddress);

      // Broker registered with invalid interceptor, should NOT throw but allowance will be set to 0
      // so no transactions should happen
      {
        const {tx, report} = await submitRingsAndSimulate(context, ringsInfo, web3.eth.blockNumber);
        assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
      }

      // Unregister the broker
      await unregisterBrokerChecked(owner, broker1);

      // Register the broker with interceptor
      await registerBrokerChecked(owner, broker1, dummyBrokerInterceptor.address);

      // Now set the allowance to a large number
      await dummyBrokerInterceptor.setAllowance(1e32);

      // Let all functions fail
      await dummyBrokerInterceptor.setFailAllFunctions(true);

      // Broker registered with interceptor functions erroring out, should NOT throw but allowance will be set to 0
      // so no transactions should happen
      {
        const {tx, report} = await submitRingsAndSimulate(context, ringsInfo, web3.eth.blockNumber);
        assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
      }

      // Unregister the broker
      await unregisterBrokerChecked(owner, broker1);
    });

  });

  // Added '.skip' here so these tests are NOT run by default because they take quite
  // a bit of extra time to run. Remove it once development on submitRings is less frequent.
  describe.skip("Security", () => {

    beforeEach(async () => {
      await cleanTradeHistory();
    });

    it("Reentrancy attack", async () => {
      const ringsInfo: RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: allTokenSymbols[0],
            tokenB: allTokenSymbols[1],
            amountS: 35e17,
            amountB: 22e17,
            broker: broker1,
          },
          {
            tokenS: allTokenSymbols[1],
            tokenB: allTokenSymbols[0],
            amountS: 23e17,
            amountB: 31e17,
          },
        ],
        transactionOrigin,
        miner,
        feeRecipient: miner,
      };

      // A ring without callbacks so submitRings doesn't get into an infinite loop
      // in a reentrancy scenario
      const ringsInfoAttack: RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: allTokenSymbols[0],
            tokenB: allTokenSymbols[1],
            amountS: 35e17,
            amountB: 25e17,
          },
          {
            tokenS: allTokenSymbols[1],
            tokenB: allTokenSymbols[0],
            amountS: 23e17,
            amountB: 32e17,
          },
        ],
        transactionOrigin,
        miner,
        feeRecipient: miner,
      };

      for (const [i, order] of ringsInfo.orders.entries()) {
        await setupOrder(order, i);
      }

      for (const [i, order] of ringsInfoAttack.orders.entries()) {
        await setupOrder(order, i);
      }

      const owner = ringsInfo.orders[0].owner;
      const context = getDefaultContext();

      const attackBrokerInterceptor = await DummyBrokerInterceptor.new(exchange.address);

      // Register the broker with interceptor
      await registerBrokerChecked(owner, broker1, attackBrokerInterceptor.address);

      // Set the allowance to a large number
      await attackBrokerInterceptor.setAllowance(1e32);

      // Enable the Reentrancy attack
      // Create a valid ring that can be submitted by the interceptor
      {
        const ringsGeneratorAttack = new RingsGenerator(context);
        await ringsGeneratorAttack.setupRingsAsync(ringsInfoAttack);
        const bsAttack = ringsGeneratorAttack.toSubmitableParam(ringsInfoAttack);
        // Enable the reentrancy attack on the interceptor
        await attackBrokerInterceptor.setReentrancyAttackEnabled(true, bsAttack);
      }

      // Setup the ring
      const ringsGenerator = new RingsGenerator(context);
      await ringsGenerator.setupRingsAsync(ringsInfo);
      const bs = ringsGenerator.toSubmitableParam(ringsInfo);

      // submitRings currently does not throw because external calls cannot fail the transaction
      exchange.submitRings(bs, {from: transactionOrigin});

      // Unregister the broker
      await unregisterBrokerChecked(owner, broker1);
    });

  });

});
