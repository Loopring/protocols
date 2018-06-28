import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import abi = require("ethereumjs-abi");
import ethUtil = require("ethereumjs-util");
import * as _ from "lodash";
import util = require("util");
import { Artifacts } from "../util/artifacts";
import { Bitstream } from "../util/bitstream";
import { Ring } from "../util/ring";
import { ringsInfoList } from "../util/rings_config";
import { RingsGenerator } from "../util/rings_generator";
import { OrderInfo, RingsInfo } from "../util/types";

const {
  Exchange,
  TokenRegistry,
  TradeDelegate,
  DummyToken,
  RingSpecs,
} = new Artifacts(artifacts);

contract("Exchange", (accounts: string[]) => {
  const miner = accounts[1];
  const orderOwners = [accounts[5], accounts[6], accounts[7]]; // 5 ~ 7

  let exchange: any;
  let tokenRegistry: any;
  let tradeDelegate: any;

  const tokenSymbolAddrMap = new Map();

  const assertNumberEqualsWithPrecision = (n1: number, n2: number, precision: number = 8) => {
    const numStr1 = (n1 / 1e18).toFixed(precision);
    const numStr2 = (n2 / 1e18).toFixed(precision);

    return assert.equal(Number(numStr1), Number(numStr2));
  };

  const approve = async (tokens: any[], addresses: string[], amounts: number[]) => {
    for (let i = 0; i < tokens.length; i++) {
      await tokens[i].approve(TradeDelegate.address, 0, {from: addresses[i]});
      await tokens[i].approve(TradeDelegate.address, amounts[i], {from: addresses[i]});
    }
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

  before( async () => {
    [exchange, tokenRegistry, tradeDelegate] = await Promise.all([
      Exchange.deployed(),
      TokenRegistry.deployed(),
      TradeDelegate.deployed(),
    ]);
  });

  const setupOrder = async (order: OrderInfo, index: number) => {
    const ownerIndex = index === 0 ? index : orderOwners.length % index;
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
  };

  describe("submitRing", () => {
    const currBlockTimeStamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    const ringsGenerator = new RingsGenerator(TradeDelegate.address, currBlockTimeStamp);

    for (const ringsInfo of ringsInfoList) {
      // all configed testcases here:
      it(ringsInfo.description, async () => {
        for (const [i, order] of ringsInfo.orders.entries()) {
          await setupOrder(order, i);
        }

        const bs = ringsGenerator.toSubmitableParam(ringsInfo);
        // console.log("bs:", bs);

        const tx = await exchange.submitRings(bs, {from: miner});
        // console.log("tx:", tx);
        // await watchAndPrintEvent(exchange, "LogInt16Arr");
        // await watchAndPrintEvent(exchange, "LogIntArr");

        // await exchange.bar("ab".repeat(16) + "xy".repeat(10), {from: miner});

        // await watchAndPrintEvent(exchange, "LogUint8Arr");
        // await watchAndPrintEvent(exchange, "LogIntArr");
        // await watchAndPrintEvent(exchange, "LogAddrArr");
        // await watchAndPrintEvent(exchange, "LogOrderFields");
        await watchAndPrintEvent(exchange, "LogInt");

        assert(true);
      });
    }

  });

});
