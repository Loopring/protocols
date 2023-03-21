import { expect } from "./setup";
import { signRecover } from "./helper/signatureUtils";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { sign } from "./helper/Signature";
import { parseEther, arrayify, hexConcat, hexlify } from "ethers/lib/utils";
import {
  createAccount,
  createAccountOwner,
  createRandomWalletConfig,
} from "./helper/utils";
import {
  newWallet,
  getFirstEvent,
  getBlockTimestamp,
  sortSignersAndSignatures,
  deployLibs,
} from "./commons";
import { RecoverLib__factory, GuardianLib__factory } from "../typechain-types";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet", () => {
  let recoverInterface = RecoverLib__factory.createInterface();
  let guardianInterface = GuardianLib__factory.createInterface();

  async function fixture() {
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const blankOwner = signers[1];
    const paymasterOwner = signers[2];
    const libraries = await deployLibs();
    const entrypoint = await (
      await ethers.getContractFactory("EntryPoint")
    ).deploy();
    const priceOracle = await (
      await ethers.getContractFactory("ChainlinkPriceOracle")
    ).deploy(entrypoint.address);

    const walletFactory = await (
      await ethers.getContractFactory("WalletFactory", { libraries })
    ).deploy(priceOracle.address, entrypoint.address, blankOwner.address);
    const paymaster = await (
      await ethers.getContractFactory("VerifyingPaymaster")
    ).deploy(entrypoint.address, paymasterOwner.address);

    const accountOwner = await signers[3];
    const guardians = [];
    for (let i = 0; i < 2; i++) {
      guardians.push(await ethers.Wallet.createRandom());
    }
    const walletConfig = await createRandomWalletConfig(
      accountOwner.address,
      undefined,
      guardians
    );

    await paymaster.addStake(1, { value: parseEther("2") });
    await entrypoint.depositTo(paymaster.address, { value: parseEther("1") });

    const { proxy: account } = await createAccount(
      accountOwner,
      walletConfig,
      entrypoint.address,
      walletFactory
    );

    await deployer.sendTransaction({
      to: accountOwner.address,
      value: parseEther("2"),
    });

    return {
      entrypoint,
      paymaster,
      paymasterOwner,
      accountOwner,
      deployer,
      account,
      guardians,
      walletFactory,
    };
  }

  describe("recover", () => {
    it("majority guardians should be able to recover a wallet", async () => {
      const {
        walletFactory,
        entrypoint,
        deployer,
        account: wallet,
        accountOwner,
        guardians,
      } = await loadFixture(fixture);
      const newOwner = await createAccountOwner();
      const validUntil = 9999999999;
      const guardian1 = guardians[0];
      const guardian2 = guardians[1];
      const masterCopy = await wallet.getMasterCopy();
      const sig1 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner.address,
        [],
        guardian1.address,
        guardian1.privateKey.slice(2)
      );
      const sig1Bs = Buffer.from(sig1.txSignature.slice(2), "hex");

      const sig2 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner.address,
        [],
        guardian2.address,
        guardian2.privateKey.slice(2)
      );
      const sig2Bs = Buffer.from(sig2.txSignature.slice(2), "hex");

      const sortedSigs = sortSignersAndSignatures(
        [guardian1.address, guardian2.address],
        [sig1Bs, sig2Bs]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: wallet.address,
      };

      const tx = await wallet.recover(approval, newOwner.address, []);
      const receipt = await tx.wait();
      const recoverEventData = receipt.events[1].data;
      const recoverEventTopics = receipt.events[1].topics;
      const recoverEvent = recoverInterface.decodeEventLog(
        "Recovered(address)",
        recoverEventData,
        recoverEventTopics
      );
      expect(recoverEvent.newOwner).to.equal(newOwner.address);

      const newOwnerInContract = (await wallet.wallet()).owner;
      expect(newOwnerInContract).to.equal(newOwner.address);
    });

    it("majority guardians should be able to recover a wallet", async () => {
      const {
        walletFactory,
        entrypoint,
        deployer,
        account: wallet,
        accountOwner,
        guardians,
      } = await loadFixture(fixture);
      const newOwner = await createAccountOwner();
      const validUntil = 9999999999;
      const guardian1 = guardians[0];
      const guardian2 = guardians[1];

      const masterCopy = await wallet.getMasterCopy();

      const sig1 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner.address,
        [],
        guardian1.address,
        guardian1.privateKey.slice(2)
      );
      const sig1Bs = Buffer.from(sig1.txSignature.slice(2), "hex");

      const sig2 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner.address,
        [],
        guardian2.address,
        guardian2.privateKey.slice(2)
      );
      const sig2Bs = Buffer.from(sig2.txSignature.slice(2), "hex");

      const sortedSigs = sortSignersAndSignatures(
        [guardian1.address, guardian2.address],
        [sig1Bs, sig2Bs]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: wallet.address,
      };

      const tx = await wallet.recover(approval, newOwner.address, []);
      // console.log("tx:", tx);
      const receipt = await tx.wait();
      const recoverEventData = receipt.events[1].data;
      const recoverEventTopics = receipt.events[1].topics;
      const recoverEvent = recoverInterface.decodeEventLog(
        "Recovered(address)",
        recoverEventData,
        recoverEventTopics
      );
      // console.log("recoverEvent:", recoverEvent);
      expect(recoverEvent.newOwner).to.equal(newOwner.address);

      const newOwnerInContract = (await wallet.wallet()).owner;
      expect(newOwnerInContract).to.equal(newOwner.address);
    });

    it("[hebaov2.1] signatures without signature type should be able to be verified", async () => {
      const {
        walletFactory,
        entrypoint,
        deployer,
        account: wallet,
        accountOwner,
        guardians,
      } = await loadFixture(fixture);
      const newOwner = await createAccountOwner().address;
      // const owner = await account1.getAddress();
      // const newOwner = await account2.getAddress();
      const validUntil = 9999999999;
      const guardian1 = guardians[0];
      const guardian2 = guardians[1];

      // const wallet = await newWallet(owner, ethers.constants.AddressZero, 0, [
      // guardian1.address,
      // guardian2.address,
      // ]);
      const masterCopy = await wallet.getMasterCopy();

      // console.log("guardian1.privateKey:", guardian1.privateKey);

      const sig1 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner,
        [],
        guardian1.address,
        guardian1.privateKey.slice(2)
      );
      const sig1Bs = Buffer.from(sig1.txSignature.slice(2), "hex");

      const sig2 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner,
        [],
        guardian2.address,
        guardian2.privateKey.slice(2)
      );
      const sig2Bs = Buffer.from(sig2.txSignature.slice(2), "hex");

      const sig1BsWithoutType = sig1Bs.slice(0, sig1Bs.length - 1);
      const sig2BsWithoutType = sig2Bs.slice(0, sig2Bs.length - 1);
      const sortedSigs = sortSignersAndSignatures(
        [guardian1.address, guardian2.address],
        [sig1BsWithoutType, sig2BsWithoutType]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: wallet.address,
      };

      const tx = await wallet.recover(approval, newOwner, []);
      // console.log("tx:", tx);
      const receipt = await tx.wait();
      const recoverEventData = receipt.events[1].data;
      const recoverEventTopics = receipt.events[1].topics;
      const recoverEvent = recoverInterface.decodeEventLog(
        "Recovered(address)",
        recoverEventData,
        recoverEventTopics
      );
      // console.log("recoverEvent:", recoverEvent);
      expect(recoverEvent.newOwner).to.equal(newOwner);

      const newOwnerInContract = (await wallet.wallet()).owner;
      expect(newOwnerInContract).to.equal(newOwner);
    });

    it("should be able to reset guardians when recovering a wallet", async () => {
      const {
        walletFactory,
        entrypoint,
        deployer,
        account: wallet,
        accountOwner,
        guardians,
      } = await loadFixture(fixture);
      const newOwner = await createAccountOwner().address;
      const validUntil = 9999999999;
      const guardian1 = guardians[0];
      const guardian2 = guardians[1];

      const masterCopy = await wallet.getMasterCopy();

      // console.log("guardian1.privateKey:", guardian1.privateKey);
      const newGuardians = ["0x" + "11".repeat(20), "0x" + "22".repeat(20)];
      const sig1 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner,
        newGuardians,
        guardian1.address,
        guardian1.privateKey.slice(2)
      );
      const sig1Bs = Buffer.from(sig1.txSignature.slice(2), "hex");

      const sig2 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner,
        newGuardians,
        guardian2.address,
        guardian2.privateKey.slice(2)
      );
      const sig2Bs = Buffer.from(sig2.txSignature.slice(2), "hex");

      const sortedSigs = sortSignersAndSignatures(
        [guardian1.address, guardian2.address],
        [sig1Bs, sig2Bs]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: wallet.address,
      };

      const tx = await wallet.recover(approval, newOwner, newGuardians);
      const receipt = await tx.wait();
      // console.log("receipt:", receipt);
      const addEvent1 = guardianInterface.decodeEventLog(
        "GuardianAdded(address,uint256)",
        receipt.events[1].data,
        receipt.events[1].topics
      );
      expect(addEvent1.guardian).to.equal(newGuardians[0]);

      const addEvent2 = guardianInterface.decodeEventLog(
        "GuardianAdded(address,uint256)",
        receipt.events[2].data,
        receipt.events[2].topics
      );
      expect(addEvent2.guardian).to.equal(newGuardians[1]);
    });

    it("recover with duplicated guardians", async () => {
      const {
        walletFactory,
        entrypoint,
        deployer,
        account: wallet,
        accountOwner,
        guardians,
      } = await loadFixture(fixture);
      const newOwner = await createAccountOwner().address;
      const validUntil = 9999999999;
      const guardian1 = guardians[0];
      const guardian2 = guardians[1];

      const masterCopy = await wallet.getMasterCopy();

      // console.log("guardian1.privateKey:", guardian1.privateKey);
      const newGuardians = [
        "0x" + "11".repeat(20),
        "0x" + "11".repeat(20),
        "0x" + "11".repeat(20),
      ];
      const sig1 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner,
        newGuardians,
        guardian1.address,
        guardian1.privateKey.slice(2)
      );
      const sig1Bs = Buffer.from(sig1.txSignature.slice(2), "hex");

      const sig2 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner,
        newGuardians,
        guardian2.address,
        guardian2.privateKey.slice(2)
      );
      const sig2Bs = Buffer.from(sig2.txSignature.slice(2), "hex");

      const sortedSigs = sortSignersAndSignatures(
        [guardian1.address, guardian2.address],
        [sig1Bs, sig2Bs]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: wallet.address,
      };

      try {
        const tx = await wallet.recover(approval, newOwner, newGuardians);
      } catch (err) {
        // console.log(err.message);
        expect(err.message.includes("INVALID_ORDERING"));
      }
    });
  });
});
