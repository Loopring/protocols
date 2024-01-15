import { ethers } from "hardhat";
import { expect } from "chai";
import { fixture } from "./helper/fixture";
import _ from "lodash";
import { arrayify } from "ethers/lib/utils";
import {
  loadFixture,
  setBalance,
  time,
  takeSnapshot,
} from "@nomicfoundation/hardhat-network-helpers";
import {
  GuardianLib__factory,
  SmartWalletV3__factory,
} from "../typechain-types";
import { getBlockTimestamp, createSmartWallet } from "./helper/utils";
import {
  fillUserOp,
  getUserOpHash,
  fillAndMultiSignForApproveToken,
  fillAndMultiSignForAddGuardian,
} from "./helper/AASigner";
import BN from "bn.js";
import { increase } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time";

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
      blockTime1 + three_days
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
      blockTime + three_days
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

  it("guardian can be smartwallet", async () => {
    const {
      sendUserOp,
      create2,
      entrypoint,
      smartWalletOwner,
      smartWallet,
      guardians,
      walletFactory,
      usdtToken,
      deployer,
      smartWalletImpl,
    } = await loadFixture(fixture);
    const guardianOwner = ethers.Wallet.createRandom().connect(ethers.provider);
    const guardian = await createRandomWallet(guardianOwner, [], walletFactory);
    await smartWallet.addGuardian(guardian.address);
    await time.increase(three_days);

    // use new guardian signature to approve token
    const receiver = deployer.address;
    const tokenAmount = ethers.utils.parseUnits("100", 6);
    const validUntil = 0;
    const signedUserOp = await fillAndMultiSignForApproveToken(
      smartWallet,
      smartWalletOwner,
      0, //nonce
      [
        { signer: smartWalletOwner },
        { signer: guardians[0] },
        {
          signer: guardianOwner,
          smartWalletAddress: guardian.address,
        },
      ],
      create2.address,
      smartWalletImpl.address,
      usdtToken.address,
      receiver,
      tokenAmount,
      entrypoint,
      validUntil
    );
    await sendUserOp(signedUserOp);
    expect(await usdtToken.allowance(smartWallet.address, receiver)).to.eq(
      tokenAmount
    );
  });

  describe("execute tx from entrypoint with nonce", () => {
    it("add and remove guardian test", async () => {
      const { guardians, smartWallet, entrypoint } = await loadFixture(fixture);
      const guardian = ethers.Wallet.createRandom().connect(ethers.provider);
      await smartWallet.addGuardian(guardian.address);
      expect(await smartWallet.isGuardian(guardian.address, true)).to.be.true;
      // during pending period
      expect(await smartWallet.isGuardian(guardian.address, false)).to.be.false;
      await time.increase(three_days);
      expect(await smartWallet.isGuardian(guardian.address, false)).to.be.true;

      // remove
      await smartWallet.removeGuardian(guardian.address);
      await time.increase(three_days);
      expect(await smartWallet.isGuardian(guardian.address, true)).to.be.false;

      //TODO(add test case that remove before pending adding period)
    });
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
        smartWallet,
        smartWalletImpl,
      } = await loadFixture(fixture);

      // add new guardian
      const guardian3 = "0x" + "12".repeat(20);

      const signedUserOp = await fillAndMultiSignForAddGuardian(
        smartWallet,
        smartWalletOwner,
        0, //nonce
        [{ signer: smartWalletOwner }, { signer: guardians[0] }],
        create2.address,
        smartWalletImpl.address,
        guardian3,
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
  describe("smart wallet guardians approval", () => {
    it("add guardian with smart wallet guardian approval", async () => {
      const {
        sendUserOp,
        create2,
        entrypoint,
        walletFactory,
        smartWalletImpl,
      } = await loadFixture(fixture);
      async function createRandomWalletAndFundingIt(
        guardians,
        walletFactory,
        entrypoint
      ) {
        const smartWalletOwner = await ethers.Wallet.createRandom().connect(
          ethers.provider
        );
        const smartWallet = await createRandomWallet(
          smartWalletOwner,
          guardians,
          walletFactory
        );
        await setBalance(
          smartWalletOwner.address,
          ethers.utils.parseEther("100")
        );
        await setBalance(smartWallet.address, ethers.utils.parseEther("100"));
        await entrypoint.depositTo(smartWallet.address, {
          value: ethers.utils.parseEther("100"),
        });
        return { smartWalletOwner, smartWallet };
      }
      const { smartWalletOwner, smartWallet } =
        await createRandomWalletAndFundingIt([], walletFactory, entrypoint);
      const {
        smartWalletOwner: smartGuardianOwner0,
        smartWallet: smartGuardian0,
      } = await createRandomWalletAndFundingIt([], walletFactory, entrypoint);
      const {
        smartWalletOwner: smartGuardianOwner1,
        smartWallet: smartGuardian1,
      } = await createRandomWalletAndFundingIt([], walletFactory, entrypoint);
      const guardianToAdd = await ethers.Wallet.createRandom().connect(
        ethers.provider
      );
      await (await smartWallet.addGuardian(smartGuardian0.address)).wait();
      await (await smartWallet.addGuardian(smartGuardian1.address)).wait();
      await increase(3 * 24 * 60 * 60 + 1); // wait for 3 days;
      const guardiansBefore = await smartWallet.getGuardians(false);
      expect(
        guardiansBefore.some((g) => g.addr === smartGuardian0.address)
      ).to.equal(true); // contains smartGuardian0
      expect(
        guardiansBefore.some((g) => g.addr === smartGuardian1.address)
      ).to.equal(true); // contains smartGuardian1
      expect(
        guardiansBefore.some((g) => g.addr === guardianToAdd.address)
      ).to.equal(false); // not contains guardianToAdd
      const signedUserOp = await fillAndMultiSignForAddGuardian(
        smartWallet,
        smartWalletOwner,
        0, //nonce
        [
          { signer: smartWalletOwner },
          {
            signer: smartGuardianOwner1,
            smartWalletAddress: smartGuardian1.address,
          },
        ],
        create2.address,
        smartWalletImpl.address,
        guardianToAdd.address,
        entrypoint
      );
      await sendUserOp(signedUserOp);
      const guardiansAfter = await smartWallet.getGuardians(false);
      expect(
        guardiansAfter.some((g) => g.addr === guardianToAdd.address)
      ).to.equal(true); // contains guardianToAdd
    });
  });
});
