import { expect } from "./setup";
import {
  signCreateWallet,
  signChangeMasterCopy,
} from "./helper/signatureUtils";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { sign } from "./helper/Signature";
import {
  newWallet,
  getContractABI,
  getFirstEvent,
  getAllEvent,
  newWalletImpl,
  sortSignersAndSignatures,
  advanceTime,
  getBlockTimestamp,
} from "./commons";
import {
  baseFixture,
  fixture,
  walletImplFixture,
  proxyFixture,
} from "./helper/fixture";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet", () => {
  describe("upgrade", () => {
    it("wallet owner should be able to upgrade impl with enough approvals", async () => {
      const {
        account: wallet,
        guardians,
        accountOwner,
      } = await loadFixture(fixture);
      const newSmartWalletImpl = await loadFixture(walletImplFixture);
      const validUntil = 9999999999;
      const currentImpl = await wallet.getMasterCopy();
      const sig1 = signChangeMasterCopy(
        wallet.address,
        currentImpl,
        new BN(validUntil),
        newSmartWalletImpl.address,
        accountOwner.address,
        accountOwner.privateKey.slice(2)
      );
      const sig1Bs = Buffer.from(sig1.txSignature.slice(2), "hex");
      const sig2 = signChangeMasterCopy(
        wallet.address,
        currentImpl,
        new BN(validUntil),
        newSmartWalletImpl.address,
        guardians[0].address,
        guardians[0].privateKey.slice(2)
      );
      const sig2Bs = Buffer.from(sig2.txSignature.slice(2), "hex");
      const sortedSigs = sortSignersAndSignatures(
        [accountOwner.address, guardians[0].address],
        [sig1Bs, sig2Bs]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: wallet.address,
      };

      const tx = await wallet.changeMasterCopy(
        approval,
        newSmartWalletImpl.address
      );

      const masterCopyOfWallet = await wallet.getMasterCopy();
      expect(masterCopyOfWallet).to.equal(newSmartWalletImpl.address);
    });
  });

  describe("DelayedImplementationManager", () => {
    it("only owner is able to set nextImpl & effectiveTime", async () => {
      const [account1, account2, account3] = await ethers.getSigners();
      const newSmartWalletImpl = await walletImplFixture();
      const storage = await (
        await ethers.getContractFactory("DelayedImplementationManager")
      ).deploy(newSmartWalletImpl.address, account1.address);
      const owner = await storage.owner();
      const signer = storage.signer;
      expect(owner).to.equal(signer.address);

      await expect(storage.executeUpgrade()).to.revertedWith("NOT_IN_EFFECT");

      const newImpl = "0x" + "11".repeat(20);
      const tx = await storage.delayedUpgradeTo(newImpl, 1);
      const blockTime = await getBlockTimestamp(tx.blockNumber);
      const receipt = await tx.wait();
      const upgradeScheduledEvent = receipt.events[0].args;
      expect(upgradeScheduledEvent.nextImpl).to.equal(newImpl);
      expect(upgradeScheduledEvent.effectiveTime.toNumber()).to.equal(
        blockTime + 3600 * 24
      );

      const storageWithAnotherSigner = await storage.connect(account2);
      const signer2 = storageWithAnotherSigner.signer.address;
      expect(owner).not.to.equal(signer2);
      const newImpl2 = "0x" + "22".repeat(20);
      await expect(
        storageWithAnotherSigner.delayedUpgradeTo(newImpl2, 1)
      ).to.revertedWith("UNAUTHORIZED");

      // execute upgrade before nexeEffectiveTime:
      await expect(storageWithAnotherSigner.executeUpgrade()).to.revertedWith(
        "NOT_IN_EFFECT"
      );

      await advanceTime(3600 * 24);
      const executeTx = await storageWithAnotherSigner.executeUpgrade();
      const executeReceipt = await executeTx.wait();
      const implementationChangedEvent = executeReceipt.events[0].args;
      expect(implementationChangedEvent.newImpl).to.equal(newImpl);

      // upgrade can not be executed agin:
      await expect(storage.executeUpgrade()).to.revertedWith("NOT_IN_EFFECT");
    });

    it("upgrade for user wallet", async () => {
      const {
        forwardProxy,
        account: wallet,
        accountOwner,
        implStorage,
      } = await loadFixture(proxyFixture);
      const currentImpl = await wallet.getMasterCopy();
      expect(currentImpl).to.eq(forwardProxy.address);
      const blankOwnerBefore = await wallet.blankOwner();

      const newSmartWalletImpl = await walletImplFixture();
      await implStorage.delayedUpgradeTo(newSmartWalletImpl.address, 1);
      await advanceTime(3600 * 24);
      await implStorage.executeUpgrade();
      const blankOwnerAfter = await wallet.blankOwner();
      expect(blankOwnerBefore).not.to.eq(blankOwnerAfter);
    });
  });
});
