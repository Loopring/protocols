import * as pjs from "protocol2-js";
import { Artifacts } from "../util/Artifacts";
import { ringsInfoList } from "./rings_config";
import { ExchangeTestUtil } from "./testExchangeUtil";

const {
  DummyExchange,
  DeserializerTest,
} = new Artifacts(artifacts);

contract("Exchange_Submit_gas_usage", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  let dummyExchange: any;
  let deserializerTest: any;

  const checkFilled = async (order: pjs.OrderInfo, expected: number) => {
    const filled = await exchangeTestUtil.context.tradeDelegate.filled("0x" + order.hash.toString("hex")).toNumber();
    assert.equal(filled, expected, "Order fill different than expected");
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    deserializerTest = await DeserializerTest.deployed();

    // Create dummy exchange and authorize it
    dummyExchange = await DummyExchange.new(exchangeTestUtil.context.tradeDelegate.address,
                                            exchangeTestUtil.context.feeHolder.address,
                                            exchangeTestUtil.ringSubmitter.address);
    await exchangeTestUtil.context.tradeDelegate.authorizeAddress(dummyExchange.address,
                                                                  {from: exchangeTestUtil.testContext.deployer});
  });

  describe("submitRing", () => {
    it("single 2-size ring, with price gap", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 100e18,
            amountB: 10e18,
          },
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 5e18,
            amountB: 45e18,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);
    });
  });

  describe("submitRing param data deserialize", () => {
    it("single 2-size ring, deserialize", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 100e18,
            amountB: 10e18,
          },
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 5e18,
            amountB: 45e18,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      const paramData = await exchangeTestUtil.deserializeRing(ringsInfo);
      const tx = await deserializerTest.deserialize(paramData);
      console.log("\x1b[46m%s\x1b[0m", "gas used: " + tx.receipt.gasUsed);
    });
  });

});
