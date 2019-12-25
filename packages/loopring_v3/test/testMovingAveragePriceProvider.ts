import { Artifacts } from "../util/Artifacts";
import BN = require("bn.js");
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";
import { ExchangeTestUtil } from "./testExchangeUtil";
const truffleAssert = require("truffle-assertions");

const MovingAveragePriceProvider = artifacts.require(
  "MovingAveragePriceProvider"
);

contract("MovingAveragePriceProvider", (accounts: string[]) => {
  const contracts = new Artifacts(artifacts);
  const MockContract = contracts.MockContract;

  let exchangeTestUtil: ExchangeTestUtil;

  // Constants
  const movingAverageTimePeriod = 60 * 60 * 24;
  const numMovingAverageDataPoints = 7;
  const defaultValue = new BN(web3.utils.toWei("1", "ether"));

  const setConversion = async (mock: any, lrc: BN) => {
    await mock.givenAnyReturnUint(lrc);
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  const doLrcPriceChange = async (
    movingAverageProvider: any,
    mockProvider: any,
    oldLrcAmount: BN,
    newLrcAmount: BN
  ) => {
    // Set the conversion so the expected LRC amounts are returned by the oracle
    await setConversion(mockProvider, newLrcAmount);

    for (let i = 1; i <= numMovingAverageDataPoints; i++) {
      // Try to update the LRC values too soon
      await truffleAssert.fails(
        movingAverageProvider.updateMovingAverage(),
        truffleAssert.ErrorType.REVERT,
        "TOO_SOON"
      );

      // Skip forward movingAverageTimePeriod seconds
      await advanceTimeAndBlockAsync(movingAverageTimePeriod);

      // Update the LRC amounts
      await movingAverageProvider.updateMovingAverage();

      // Calculate the expected values
      const interpolate = (startValue: BN, endValue: BN) => {
        return startValue
          .mul(new BN(numMovingAverageDataPoints - i))
          .add(endValue.mul(new BN(i)))
          .div(new BN(numMovingAverageDataPoints));
      };
      const expectedMovingAverage = interpolate(oldLrcAmount, newLrcAmount);

      // Check against the contract value
      assert(
        expectedMovingAverage.eq(
          await movingAverageProvider.usd2lrc(defaultValue)
        ),
        "unexpected movingAverage"
      );

      // Check against another USD value
      const factor = new BN(exchangeTestUtil.getRandomInt(10), 10);
      assert(
        expectedMovingAverage
          .mul(factor)
          .eq(await movingAverageProvider.usd2lrc(defaultValue.mul(factor))),
        "unexpected conversion"
      );

      // Check the LRCValuesUpdated event
      const updateEvent = await exchangeTestUtil.assertEventEmitted(
        movingAverageProvider,
        "MovingAverageUpdated"
      );
      assert(
        updateEvent.movingAverageLRC.eq(expectedMovingAverage),
        "unexpected movingAverage"
      );
    }

    // Call update for a random number of times (to randomize updateIndex)
    for (let i = 0; i <= exchangeTestUtil.getRandomInt(10); i++) {
      await advanceTimeAndBlockAsync(movingAverageTimePeriod);
      await movingAverageProvider.updateMovingAverage();
    }
  };

  it("moving average should work as expected", async () => {
    const mockProvider = await MockContract.new();
    await setConversion(mockProvider, defaultValue.mul(new BN(100)));

    const movingAverageProvider = await MovingAveragePriceProvider.new(
      mockProvider.address,
      new BN(movingAverageTimePeriod, 10),
      new BN(numMovingAverageDataPoints, 10),
      defaultValue
    );

    // Change the LRC price (double the LRC needed) and go throught the MA steps
    await doLrcPriceChange(
      movingAverageProvider,
      mockProvider,
      defaultValue.mul(new BN(100)),
      defaultValue.mul(new BN(200))
    );
    // Change the LRC price (tripple the LRC needed) and go throught the MA steps
    await doLrcPriceChange(
      movingAverageProvider,
      mockProvider,
      defaultValue.mul(new BN(200)),
      defaultValue.mul(new BN(600))
    );
    // Change the LRC price (back to the original LRC needed) and go throught the MA steps
    await doLrcPriceChange(
      movingAverageProvider,
      mockProvider,
      defaultValue.mul(new BN(600)),
      defaultValue.mul(new BN(100))
    );
  });
});
