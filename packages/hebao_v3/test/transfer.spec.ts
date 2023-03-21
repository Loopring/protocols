import { expect } from "./setup";
import {
  signTransferTokenWA,
  signApproveTokenWA,
} from "./helper/signatureUtils";
import { sign } from "./helper/Signature";
import {
  newWallet,
  getFirstEvent,
  advanceTime,
  getBlockTimestamp,
  timeAlmostEqual,
  sortSignersAndSignatures,
} from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer, Wallet } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { baseFixture, fixture } from "./helper/fixture";
import BN = require("bn.js");

describe("wallet", () => {
  // let account1: Signer;
  let account2: Wallet;
  let guardians: Wallet[];
  // let account3: Signer;
  let owner: string;
  let wallet: Contract;
  let LRC: Contract;
  before(async () => {
    const loadedFixtures = await loadFixture(fixture);
    // [account1, account2, account3] = await ethers.getSigners();

    // owner = await account2.getAddress();
    // wallet = (await newWallet(owner, ethers.constants.AddressZero, 0)).connect(
    // account2
    // );
    account2 = loadedFixtures.accountOwner;
    owner = account2.address;
    wallet = loadedFixtures.account;
    guardians = loadedFixtures.guardians;

    // feed wallet:
    await loadedFixtures.deployer.sendTransaction({
      to: wallet.address,
      value: ethers.utils.parseEther("100"),
    });

    LRC = await (await ethers.getContractFactory("LRC")).deploy();
  });

  describe("transfer token", () => {
    it("owner should be able to transfer eth or ERC20 token of the wallet", async () => {
      const walletEthBalance = await ethers.provider.getBalance(wallet.address);
      expect(walletEthBalance).to.equal(ethers.utils.parseEther("100"));

      const to = "0x" + "33".repeat(20);
      // send ether:
      const tx2 = await wallet.transferToken(
        ethers.constants.AddressZero,
        to,
        ethers.utils.parseEther("10"),
        [],
        false
      );
      const walletEthBalanceAfter = await ethers.provider.getBalance(
        wallet.address
      );
      const toBalance = await ethers.provider.getBalance(to);
      expect(walletEthBalanceAfter).to.equal(ethers.utils.parseEther("90"));
      expect(toBalance).to.equal(ethers.utils.parseEther("10"));

      await LRC.setBalance(wallet.address, ethers.utils.parseEther("1000"));
      await wallet.transferToken(
        LRC.address,
        to,
        ethers.utils.parseEther("200"),
        [],
        false
      );
      const walletLrcBalance = await LRC.balanceOf(wallet.address);
      const toLrcBalance = await LRC.balanceOf(to);
      expect(walletLrcBalance).to.equal(ethers.utils.parseEther("800"));
      expect(toLrcBalance).to.equal(ethers.utils.parseEther("200"));
    });

    it("owner's transfer amount can not exceed quota", async () => {
      const quotaAmount = ethers.utils.parseEther("10");
      await wallet.changeDailyQuota(quotaAmount);
      await advanceTime(3600 * 24 + 1);

      const to = "0x" + "33".repeat(20);
      // send ether:
      try {
        const tx2 = await wallet.transferToken(
          ethers.constants.AddressZero,
          to,
          ethers.utils.parseEther("20"),
          [],
          false
        );
      } catch (err) {
        expect(err.message.includes("QUOTA_EXCEEDED"));
      }
    });

    it("transfer token with approval(owner required)", async () => {
      // const guardians: string[] = [
      // await account1.getAddress(),
      // await account3.getAddress(),
      // ];
      // const salt = new Date().getTime();
      // wallet = await newWallet(
      // owner,
      // ethers.constants.AddressZero,
      // salt,
      // guardians
      // );
      // wallet = await wallet.connect(account2);

      // feed wallet:
      await wallet.changeDailyQuota(ethers.utils.parseEther("10"));
      await advanceTime(3600 * 24 + 1);

      const masterCopy = await wallet.getMasterCopy();
      const validUntil = new Date().getTime() + 1000 * 3600 * 24; // one day
      const toAddr = "0x" + "11".repeat(20);

      // amount can exceed daily quota:
      const amount = ethers.utils.parseEther("20");

      const sig1 = signTransferTokenWA(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        ethers.constants.AddressZero,
        toAddr,
        amount,
        Buffer.from(""),
        owner,
        account2.privateKey.slice(2)
      );
      const sig2 = signTransferTokenWA(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        ethers.constants.AddressZero,
        toAddr,
        amount,
        Buffer.from(""),
        guardians[0].address,
        guardians[0].privateKey.slice(2)
      );

      const sortedSigs = sortSignersAndSignatures(
        [owner, guardians[0].address],
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

      const toBalanceBefore = await ethers.provider.getBalance(toAddr);
      const tx = await wallet.transferTokenWA(
        approval,
        ethers.constants.AddressZero,
        toAddr,
        amount,
        []
      );
      const toBalanceAfter = await ethers.provider.getBalance(toAddr);
      expect(toBalanceAfter.sub(toBalanceBefore)).to.equal(amount);
    });
  });

  describe("approve token", () => {
    it("wallet owner should be able to approve ERC20 token", async () => {
      const to = "0x" + "67".repeat(20);
      await LRC.setBalance(wallet.address, ethers.utils.parseEther("1000"));
      await wallet.approveToken(
        LRC.address,
        to,
        ethers.utils.parseEther("200"),
        false
      );
      const toAllowance = await LRC.allowance(wallet.address, to);
      expect(toAllowance).to.equal(ethers.utils.parseEther("200"));
    });

    it("approve token with approval(owner required)", async () => {
      // const guardians: string[] = [
      // await account1.getAddress(),
      // await account3.getAddress(),
      // ];
      // const salt = new Date().getTime();
      // wallet = await newWallet(
      // owner,
      // ethers.constants.AddressZero,
      // salt,
      // guardians
      // );
      // wallet = await wallet.connect(account2);

      const masterCopy = await wallet.getMasterCopy();
      const validUntil = new Date().getTime() + 1000 * 3600 * 24; // one day
      const toAddr = "0x" + "55".repeat(20);

      // amount can exceed daily quota:
      const amount = ethers.utils.parseEther("1000");

      const sig1 = signApproveTokenWA(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        LRC.address,
        toAddr,
        amount,
        owner,
        account2.privateKey.slice(2)
      );
      const sig2 = signApproveTokenWA(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        LRC.address,
        toAddr,
        amount,
        guardians[0].address,
        guardians[0].privateKey.slice(2)
      );

      const sortedSigs = sortSignersAndSignatures(
        [owner, guardians[0].address],
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

      const tx = await wallet.approveTokenWA(
        approval,
        LRC.address,
        toAddr,
        amount,
        []
      );

      const toAllowance = await LRC.allowance(wallet.address, toAddr);
      expect(toAllowance).to.equal(amount);
    });
  });
});
