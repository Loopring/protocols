import * as psc from "protocol2-js";
import { ExchangeTestUtil } from "./testExchangeUtil";

const ExchangeWrapper = artifacts.require("ExchangeWrapper");

contract("ExchangeWrapper", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  let exchangeWrapper: any;

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  describe("ExchangeWrapper", () => {

    beforeEach(async () => {
      await exchangeTestUtil.cleanTradeHistory();
      exchangeWrapper = await ExchangeWrapper.new(exchangeTestUtil.ringSubmitter.address);
    });

    it("should be able to submit rings through a wrapper contract", async () => {
      const ringsInfo: psc.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: "WETH",
            tokenB: "LRC",
            amountS: 10e18,
            amountB: 10e18,
          },
          {
            tokenS: "LRC",
            tokenB: "WETH",
            amountS: 10e18,
            amountB: 10e18,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);

      // Get the submitRings data
      const ringsGenerator = new psc.RingsGenerator(exchangeTestUtil.context);
      await ringsGenerator.setupRingsAsync(ringsInfo);
      const bs = ringsGenerator.toSubmitableParam(ringsInfo);

      // No owner whitelisted so submitRings should throw
      await psc.expectThrow(
        exchangeWrapper.submitRings(bs, {from: exchangeTestUtil.testContext.transactionOrigin}),
        "OWNER_NOT_WHITELISTED",
      );

      // Whitelist owners
      await exchangeWrapper.setWhitelisted(ringsInfo.orders[0].owner, true);
      await exchangeWrapper.setWhitelisted(ringsInfo.orders[1].owner, true);

      // Submit the rings again, this time successfully
      await exchangeTestUtil.submitRingsAndSimulate(ringsInfo, undefined, exchangeWrapper);
    });

  });

});
