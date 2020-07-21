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
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  const calculateProtocolFee = (
    minFee: BN,
    maxFee: BN,
    stake: BN,
    targetStake: BN
  ) => {
    const maxReduction = maxFee.sub(minFee);
    let reduction = maxReduction.mul(stake).div(targetStake);
    if (reduction.gt(maxReduction)) {
      reduction = maxReduction;
    }
    return maxFee.sub(reduction);
  };

  const checkProtocolFees = async () => {
    const minProtocolTakerFeeBips = await loopring.minProtocolTakerFeeBips();
    const maxProtocolTakerFeeBips = await loopring.maxProtocolTakerFeeBips();
    const minProtocolMakerFeeBips = await loopring.minProtocolMakerFeeBips();
    const maxProtocolMakerFeeBips = await loopring.maxProtocolMakerFeeBips();
    const targetProtocolTakerFeeStake = await loopring.targetProtocolTakerFeeStake();
    const targetProtocolMakerFeeStake = await loopring.targetProtocolMakerFeeStake();

    const stake = (await loopring.getProtocolFeeStake(
      exchangeTestUtil.exchangeId
    )).div(new BN(2));

    const expectedTakerFee = calculateProtocolFee(
      minProtocolTakerFeeBips,
      maxProtocolTakerFeeBips,
      stake,
      targetProtocolTakerFeeStake
    );
    const expectedMakerFee = calculateProtocolFee(
      minProtocolMakerFeeBips,
      maxProtocolMakerFeeBips,
      stake,
      targetProtocolMakerFeeStake
    );

    const protocolFees = await loopring.getProtocolFeeValues(
      exchangeTestUtil.exchangeId,
      exchangeTestUtil.rollupMode
    );
    assert(
      protocolFees.takerFeeBips.eq(expectedTakerFee),
      "Wrong protocol taker fees"
    );
    assert(
      protocolFees.makerFeeBips.eq(expectedMakerFee),
      "Wrong protocol maker fees"
    );
  };

  describe("Staking", function() {
    this.timeout(0);

    describe("Exchange owner", () => {
      it("should be able to withdraw the protocol fee stake", async () => {
        // Deposit some LRC to stake for the exchange
        const depositer = exchangeTestUtil.testContext.operators[2];
        const stakeAmount = new BN(web3.utils.toWei("1234567", "ether"));
        await exchangeTestUtil.setBalanceAndApprove(
          depositer,
          "LRC",
          stakeAmount,
          loopring.address
        );
        // Stake it
        await exchangeTestUtil.depositProtocolFeeStakeChecked(
          stakeAmount,
          depositer
        );
        // Try to withdraw it from an unauthorized address on the exchange contract
        await expectThrow(
          exchangeTestUtil.exchange.withdrawProtocolFeeStake(
            exchangeTestUtil.exchangeOwner,
            stakeAmount,
            { from: exchangeTestUtil.exchangeOperator }
          ),
          "UNAUTHORIZED"
        );
        // Try to withdraw it from an unauthorized address on the loopring contract
        await expectThrow(
          loopring.withdrawProtocolFeeStake(
            exchangeTestUtil.exchangeId,
            exchangeTestUtil.exchangeOwner,
            stakeAmount,
            { from: exchangeTestUtil.exchangeOwner }
          ),
          "UNAUTHORIZED"
        );
        // Withdraw the exchange stake
        await exchangeTestUtil.withdrawProtocolFeeStakeChecked(
          exchangeTestUtil.exchangeOwner,
          stakeAmount
        );
      });

      it("should be able to lower the protocol fees", async () => {
        const minProtocolTakerFeeBips = await loopring.minProtocolTakerFeeBips();
        const maxProtocolTakerFeeBips = await loopring.maxProtocolTakerFeeBips();
        const minProtocolMakerFeeBips = await loopring.minProtocolMakerFeeBips();
        const maxProtocolMakerFeeBips = await loopring.maxProtocolMakerFeeBips();
        const targetProtocolTakerFeeStake = await loopring.targetProtocolTakerFeeStake();
        const targetProtocolMakerFeeStake = await loopring.targetProtocolMakerFeeStake();

        // Deposit some LRC to stake for the exchange
        const depositer = exchangeTestUtil.testContext.operators[2];
        const totalLRC = targetProtocolTakerFeeStake.mul(new BN(4));
        await exchangeTestUtil.setBalanceAndApprove(
          depositer,
          "LRC",
          totalLRC,
          loopring.address
        );

        {
          const protocolFees = await loopring.getProtocolFeeValues(
            exchangeTestUtil.exchangeId,
            exchangeTestUtil.rollupMode
          );
          assert(
            protocolFees.takerFeeBips.eq(maxProtocolTakerFeeBips),
            "Wrong protocol taker fees"
          );
          assert(
            protocolFees.makerFeeBips.eq(maxProtocolMakerFeeBips),
            "Wrong protocol maker fees"
          );
        }

        await exchangeTestUtil.depositProtocolFeeStakeChecked(
          targetProtocolMakerFeeStake,
          depositer
        );
        await checkProtocolFees();
        await exchangeTestUtil.depositProtocolFeeStakeChecked(
          targetProtocolMakerFeeStake,
          depositer
        );
        await checkProtocolFees();
        await exchangeTestUtil.depositProtocolFeeStakeChecked(
          targetProtocolTakerFeeStake,
          depositer
        );
        await checkProtocolFees();
        await exchangeTestUtil.depositProtocolFeeStakeChecked(
          targetProtocolTakerFeeStake,
          depositer
        );

        {
          const protocolFees = await loopring.getProtocolFeeValues(
            exchangeTestUtil.exchangeId,
            exchangeTestUtil.rollupMode
          );
          assert(
            protocolFees.takerFeeBips.eq(minProtocolTakerFeeBips),
            "Wrong protocol taker fees"
          );
          assert(
            protocolFees.makerFeeBips.eq(minProtocolMakerFeeBips),
            "Wrong protocol maker fees"
          );
        }
      });
    });
  });

  describe("Owner", () => {
    it("should be able to update settings", async () => {
      const protocolFeeVaultBefore = await loopring.protocolFeeVault();
      const newProtocolFeeVault = exchangeTestUtil.testContext.orderOwners[2];
      assert(newProtocolFeeVault !== protocolFeeVaultBefore);

      await loopring.updateSettings(
        newProtocolFeeVault,
        exchangeTestUtil.testContext.orderOwners[2],
        new BN(web3.utils.toWei("0.01", "ether")),
        new BN(web3.utils.toWei("9000", "ether")),
        new BN(web3.utils.toWei("20", "ether")),
        new BN(web3.utils.toWei("250000", "ether")),
        { from: exchangeTestUtil.testContext.deployer }
      );

      const protocolFeeVaultAfter = await loopring.protocolFeeVault();
      assert(
        newProtocolFeeVault === protocolFeeVaultAfter,
        "new protocolFeeVault should be set"
      );
    });
  });

  describe("anyone", () => {
    it("should not be able to burn the stake", async () => {
      await expectThrow(
        loopring.burnExchangeStake(exchangeTestUtil.exchangeId, new BN(0), {
          from: exchangeTestUtil.testContext.deployer
        }),
        "UNAUTHORIZED"
      );
    });

    it("should not be able to withdraw the stake", async () => {
      const recipient = exchangeTestUtil.testContext.orderOwners[1];
      await expectThrow(
        loopring.withdrawExchangeStake(
          exchangeTestUtil.exchangeId,
          recipient,
          new BN(0),
          { from: exchangeTestUtil.testContext.deployer }
        ),
        "UNAUTHORIZED"
      );
    });

    it("should not be able to set the update the settings", async () => {
      await expectThrow(
        loopring.updateSettings(
          exchangeTestUtil.testContext.orderOwners[1], // fee vault
          exchangeTestUtil.testContext.orderOwners[2], // block verifier
          new BN(web3.utils.toWei("0.01", "ether")),
          new BN(web3.utils.toWei("9000", "ether")),
          new BN(web3.utils.toWei("20", "ether")),
          new BN(web3.utils.toWei("250000", "ether")),
          { from: exchangeTestUtil.testContext.orderOwners[0] }
        ),
        "UNAUTHORIZED"
      );
    });

    it("should not be able to set the update the protocol fee settings", async () => {
      await expectThrow(
        loopring.updateProtocolFeeSettings(
          25,
          50,
          10,
          25,
          new BN(web3.utils.toWei("25000000", "ether")),
          new BN(web3.utils.toWei("10000000", "ether")),
          { from: exchangeTestUtil.testContext.orderOwners[0] }
        ),
        "UNAUTHORIZED"
      );
    });
  });
});
