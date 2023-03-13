import { expect } from "./setup";
import { signCreateWallet } from "./helper/signatureUtils";
import { sign } from "./helper/Signature";
import { newWallet, getFirstEvent, getBlockTimestamp } from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet", () => {
  let account1: Signer;
  let account2: Signer;
  let account3: Signer;

  let wallet: any;

  before(async () => {
    [account1, account2, account3] = await ethers.getSigners();
    const owner = await account1.getAddress();
    const guardians = ["0x" + "11".repeat(20)];
    wallet = await newWallet(owner, ethers.constants.AddressZero, 0, guardians);

    const quotaAmount = ethers.utils.parseEther("10");
    await wallet.changeDailyQuota(quotaAmount);
    // const quotaInfo = (await wallet.wallet())["quota"];
  });

  describe("read methods", () => {
    it("quota", async () => {
      const walletData = await wallet.wallet();
      // console.log("walletData:", walletData);
      const quotaInfo = walletData["quota"];
      // console.log("quota:", quotaInfo);
    });

    it("guardians", async () => {
      const guardians = await wallet.getGuardians(true);
      // console.log("guardians:", guardians);
    });

    it("isWhitelisted", async () => {
      const isWhitelisted = await wallet.isWhitelisted("0x" + "22".repeat(20));
      // console.log("isWhitelisted:", isWhitelisted);
    });

    it("getNonce", async () => {
      const walletData = await wallet.wallet();
      const nonce = walletData["nonce"];
      // console.log("nonce:", nonce);
    });
  });
});
