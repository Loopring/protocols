import { expect } from "./setup";
import { signCreateWallet } from "./helper/signatureUtils";
import { sign } from "./helper/Signature";
import { newWallet, getFirstEvent, advanceTime } from "./commons";
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

      // expect(quotaInfo.pendingQuota.toString(10)).to.equal(quotaAmount);
    });
  });
});
