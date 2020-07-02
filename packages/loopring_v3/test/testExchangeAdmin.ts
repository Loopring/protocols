import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
  let loopring: any;
  let exchangeId = 0;

  const createExchange = async (bSetupTestState: boolean = true) => {
    exchangeId = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      bSetupTestState
    );
    exchange = exchangeTestUtil.exchange;
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    loopring = exchangeTestUtil.loopringV3;
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  describe("Admin", function() {
    this.timeout(0);

    describe("Exchange owner", () => {
      it("should be able to set the operator", async () => {
        await createExchange();
        const newOperator = exchangeTestUtil.testContext.orderOwners[5];
        await exchange.setOperator(newOperator, {
          from: exchangeTestUtil.exchangeOwner
        });

        const operator = await exchange.getOperator();
        assert.equal(operator, newOperator, "operator unexpected");
      });
    });

    describe("anyone", () => {
      it("should not be able to set the operator", async () => {
        await createExchange();
        const newOperator = exchangeTestUtil.testContext.orderOwners[5];
        await expectThrow(
          exchange.setOperator(newOperator, {
            from: exchangeTestUtil.testContext.orderOwners[0]
          }),
          "UNAUTHORIZED"
        );
      });
    });
  });
});
