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
  let account2: Signer;
  let account3: Signer;

  describe("wallet", () => {
    it("owner should be able to add a guardian", async () => {
      [account1, account2, account3] = await ethers.getSigners();

      const owner = await account1.getAddress();
      const wallet = await newWallet(owner, ethers.constants.AddressZero, 0);
      const guardian = "0x" + "12".repeat(20);
      const tx = await wallet.addGuardian(guardian);

      // check isGuardian:
      const isGuardian = await wallet.isGuardian(guardian, false);
      console.log("isGuardian:", isGuardian);

      // get guardianAdded event:
    });
  });
});
