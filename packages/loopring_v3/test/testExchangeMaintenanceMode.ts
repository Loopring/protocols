import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
  let loopring: any;
  let exchangeID = 0;

  const getDowntimeCost = async (duration: number) => {
    const downtimePriceLRCPerDay = await loopring.downtimePriceLRCPerDay();
    const dayInSeconds = 24 * 60 * 60;
    const cost = new BN(duration).mul(downtimePriceLRCPerDay).div(new BN(dayInSeconds));
    return cost;
  };

  const purchaseDowntimeChecked = async (duration: number, user: string) => {
    const LRC = await exchangeTestUtil.getTokenContract("LRC");

    // Total amount LRC needed for the requested duration
    const cost = await exchange.getDowntimeCostLRC(duration);

    const lrcBalanceBefore = await exchangeTestUtil.getOnchainBalance(user, "LRC");
    const lrcSupplyBefore = await LRC.totalSupply();
    const remainingDowntimeBefore = await exchange.getRemainingDowntime();

    await exchange.purchaseDowntime(duration, {from: user});

    const lrcBalanceAfter = await exchangeTestUtil.getOnchainBalance(user, "LRC");
    const lrcSupplyAfter = await LRC.totalSupply();
    const remainingDowntimeAfter = await exchange.getRemainingDowntime();

    assert(lrcBalanceAfter.eq(lrcBalanceBefore.sub(cost)),
           "LRC balance of exchange owner needs to be reduced by maintenance cost");
    assert(lrcSupplyAfter.eq(lrcSupplyBefore.sub(cost)),
           "LRC supply needs to be reduced by maintenance cost");
    assert(remainingDowntimeAfter.sub(remainingDowntimeBefore.add(new BN(duration))).abs().lt(new BN(2)),
           "Remaining downtime should have been increased by duration bought");
  };

  const checkRemainingDowntime = async (expectedRemainingDowntime: number) => {
    const remainingDowntime = await exchange.getRemainingDowntime();
    assert(remainingDowntime.sub(new BN(expectedRemainingDowntime)).abs().lt(new BN(5)),
           "remaining downtime not as expected");
  };

  const createExchange = async (bSetupTestState: boolean = true) => {
    exchangeID = await exchangeTestUtil.createExchange(exchangeTestUtil.testContext.stateOwners[0], bSetupTestState);
    exchange = exchangeTestUtil.exchange;
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    exchange = exchangeTestUtil.exchange;
    loopring = exchangeTestUtil.loopringV3;
    exchangeID = 1;
  });

  describe("Tokens", function() {
    this.timeout(0);

    describe("exchange owner", () => {
      it("should be able to purchase downtime", async () => {
        await createExchange(false);

        const fees = await exchange.getFees();

        const keyPair = exchangeTestUtil.getKeyPairEDDSA();
        const owner = exchangeTestUtil.testContext.orderOwners[5];
        const amount = new BN(web3.utils.toWei("4567", "ether"));
        const token = exchangeTestUtil.getTokenAddress("WETH");

        await exchangeTestUtil.deposit(exchangeID, owner,
                                       keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                       token, amount);

        const duration = 500;

        // Make sure the account owner has enough tokens for additional deposits
        await exchangeTestUtil.setBalanceAndApprove(
          owner, token, amount.mul(new BN(10)),
        );

        // Try to purchase the downtime without enough LRC
        await expectThrow(
          exchange.purchaseDowntime(duration, {from: exchangeTestUtil.exchangeOwner}),
          // "BURNFROM_INSUFFICIENT_BALANCE",
        );

        // Make sure the exchange owner has enough LRC
        const maintenanceCost = await exchange.getDowntimeCostLRC(duration);
        await exchangeTestUtil.setBalanceAndApprove(
          exchangeTestUtil.exchangeOwner, "LRC", maintenanceCost.mul(new BN(10)),
        );

        // Purchase the downtime
        await purchaseDowntimeChecked(duration, exchangeTestUtil.exchangeOwner);
        await checkRemainingDowntime(duration);

        // Try to deposit
        await expectThrow(
          exchange.deposit(token, amount, {from: owner, value: fees._depositFeeETH}),
          "USER_REQUEST_SUSPENDED",
        );
        // Try to withdraw
        await expectThrow(
          exchange.withdraw(token, amount, {from: owner, value: fees._withdrawalFeeETH}),
          "USER_REQUEST_SUSPENDED",
        );

        // Advance until a bit before the maintenance mode stops
        await exchangeTestUtil.advanceBlockTimestamp(duration - 100);
        await checkRemainingDowntime(100);

        // Try to deposit
        await expectThrow(
          exchange.deposit(token, amount, {from: owner, value: fees._depositFeeETH}),
          "USER_REQUEST_SUSPENDED",
        );

        // Purchase additional downtime
        await purchaseDowntimeChecked(duration, exchangeTestUtil.exchangeOwner);
        await checkRemainingDowntime(100 + duration);

        // Advance until a bit before the maintenance mode stops
        await exchangeTestUtil.advanceBlockTimestamp(duration);

        // Try to deposit
        await expectThrow(
          exchange.deposit(token, amount, {from: owner, value: fees._depositFeeETH}),
          "USER_REQUEST_SUSPENDED",
        );

        // Advance until a after the maintenance mode stops
        await exchangeTestUtil.advanceBlockTimestamp(200);
        await checkRemainingDowntime(0);

        // Deposit
        await exchange.deposit(token, amount, {from: owner, value: fees._depositFeeETH});
        // Withdraw
        await exchange.withdraw(token, amount, {from: owner, value: fees._withdrawalFeeETH});
      });
    });

    it("should not be able to commit settlement blocks while in maintenance mode", async () => {
      await createExchange();

      // Setup a ring
      const ring: RingInfo = {
        orderA:
          {
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
          },
        orderB:
          {
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("5", "ether")),
            amountB: new BN(web3.utils.toWei("45", "ether")),
          },
        expected: {
          orderA: { filledFraction: 0.5, spread: new BN(web3.utils.toWei("5", "ether")) },
          orderB: { filledFraction: 1.0 },
        },
      };
      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.commitDeposits(exchangeID);

      const fees = await exchange.getFees();

      const duration = 1000;

      // Make sure the exchange owner has enough LRC
      const maintenanceCost = await exchange.getDowntimeCostLRC(duration);
      await exchangeTestUtil.setBalanceAndApprove(
        exchangeTestUtil.exchangeOwner, "LRC", maintenanceCost.mul(new BN(10)),
      );

      // Purchase the downtime
      await purchaseDowntimeChecked(duration, exchangeTestUtil.exchangeOwner);
      await checkRemainingDowntime(duration);

      // The operator shouldn't be able to commit any ring settlement blocks
      // while in maitenance mode
      await exchangeTestUtil.sendRing(exchangeID, ring);
      await expectThrow(
        exchangeTestUtil.commitRings(exchangeID),
        "SETTLEMENT_SUSPENDED",
      );
    });

    describe("anyone", () => {
      it("should not be able to purchase downtime a token", async () => {
        await createExchange(false);
        // Try to purchase the downtime
        await expectThrow(
          exchange.purchaseDowntime(123),
          "UNAUTHORIZED",
        );
      });
    });

    it("Downtime cost should be as expected", async () => {
      await createExchange(false);

      let duration = 123;
      let expectedCost = await getDowntimeCost(duration);
      let cost = await exchange.getDowntimeCostLRC(duration);
      assert(cost.eq(expectedCost), "Downtime cost not as expected");

      duration = 456;
      expectedCost = await getDowntimeCost(duration);
      cost = await exchange.getDowntimeCostLRC(duration);
      assert(cost.eq(expectedCost), "Downtime cost not as expected");
    });
  });
});
