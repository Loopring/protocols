import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
  let loopring: any;
  let exchangeId = 0;

  const setFeesChecked = async (
    accountCreationFeeETH: BN,
    accountUpdateFeeETH: BN,
    depositFeeETH: BN,
    withdrawalFeeETH: BN
  ) => {
    // Set the fees
    await exchange.setFees(
      accountCreationFeeETH,
      accountUpdateFeeETH,
      depositFeeETH,
      withdrawalFeeETH,
      { from: exchangeTestUtil.exchangeOwner }
    );
    // Check the fees
    const fees = await exchange.getFees();
    assert(
      fees._accountCreationFeeETH.eq(accountCreationFeeETH),
      "accountCreationFeeETH does not match"
    );
    assert(
      fees._accountUpdateFeeETH.eq(accountUpdateFeeETH),
      "accountUpdateFeeETH does not match"
    );
    assert(
      fees._depositFeeETH.eq(depositFeeETH),
      "depositFeeETH does not match"
    );
    assert(
      fees._withdrawalFeeETH.eq(withdrawalFeeETH),
      "withdrawalFeeETH does not match"
    );
  };

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
      });

      it("should be able to set the fees", async () => {
        await createExchange();
        await setFeesChecked(new BN(1), new BN(2), new BN(3), new BN(4));
      });

      it("should not be able to set the withdrawal fee higher than allowed", async () => {
        await createExchange();
        const maxWithdrawalFee = await loopring.maxWithdrawalFee();
        assert(
          !maxWithdrawalFee.isZero(),
          "max withdrawal fee cannot be 0 for test"
        );
        await expectThrow(
          exchange.setFees(
            new BN(0),
            new BN(0),
            new BN(0),
            maxWithdrawalFee.add(new BN(1)),
            { from: exchangeTestUtil.exchangeOwner }
          ),
          "AMOUNT_TOO_LARGE"
        );
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

      it("should not be able to set the fees", async () => {
        await createExchange();
        await expectThrow(
          exchange.setFees(new BN(0), new BN(0), new BN(0), new BN(0), {
            from: exchangeTestUtil.testContext.orderOwners[0]
          }),
          "UNAUTHORIZED"
        );
      });
    });
  });
});
