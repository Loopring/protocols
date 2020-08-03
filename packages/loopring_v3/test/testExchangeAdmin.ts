import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
  let maxAge = 123;

  const createExchange = async (bSetupTestState: boolean = true) => {
    await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      bSetupTestState
    );
    exchange = exchangeTestUtil.exchange;
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  describe("Admin", function() {
    this.timeout(0);

    describe("Exchange owner", () => {
      it("should be able to set the max age of a deposit", async () => {
        await createExchange();
        const newOperator = exchangeTestUtil.testContext.orderOwners[5];
        await exchange.setMaxAgeDepositUntilWithdrawable(maxAge, {
          from: exchangeTestUtil.exchangeOwner
        });

        const maxAgeOnchain = await exchange.getMaxAgeDepositUntilWithdrawable();
        assert.equal(maxAgeOnchain, maxAge, "max age unexpected");
      });
    });

    describe("anyone", () => {
      it("should not be able to  set the max age of a deposit", async () => {
        await createExchange();
        const newOperator = exchangeTestUtil.testContext.orderOwners[5];
        await expectThrow(
          exchange.setMaxAgeDepositUntilWithdrawable(maxAge, {
            from: exchangeTestUtil.testContext.orderOwners[0]
          }),
          "UNAUTHORIZED"
        );
      });
    });
  });
});
