import { expect } from "./setup";
import { signAddGuardianWA } from "./helper/signatureUtils";
import { sign } from "./helper/Signature";
import {
  newWallet,
  getFirstEvent,
  getBlockTimestamp,
  sortSignersAndSignatures,
} from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");
import { Wallet } from "ethers";
import { baseFixture } from "./helper/fixture";
import {
  createRandomAccount,
  createRandomWalletConfig,
  createAccount,
} from "./helper/utils";
import {
  GuardianLib__factory,
  SmartWallet,
  EntryPoint,
  WalletFactory,
} from "../typechain-types";

import { Contract, Signer } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import BN = require("bn.js");

describe("wallet", () => {
  let accountOwner: Wallet;
  let entrypoint: EntryPoint;
  let walletFactory: WalletFactory;
  const guardianInterfact = GuardianLib__factory.createInterface();

  before(async () => {
    const loadedFixtures = await loadFixture(baseFixture);
    accountOwner = loadedFixtures.accountOwner;
    entrypoint = loadedFixtures.entrypoint;
    walletFactory = loadedFixtures.walletFactory;
  });

  describe("guardian", () => {
    it("owner should be able to add guardians", async () => {
      const guardian1 = "0x" + "12".repeat(20);

      const walletConfig = await createRandomWalletConfig(accountOwner.address);
      const { proxy: wallet } = await createAccount(
        accountOwner,
        // use empty guardians list instead
        { ...walletConfig, guardians: [] },
        entrypoint.address,
        walletFactory
      );
      const tx1 = await wallet.addGuardian(guardian1);
      const receipt1 = await tx1.wait();
      // console.log("receipt1:", receipt1);

      const eventData = receipt1.events[0].data;
      const eventTopics = receipt1.events[0].topics;
      const addEvent = guardianInterfact.decodeEventLog(
        "GuardianAdded(address,uint256)",
        eventData,
        eventTopics
      );
      // console.log("addEvent:", addEvent.guardian);
      expect(addEvent.guardian).to.equal(guardian1);
      const blockTime = await getBlockTimestamp(tx1.blockNumber);
      // first guardian should be effective immediately:
      expect(addEvent.effectiveTime.toNumber()).to.equal(blockTime);
    });

    it("first two guardian additions should be effective immediately", async () => {
      const guardian1 = "0x" + "12".repeat(20);
      const walletConfig = await createRandomWalletConfig(accountOwner.address);
      const { proxy: wallet } = await createAccount(
        accountOwner,
        // use empty guardians list instead
        { ...walletConfig, guardians: [] },
        entrypoint.address,
        walletFactory
      );
      const tx1 = await wallet.addGuardian(guardian1);
      const receipt1 = await tx1.wait();

      // console.log("GuardianLib:", GuardianLib);
      const eventData1 = receipt1.events[0].data;
      const eventTopics1 = receipt1.events[0].topics;
      const addEvent1 = guardianInterfact.decodeEventLog(
        "GuardianAdded(address,uint256)",
        eventData1,
        eventTopics1
      );
      // console.log("addEvent:", addEvent.guardian);
      expect(addEvent1.guardian).to.equal(guardian1);
      const blockTime1 = await getBlockTimestamp(tx1.blockNumber);
      // first guardian should be effective immediately:
      expect(addEvent1.effectiveTime.toNumber()).to.equal(blockTime1);

      const guardian2 = "0x" + "22".repeat(20);
      const tx2 = await wallet.addGuardian(guardian2);
      const receipt2 = await tx2.wait();

      // console.log("GuardianLib:", GuardianLib);
      const eventData2 = receipt2.events[0].data;
      const eventTopics2 = receipt2.events[0].topics;
      const addEvent2 = guardianInterfact.decodeEventLog(
        "GuardianAdded(address,uint256)",
        eventData2,
        eventTopics2
      );
      // console.log("addEvent:", addEvent.guardian);
      expect(addEvent2.guardian).to.equal(guardian2);
      const blockTime2 = await getBlockTimestamp(tx2.blockNumber);
      // second guardian should be effective immediately:
      expect(addEvent2.effectiveTime.toNumber()).to.equal(blockTime2);
    });

    it("the third guardian addition will be effective in 3 days", async () => {
      const guardian3 = "0x" + "33".repeat(20);
      const walletConfig = await createRandomWalletConfig(accountOwner.address);
      const { proxy: wallet } = await createAccount(
        accountOwner,
        // use empty guardians list instead
        walletConfig,
        entrypoint.address,
        walletFactory
      );
      const tx1 = await wallet.addGuardian(guardian3);
      const receipt1 = await tx1.wait();

      // console.log("GuardianLib:", GuardianLib);
      const eventData1 = receipt1.events[0].data;
      const eventTopics1 = receipt1.events[0].topics;
      const addEvent1 = guardianInterfact.decodeEventLog(
        "GuardianAdded(address,uint256)",
        eventData1,
        eventTopics1
      );
      // console.log("addEvent:", addEvent.guardian);
      expect(addEvent1.guardian).to.equal(guardian3);
      const blockTime1 = await getBlockTimestamp(tx1.blockNumber);
      // third guardian will be effective in 3 days.
      expect(addEvent1.effectiveTime.toNumber()).to.equal(
        blockTime1 + 3600 * 24 * 3
      );
    });

    it("guardian deletion will be effective in 3 days", async () => {
      const guardian1 = "0x" + "12".repeat(20);
      const walletConfig = await createRandomWalletConfig(accountOwner.address);
      const { proxy: wallet } = await createAccount(
        accountOwner,
        // use empty guardians list instead
        { ...walletConfig, guardians: [] },
        entrypoint.address,
        walletFactory
      );
      await wallet.addGuardian(guardian1);
      const tx1 = await wallet.removeGuardian(guardian1);
      const receipt1 = await tx1.wait();

      const eventData = receipt1.events[0].data;
      const eventTopics = receipt1.events[0].topics;
      const removeEvent = guardianInterfact.decodeEventLog(
        "GuardianRemoved(address,uint256)",
        eventData,
        eventTopics
      );

      expect(removeEvent.guardian).to.equal(guardian1);
      const blockTime = await getBlockTimestamp(tx1.blockNumber);
      expect(removeEvent.effectiveTime.toNumber()).to.equal(
        blockTime + 3 * 24 * 3600
      );
    });

    it("guardian can not be owner", async () => {
      const guardian1 = await ethers.Wallet.createRandom();
      // const guardian1 = await account2.getAddress();
      const walletConfig = await createRandomWalletConfig(accountOwner.address);
      try {
        const { proxy: wallet } = await createAccount(
          accountOwner,
          {
            ...walletConfig,
            guardians: [accountOwner, guardian1]
              .map((g) => g.address.toLowerCase())
              .sort(),
          },
          entrypoint.address,
          walletFactory
        );
      } catch (err) {
        expect(err.message.includes("GUARDIAN_CAN_NOT_BE_OWNER"));
      }
      const { proxy: wallet } = await createAccount(
        accountOwner,
        { ...walletConfig, guardians: [guardian1.address.toLowerCase()] },
        entrypoint.address,
        walletFactory
      );

      try {
        await wallet.addGuardian(accountOwner.address);
      } catch (err) {
        expect(err.message.includes("GUARDIAN_CAN_NOT_BE_OWNER"));
      }
    });

    it("add guardian with approval", async () => {
      const guardians = [];
      for (let i = 0; i < 2; i++) {
        guardians.push(await ethers.Wallet.createRandom());
      }
      const walletConfig = await createRandomWalletConfig(accountOwner.address);
      const { proxy: wallet } = await createAccount(
        accountOwner,
        {
          ...walletConfig,
          guardians: guardians.map((g) => g.address.toLowerCase()).sort(),
        },
        entrypoint.address,
        walletFactory
      );
      const masterCopy = await wallet.getMasterCopy();

      const guardian3 = "0x" + "12".repeat(20);
      const validUntil = 1999999999;

      const sig1 = signAddGuardianWA(
        masterCopy,
        wallet.address,
        guardian3,
        new BN(validUntil),
        accountOwner.address,
        accountOwner.privateKey.slice(2)
      );

      const sig2 = signAddGuardianWA(
        masterCopy,
        wallet.address,
        guardian3,
        new BN(validUntil),
        guardians[0].address,
        guardians[0].privateKey.slice(2)
      );

      const sortedSigs = sortSignersAndSignatures(
        [accountOwner.address, guardians[0].address],
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

      const tx1 = await wallet.addGuardianWA(approval, guardian3);
      const receipt1 = await tx1.wait();

      const eventData = receipt1.events[0].data;
      const eventTopics = receipt1.events[0].topics;
      const addEvent = guardianInterfact.decodeEventLog(
        "GuardianAdded(address,uint256)",
        eventData,
        eventTopics
      );

      expect(addEvent.guardian).to.equal(guardian3);
      const blockTime = await getBlockTimestamp(tx1.blockNumber);
      expect(addEvent.effectiveTime.toNumber()).to.equal(blockTime);
    });
  });
});
