import {
  time,
  loadFixture
} from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployTask } from "./utils/deploy_util";
import { deployExchangeFixture } from "./utils/fixture";

describe("ExchangeV3", function () {
  describe("loopringv3 test", function () {
    it("update setting successfully", async function () {
      const {
        exchange,
        loopringV3,
        protocolFeeVault,
        blockVerifier
      } = await loadFixture(deployExchangeFixture);

      // setting valid immediately when it is the first time to set
      expect(await loopringV3.forcedWithdrawalFee()).to.eq(0);
      expect(await loopringV3.protocolFeeVault()).to.eq(
        await protocolFeeVault.address
      );
      expect(await loopringV3.blockVerifierAddress()).to.eq(
        await blockVerifier.address
      );

      // revert when fee is too high
      await expect(
        loopringV3.updateSettings(
          protocolFeeVault.address,
          blockVerifier.address,
          ethers.utils.parseEther("2")
        )
      ).to.revertedWith("FORCED_WITHDRAWAL_FEE_TOO_HIGH");

      const newForcedWithdrawalFee = ethers.utils.parseEther("0.02");
      await loopringV3.updateSettings(
        protocolFeeVault.address,
        blockVerifier.address,
        newForcedWithdrawalFee
      );
      // unchanged
      expect(await loopringV3.forcedWithdrawalFee()).not.to.eq(
        newForcedWithdrawalFee
      );

      await expect(loopringV3.applyUpdate()).to.revertedWith(
        "NOT_ENABLED_YET"
      );

      await time.increase(3600 * 24 * 7);
      await loopringV3.applyUpdate();

      // changed
      expect(await loopringV3.forcedWithdrawalFee()).to.eq(
        newForcedWithdrawalFee
      );
    });
  });

  describe("exchange test", () => {
    it("deposit test", async () => {
      const { exchange, otherAccount, weth, depositContract } =
        await loadFixture(deployExchangeFixture);

      // prepare tokens
      const initAmount = ethers.utils.parseEther("1000");
      await weth.setBalance(otherAccount.address, initAmount);
      await weth
        .connect(otherAccount)
        .approve(
          depositContract.address,
          ethers.constants.MaxUint256
        );

      const amount0 = ethers.utils.parseEther("1");
      const balanceBefore = await weth.balanceOf(
        otherAccount.address
      );
      await exchange
        .connect(otherAccount)
        .deposit(
          otherAccount.address,
          otherAccount.address,
          weth.address,
          amount0,
          "0x"
        );
      const balanceAfter = await weth.balanceOf(otherAccount.address);
      expect(
        balanceBefore.toBigInt() - balanceAfter.toBigInt()
      ).to.eq(amount0);

      const amount1 = amount0.toBigInt() / 1000n - 1n;
      await expect(
        exchange
          .connect(otherAccount)
          .deposit(
            otherAccount.address,
            otherAccount.address,
            weth.address,
            amount1,
            "0x"
          )
      ).to.revertedWith("DEPOSIT_TOO_LITTLE");
    });

    it("delay to update proxy", async () => {
      const {
        exchange,
        loopringV3,
        protocolFeeVault,
        blockVerifier
      } = await loadFixture(deployExchangeFixture);
      const proxy = await ethers.getContractAt(
        "OwnedUpgradabilityProxy",
        exchange.address
      );
      // mock new impl address
      const newImpl = "0x" + "12".repeat(20);
      await proxy.upgradeTo(newImpl);
      expect(await proxy.implementation()).not.to.eq(newImpl);

      await expect(proxy.applyUpdate()).to.revertedWith(
        "NOT_EFFECT_YET"
      );
      await time.increase(3600 * 24 * 7);
      await proxy.applyUpdate();

      expect(await proxy.implementation()).to.eq(newImpl);
    });
  });

  describe("block verifier", () => {
    it("circuit management", async () => {
      const { blockVerifier } = await loadFixture(
        deployExchangeFixture
      );
      const blockType = 0;
      const blockSize = 16;
      const blockVersion = 0;
      const vk = Array<number>(18).fill(0);
      await blockVerifier.registerCircuit(
        blockType,
        blockSize,
        blockVersion,
        vk
      );
      expect(
        await blockVerifier.isCircuitRegistered(
          blockType,
          blockSize,
          blockVersion
        )
      ).to.be.true;
      await expect(
        blockVerifier.enableCircuit(
          blockType,
          blockSize,
          blockVersion
        )
      ).to.revertedWith("NOT_EFFECT_YET");
      await time.increase(3600 * 24 * 7);
      await blockVerifier.enableCircuit(
        blockType,
        blockSize,
        blockVersion
      );
      expect(
        await blockVerifier.isCircuitEnabled(
          blockType,
          blockSize,
          blockVersion
        )
      ).to.be.true;

      await blockVerifier.disableCircuit(
        blockType,
        blockSize,
        blockVersion
      );
      expect(
        await blockVerifier.isCircuitEnabled(
          blockType,
          blockSize,
          blockVersion
        )
      ).to.be.false;
    });
  });
});
