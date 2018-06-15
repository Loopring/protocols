import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import abi = require("ethereumjs-abi");
import * as _ from "lodash";
import { Artifacts } from "../util/artifacts";
import { Ring } from "../util/ring";
import { RingsGenerator } from "../util/rings_generator";
import { RingsSubmitParams } from "../util/types";

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

  let ringsGenerator: RingsGenerator;

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

  before( async () => {
    [exchange, tokenRegistry, tradeDelegate] = await Promise.all([
      Exchange.deployed(),
      TokenRegistry.deployed(),
      TradeDelegate.deployed(),
    ]);

    ringsGenerator = new RingsGenerator();
  });

  describe("submitRing", () => {
    // it("should be able to fill ring with 2 orders", async () => {
    //   const rings: Ring[] = ringsGenerator.generateRings();
    //   const params: RingsSubmitParams = ringsGenerator.toSubmitableParam(rings);
    //   exchange.submitRings(params.miningSpec,
    //                        params.orderSpecs,
    //                        params.ringSpecs,
    //                        params.addressList,
    //                        params.uintList,
    //                        params.bytesList,
    //                        {from: miner});
    //   assert(true);
    // });

    it("bytes test", async () => {
      const a = accounts[9];
      const bn = new BigNumber(12345);
      const c = 31;
      const d = "xxxbbbcc";
      const h = "ccccccccccccccccccccccccccdddddddddddddddd\
ddddddddddddddddddxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\
xxxxxxxxxxxxxxxxxxxxfffffffffffffffffffffffff987";

      const paramsBytes = abi.rawEncode(["address", "uint256", "uint8", "bytes32", "bytes"],
                                        [a, new BN(bn.toString(10), 10), c, d, h]);
      console.log("paramsBytes:", paramsBytes.toString("hex"));
    });

  });

});
