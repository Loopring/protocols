import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";

contract("Loopring", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let loopring: any;

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    loopring = exchangeTestUtil.loopringV3;

    await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      { setupTestState: false, useOwnerContract: false }
    );
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  const checkProtocolFees = async (
    takerFeeBips: number,
    makerFeeBips: number
  ) => {
    const protocolTakerFeeBips = await loopring.protocolTakerFeeBips();
    const protocolMakerFeeBips = await loopring.protocolMakerFeeBips();

    assert.equal(
      protocolTakerFeeBips,
      takerFeeBips,
      "unexpected taker fee bips"
    );
    assert.equal(
      protocolMakerFeeBips,
      makerFeeBips,
      "unexpected maker fee bips"
    );

    const protocolFees = await loopring.getProtocolFeeValues();
    assert(
      protocolFees.takerFeeBips.eq(protocolTakerFeeBips),
      "Wrong protocol taker fees"
    );
    assert(
      protocolFees.makerFeeBips.eq(protocolMakerFeeBips),
      "Wrong protocol maker fees"
    );
  };

  describe("Owner", () => {
    it("should be able to update settings", async () => {
      const protocolFeeVaultBefore = await loopring.protocolFeeVault();
      const newProtocolFeeVault = exchangeTestUtil.testContext.orderOwners[2];
      assert(newProtocolFeeVault !== protocolFeeVaultBefore);

      await loopring.updateSettings(
        newProtocolFeeVault,
        exchangeTestUtil.testContext.orderOwners[2],
        new BN(web3.utils.toWei("0.01", "ether")),
        { from: exchangeTestUtil.testContext.deployer }
      );

      const protocolFeeVaultAfter = await loopring.protocolFeeVault();
      assert(
        newProtocolFeeVault === protocolFeeVaultAfter,
        "new protocolFeeVault should be set"
      );
    });

    it("should be able to update protocol fee settings", async () => {
      const takerFeeBips = 12;
      const makerFeeBips = 34;
      await loopring.updateProtocolFeeSettings(takerFeeBips, makerFeeBips, {
        from: exchangeTestUtil.testContext.deployer
      });
      await checkProtocolFees(takerFeeBips, makerFeeBips);
    });
  });

  describe("anyone", () => {
    it("should not be able to set the update the settings", async () => {
      await expectThrow(
        loopring.updateSettings(
          exchangeTestUtil.testContext.orderOwners[1], // fee vault
          exchangeTestUtil.testContext.orderOwners[2], // block verifier
          new BN(web3.utils.toWei("0.01", "ether")),
          { from: exchangeTestUtil.testContext.orderOwners[0] }
        ),
        "UNAUTHORIZED"
      );
    });

    it("should not be able to set the update the protocol fee settings", async () => {
      await expectThrow(
        loopring.updateProtocolFeeSettings(25, 50, {
          from: exchangeTestUtil.testContext.orderOwners[0]
        }),
        "UNAUTHORIZED"
      );
    });
  });
});
