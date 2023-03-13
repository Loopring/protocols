import { expect } from "./setup";
import { signUnlock } from "./helper/signatureUtils";
import { sign } from "./helper/Signature";
import { newWallet, sortSignersAndSignatures } from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet", () => {
  let account1: Signer;
  let account2: Signer;
  let account3: Signer;

  describe("lock", () => {
    it("owner should be able to lock wallet", async () => {
      [account1, account2, account3] = await ethers.getSigners();

      const owner = await account1.getAddress();

      const guardians: string[] = [
        await account2.getAddress(),
        await account3.getAddress(),
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
    });

    it("guardian should be able to lock wallet", async () => {
      [account1, account2, account3] = await ethers.getSigners();

      const owner = await account1.getAddress();

      const guardians: string[] = [
        await account2.getAddress(),
        await account3.getAddress(),
      ];

      const salt = new Date().getTime();
      let wallet = await newWallet(
        owner,
        ethers.constants.AddressZero,
        salt,
        guardians
      );
      wallet = await wallet.connect(account2);

      const walletDataBefore = await wallet.wallet();
      expect(walletDataBefore.locked).to.equal(false);
      const tx1 = await wallet.lock();
      const walletDataAfter = await wallet.wallet();
      expect(walletDataAfter.locked).to.equal(true);
    });

    it("unlock wallet with majority's approval(owner required)", async () => {
      [account1, account2, account3] = await ethers.getSigners();
      const owner = await account1.getAddress();
      const guardians: string[] = [
        await account2.getAddress(),
        await account3.getAddress(),
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
      const sig1 = signUnlock(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        owner
      );
      const sig2 = signUnlock(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        guardians[0]
      );

      const sortedSigs = sortSignersAndSignatures(
        [owner, guardians[0]],
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

      const tx = await wallet.unlock(approval);
      const walletDataAfter2 = await wallet.wallet();
      expect(walletDataAfter2.locked).to.equal(false);
    });
  });
});
