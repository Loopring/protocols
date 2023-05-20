import { ethers } from "ethers";
import { expect } from "chai";
import { fixture } from "./helper/fixture";
import {
  loadFixture,
  setBalance,
} from "@nomicfoundation/hardhat-network-helpers";
import {
  GuardianLib__factory,
  SmartWalletV3__factory,
} from "../typechain-types";
import { getBlockTimestamp, createSmartWallet } from "./helper/utils";
import { fillUserOp, fillAndMultiSign } from "./helper/AASigner";
import BN from "bn.js";

describe("guardian test", () => {
  const three_days = 3 * 3600 * 24;
  const guardianInterfact = GuardianLib__factory.createInterface();
  async function createRandomWallet(
    smartWalletOwner,
    guardians,
    walletFactory
  ) {
    const salt = ethers.utils.formatBytes32String("0x1");
    await createSmartWallet(
      smartWalletOwner,
      guardians.map((g) => g.address.toLowerCase()).sort(),
      walletFactory,
      salt
    );

    const smartWalletAddr = await walletFactory.computeWalletAddress(
      smartWalletOwner.address,
      salt
    );
    const smartWallet = SmartWalletV3__factory.connect(
      smartWalletAddr,
      smartWalletOwner
    );
    return smartWallet;
  }
  it("basic testcase", async () => {
    const { smartWallet } = await loadFixture(fixture);
    const guardian1 = "0x" + "12".repeat(20);
    const tx1 = await smartWallet.addGuardian(guardian1);
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
    expect(addEvent.effectiveTime.toNumber()).to.equal(blockTime + three_days);
  });

  it("first two guardian additions should be effective immediately", async () => {
    const guardian1 = "0x" + "12".repeat(20);
    const { smartWalletOwner, guardians, walletFactory } = await loadFixture(
      fixture
    );
    const wallet = await createRandomWallet(
      smartWalletOwner,
      [],
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
    expect(addEvent1.effectiveTime.toNumber()).to.equal(blockTime1 + 1);

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
    expect(addEvent2.guardian).to.equal(guardian2);
    const blockTime2 = await getBlockTimestamp(tx2.blockNumber);
    // second guardian should be effective immediately:
    expect(addEvent2.effectiveTime.toNumber()).to.equal(blockTime2 + 1);
  });

  it("the third guardian addition will be effective in 3 days", async () => {
    const guardian3 = "0x" + "33".repeat(20);
    const { smartWallet: wallet } = await loadFixture(fixture);
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
    const { smartWallet: wallet, guardians } = await loadFixture(fixture);
    const guardian1 = guardians[0].address;
    // await wallet.addGuardian(guardian1);
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
    const { smartWalletOwner, guardians, walletFactory } = await loadFixture(
      fixture
    );
    await expect(
      createRandomWallet(
        smartWalletOwner,
        [smartWalletOwner, guardians[0]],
        walletFactory
      )
    ).to.revertedWith("GUARDIAN_CAN_NOT_BE_OWNER");

    const wallet = await createRandomWallet(
      smartWalletOwner,
      [guardians[0]],
      walletFactory
    );

    await expect(wallet.addGuardian(smartWalletOwner.address)).to.rejectedWith(
      "GUARDIAN_CAN_NOT_BE_OWNER"
    );
  });
  describe("execute tx from entrypoint with nonce", () => {
    it("add guardian test", async () => {});
    it("remove guardian test", async () => {});
  });
  describe("execute tx with approval(skip nonce)", () => {
    it("add guardian test", async () => {
      const {
        sendUserOp,
        smartWalletOwner,
        guardians,
        smartWallet: wallet,
        create2,
        entrypoint,
      } = await loadFixture(fixture);

      const guardian3 = "0x" + "12".repeat(20);
      const tx = await wallet.populateTransaction.addGuardianWA(guardian3);
      const partialUserOp = {
        sender: wallet.address,
        nonce: 0,
        callData: tx.data,
      };
      const signedUserOp = await fillAndMultiSign(
        partialUserOp,
        [smartWalletOwner, guardians[0]],
        create2.address,
        entrypoint
      );

      const recipt = await sendUserOp(signedUserOp);
      const eventData = recipt.events[0].data;
      const eventTopics = recipt.events[0].topics;
      const addEvent = guardianInterfact.decodeEventLog(
        "GuardianAdded(address,uint256)",
        eventData,
        eventTopics
      );

      expect(addEvent.guardian).to.equal(guardian3);
      const blockTime = await getBlockTimestamp(recipt.blockNumber);
      expect(addEvent.effectiveTime.toNumber()).to.equal(blockTime);
    });
    it("remove guardian test", async () => {});
  });
});
