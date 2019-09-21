import * as pjs from "protocol2-js";
import { Artifacts } from "../util/Artifacts";
import { ExchangeTestUtil } from "./testExchangeUtil";

const {
  DummyExchange,
  OrderBook,
  OrderRegistry,
} = new Artifacts(artifacts);

contract("SubmitRings_Simple", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  let dummyExchange: any;

  const checkFilled = async (order: pjs.OrderInfo, expected: number) => {
    const filled = await exchangeTestUtil.context.tradeDelegate.filled("0x" + order.hash.toString("hex")).toNumber();
    assert.equal(filled, expected, "Order fill different than expected");
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);

    // Create dummy exchange and authorize it
    dummyExchange = await DummyExchange.new(exchangeTestUtil.context.tradeDelegate.options.address,
                                            exchangeTestUtil.context.tradeHistory.options.address,
                                            exchangeTestUtil.context.feeHolder.options.address,
                                            exchangeTestUtil.ringSubmitter.address);
    await exchangeTestUtil.context.tradeDelegate.methods.authorizeAddress(
      dummyExchange.address,
    ).send({from: exchangeTestUtil.testContext.deployer});
  });

  describe("submitRings", () => {
    it("simple test", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: "WETH",
            tokenB: "LRC",
            amountS: 1e18,
            amountB: 1000e18,
            balanceS: 1e26,
            balanceFee: 1e26,
            balanceB: 1e26,
          },
          {
            tokenS: "LRC",
            tokenB: "WETH",
            amountS: 1000e18,
            amountB: 1e18,
            balanceS: 1e26,
            balanceFee: 1e26,
            balanceB: 1e26,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      await exchangeTestUtil.submitRingsAndSimulate(ringsInfo, dummyExchange);
    });

  });

});
