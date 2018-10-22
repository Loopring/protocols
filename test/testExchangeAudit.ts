import * as pjs from "protocol2-js";
import { Artifacts } from "../util/Artifacts";
import { ringsInfoList } from "./rings_config";
import { ExchangeTestUtil } from "./testExchangeUtil";

const {
  DummyExchange,
  DeserializerTest,
} = new Artifacts(artifacts);

contract("Exchange_Submit_Audit", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  let dummyExchange: any;
  let deserializerTest: any;

  const checkFilled = async (order: pjs.OrderInfo, expected: number) => {
    const filled = await exchangeTestUtil.context.tradeDelegate.filled("0x" + order.hash.toString("hex")).toNumber();
    assert.equal(filled, expected, "Order fill different than expected");
  };

  const showCallDataStats = (callData: string)  => {
    // console.log("Call data: " + callData);
    let callDataCost = 0;
    for (let i = 0; i < callData.length; i += 2) {
      if (callData.slice(i, i + 2) === "00") {
        callDataCost += 4;
      } else {
        callDataCost += 68;
      }
    }
    pjs.logDebug("Call data cost: " + callDataCost);
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
    it("check allOrNone A", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 2], [0, 1]],
        orders: [
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 10e18,
            amountB: 10e18,
            allOrNone: true,
          },
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 5e18,
            amountB: 5e18,
            allOrNone: false,
          },
          {
            index: 2,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 6e18,
            amountB: 6e18,
            allOrNone: true,
          },
        ],
        expected: {
          rings: [
            {
              orders: [
                {
                  filledFraction: 0.5,
                },
                {
                  filledFraction: 1.0,
                },
              ],
            },
            {
              orders: [
                {
                  filledFraction: 0.5,
                },
                {
                  filledFraction: 4 / 5,
                },
              ],
            },
          ],
        },
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      await exchangeTestUtil.submitRingsAndSimulate(ringsInfo, dummyExchange);
    });

    it("check allOrNone B", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1], [0, 2]],
        orders: [
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 10e18,
            amountB: 10e18,
            allOrNone: true,
          },
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 5e18,
            amountB: 5e18,
            allOrNone: false,
          },
          {
            index: 2,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 6e18,
            amountB: 6e18,
            allOrNone: true,
          },
        ],
        expected: {
          rings: [
            {
              fail: true,
            },
            {
              fail: true,
            },
          ],
        },
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      await exchangeTestUtil.submitRingsAndSimulate(ringsInfo, dummyExchange);
    });

  });

});
