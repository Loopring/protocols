import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import abi = require("ethereumjs-abi");
import ethUtil = require("ethereumjs-util");
import * as _ from "lodash";
import util = require("util");
import { Artifacts } from "../util/artifacts";
import { Bitstream } from "../util/bitstream";
import { Ring } from "../util/ring";
import { RingsGenerator } from "../util/rings_generator";
import { RingsInfo } from "../util/types";

const {
  Exchange,
  TokenRegistry,
  TradeDelegate,
  DummyToken,
} = new Artifacts(artifacts);

contract("Exchange", (accounts: string[]) => {
  const miner = accounts[1];

  let exchange: any;
  let tokenRegistry: any;
  let tradeDelegate: any;

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

  describe("submitRing", () => {
    const currBlockTimeStamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    const ringsGenerator = new RingsGenerator(TradeDelegate.address, currBlockTimeStamp);

    const ringsList: RingsInfo[] = ringsGenerator.getRingsInfoList();
    console.log(ringsList.length);

    for (const rings of ringsList) {
      // all configed testcases here:
      it(rings.description, async () => {
        const bs = ringsGenerator.toSubmitableParam(rings);
        console.log("bs:", bs);

        await exchange.submitRings(bs, {from: miner});
        await watchAndPrintEvent(exchange, "LogIntArr");

        // await exchange.submitRings(params.miningSpec,
        //                            params.orderSpecs,
        //                            // params.ringSpecs,
        //                            params.addressList,
        //                            params.uintList,
        //                            // params.bytesList,
        //                            {from: miner});
        // await watchAndPrintEvent(exchange, "LogParam");
        assert(true);
      });
    }

//     it("bytes test", async () => {
//       const a = accounts[9];
//       const bn = new BigNumber(12345);
//       const c = 31;
//       const d = "xxxbbbcc";
//       const h = "ccccccccccccccccccccccccccdddddddddddddddd\
// ddddddddddddddddddxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\
// xxxxxxxxxxxxxxxxxxxxfffffffffffffffffffffffff987";

//       console.log("address:", a);

//       const bs = new Bitstream();
//       bs.addAddress(a, 32);
//       bs.addBigNumber(bn);
//       bs.addNumber(c, 32);
//       bs.addHex(web3.toHex(d));
//       // bs.addHex(web3.toHex(h));

//       const data = bs.getData();
//       console.log("data:", data);

//       // const paramsBytes = abi.rawEncode(["address", "uint256", "uint8", "bytes32", "bytes"],
//       //                                   [a, new BN(bn.toString(10), 10), c, d, h]);
//       // console.log("paramsBytes:", paramsBytes.toString("hex"));
//       // console.log("paramsBytes with web3:", ethUtil.bufferToHex(paramsBytes));
//       const tx = await exchange.structCopyTest(data, {from: miner, gasLimit: 6000000});
//       // console.log("tx:", tx);
//       await watchAndPrintEvent(exchange, "LogBytes");
//       await watchAndPrintEvent(exchange, "LogData");
//     });

  });

});
