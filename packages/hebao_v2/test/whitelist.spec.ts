import { expect } from "./setup";
import { signCreateWallet } from "./helper/signatureUtils";
import { sign } from "./helper/Signature";
import {
  newWallet,
  getFirstEvent,
  advanceTime,
  getBlockTimestamp,
  timeAlmostEqual
} from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet", () => {
  let account1: Signer;

  describe("whitelist", () => {
    it.only("owner should be able to add address to its whitelist", async () => {
      [account1] = await ethers.getSigners();

      const owner = await account1.getAddress();
      const wallet = await newWallet(owner, ethers.constants.AddressZero, 0);

      const whiteListedAddr = "0x" + "11".repeat(20);
      const tx = await wallet.addToWhitelist(whiteListedAddr);

      const effectiveTime = await wallet.getWhitelistEffectiveTime(
        whiteListedAddr
      );
      const now = Math.floor(new Date().getTime() / 1000);

      expect(
        timeAlmostEqual(now + 3600 * 24, effectiveTime.toNumber(), 60 * 10)
      ).to.be.true;
    });
  });
});
