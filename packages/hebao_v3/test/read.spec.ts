import { expect } from "./setup";
import { signCreateWallet } from "./helper/signatureUtils";
import { sign } from "./helper/Signature";
import { newWallet, getFirstEvent, getBlockTimestamp } from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");
import { baseFixture } from "./helper/fixture";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { createRandomWalletConfig, createAccount } from "./helper/utils";
import { SmartWallet } from "../typechain-types";

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet", () => {
  let wallet: SmartWallet;

  before(async () => {
    const { accountOwner, entrypoint, walletFactory } = await loadFixture(
      baseFixture
    );
    const guardians = ["0x" + "11".repeat(20)];
    const walletConfig = await createRandomWalletConfig(accountOwner.address);
    const { proxy } = await createAccount(
      accountOwner,
      { ...walletConfig, guardians },
      entrypoint.address,
      walletFactory
    );
    wallet = proxy;
    const quotaAmount = ethers.utils.parseEther("10");
    await wallet.changeDailyQuota(quotaAmount);
  });

  describe("read methods", () => {
    it("quota", async () => {
      const walletData = await wallet.wallet();
      const quotaInfo = walletData["quota"];
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
      expect(nonce).to.eq(0);
    });
  });
});
