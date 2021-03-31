import { expect } from "./setup";
import { signCreateWallet } from "./helper/signatureUtils";
import { sign } from "./helper/Signature";
import {
  newWallet,
  getFirstEvent,
  advanceTime,
  getBlockTimestamp
} from "./commons";
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

      // console.log("quotaInfo:", quotaInfo);
      const blockTime = await getBlockTimestamp(tx.blockNumber);
      // console.log("blockTime:", blockTime);
      expect(quotaInfo.pendingQuota.toString()).to.equal(quotaAmount);
      expect(quotaInfo.pendingUntil.toString()).to.equal(
        blockTime + 3600 * 24 + ""
      );
    });
  });
});
