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

      // console.log("quotaInfo:", quotaInfo);
      const blockTime = await getBlockTimestamp(tx.blockNumber);
      // console.log("blockTime:", blockTime);
      expect(quotaInfo.pendingQuota.toString()).to.equal(quotaAmount);
      expect(quotaInfo.pendingUntil.toString()).to.equal(
        blockTime + 3600 * 24 + ""
      );
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
      expect(quotaInfo.currentQuota.toString()).to.equal(newQuota);
      expect(quotaInfo.pendingUntil.toString()).to.equal("0");
    });
  });
});
