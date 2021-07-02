import { expect } from "./setup";
import { signAddToWhitelistWA } from "./helper/signatureUtils";
import {
  newWallet,
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
  let wallet: Contract;

  const whiteListedAddr = "0x" + "11".repeat(20);
  before(async () => {
    [account1] = await ethers.getSigners();

    const owner = await account1.getAddress();
    wallet = await newWallet(owner, ethers.constants.AddressZero, 0);
  });

  describe("whitelist", () => {
    it("owner should be able to add address to its whitelist", async () => {
      const tx = await wallet.addToWhitelist(whiteListedAddr);
      const effectiveTime = await wallet.getWhitelistEffectiveTime(
        whiteListedAddr
      );
      const blockTime = await getBlockTimestamp(tx.blockNumber);
      expect(effectiveTime.toNumber()).to.equal(blockTime + 3600 * 24);
    });

    it("owner should be able to remove its whitelisted address", async () => {
      await wallet.removeFromWhitelist(whiteListedAddr);
      const effectiveTime = await wallet.getWhitelistEffectiveTime(
        whiteListedAddr
      );
      expect(effectiveTime).to.equal(0);
    });

    it("majority(owner required) should be able to whitelist address immediately", async () => {
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

      const masterCopy = await wallet.getMasterCopy();
      const validUntil = new Date().getTime() + 1000 * 3600 * 24; // one day
      const addr = "0x" + "12".repeat(20);
      const sig1 = signAddToWhitelistWA(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        addr,
        owner
      );
      const sig2 = signAddToWhitelistWA(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        addr,
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

      const tx = await wallet.addToWhitelistWA(approval, addr);
      const effectiveTime = await wallet.getWhitelistEffectiveTime(addr);
      const blockTime = await getBlockTimestamp(tx.blockNumber);
      expect(effectiveTime.toNumber()).to.equal(blockTime);
    });
  });
});
