import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";

contract("Exchange", (accounts: string[]) => {
  let ctx: ExchangeTestUtil;
  let exchange: any;
  let loopringV3: any;

  const createExchange = async () => {
    await ctx.createExchange(
      ctx.testContext.stateOwners[0],
      {useOwnerContract: false}
    );
    exchange = ctx.exchange;
  };

  before(async () => {
    ctx = new ExchangeTestUtil();
    await ctx.initialize(accounts);
    loopringV3 = ctx.loopringV3;
  });

  after(async () => {
    await ctx.stop();
  });

  describe("Shutdown", function() {
    this.timeout(0);

    it("Withdraw exchange stake", async () => {
      await createExchange();

      const currentStakeAmount = await exchange.getExchangeStake();

      // Deposit some LRC to stake for the exchange
      const depositer = ctx.testContext.operators[2];
      const stakeAmount = new BN(web3.utils.toWei("1234567", "ether"));
      await ctx.setBalanceAndApprove(
        depositer,
        "LRC",
        stakeAmount,
        loopringV3.address
      );

      // Stake it
      await ctx.depositExchangeStakeChecked(
        stakeAmount,
        depositer
      );

      // Try to withdraw before the exchange is shutdown
      await expectThrow(
        exchange.withdrawExchangeStake(ctx.exchangeOwner, {
          from: ctx.exchangeOwner
        }),
        "EXCHANGE_NOT_SHUTDOWN"
      );

      // Shut down the exchange
      await exchange.shutdown({ from: ctx.exchangeOwner });

      // Try to withdraw before the minimum time in shutdown mode has passed
      await expectThrow(
        exchange.withdrawExchangeStake(ctx.exchangeOwner, {
          from: ctx.exchangeOwner
        }),
        "TOO_EARLY"
      );

      // Wait
      await ctx.advanceBlockTimestamp(ctx.MIN_TIME_IN_SHUTDOWN - 100);

      // Try to withdraw before the minimum time in shutdown mode has passed
      await expectThrow(
        exchange.withdrawExchangeStake(ctx.exchangeOwner, {
          from: ctx.exchangeOwner
        }),
        "TOO_EARLY"
      );

      // Wait
      await ctx.advanceBlockTimestamp(200);

      // Withdraw the exchange stake
      await ctx.withdrawExchangeStakeChecked(
        ctx.exchangeOwner,
        currentStakeAmount.add(stakeAmount)
      );
    });

    it("Should not be able to shutdown when already shutdown", async () => {
      await createExchange();

      // Shut down the exchange
      await exchange.shutdown({ from: ctx.exchangeOwner });

      // Try to shut down again
      await expectThrow(
        exchange.shutdown({ from: ctx.exchangeOwner }),
        "ALREADY_SHUTDOWN"
      );
    });
  });
});
