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
import { MultiHashUtil } from "../util/multihash";
import { ProtocolSimulator } from "../util/protocol_simulator";
import { Ring } from "../util/ring";
import { ringsInfoList } from "../util/rings_config";
import { RingsGenerator } from "../util/rings_generator";
import { OrderInfo, RingMinedEvent, RingsInfo, SignAlgorithm, SimulatorReport } from "../util/types";

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

  const multiHashUtil = new MultiHashUtil();

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

  const getRingMinedEvents = async (fromBlock: number) => {
    const ringMinedEvents: RingMinedEvent[] = [];
    const eventArr: any = await getEventsFromContract(exchange, "RingMined", fromBlock);
    const items = eventArr.map((eventObj: any) => {
      const ringMined = {
        ringIndex: eventObj.args._ringIndex,
      };
      ringMinedEvents.push(ringMined);
    });
    return ringMinedEvents;
  };

  const validateSubmitRings = async (tx: any, ringsInfo: RingsInfo, simulatorReport: SimulatorReport) => {
    // Validate RingMined events
    const ringMinedEvents = await getRingMinedEvents(tx.receipt.blockNumber);
    assert(ringMinedEvents.length === simulatorReport.ringMinedEvents.length, "Different number of RingMined events");
    /*for (let i = 0; i < ringMinedEvents.length; i++) {
      assert(
        ringMinedEvents[i].ringIndex.equals(simulatorReport.ringMinedEvents[i].ringIndex),
        "RingMined event ring indices should match",
      );
    }*/
    // Ring index of all mined rings should get incremented by 1 for every additional ring
    for (let i = 1; i < ringMinedEvents.length; i++) {
      assert(
        ringMinedEvents[i - 1].ringIndex.equals(ringMinedEvents[i].ringIndex.minus(1)),
        "RingIndex should increment by 1",
      );
    }
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

    // setup amount:
    const orderTokenS = await DummyToken.at(addrS);
    await orderTokenS.addBalance(order.owner, order.amountS);
    const lrcToken = await DummyToken.at(lrcAddress);
    await lrcToken.addBalance(order.owner, order.lrcFee);
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
      it(ringsInfo.description, async () => {

        for (const [i, order] of ringsInfo.orders.entries()) {
          await setupOrder(order, i);
        }

        await ringsGenerator.setupRingsAsync(ringsInfo, transactionOrigin);

        const bs = ringsGenerator.toSubmitableParam(ringsInfo);
        // console.log("bs:", bs);

        const simulatorReport = await simulator.simulateAndReport(ringsInfo, transactionOrigin);

        const tx = await exchange.submitRings(bs, {from: transactionOrigin});
        // console.log("tx:", tx);
        console.log("Rings mined: ", simulatorReport.ringMinedEvents.length);
        await watchAndPrintEvent(exchange, "LogTrans");

        await validateSubmitRings(tx, ringsInfo, simulatorReport);

        assert(true);
      });
    }

  });

});
