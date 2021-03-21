import { expect } from "./setup";
import { signCreateWallet } from "./helper/signatureUtils";
import { sign } from "./helper/Signature";
import { newWallet, getFirstEvent, advanceTime } from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet lock", () => {
  let account1: Signer;
  let account2: Signer;
  let account3: Signer;

  async function getBlockTime() {}

  describe("wallet", () => {
    it("owner should be able to add a guardian", async () => {
      [account1, account2, account3] = await ethers.getSigners();

      const owner = await account1.getAddress();
      const wallet = await newWallet(owner, ethers.constants.AddressZero, 0);
      const guardian = "0x" + "12".repeat(20);
      const tx = await wallet.addGuardian(guardian);

      // check isGuardian, first guardian should be added immediately.
      const isGuardian = await wallet.isGuardian(guardian, false);
      expect(isGuardian).to.be.true;

      // get guardianAdded event:
      const addEvent = await getFirstEvent(
        wallet,
        tx.blockNumber,
        "GuardianAdded"
      );
      // console.log("addEvent:", addEvent);
      expect(addEvent.args.guardian).to.equal(guardian);
    });

    it.only("owner should be able to remove a guardian", async () => {
      [account1, account2, account3] = await ethers.getSigners();

      const owner = await account1.getAddress();
      const wallet = await newWallet(owner, ethers.constants.AddressZero, 0);
      const guardian = "0x" + "12".repeat(20);
      const tx = await wallet.addGuardian(guardian);

      // check isGuardian, first guardian should be added immediately.
      const isGuardian = await wallet.isGuardian(guardian, false);
      expect(isGuardian).to.be.true;

      const tx2 = await wallet.removeGuardian(guardian);
      // console.log("tx2", tx2);
      // pending deleting, should still be guardian:
      const isGuardian2 = await wallet.isGuardian(guardian, false);
      expect(isGuardian2).to.be.true;

      const removeEvent = await getFirstEvent(
        wallet,
        tx2.blockNumber,
        "GuardianRemoved"
      );
      expect(removeEvent.args.guardian).to.equal(guardian);

      // const provider = ethers.providers.getDefaultProvider();
      // const blockTime = (await provider.getBlock(tx2.blockNumber)).timestamp;
      // expect(removeEvent.args.effectiveTime).to.equal(blockTime + 3600 * 24 * 3);
    });
  });
});
