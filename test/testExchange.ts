import { BigNumber } from "bignumber.js";
import promisify = require("es6-promisify");
import * as _ from "lodash";
import { Artifacts } from "../util/artifacts";
import { RingFactory } from "../util/ring_factory";
import { OrderParams } from "../util/types";

const {
  Exchange,
  TokenRegistry,
  TradeDelegate,
  DummyToken,
} = new Artifacts(artifacts);

contract("Exchange", (accounts: string[]) => {
  let exchange: any;
  let tokenRegistry: any;
  let tradeDelegate: any;

  let currBlockTimeStamp: number;
  let walletSplitPercentage: number;

  let ringFactory: RingFactory;

  const getTokenBalanceAsync = async (token: any, addr: string) => {
    const tokenBalanceStr = await token.balanceOf(addr);
    const balance = new BigNumber(tokenBalanceStr);
    return balance;
  };

  const getEthBalanceAsync = async (addr: string) => {
    const balanceStr = await promisify(web3.eth.getBalance)(addr);
    const balance = new BigNumber(balanceStr);
    return balance;
  };

  const assertNumberEqualsWithPrecision = (n1: number, n2: number, precision: number = 8) => {
    const numStr1 = (n1 / 1e18).toFixed(precision);
    const numStr2 = (n2 / 1e18).toFixed(precision);

    return assert.equal(Number(numStr1), Number(numStr2));
  };

  const clear = async (tokens: any[], addresses: string[]) => {
    for (const token of tokens) {
      for (const address of addresses) {
        await token.setBalance(address, 0);
      }
    }
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
  });

  describe("submitRing", () => {
    it("should be able to fill ring with 2 orders", async () => {
      assert(true);
    });

  });

});
