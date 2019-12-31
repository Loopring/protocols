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
    return new BN(await exchange.getDowntimeCostLRC(duration));
  };

  const startOrContinueMaintenanceModeChecked = async (
    duration: number,
    user: string
  ) => {
    const LRC = await exchangeTestUtil.getTokenContract("LRC");

    // Total amount LRC needed for the requested duration
    const numMinutesLeft = (await exchange.getRemainingDowntime()).toNumber();
    const numMinutesToBuy =
      duration >= numMinutesLeft ? duration - numMinutesLeft : 0;
    const cost = await getDowntimeCost(numMinutesToBuy);

    const lrcBalanceBefore = await exchangeTestUtil.getOnchainBalance(
      user,
      "LRC"
    );
    const lrcSupplyBefore = await LRC.totalSupply();
    const remainingDowntimeBefore = await exchange.getRemainingDowntime();

    await exchange.startOrContinueMaintenanceMode(duration, { from: user });

    const lrcBalanceAfter = await exchangeTestUtil.getOnchainBalance(
      user,
      "LRC"
    );
    const lrcSupplyAfter = await LRC.totalSupply();
    const remainingDowntimeAfter = await exchange.getRemainingDowntime();
    await checkMaintenanceMode(true);

    assert(
      lrcBalanceAfter.eq(lrcBalanceBefore.sub(cost)),
      "LRC balance of exchange owner needs to be reduced by maintenance cost"
    );
    // assert(
    //   lrcSupplyAfter.eq(lrcSupplyBefore.sub(cost)),
    //   "LRC supply needs to be reduced by maintenance cost"
    // );
    assert(
      remainingDowntimeAfter
        .sub(remainingDowntimeBefore.add(new BN(numMinutesToBuy)))
        .abs()
        .lt(new BN(2)),
      "Remaining downtime should have been increased by duration bought"
    );
  };

  const stopMaintenanceModeChecked = async (user: string) => {
    await checkMaintenanceMode(true);
    const remainingDowntimeBefore = await exchange.getRemainingDowntime();

    await exchange.stopMaintenanceMode({ from: user });

    await checkMaintenanceMode(false);
    const remainingDowntimeAfter = await exchange.getRemainingDowntime();

    assert(
      remainingDowntimeAfter.eq(remainingDowntimeBefore.sub(new BN(1))),
      "Remaining downtime should remain the same"
    );
  };

  const checkRemainingDowntime = async (expectedRemainingDowntime: number) => {
    const remainingDowntime = await exchange.getRemainingDowntime();
    assert(
      remainingDowntime
        .sub(new BN(expectedRemainingDowntime))
        .abs()
        .lt(new BN(2)),
      "remaining downtime not as expected"
    );
  };

  const checkTotalTimeInMaintenanceSeconds = async (
    expectedTotalTime: number
  ) => {
    const totalTime = await exchange.getTotalTimeInMaintenanceSeconds();
    assert(
      totalTime
        .sub(new BN(expectedTotalTime))
        .abs()
        .lt(new BN(60)),
      "total time in maintenance not as expected"
    );
  };

  const checkMaintenanceMode = async (expected: boolean) => {
    const isInMaintenance = await exchange.isInMaintenance();
    assert.equal(isInMaintenance, expected, "maintenance mode not as expected");
  };

  const createExchange = async (bSetupTestState: boolean = true) => {
    exchangeID = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      bSetupTestState
    );
    exchange = exchangeTestUtil.exchange;
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    exchange = exchangeTestUtil.exchange;
    loopring = exchangeTestUtil.loopringV3;
    exchangeID = 1;
  });

  describe("Maintenance mode", function() {
    this.timeout(0);

    describe("exchange owner", () => {
      it("should be able to start and continue maintenance mode", async () => {
        await createExchange(false);

        const fees = await exchange.getFees();

        const keyPair = exchangeTestUtil.getKeyPairEDDSA();
        const owner = exchangeTestUtil.testContext.orderOwners[5];
        const amount = new BN(web3.utils.toWei("4567", "ether"));
        const token = exchangeTestUtil.getTokenAddress("WETH");

        await exchangeTestUtil.deposit(
          exchangeID,
          owner,
          keyPair.secretKey,
          keyPair.publicKeyX,
          keyPair.publicKeyY,
          token,
          amount
        );

        const durationMinutes = 60;

        // Make sure the account owner has enough tokens for additional deposits
        await exchangeTestUtil.setBalanceAndApprove(
          owner,
          token,
          amount.mul(new BN(10))
        );

        // Try to purchase the downtime without enough LRC
        await expectThrow(
          exchange.startOrContinueMaintenanceMode(durationMinutes, {
            from: exchangeTestUtil.exchangeOwner
          })
          // "BURNFROM_INSUFFICIENT_BALANCE",
        );

        // Make sure the exchange owner has enough LRC
        const maintenanceCost = await getDowntimeCost(durationMinutes);
        await exchangeTestUtil.setBalanceAndApprove(
          exchangeTestUtil.exchangeOwner,
          "LRC",
          maintenanceCost.mul(new BN(10))
        );

        // Start maintenance
        await checkMaintenanceMode(false);
        await startOrContinueMaintenanceModeChecked(
          durationMinutes,
          exchangeTestUtil.exchangeOwner
        );
        await checkRemainingDowntime(durationMinutes);
        await checkTotalTimeInMaintenanceSeconds(0);

        // Try to deposit
        await expectThrow(
          exchange.deposit(token, amount, {
            from: owner,
            value: fees._depositFeeETH
          }),
          "USER_REQUEST_SUSPENDED"
        );
        // Try to withdraw
        await expectThrow(
          exchange.withdraw(token, amount, {
            from: owner,
            value: fees._withdrawalFeeETH
          }),
          "USER_REQUEST_SUSPENDED"
        );

        // Advance until a bit before the maintenance mode stops
        await exchangeTestUtil.advanceBlockTimestamp(
          (durationMinutes - 5) * 60
        );
        await checkRemainingDowntime(5);
        await checkTotalTimeInMaintenanceSeconds((durationMinutes - 5) * 60);

        // Try to deposit
        await expectThrow(
          exchange.deposit(token, amount, {
            from: owner,
            value: fees._depositFeeETH
          }),
          "USER_REQUEST_SUSPENDED"
        );

        // Add additional downtime
        await startOrContinueMaintenanceModeChecked(
          durationMinutes,
          exchangeTestUtil.exchangeOwner
        );
        await checkRemainingDowntime(durationMinutes);
        await checkTotalTimeInMaintenanceSeconds((durationMinutes - 5) * 60);

        // Advance until a bit before the maintenance mode stops
        await exchangeTestUtil.advanceBlockTimestamp(
          (durationMinutes - 2) * 60
        );
        await checkMaintenanceMode(true);

        // Try to deposit
        await expectThrow(
          exchange.deposit(token, amount, {
            from: owner,
            value: fees._depositFeeETH
          }),
          "USER_REQUEST_SUSPENDED"
        );

        // Advance until after the maintenance mode stops
        await exchangeTestUtil.advanceBlockTimestamp(5 * 60);
        await checkRemainingDowntime(0);
        await checkTotalTimeInMaintenanceSeconds(
          (durationMinutes - 5 + durationMinutes) * 60
        );
        await checkMaintenanceMode(false);

        // Deposit
        await exchange.deposit(token, amount, {
          from: owner,
          value: fees._depositFeeETH
        });
        // Withdraw
        await exchange.withdraw(token, amount, {
          from: owner,
          value: fees._withdrawalFeeETH
        });

        // Advance time
        await exchangeTestUtil.advanceBlockTimestamp(60 * 60);

        // Enter maintenance mode again after automatic exit
        await startOrContinueMaintenanceModeChecked(
          durationMinutes,
          exchangeTestUtil.exchangeOwner
        );
        await checkRemainingDowntime(durationMinutes);
        await checkTotalTimeInMaintenanceSeconds(
          (durationMinutes - 5 + durationMinutes) * 60
        );
      });

      it("should be able to exit maintenance mode", async () => {
        await createExchange(false);

        const fees = await exchange.getFees();

        const keyPair = exchangeTestUtil.getKeyPairEDDSA();
        const owner = exchangeTestUtil.testContext.orderOwners[5];
        const amount = new BN(web3.utils.toWei("4567", "ether"));
        const token = exchangeTestUtil.getTokenAddress("WETH");

        await exchangeTestUtil.deposit(
          exchangeID,
          owner,
          keyPair.secretKey,
          keyPair.publicKeyX,
          keyPair.publicKeyY,
          token,
          amount
        );

        const durationMinutes = 60;

        // Make sure the account owner has enough tokens for additional deposits
        await exchangeTestUtil.setBalanceAndApprove(
          owner,
          token,
          amount.mul(new BN(10))
        );

        // Try to purchase the downtime without enough LRC
        await expectThrow(
          exchange.startOrContinueMaintenanceMode(durationMinutes, {
            from: exchangeTestUtil.exchangeOwner
          })
          // "BURNFROM_INSUFFICIENT_BALANCE",
        );

        // Make sure the exchange owner has enough LRC
        const maintenanceCost = await getDowntimeCost(durationMinutes);
        await exchangeTestUtil.setBalanceAndApprove(
          exchangeTestUtil.exchangeOwner,
          "LRC",
          maintenanceCost.mul(new BN(10))
        );

        // Purchase the downtime
        await checkMaintenanceMode(false);
        await startOrContinueMaintenanceModeChecked(
          durationMinutes,
          exchangeTestUtil.exchangeOwner
        );
        await checkRemainingDowntime(durationMinutes);

        // Advance to before the maintenance mode stops
        await exchangeTestUtil.advanceBlockTimestamp(
          (durationMinutes / 2) * 60
        );
        await checkRemainingDowntime(30);
        await checkTotalTimeInMaintenanceSeconds((durationMinutes / 2) * 60);
        await checkMaintenanceMode(true);

        // Try to exit maintenance mode not by the exchange owner
        await expectThrow(
          exchange.stopMaintenanceMode({
            from: exchangeTestUtil.testContext.orderOwners[0]
          }),
          "UNAUTHORIZED"
        );

        // Exit maintenance
        await stopMaintenanceModeChecked(exchangeTestUtil.exchangeOwner);

        // Deposit
        await exchange.deposit(token, amount, {
          from: owner,
          value: fees._depositFeeETH
        });
        // Withdraw
        await exchange.withdraw(token, amount, {
          from: owner,
          value: fees._withdrawalFeeETH
        });

        // Advance time
        await exchangeTestUtil.advanceBlockTimestamp(60 * 60);

        // Enter maintenance mode again after manual exit
        await checkRemainingDowntime(durationMinutes / 2);
        await startOrContinueMaintenanceModeChecked(
          durationMinutes,
          exchangeTestUtil.exchangeOwner
        );
        await checkRemainingDowntime(durationMinutes);
        await checkTotalTimeInMaintenanceSeconds((durationMinutes / 2) * 60);
      });
    });

    it("should not be able to commit settlement blocks while in maintenance mode", async () => {
      await createExchange();

      // Setup a ring
      const ring: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("10", "ether"))
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("5", "ether")),
          amountB: new BN(web3.utils.toWei("45", "ether"))
        },
        expected: {
          orderA: {
            filledFraction: 0.5,
            spread: new BN(web3.utils.toWei("5", "ether"))
          },
          orderB: { filledFraction: 1.0 }
        }
      };
      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.commitDeposits(exchangeID);

      const duration = 1000;

      // Make sure the exchange owner has enough LRC
      const maintenanceCost = await getDowntimeCost(duration);
      await exchangeTestUtil.setBalanceAndApprove(
        exchangeTestUtil.exchangeOwner,
        "LRC",
        maintenanceCost.mul(new BN(10))
      );

      // Purchase the downtime
      await startOrContinueMaintenanceModeChecked(
        duration,
        exchangeTestUtil.exchangeOwner
      );
      await checkRemainingDowntime(duration);

      // The operator shouldn't be able to commit any ring settlement blocks
      // while in maitenance mode
      await exchangeTestUtil.sendRing(exchangeID, ring);
      await expectThrow(
        exchangeTestUtil.commitRings(exchangeID),
        "SETTLEMENT_SUSPENDED"
      );
    });

    describe("anyone", () => {
      it("should not be able to purchase downtime a token", async () => {
        await createExchange(false);
        // Try to purchase the downtime
        await expectThrow(
          exchange.startOrContinueMaintenanceMode(123),
          "UNAUTHORIZED"
        );
      });
    });
  });
});
