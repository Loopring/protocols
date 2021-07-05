import { expect } from "./setup";
import { signCreateWallet } from "./helper/signatureUtils";
import { sign } from "./helper/Signature";
import { newWallet } from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet lock", () => {
  let account1: Signer;

  describe("wallet", () => {
    it("should be able to verify erc1271 signature", async () => {
      [account1] = await ethers.getSigners();

      const owner = await account1.getAddress();
      const wallet = await newWallet(owner, ethers.constants.AddressZero, 0);
      // console.log("wallet:", wallet);

      const hash = "12".repeat(32);
      const fakeHashBuf = Buffer.from(hash, "hex");
      const signature = sign(owner, fakeHashBuf);
      // console.log("signature:", signature);

      const retValue = await wallet.isValidSignature("0x" + hash, signature);
      // console.log("isValid:", isValid);
      const erc1271_magic_value = "0x1626ba7e";
      expect(retValue).to.equal(erc1271_magic_value);
    });

    it("should not be able to verify erc1271 signature when wallet is locked", async () => {
      [account1] = await ethers.getSigners();

      const owner = await account1.getAddress();
      const wallet = await newWallet(owner, ethers.constants.AddressZero, 0);

      const hash = "12".repeat(32);
      const fakeHashBuf = Buffer.from(hash, "hex");
      const signature = sign(owner, fakeHashBuf);

      const retValue = await wallet.isValidSignature("0x" + hash, signature);
      const erc1271_magic_value = "0x1626ba7e";
      expect(retValue).to.equal(erc1271_magic_value);

      await wallet.lock();
      const retValue2 = await wallet.isValidSignature("0x" + hash, signature);
      expect(retValue2).to.equal("0x00000000");
    });
  });
});
