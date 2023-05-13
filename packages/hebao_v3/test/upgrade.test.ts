import { expect } from "chai";
import {
  signCreateWallet,
  signChangeMasterCopy,
} from "./helper/signatureUtils";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import {
  getFirstEvent,
  sortSignersAndSignatures,
  getBlockTimestamp,
  deployWalletImpl,
  sendTx,
} from "./helper/utils";
import { fixture } from "./helper/fixture";
// import { /*l2ethers as*/ ethers } from "hardhat";
import { ethers } from "hardhat";
import { fillUserOp } from "./helper/AASigner";

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet", () => {
  describe("upgrade", () => {
    it("wallet owner should be able to upgrade impl with enough approvals", async () => {
      const {
        smartWallet: wallet,
        guardians,
        smartWalletOwner,
        create2,
        entrypoint,
        sendUserOp,
        smartWalletImpl,
      } = await loadFixture(fixture);
      const newSmartWalletImpl = await deployWalletImpl(
        create2,
        entrypoint.address,
        ethers.constants.AddressZero
      );
      const validUntil = 9999999999;
      const currentImpl = smartWalletImpl.address;
      const sig1 = signChangeMasterCopy(
        wallet.address,
        currentImpl,
        new BN(validUntil),
        newSmartWalletImpl.address,
        smartWalletOwner.address,
        smartWalletOwner.privateKey.slice(2)
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
        [smartWalletOwner.address, guardians[0].address],
        [sig1Bs, sig2Bs]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: wallet.address,
      };
      const signature = ethers.utils.defaultAbiCoder.encode(
        [
          "tuple(address[] signers,bytes[] signatures,uint256 validUntil,address wallet)",
        ],
        [approval]
      );

      const changeMasterCopy =
        await wallet.populateTransaction.changeMasterCopy(
          newSmartWalletImpl.address
        );

      const partialUserOp = {
        sender: wallet.address,
        nonce: 0,
        callData: changeMasterCopy.data,
      };
      const userOp = await fillUserOp(
        partialUserOp,
        create2.address,
        entrypoint
      );
      const signedUserOp = {
        ...userOp,
        signature,
      };

      const recipt = await sendUserOp(signedUserOp);

      const masterCopyOfWallet = await wallet.getMasterCopy();
      expect(masterCopyOfWallet).to.equal(newSmartWalletImpl.address);
    });
  });

  describe("DelayedImplementationManager", () => {
    it("only owner is able to set nextImpl & effectiveTime", async () => {
      const {
        smartWallet: wallet,
        guardians,
        smartWalletOwner,
        create2,
        entrypoint,
        sendUserOp,
        deployer,
        implStorage,
      } = await loadFixture(fixture);
      const otherSigner = (await ethers.getSigners())[1];
      const owner = await implStorage.owner();
      expect(owner).to.equal(deployer.address);

      await expect(implStorage.executeUpgrade()).to.revertedWith(
        "NOT_IN_EFFECT"
      );

      const newImpl = "0x" + "11".repeat(20);
      const tx = await implStorage.delayedUpgradeTo(newImpl, 1);
      const blockTime = await getBlockTimestamp(tx.blockNumber);
      const receipt = await tx.wait();
      const upgradeScheduledEvent = receipt.events[0].args;
      expect(upgradeScheduledEvent.nextImpl).to.equal(newImpl);
      expect(upgradeScheduledEvent.effectiveTime.toNumber()).to.equal(
        blockTime + 3600 * 24
      );

      const storageWithAnotherSigner = await implStorage.connect(otherSigner);
      const signer2 = await storageWithAnotherSigner.signer.getAddress();
      expect(owner).not.to.equal(signer2);
      const newImpl2 = "0x" + "22".repeat(20);
      await expect(
        storageWithAnotherSigner.delayedUpgradeTo(newImpl2, 1)
      ).to.revertedWith("UNAUTHORIZED");

      // execute upgrade before nexeEffectiveTime:
      await expect(storageWithAnotherSigner.executeUpgrade()).to.revertedWith(
        "NOT_IN_EFFECT"
      );

      await time.increase(3600 * 24);
      const executeTx = await storageWithAnotherSigner.executeUpgrade();
      const executeReceipt = await executeTx.wait();
      const implementationChangedEvent = executeReceipt.events[0].args;
      expect(implementationChangedEvent.newImpl).to.equal(newImpl);

      // // upgrade can not be executed agin:
      await expect(implStorage.executeUpgrade()).to.revertedWith(
        "NOT_IN_EFFECT"
      );
    });

    it("upgrade for user wallet", async () => {
      const {
        forwardProxy,
        smartWallet,
        smartWalletOwner,
        implStorage,
        create2,
        entrypoint,
        blankOwner,
      } = await loadFixture(fixture);
      const currentImpl = await smartWallet.getMasterCopy();
      expect(currentImpl).to.eq(forwardProxy.address);
      expect(await smartWallet.blankOwner()).to.eq(blankOwner.address);

      // random blankowner
      const ownerSetter = "0xB7101ff647ac42e776bA857907DdBE743522AA95";
      const newSmartWalletImpl = await deployWalletImpl(
        create2,
        entrypoint.address,
        ownerSetter
      );
      await implStorage.delayedUpgradeTo(newSmartWalletImpl.address, 1);
      await time.increase(3600 * 24);
      await implStorage.executeUpgrade();
      expect(await smartWallet.blankOwner()).to.eq(ownerSetter);
    });
  });
});
