import { expect } from "chai";
import { ethers } from "hardhat";
import { fixture } from "./helper/fixture";
import {
  getBlockTimestamp,
  getCurrentQuota,
  sortSignersAndSignatures,
  deployWalletImpl,
} from "./helper/utils";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { signChangeDailyQuotaWA } from "./helper/signatureUtils";
import { fillAndMultiSign } from "./helper/AASigner";
import BN from "bn.js";

describe("quota test", () => {
  it("change daily quota from entrypoint using `execute` api", async () => {
    const { smartWallet: wallet } = await loadFixture(fixture);
  });
  it("change daily quota from entrypoint directly", async () => {});
  it("change daily quota from wallet owner", async () => {
    const { smartWallet: wallet } = await loadFixture(fixture);
    const quotaAmount = ethers.utils.parseEther("10");
    const tx = await wallet.changeDailyQuota(quotaAmount);
    const quotaInfo = (await wallet.wallet())["quota"];

    // 0 (MAX_AMOUNT) => quotaAmount, become effective immediately.
    const blockTime = await getBlockTimestamp(tx.blockNumber);
    expect(quotaInfo.pendingQuota.toString()).to.equal(quotaAmount);
    expect(quotaInfo.pendingUntil).to.equal(0);
  });

  it("changeDailyQuota extra test", async () => {
    const {
      walletFactory,
      entrypoint,
      deployer,
      smartWallet: wallet,
    } = await loadFixture(fixture);

    const quotaAmount = ethers.utils.parseEther("10");
    const tx = await wallet.changeDailyQuota(quotaAmount);
    const quotaInfo = (await wallet.wallet())["quota"];
    // 0 (MAX_AMOUNT) => quotaAmount, become effective immediately.
    const currentQuota = await getCurrentQuota(quotaInfo, tx.blockNumber);
    const blockTime = await getBlockTimestamp(tx.blockNumber);
    expect(currentQuota).to.equal(quotaAmount);
    expect(quotaInfo.pendingQuota).to.equal(quotaAmount);
    expect(quotaInfo.pendingUntil).to.equal(0);

    await time.increase(3600 * 24);
    const quotaAmount2 = ethers.utils.parseEther("20");
    const tx2 = await wallet.changeDailyQuota(quotaAmount2);
    const blockTime2 = await getBlockTimestamp(tx2.blockNumber);
    const quotaInfo2 = (await wallet.wallet())["quota"];
    const currentQuota2 = await getCurrentQuota(quotaInfo2, tx2.blockNumber);
    expect(currentQuota2).to.equal(quotaAmount);
    expect(quotaInfo2.pendingQuota).to.equal(quotaAmount2);
    expect(quotaInfo2.pendingUntil.toString()).to.equal(
      blockTime2 + 3600 * 24 + ""
    );

    await time.increase(3600 * 24);
    const quotaAmount3 = ethers.utils.parseEther("50");
    const tx3 = await wallet.changeDailyQuota(quotaAmount3);
    const blockTime3 = await getBlockTimestamp(tx3.blockNumber);
    const quotaInfo3 = (await wallet.wallet())["quota"];
    const currentQuota3 = await getCurrentQuota(quotaInfo3, tx3.blockNumber);
    expect(currentQuota3).to.equal(quotaAmount2);
    expect(quotaInfo3.pendingQuota).to.equal(quotaAmount3);
    expect(quotaInfo3.pendingUntil.toString()).to.equal(
      blockTime3 + 3600 * 24 + ""
    );

    await time.increase(3600 * 24);

    // newQuota < currentQuota, newQuota will become effective immediately.
    const quotaAmount4 = ethers.utils.parseEther("49");
    const tx4 = await wallet.changeDailyQuota(quotaAmount4);
    const blockTime4 = await getBlockTimestamp(tx4.blockNumber);
    const quotaInfo4 = (await wallet.wallet())["quota"];
    const currentQuota4 = await getCurrentQuota(quotaInfo4, tx4.blockNumber);
    expect(currentQuota4).to.equal(quotaAmount4);
    expect(quotaInfo4.pendingQuota).to.equal(quotaAmount4);
    expect(quotaInfo4.pendingUntil).to.equal(0);
  });

  it("changeDailyQuotaWA", async () => {
    const {
      smartWallet,
      smartWalletOwner,
      guardians,
      create2,
      entrypoint,
      sendUserOp,
      smartWalletImpl,
    } = await loadFixture(fixture);
    const newQuota = "1" + "0".repeat(20);
    const tx = await smartWallet.populateTransaction.changeDailyQuotaWA(
      newQuota
    );
    const partialUserOp = {
      sender: smartWallet.address,
      nonce: 0,
      callData: tx.data,
      callGasLimit: "126880",
    };
    const signedUserOp = await fillAndMultiSign(
      partialUserOp,
      [smartWalletOwner, guardians[0]],
      create2.address,
      entrypoint
    );

    const recipt = await sendUserOp(signedUserOp);

    const quotaInfo = (await smartWallet.wallet())["quota"];
    const currentQuota = await getCurrentQuota(quotaInfo, recipt.blockNumber);
    expect(currentQuota).to.equal(newQuota);
    expect(quotaInfo.pendingUntil.toString()).to.equal("0");
  });

  describe("quota check test", () => {
    const ONE_DAY = 3600 * 24;
    it("will failed when usage excess daily quota", async () => {
      const {
        smartWallet,
        smartWalletOwner,
        guardians,
        create2,
        entrypoint,
        sendUserOp,
        blankOwner,
        usdtToken,
      } = await loadFixture(fixture);

      const oraclePrice = 1;
      const testPriceOracle = await (
        await ethers.getContractFactory("TestPriceOracle")
      ).deploy(oraclePrice);
      // create new smart wallet implementation with valid price oracle
      const newSmartWalletImpl = await deployWalletImpl(
        create2,
        entrypoint.address,
        blankOwner.address,
        testPriceOracle.address
      );
      // update to new implementation
      const changeMasterCopy =
        await smartWallet.populateTransaction.changeMasterCopy(
          newSmartWalletImpl.address
        );

      const partialUserOp = {
        sender: smartWallet.address,
        nonce: 0,
        callData: changeMasterCopy.data,
      };
      const signedUserOp = await fillAndMultiSign(
        partialUserOp,
        [smartWalletOwner, guardians[0]],
        create2.address,
        entrypoint
      );
      await sendUserOp(signedUserOp);
      const masterCopyOfWallet = await smartWallet.getMasterCopy();
      expect(masterCopyOfWallet).to.equal(newSmartWalletImpl.address);
      expect(await smartWallet.priceOracle()).to.eq(testPriceOracle.address);

      // spent daily quota using approving token
      const tokenAmount = ethers.utils.parseUnits("100", 6);
      const quotaAmount = ethers.utils.parseUnits("200", 6);
      const initTokenAmount = ethers.utils.parseUnits("1000", 6);
      await usdtToken.setBalance(smartWallet.address, initTokenAmount);

      await smartWallet.changeDailyQuota(quotaAmount);
      // advance time to make it valid immediately
      await time.increase(ONE_DAY);
      const receiver = ethers.constants.AddressZero;
      await smartWallet.transferToken(
        usdtToken.address,
        receiver,
        tokenAmount,
        "0x",
        true
      );
      const quotaInfo = (await smartWallet.wallet())["quota"];
      const tokenValue = await testPriceOracle.tokenValue(
        usdtToken.address,
        tokenAmount
      );
      expect(quotaInfo.spentAmount).to.equal(tokenValue);

      // will fail when spent too much tokens
      await expect(
        smartWallet.transferToken(
          usdtToken.address,
          receiver,
          tokenAmount.mul(2),
          "0x",
          true
        )
      ).to.rejectedWith("QUOTA_EXCEEDED");

      // add receiver address to whitelist
      await smartWallet.addToWhitelist(receiver);
      await time.increase(ONE_DAY);
      await expect(
        smartWallet.transferToken(
          usdtToken.address,
          receiver,
          tokenAmount.mul(2),
          "0x",
          false
        )
      ).not.to.reverted;
    });
  });
});
