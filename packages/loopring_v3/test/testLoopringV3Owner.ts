import { Artifacts } from "../util/Artifacts";
import BN = require("bn.js");
import { Constants } from "loopringV3.js";
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";
import { ExchangeTestUtil } from "./testExchangeUtil";

const LoopringV3Owner = artifacts.require("LoopringV3Owner");
const ChainlinkTokenPriceOracle = artifacts.require(
  "ChainlinkTokenPriceProvider"
);

contract("LoopringV3Owner", (accounts: string[]) => {
  let contracts: Artifacts;
  let MockContract: any;

  let exchangeTestUtil: ExchangeTestUtil;
  let loopring: any;
  let chainlinkTokenPriceOracle: any;

  // USD values
  let minExchangeStakeDA = new BN(web3.utils.toWei("10000", "ether"));
  let minExchangeStakeWDA = new BN(web3.utils.toWei("25000", "ether"));
  let revertFine = new BN(web3.utils.toWei("1250", "ether"));

  before(async () => {
    contracts = new Artifacts(artifacts);
    MockContract = contracts.MockContract;
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    loopring = exchangeTestUtil.loopringV3;
    // Create a dummy oracle contract that we can use to setup the mock contract
    chainlinkTokenPriceOracle = await ChainlinkTokenPriceOracle.new(
      Constants.zeroAddress,
      Constants.zeroAddress
    );
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  const doLrcPriceChange = async (
    loopringV3Owner: any,
    mockChainlink: any,
    priceFactor: number
  ) => {
    const startMinExchangeStakeDALrc = await loopring.minExchangeStakeRollup();
    const startMinExchangeStakeWDALrc = await loopring.minExchangeStakeValidium();

    const transformPrice = (value: BN) => {
      return priceFactor > 1
        ? value.mul(new BN(priceFactor))
        : value.div(new BN(1 / priceFactor));
    };
    const expectedMinExchangeStakeDALrc = transformPrice(
      startMinExchangeStakeDALrc
    );
    const expectedMinExchangeStakeWDALrc = transformPrice(
      startMinExchangeStakeWDALrc
    );

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
      expectedMinExchangeStakeDALrc
    );
    await setConversion(
      mockChainlink,
      minExchangeStakeWDA,
      expectedMinExchangeStakeWDALrc
    );

    // Update the LRC amounts
    await loopringV3Owner.updateValuesInLRC();

    // Check against the contract values
    assert(
      expectedMinExchangeStakeDALrc.eq(await loopring.minExchangeStakeRollup()),
      "unexpected currentMinExchangeStakeDALrc"
    );
    assert(
      expectedMinExchangeStakeWDALrc.eq(
        await loopring.minExchangeStakeValidium()
      ),
      "unexpected currentMinExchangeStakeWDALrc"
    );

    // Check the LRCValuesUpdated event
    const updateEvent = await exchangeTestUtil.assertEventEmitted(
      loopringV3Owner,
      "LRCValuesUpdated"
    );
    assert(
      updateEvent.minExchangeStakeRollupLRC.eq(expectedMinExchangeStakeDALrc),
      "unexpected currentMinExchangeStakeDALrc"
    );
    assert(
      updateEvent.minExchangeStakeValidiumLRC.eq(
        expectedMinExchangeStakeWDALrc
      ),
      "unexpected currentMinExchangeStakeWDALrc"
    );
  };

  it("should work as expected as the owner", async () => {
    const mockProvider = await MockContract.new();
    const loopringV3Owner = await LoopringV3Owner.new(
      loopring.address,
      mockProvider.address,
      minExchangeStakeDA,
      minExchangeStakeWDA
    );

    // Set the owner to the newly created LoopringV3Owner
    await loopring.transferOwnership(loopringV3Owner.address);

    // Claim ownership of the protocol contract
    {
      const calldata = await loopringV3Owner.contract.methods
        .claimOwnership()
        .encodeABI();
      await loopringV3Owner.transact(loopring.address, calldata);
    }

    // Change the LRC price (double the LRC needed) and go throught the MA steps
    await doLrcPriceChange(loopringV3Owner, mockProvider, 2);
    // Change the LRC price (tripple the LRC needed) and go throught the MA steps
    await doLrcPriceChange(loopringV3Owner, mockProvider, 3);
    // Change the LRC price (back to the original LRC needed) and go throught the MA steps
    await doLrcPriceChange(loopringV3Owner, mockProvider, 1 / 6);

    // Create a new owner contract that we'll transfer ownership to
    const loopringV3Owner2 = await LoopringV3Owner.new(
      loopring.address,
      mockProvider.address,
      minExchangeStakeDA,
      minExchangeStakeWDA
    );

    // Now transfer the ownership to the new contract (this operation is delayed)
    {
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
    }

    // The new owner should be able to claim ownership now
    {
      const calldata = await loopringV3Owner2.contract.methods
        .claimOwnership()
        .encodeABI();
      await loopringV3Owner2.transact(loopring.address, calldata);
    }
  });
});
