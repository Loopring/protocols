import { expect } from "./setup";
import {
  signCreateWallet,
  signChangeDailyQuotaWA
} from "./helper/signatureUtils";
import { sign } from "./helper/Signature";
import {
  newWallet,
  getFirstEvent,
  getBlockTimestamp,
  advanceTime,
  getCurrentQuota,
  sortSignersAndSignatures
} from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet", () => {
  let account1: Signer;
  let account2: Signer;
  let account3: Signer;

  describe("quota", () => {
    it("owner should be able to changeDialyQuota", async () => {
      [account1, account2, account3] = await ethers.getSigners();

      const owner = await account1.getAddress();
      const wallet = await newWallet(owner, ethers.constants.AddressZero, 0);

      const quotaAmount = ethers.utils.parseEther("10");
      const tx = await wallet.changeDailyQuota(quotaAmount);
      const quotaInfo = (await wallet.wallet())["quota"];

      // 0 (MAX_AMOUNT) => quotaAmount, become effective immediately.
      const blockTime = await getBlockTimestamp(tx.blockNumber);
      expect(quotaInfo.pendingQuota.toString()).to.equal(quotaAmount);
      expect(quotaInfo.pendingUntil).to.equal(0);
    });

    it("changeDialyQuota extra test", async () => {
      [account1, account2, account3] = await ethers.getSigners();

      const owner = await account1.getAddress();
      const wallet = await newWallet(owner, ethers.constants.AddressZero, 0);
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
      [account1, account2, account3] = await ethers.getSigners();
      const owner = await account1.getAddress();
      const guardians: string[] = [
        await account2.getAddress(),
        await account3.getAddress()
      ];
      const salt = new Date().getTime();
      let wallet = await newWallet(
        owner,
        ethers.constants.AddressZero,
        salt,
        guardians
      );
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
        owner
      );
      const sig2 = signChangeDailyQuotaWA(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        new BN(newQuota),
        guardians[0]
      );

      const sortedSigs = sortSignersAndSignatures(
        [owner, guardians[0]],
        [
          Buffer.from(sig1.txSignature.slice(2), "hex"),
          Buffer.from(sig2.txSignature.slice(2), "hex")
        ]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: wallet.address
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
