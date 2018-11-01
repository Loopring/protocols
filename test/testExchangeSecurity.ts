import * as psc from "protocol2-js";
import tokenInfos = require("../migrations/config/tokens.js");
import { Artifacts } from "../util/Artifacts";
import { ExchangeTestUtil } from "./testExchangeUtil";

const {
  TESTToken,
} = new Artifacts(artifacts);

contract("Exchange_Security", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  const allTokenSymbols = tokenInfos.development.map((t) => t.symbol);

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  describe("Security", () => {

    beforeEach(async () => {
      await exchangeTestUtil.cleanTradeHistory();
    });

    it("Reentrancy attack", async () => {
      const ringsInfo: psc.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: "WETH",
            tokenB: "TEST",
            amountS: 35e17,
            amountB: 22e17,
          },
          {
            tokenS: "TEST",
            tokenB: "WETH",
            amountS: 23e17,
            amountB: 31e17,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);

      // A ring without callbacks so submitRings doesn't get into an infinite loop
      // in a reentrancy scenario
      const ringsInfoAttack: psc.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: "WETH",
            tokenB: "LRC",
            amountS: 35e17,
            amountB: 25e17,
            dualAuthSignAlgorithm: psc.SignAlgorithm.None,
          },
          {
            tokenS: "LRC",
            tokenB: "WETH",
            amountS: 23e17,
            amountB: 32e17,
            dualAuthSignAlgorithm: psc.SignAlgorithm.None,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfoAttack);

      const TestToken = TESTToken.at(exchangeTestUtil.testContext.tokenSymbolAddrMap.get("TEST"));

      // Enable the Reentrancy attack
      // Create a valid ring that can be submitted by the token
      {
        const ringsGeneratorAttack = new psc.RingsGenerator(exchangeTestUtil.context);
        await ringsGeneratorAttack.setupRingsAsync(ringsInfoAttack);
        const bsAttack = ringsGeneratorAttack.toSubmitableParam(ringsInfoAttack);
        // Enable the reentrancy attack on the token
        await TestToken.setTestCase(await TestToken.TEST_REENTRANCY());
        await TestToken.setReentrancyAttackData(exchangeTestUtil.ringSubmitter.address, bsAttack);
      }

      // Setup the ring
      const ringsGenerator = new psc.RingsGenerator(exchangeTestUtil.context);
      await ringsGenerator.setupRingsAsync(ringsInfo);
      const bs = ringsGenerator.toSubmitableParam(ringsInfo);

      // submitRings should throw. TESTToken will check if the revert message is REENTRY.
      await psc.expectThrow(
        exchangeTestUtil.ringSubmitter.submitRings(bs, {from: exchangeTestUtil.testContext.transactionOrigin}),
        "TRANSFER_FAILURE",
      );
    });

  });

});
