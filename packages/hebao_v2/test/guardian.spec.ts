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

  describe("guardian", () => {
    it.only("owner should be able to add guardians", async () => {
      [account1, account2, account3] = await ethers.getSigners();

      const owner = await account1.getAddress();
      const wallet = await newWallet(owner, ethers.constants.AddressZero, 0);

      const guardian1 = "0x" + "12".repeat(20);
      const tx1 = await wallet.addGuardian(guardian1);
      const receipt1 = await tx1.wait();
      // console.log("receipt1:", receipt1);

      const GuardianLib = await ethers.getContractFactory("GuardianLib");
      // console.log("GuardianLib:", GuardianLib);
      const guardianInterfact = GuardianLib.interface;
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
  });
});
