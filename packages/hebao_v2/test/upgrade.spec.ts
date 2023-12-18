import { expect } from "./setup";
import {
  signCreateWallet,
  signChangeMasterCopy,
} from "./helper/signatureUtils";
import { sign } from "./helper/Signature";
import {
  newWallet,
  attachWallet,
  getContractABI,
  getFirstEvent,
  getAllEvent,
  getBlockTimestamp,
  newWalletImpl,
  sortSignersAndSignatures,
  advanceTime,
} from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet", () => {
  let account1: Signer;
  let account2: Signer;
  let account3: Signer;
  let owner: string;
  let guardian1: string;
  let guardian2: string;
  let wallet: Contract;
  let newSmartWalletImpl: Contract;
  let forwardProxy: Contract;

  before(async () => {
    [account1, account2, account3] = await ethers.getSigners();

    owner = await account1.getAddress();
    guardian1 = await account2.getAddress();
    guardian2 = await account3.getAddress();

    wallet = await newWallet(owner, ethers.constants.AddressZero, 0, [
      guardian1,
      guardian2,
    ]);
    newSmartWalletImpl = await newWalletImpl();
    console.log("newSmartWalletImpl.address: ", newSmartWalletImpl.address);

    const implStorage = await (
      await ethers.getContractFactory("DelayedImplementationManager")
    ).deploy(newSmartWalletImpl.address);
    forwardProxy = await (
      await ethers.getContractFactory("ForwardProxy")
    ).deploy(implStorage.address);
    console.log("forwardProxy.address: ", forwardProxy.address);
  });

  describe("upgrade", () => {
    it("wallet owner should be able to upgrade impl with enough approvals", async () => {
      const validUntil = 9999999999;
      const currentImpl = await wallet.getMasterCopy();
      console.log("old impl:", currentImpl);
      const sig1 = signChangeMasterCopy(
        wallet.address,
        currentImpl,
        new BN(validUntil),
        newSmartWalletImpl.address,
        owner
      );
      const sig1Bs = Buffer.from(sig1.txSignature.slice(2), "hex");
      const sig2 = signChangeMasterCopy(
        wallet.address,
        currentImpl,
        new BN(validUntil),
        newSmartWalletImpl.address,
        guardian1
      );
      const sig2Bs = Buffer.from(sig2.txSignature.slice(2), "hex");
      const sortedSigs = sortSignersAndSignatures(
        [owner, guardian1],
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
      console.log("masterCopyofwallet:", masterCopyOfWallet);

      expect(masterCopyOfWallet).to.equal(newSmartWalletImpl.address);
    });
  });

  describe("DelayedImplementationManager", () => {
    it("only owner is able to set nextImpl & effectiveTime", async () => {
      const storage = await (
        await ethers.getContractFactory("DelayedImplementationManager")
      ).deploy(newSmartWalletImpl.address);
      const owner = await storage.owner();
      const signer = storage.signer;
      expect(owner).to.equal(signer.address);

      try {
        await storage.executeUpgrade();
      } catch (err) {
        expect(err.message.includes("NOT_IN_EFFECT")).to.be.true;
      }

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
      try {
        await storageWithAnotherSigner.delayedUpgradeTo(newImpl2, 1);
      } catch (err) {
        expect(err.message.includes("UNAUTHORIZED")).to.be.true;
      }

      // execute upgrade before nexeEffectiveTime:
      try {
        await storageWithAnotherSigner.executeUpgrade();
      } catch (err) {
        expect(err.message.includes("NOT_IN_EFFECT")).to.be.true;
      }

      await advanceTime(3600 * 24);
      const executeTx = await storageWithAnotherSigner.executeUpgrade();
      const executeReceipt = await executeTx.wait();
      const implementationChangedEvent = executeReceipt.events[0].args;
      expect(implementationChangedEvent.newImpl).to.equal(newImpl);

      // upgrade can not be executed agin:
      try {
        await storage.executeUpgrade();
      } catch (err) {
        expect(err.message.includes("NOT_IN_EFFECT")).to.be.true;
      }
    });
  });

  describe("upgrade to proxy", () => {
    it("wallet owner should be able to upgrade to a proxy contract", async () => {
      const validUntil = 9999999999;
      const currentImpl = await wallet.getMasterCopy();
      // console.log("old masterCopy:", currentImpl);
      const ownerBefore = await wallet.getOwner();

      const newImpl = forwardProxy.address;
      // console.log('new masterCopy: ', newImpl);

      const smartWalletAddr = await forwardProxy.implementation();
      // console.log('smartWalletAddr : ', smartWalletAddr);

      const sig1 = signChangeMasterCopy(
        wallet.address,
        currentImpl,
        new BN(validUntil),
        newImpl,
        owner
      );
      const sig1Bs = Buffer.from(sig1.txSignature.slice(2), "hex");
      const sig2 = signChangeMasterCopy(
        wallet.address,
        currentImpl,
        new BN(validUntil),
        newImpl,
        guardian1
      );
      const sig2Bs = Buffer.from(sig2.txSignature.slice(2), "hex");
      const sortedSigs = sortSignersAndSignatures(
        [owner, guardian1],
        [sig1Bs, sig2Bs]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: wallet.address,
      };

      const tx = await wallet.changeMasterCopy(approval, newImpl);

      const masterCopyOfWallet = await wallet.getMasterCopy();
      // console.log("masterCopyofwallet:", masterCopyOfWallet);
      expect(masterCopyOfWallet).to.equal(newImpl);

      const walletAfter = await wallet.wallet();
      expect(walletAfter.owner).to.equal(ownerBefore);
      // console.log('walletAfter: ', walletAfter);
    });
  });
});
