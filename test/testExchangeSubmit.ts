import { BigNumber } from "bignumber.js";
import { Artifacts } from "../util/Artifacts";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { OrderInfo, RingInfo, RingsInfo } from "./types";

const {
  DummyExchange,
  TESTToken,
} = new Artifacts(artifacts);

contract("Exchange_Submit", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  const zeroAddress = "0x" + "00".repeat(20);

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  describe("submitRing", () => {
    it("Basic test", async () => {
      const ringsInfo: RingsInfo = {
        rings : [
          {
            orderA:
              {
                tokenS: "WETH",
                tokenB: "GTO",
                amountS: 100,
                amountB: 200,
                amountF: 1000,
              },
            orderB:
              {
                tokenS: "GTO",
                tokenB: "WETH",
                amountS: 200,
                amountB: 100,
                amountF: 1000,
              },
          },
          /*{
            orderA:
              {
                tokenS: "WETH",
                tokenB: "GTO",
                amountS: 100,
                amountB: 200,
                amountF: 1000,
              },
            orderB:
              {
                tokenS: "GTO",
                tokenB: "WETH",
                amountS: 200,
                amountB: 100,
                amountF: 1000,
              },
          },*/
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      await exchangeTestUtil.submitRings(ringsInfo);
    });
  });
});
