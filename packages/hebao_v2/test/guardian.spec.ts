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
  let guardianInterfact: any;

  before(async () => {
    [account1, account2, account3] = await ethers.getSigners();
    const GuardianLib = await ethers.getContractFactory("GuardianLib");
    guardianInterfact = GuardianLib.interface;
  });

  describe("guardian", () => {
    it("owner should be able to add guardians", async () => {
      const owner = await account1.getAddress();
      const wallet = await newWallet(owner, ethers.constants.AddressZero, 0);

      const guardian1 = "0x" + "12".repeat(20);
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
      const owner = await account1.getAddress();
      const wallet = await newWallet(owner, ethers.constants.AddressZero, 1);

      const guardian1 = "0x" + "12".repeat(20);
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

    it.only("the third guardian addition will be effective in 3 days", async () => {
      const owner = await account1.getAddress();
      const guardian1 = "0x" + "11".repeat(20);
      const guardian2 = "0x" + "22".repeat(20);
      const wallet = await newWallet(owner, ethers.constants.AddressZero, 1, [
        guardian1,
        guardian2
      ]);

      const guardian3 = "0x" + "33".repeat(20);
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
  });
});
