import { expect } from "./setup";
import { signCreateWallet } from "./helper/signatureUtils";
import { sign, sign2 } from "./helper/Signature";
import { newWallet } from "./commons";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { fixture } from "./helper/fixture";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet lock", () => {
  let account1: Signer;

  describe("wallet", () => {
    it("should be able to verify erc1271 signature", async () => {
      const { account: wallet, accountOwner } = await loadFixture(fixture);

      const owner = accountOwner.address;

      const hash = "12".repeat(32);
      const fakeHashBuf = Buffer.from(hash, "hex");
      const signature = sign2(
        owner,
        accountOwner.privateKey.slice(2),
        fakeHashBuf
      );

      const retValue = await wallet.isValidSignature("0x" + hash, signature);
      const erc1271_magic_value = "0x1626ba7e";
      expect(retValue).to.equal(erc1271_magic_value);
    });

    it("should not be able to verify erc1271 signature when wallet is locked", async () => {
      const { account: wallet, accountOwner } = await loadFixture(fixture);

      const owner = accountOwner.address;

      const hash = "12".repeat(32);
      const fakeHashBuf = Buffer.from(hash, "hex");
      const signature = sign2(
        owner,
        accountOwner.privateKey.slice(2),
        fakeHashBuf
      );

      const retValue = await wallet.isValidSignature("0x" + hash, signature);
      const erc1271_magic_value = "0x1626ba7e";
      expect(retValue).to.equal(erc1271_magic_value);

      await wallet.lock();
      const retValue2 = await wallet.isValidSignature("0x" + hash, signature);
      expect(retValue2).to.equal("0x00000000");
    });
  });
});
