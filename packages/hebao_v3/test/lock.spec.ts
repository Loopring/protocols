import { expect } from "./setup";
import { signUnlock } from "./helper/signatureUtils";
import { sign } from "./helper/Signature";
import { newWallet, sortSignersAndSignatures } from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");
import { parseEther } from "ethers/lib/utils";

import { Contract, Signer } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { fixture } from "./helper/fixture";
import BN = require("bn.js");

describe("wallet", () => {
  describe("lock", () => {
    it("owner should be able to lock wallet", async () => {
      const { accountOwner, account: wallet } = await loadFixture(fixture);
      const owner = await accountOwner.address;

      const walletDataBefore = await wallet.wallet();
      expect(walletDataBefore.locked).to.equal(false);
      await wallet.lock();
      const walletDataAfter = await wallet.wallet();
      expect(walletDataAfter.locked).to.equal(true);
    });

    it("guardian should be able to lock wallet", async () => {
      const {
        accountOwner,
        account: wallet,
        guardians,
        deployer,
      } = await loadFixture(fixture);
      const owner = await accountOwner.address;

      await deployer.sendTransaction({
        to: guardians[0].address,
        value: parseEther("1"),
      });

      const walletDataBefore = await wallet.wallet();
      expect(walletDataBefore.locked).to.equal(false);
      await wallet.connect(guardians[0]).lock();
      const walletDataAfter = await wallet.wallet();
      expect(walletDataAfter.locked).to.equal(true);
    });

    it("unlock wallet with majority's approval(owner required)", async () => {
      const {
        accountOwner,
        account: wallet,
        guardians,
      } = await loadFixture(fixture);
      const owner = await accountOwner.address;
      const walletDataBefore = await wallet.wallet();
      expect(walletDataBefore.locked).to.equal(false);
      const tx1 = await wallet.lock();
      const walletDataAfter = await wallet.wallet();
      expect(walletDataAfter.locked).to.equal(true);

      const masterCopy = await wallet.getMasterCopy();

      const validUntil = new Date().getTime() + 1000 * 3600 * 24; // one day
      const sig1 = signUnlock(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        owner,
        accountOwner.privateKey.slice(2)
      );
      const sig2 = signUnlock(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        guardians[0].address,
        guardians[0].privateKey.slice(2)
      );

      const sortedSigs = sortSignersAndSignatures(
        [owner, guardians[0].address],
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

      await wallet.unlock(approval);
      const walletDataAfter2 = await wallet.wallet();
      expect(walletDataAfter2.locked).to.equal(false);
    });
  });
});
