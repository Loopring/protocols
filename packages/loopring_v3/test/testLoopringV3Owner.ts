import { Artifacts } from "../util/Artifacts";
import BN = require("bn.js");
import { Constants } from "loopringV3.js";
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";
import { ExchangeTestUtil } from "./testExchangeUtil";
const truffleAssert = require("truffle-assertions");

const LoopringV3Owner = artifacts.require("LoopringV3Owner");
const ChainlinkTokenPriceOracle = artifacts.require(
  "ChainlinkTokenPriceOracle"
);

contract("LoopringV3Owner", (accounts: string[]) => {
  const contracts = new Artifacts(artifacts);
  const MockContract = contracts.MockContract;

  let exchangeTestUtil: ExchangeTestUtil;
  let loopring: any;
  let chainlinkTokenPriceOracle: any;

  // USD values
  let minExchangeStakeDA = new BN(10000);
  let minExchangeStakeWDA = new BN(25000);
  let revertFine = new BN(1250);

  // Constants
  let NUM_MOVING_AVERAGE_DATA_POINTS: number;
  let MOVING_AVERAGE_TIME_PERIOD: number;

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    loopring = exchangeTestUtil.loopringV3;
    // Create a dummy oracle contract that we can use to setup the mock contract
    chainlinkTokenPriceOracle = await ChainlinkTokenPriceOracle.new(
      Constants.zeroAddress,
      Constants.zeroAddress
    );
  });

  const doLrcPriceChange = async (
    loopringV3Owner: any,
    mockChainlink: any,
    priceFactor: number
  ) => {
    const startMinExchangeStakeDALrc = await loopring.minExchangeStakeWithDataAvailability();
    const startMinExchangeStakeWDALrc = await loopring.minExchangeStakeWithoutDataAvailability();
    const startRevertFineLrc = await loopring.revertFineLRC();

    const transformPrice = (value: BN) => {
      return priceFactor > 1
        ? value.mul(new BN(priceFactor))
        : value.div(new BN(1 / priceFactor));
    };
    const endMinExchangeStakeDALrc = transformPrice(startMinExchangeStakeDALrc);
    const endMinExchangeStakeWDALrc = transformPrice(
      startMinExchangeStakeWDALrc
    );
    const endRevertFineLrc = transformPrice(startRevertFineLrc);

    // Set the conversion so the expected LRC amounts are returned by the oracle
    const setConversion = async (mockContract: any, usd: BN, lrc: BN) => {
      const calldata = chainlinkTokenPriceOracle.contract.methods
        .usd2lrc("0x" + usd.toString(16))
        .encodeABI();
      await mockContract.givenCalldataReturnUint(calldata, lrc);
    };
    await setConversion(
      mockChainlink,
      minExchangeStakeDA,
      endMinExchangeStakeDALrc
    );
    await setConversion(
      mockChainlink,
      minExchangeStakeWDA,
      endMinExchangeStakeWDALrc
    );
    await setConversion(mockChainlink, revertFine, endRevertFineLrc);

    for (let i = 1; i <= NUM_MOVING_AVERAGE_DATA_POINTS; i++) {
      // Try to update the LRC values too soon
      await truffleAssert.fails(
        loopringV3Owner.updateValuesInLRC(),
        truffleAssert.ErrorType.REVERT,
        "TOO_SOON"
      );

      // Skip forward MOVING_AVERAGE_TIME_PERIOD seconds
      await advanceTimeAndBlockAsync(MOVING_AVERAGE_TIME_PERIOD);

      // Update the LRC amounts
      await loopringV3Owner.updateValuesInLRC();

      // Calculate the expected values
      const interpolate = (startValue: BN, endValue: BN) => {
        return startValue
          .mul(new BN(NUM_MOVING_AVERAGE_DATA_POINTS - i))
          .add(endValue.mul(new BN(i)))
          .div(new BN(NUM_MOVING_AVERAGE_DATA_POINTS));
      };
      const expectedMinExchangeStakeDALrc = interpolate(
        startMinExchangeStakeDALrc,
        endMinExchangeStakeDALrc
      );
      const expectedMinExchangeStakeWDALrc = interpolate(
        startMinExchangeStakeWDALrc,
        endMinExchangeStakeWDALrc
      );
      const expectedRevertFineLrc = interpolate(
        startRevertFineLrc,
        endRevertFineLrc
      );

      // Check against the contract values
      assert(
        expectedMinExchangeStakeDALrc.eq(
          await loopring.minExchangeStakeWithDataAvailability()
        ),
        "unexpected currentMinExchangeStakeDALrc"
      );
      assert(
        expectedMinExchangeStakeWDALrc.eq(
          await loopring.minExchangeStakeWithoutDataAvailability()
        ),
        "unexpected currentMinExchangeStakeWDALrc"
      );
      assert(
        expectedRevertFineLrc.eq(await loopring.revertFineLRC()),
        "unexpected currentRevertFineLrc"
      );

      // Check the LRCValuesUpdated event
      const updateEvent = await exchangeTestUtil.assertEventEmitted(
        loopringV3Owner,
        "LRCValuesUpdated"
      );
      assert(
        updateEvent.minExchangeStakeWithDataAvailabilityLRC.eq(
          expectedMinExchangeStakeDALrc
        ),
        "unexpected currentMinExchangeStakeDALrc"
      );
      assert(
        updateEvent.minExchangeStakeWithoutDataAvailabilityLRC.eq(
          expectedMinExchangeStakeWDALrc
        ),
        "unexpected currentMinExchangeStakeWDALrc"
      );
      assert(
        updateEvent.revertFineLRC.eq(expectedRevertFineLrc),
        "unexpected currentRevertFineLrc"
      );
    }

    // Call update for a random number of times (to randomize updateIndex)
    for (let i = 0; i <= exchangeTestUtil.getRandomInt(10); i++) {
      await advanceTimeAndBlockAsync(MOVING_AVERAGE_TIME_PERIOD);
      await loopringV3Owner.updateValuesInLRC();
    }
  };

  it("should work as expected as the owner", async () => {
    const mockChainlink = await MockContract.new();
    const loopringV3Owner = await LoopringV3Owner.new(
      loopring.address,
      mockChainlink.address,
      minExchangeStakeDA,
      minExchangeStakeWDA,
      revertFine
    );

    // Get the constant values from the contract
    NUM_MOVING_AVERAGE_DATA_POINTS = (
      await loopringV3Owner.NUM_MOVING_AVERAGE_DATA_POINTS()
    ).toNumber(10);
    MOVING_AVERAGE_TIME_PERIOD = (
      await loopringV3Owner.MOVING_AVERAGE_TIME_PERIOD()
    ).toNumber(10);

    // Set the owner to the newly created LoopringV3Owner
    await loopring.transferOwnership(loopringV3Owner.address);

    // Try to update the LRC values without initializing first
    await truffleAssert.fails(
      loopringV3Owner.updateValuesInLRC(),
      truffleAssert.ErrorType.REVERT,
      "NOT_INITIALIZED"
    );

    // Claim ownershipt of the protocol contract and initialize
    await loopringV3Owner.claimOwnershipAndInitialize();
    // Try to initialize again
    await truffleAssert.fails(
      loopringV3Owner.claimOwnershipAndInitialize(),
      truffleAssert.ErrorType.REVERT,
      "ALREADY_INITIALIZED"
    );

    // Change the LRC price (double the LRC needed) and go throught the MA steps
    await doLrcPriceChange(loopringV3Owner, mockChainlink, 2);
    // Change the LRC price (tripple the LRC needed) and go throught the MA steps
    await doLrcPriceChange(loopringV3Owner, mockChainlink, 3);
    // Change the LRC price (back to the original LRC needed) and go throught the MA steps
    await doLrcPriceChange(loopringV3Owner, mockChainlink, 1 / 6);

    // Create a new owner contract that we'll transfer ownership to
    const loopringV3Owner2 = await LoopringV3Owner.new(
      loopring.address,
      mockChainlink.address,
      minExchangeStakeDA,
      minExchangeStakeWDA,
      revertFine
    );

    // Now transfer the ownership to the new contract (this operation is delayed)
    const calldata = await loopringV3Owner.contract.methods
      .transferOwnership(loopringV3Owner2.address)
      .encodeABI();
    await loopringV3Owner.transact(loopring.address, calldata);
    // Check the TransactionDelayed event
    const delayedEvent = await exchangeTestUtil.assertEventEmitted(
      loopringV3Owner,
      "TransactionDelayed"
    );
    // Skip forward the enforced delay
    await advanceTimeAndBlockAsync(delayedEvent.delay.toNumber());
    // Actually transfer the ownership now
    await loopringV3Owner.executeTransaction(delayedEvent.id);

    // The new owner should be able to claim ownership now
    await loopringV3Owner2.claimOwnershipAndInitialize();
  });
});
