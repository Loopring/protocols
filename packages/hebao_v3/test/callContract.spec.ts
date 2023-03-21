import { expect } from "./setup";
import {
  signCallContractWA,
  signApproveThenCallContractWA,
} from "./helper/signatureUtils";
import { sign } from "./helper/Signature";
import {
  newWallet,
  getContractABI,
  getFirstEvent,
  sortSignersAndSignatures,
} from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { fixture } from "./helper/fixture";
import { SmartWallet, TestTargetContract } from "../typechain-types";

import { Contract, Signer, Wallet } from "ethers";
import BN = require("bn.js");

describe("wallet", () => {
  let account1: Wallet;
  // let account2: Signer;
  // let account3: Signer;
  let owner: string;
  let guardians: Wallet[];
  let wallet: SmartWallet;
  let LRC: Contract;
  let TestContract: TestTargetContract;
  before(async () => {
    const {
      account,
      accountOwner,
      guardians: guardians_,
      deployer,
    } = await loadFixture(fixture);
    // feed wallet:
    wallet = account;
    account1 = accountOwner;
    owner = accountOwner.address;
    guardians = guardians_;
    await deployer.sendTransaction({
      to: wallet.address,
      value: ethers.utils.parseEther("100"),
    });
    LRC = await (await ethers.getContractFactory("LRC")).deploy();
    TestContract = await (
      await ethers.getContractFactory("TestTargetContract")
    ).deploy();
  });

  describe("callContract", () => {
    it("wallet owner should be able to call other contract", async () => {
      const callData = TestContract.interface.encodeFunctionData(
        "functionDefault",
        [10]
      );
      const tx = await wallet.callContract(
        TestContract.address,
        0,
        callData,
        false
      );
      const event = await getFirstEvent(
        TestContract,
        tx.blockNumber,
        "Invoked"
      );
      expect(event.args.sender).to.equal(wallet.address);
    });

    it("call other contract with approval(owner required)", async () => {
      const masterCopy = await wallet.getMasterCopy();
      const validUntil = new Date().getTime() + 1000 * 3600 * 24; // one day
      const callData = TestContract.interface.encodeFunctionData(
        "functionDefault",
        [10]
      );
      // console.log("callData:", callData);

      const sig1 = signCallContractWA(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        TestContract.address,
        new BN(0),
        Buffer.from(callData.slice(2), "hex"),
        owner,
        account1.privateKey.slice(2)
      );
      const sig2 = signCallContractWA(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        TestContract.address,
        new BN(0),
        Buffer.from(callData.slice(2), "hex"),
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

      const tx = await wallet.callContractWA(
        approval,
        TestContract.address,
        0,
        callData
      );
      const event = await getFirstEvent(
        TestContract,
        tx.blockNumber,
        "Invoked"
      );
      expect(event.args.sender).to.equal(wallet.address);
    });
  });

  describe("approveThenCallContract", () => {
    it("approveThenCallContract by owner", async () => {
      const callData = TestContract.interface.encodeFunctionData(
        "functionPayable",
        [10]
      );
      const tx = await wallet.approveThenCallContract(
        LRC.address,
        TestContract.address,
        ethers.utils.parseEther("10000"),
        ethers.utils.parseEther("0.01"),
        callData,
        false
      );
      const event = await getFirstEvent(
        TestContract,
        tx.blockNumber,
        "Invoked"
      );
      expect(event.args.sender).to.equal(wallet.address);
    });

    it("approveThenCallContract with approval(owner required)", async () => {
      const masterCopy = await wallet.getMasterCopy();
      const validUntil = new Date().getTime() + 1000 * 3600 * 24; // one day
      const callData = TestContract.interface.encodeFunctionData(
        "functionPayable",
        [10]
      );
      const amount = ethers.utils.parseEther("10000");
      const value = ethers.utils.parseEther("50");

      const sig1 = signApproveThenCallContractWA(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        LRC.address,
        TestContract.address,
        amount,
        value,
        Buffer.from(callData.slice(2), "hex"),
        owner,
        account1.privateKey.slice(2)
      );
      const sig2 = signApproveThenCallContractWA(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        LRC.address,
        TestContract.address,
        amount,
        value,
        Buffer.from(callData.slice(2), "hex"),
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

      const tx = await wallet.approveThenCallContractWA(
        approval,
        LRC.address,
        TestContract.address,
        amount,
        value,
        callData
      );
      const event = await getFirstEvent(
        TestContract,
        tx.blockNumber,
        "Invoked"
      );
      expect(event.args.sender).to.equal(wallet.address);
    });
  });
});
