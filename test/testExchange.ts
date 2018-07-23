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
import { ProtocolSimulator } from "../util/protocol_simulator";
import { Ring } from "../util/ring";
import { ringsInfoList } from "../util/rings_config";
import { RingsGenerator } from "../util/rings_generator";
import { OrderInfo, RingsInfo, SignAlgorithm } from "../util/types";

const {
  Exchange,
  TokenRegistry,
  TradeDelegate,
  DummyToken,
} = new Artifacts(artifacts);

contract("Exchange", (accounts: string[]) => {
  const deployer = accounts[0];
  const miner = accounts[9];
  const orderOwners = accounts.slice(5, 8); // 5 ~ 7
  const orderDualAuthAddr = accounts.slice(1, 4);
  const transactionOrigin = /*miner*/ accounts[1];

  let exchange: any;
  let tokenRegistry: any;
  let tradeDelegate: any;
  let lrcAddress: string;
  let walletSplitPercentage: number;

  const tokenSymbolAddrMap = new Map();
  const tokenInstanceMap = new Map();
  const allTokenSymbols = tokenInfos.development.map((t) => t.symbol);

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

  const watchAndPrintEvent = async (contract: any, eventName: string) => {
    const events: any = await getEventsFromContract(contract, eventName, 0);

    events.forEach((e: any) => {
      console.log("event:", util.inspect(e.args, false, null));
    });
  };

  const setupOrder = async (order: OrderInfo, index: number) => {
    const ownerIndex = index === 0 ? index : index % orderOwners.length;
    const owner = orderOwners[ownerIndex];

    const symbolS = order.tokenS;
    const symbolB = order.tokenB;
    const addrS = await tokenRegistry.getAddressBySymbol(symbolS);
    const addrB = await tokenRegistry.getAddressBySymbol(symbolB);

    order.owner = owner;
    order.delegateContract = TradeDelegate.address;
    order.tokenS = addrS;
    order.tokenB = addrB;
    if (!order.lrcFee) {
      order.lrcFee = 1e18;
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

    // setup amount:
    const orderTokenS = await DummyToken.at(addrS);
    await orderTokenS.addBalance(order.owner, order.amountS);
    const lrcToken = await DummyToken.at(lrcAddress);
    await lrcToken.addBalance(order.owner, order.lrcFee);
  };

  const assertEqualsRingsInfo = (ringsInfoA: RingsInfo, ringsInfoB: RingsInfo) => {
    // Blacklist properties we don't want to check.
    // We don't whitelist because we might forget to add them here otherwise.
    const ringsInfoPropertiesToSkip = ["description", "signAlgorithm", "hash"];
    const orderPropertiesToSkip = [
      "maxAmountS", "maxAmountB", "fillAmountS", "fillAmountB", "fillAmountLrcFee", "splitS", "brokerInterceptor",
      "valid", "hash", "delegateContract", "signAlgorithm", "dualAuthSignAlgorithm", "index", "lrcAddress",
    ];
    // Make sure to get the keys from both objects to make sure we get all keys defined in both
    for (const key of [...Object.keys(ringsInfoA), ...Object.keys(ringsInfoB)]) {
      if (ringsInfoPropertiesToSkip.every((x) => x !== key)) {
        if (key === "rings") {
          assert(ringsInfoA.rings.length === ringsInfoB.rings.length,
                 "Number of rings does not match");
          for (let r = 0; r < ringsInfoA.rings.length; r++) {
            assert(ringsInfoA.rings[r].length === ringsInfoB.rings[r].length,
                   "Number of orders in rings does not match");
            for (let o = 0; o < ringsInfoA.rings[r].length; o++) {
              assert(ringsInfoA.rings[r][o] === ringsInfoB.rings[r][o],
                     "Order indices in rings do not match");
            }
          }
        } else if (key === "orders") {
          assert(ringsInfoA.orders.length === ringsInfoB.orders.length,
                 "Number of orders does not match");
          for (let o = 0; o < ringsInfoA.orders.length; o++) {
            for (const orderKey of [...Object.keys(ringsInfoA.orders[o]), ...Object.keys(ringsInfoB.orders[o])]) {
              if (orderPropertiesToSkip.every((x) => x !== orderKey)) {
                assert(ringsInfoA.orders[o][orderKey] === ringsInfoB.orders[o][orderKey],
                       "Order property '" + orderKey + "' does not match");
              }
            }
          }
        } else {
            assert(ringsInfoA[key] === ringsInfoB[key],
                   "RingInfo property '" + key + "' does not match");
        }
      }
    }
  };

  before( async () => {
    [exchange, tokenRegistry, tradeDelegate] = await Promise.all([
      Exchange.deployed(),
      TokenRegistry.deployed(),
      TradeDelegate.deployed(),
    ]);

    await tradeDelegate.authorizeAddress(Exchange.address, {from: deployer});
    lrcAddress = await tokenRegistry.getAddressBySymbol("LRC");

    const walletSplitPercentageBN = await tradeDelegate.walletSplitPercentage();
    walletSplitPercentage = walletSplitPercentageBN.toNumber();

    for (const sym of allTokenSymbols) {
      const addr = await tokenRegistry.getAddressBySymbol(sym);
      tokenSymbolAddrMap.set(sym, addr);
      const token = await DummyToken.at(addr);
      // approve once for all orders:
      for (const orderOwner of orderOwners) {
        await token.approve(TradeDelegate.address, 1e27, {from: orderOwner});
      }
    }
  });

  describe("submitRing", () => {
    const currBlockTimeStamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    const ringsGenerator = new RingsGenerator(TradeDelegate.address, currBlockTimeStamp);

    const simulator = new ProtocolSimulator(walletSplitPercentage);

    for (const ringsInfo of ringsInfoList) {
      // all configed testcases here:
      ringsInfo.transactionOrigin = transactionOrigin;

      it(ringsInfo.description, async () => {

        for (const [i, order] of ringsInfo.orders.entries()) {
          await setupOrder(order, i);
        }

        await ringsGenerator.setupRingsAsync(ringsInfo);

        await simulator.simulateAndReport(ringsInfo);

        const bs = ringsGenerator.toSubmitableParam(ringsInfo);
        // console.log("bs:", bs);

        const tx = await exchange.submitRings(bs, {from: transactionOrigin});
        // console.log("tx:", tx);
        await watchAndPrintEvent(exchange, "LogTrans");
        // await watchAndPrintEvent(exchange, "LogAddress");

        const deserializedRingsInfo = simulator.deserialize(bs, transactionOrigin, TradeDelegate.address);
        assertEqualsRingsInfo(ringsInfo, deserializedRingsInfo);

        assert(true);
      });
    }

  });

});
