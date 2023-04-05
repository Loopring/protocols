import { expect } from "./setup";
import {
  signCreateWallet,
  signChangeDailyQuotaWA,
} from "./helper/signatureUtils";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { sign } from "./helper/Signature";
import {
  createAccount,
  createAccountOwner,
  createRandomWalletConfig,
} from "./helper/utils";
import { parseEther, arrayify, hexConcat, hexlify } from "ethers/lib/utils";
import {
  newWallet,
  getFirstEvent,
  getBlockTimestamp,
  advanceTime,
  getCurrentQuota,
  sortSignersAndSignatures,
  deployLibs,
} from "./commons";
import { fixture } from "./helper/fixture";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet", () => {
  describe("quota", () => {
    it("owner should be able to changeDialyQuota", async () => {
      const {
        walletFactory,
        entrypoint,
        deployer,
        account: wallet,
      } = await loadFixture(fixture);
      const quotaAmount = ethers.utils.parseEther("10");
      const tx = await wallet.changeDailyQuota(quotaAmount);
      const quotaInfo = (await wallet.wallet())["quota"];

      // 0 (MAX_AMOUNT) => quotaAmount, become effective immediately.
      const blockTime = await getBlockTimestamp(tx.blockNumber);
      expect(quotaInfo.pendingQuota.toString()).to.equal(quotaAmount);
      expect(quotaInfo.pendingUntil).to.equal(0);
    });

    it("changeDialyQuota extra test", async () => {
      const {
        walletFactory,
        entrypoint,
        deployer,
        account: wallet,
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

      await advanceTime(3600 * 24);
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

      await advanceTime(3600 * 24);
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

      await advanceTime(3600 * 24);

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

    it("majority(owner required) should be able to change dialy quota immediately", async () => {
      const {
        walletFactory,
        entrypoint,
        deployer,
        account: wallet,
        guardians,
        accountOwner,
      } = await loadFixture(fixture);
      const salt = new Date().getTime();
      const walletDataBefore = await wallet.wallet();
      expect(walletDataBefore.locked).to.equal(false);
      const tx1 = await wallet.lock();
      const walletDataAfter = await wallet.wallet();
      expect(walletDataAfter.locked).to.equal(true);

      const masterCopy = await wallet.getMasterCopy();
      const validUntil = new Date().getTime() + 1000 * 3600 * 24; // one day
      const newQuota = "1" + "0".repeat(20);
      const sig1 = signChangeDailyQuotaWA(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        new BN(newQuota),
        accountOwner.address,
        accountOwner.privateKey.slice(2)
      );
      const sig2 = signChangeDailyQuotaWA(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        new BN(newQuota),
        guardians[0].address,
        guardians[0].privateKey.slice(2)
      );

      const sortedSigs = sortSignersAndSignatures(
        [accountOwner.address, guardians[0].address],
        [
          Buffer.from(sig1.txSignature.slice(2), "hex"),
          Buffer.from(sig2.txSignature.slice(2), "hex"),
        ]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: wallet.address,
      };

      // Tx with approval will ignore wallet lock.
      const tx = await wallet.changeDailyQuotaWA(approval, newQuota);
      const quotaInfo = (await wallet.wallet())["quota"];
      const currentQuota = await getCurrentQuota(quotaInfo, tx.blockNumber);
      expect(currentQuota).to.equal(newQuota);
      expect(quotaInfo.pendingUntil.toString()).to.equal("0");
    });
  });
});
