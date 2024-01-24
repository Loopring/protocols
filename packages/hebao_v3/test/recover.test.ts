import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { Wallet } from "ethers";
import { fixture } from "./helper/fixture";
import _ from "lodash";
import {
  PaymasterOption,
  evInfo,
  evRevertInfo,
  sortSignersAndSignatures,
  getErrorMessage,
} from "./helper/utils";
import {
  fillUserOp,
  getUserOpHash,
  fillAndMultiSign,
  fillAndMultiSignForRecover,
} from "./helper/AASigner";
import BN from "bn.js";

describe("recover test", () => {
  it("recover success", async () => {
    const {
      entrypoint,
      smartWallet,
      smartWalletOwner,
      create2,
      deployer,
      sendUserOp,
      smartWalletImpl,
      guardians,
    } = await loadFixture(fixture);

    const newOwner = await ethers.Wallet.createRandom();
    const newGuardians = [];
    const signedUserOp = await fillAndMultiSignForRecover(
      smartWallet,
      newOwner,
      0, //nonce
      [
        { signer: guardians[0] },
        {
          signer: guardians[1],
        },
      ],
      create2.address,
      smartWalletImpl.address,
      newGuardians,
      entrypoint
    );

    expect(await smartWallet.getOwner()).to.eq(smartWalletOwner.address);
    const preDeposit = await smartWallet.getDeposit();
    const preBalance = await ethers.provider.getBalance(deployer.address);
    const recipt = await sendUserOp(signedUserOp);
    const postDeposit = await smartWallet.getDeposit();
    expect(await smartWallet.getOwner()).to.eq(newOwner.address);
    const postBalance = await ethers.provider.getBalance(deployer.address);
    const events = await evInfo(entrypoint, recipt);
    expect(events.length).to.eq(1);
    // check relayer balance
    expect(
      preBalance
        .sub(recipt.gasUsed.mul(recipt.effectiveGasPrice))
        .add(events[0].actualGasCost)
    ).to.eq(postBalance);
    // check sender balance
    expect(preDeposit.sub(postDeposit)).to.eq(events[0].actualGasCost);

    // it will not take any cost to execute both of the following txs
    // no fee charged if validation failed
    await expect(sendUserOp({ ...signedUserOp, signature: "0x" }))
      .to.revertedWithCustomError(entrypoint, "FailedOp")
      .withArgs(0, ethers.constants.AddressZero, "AA23 reverted (or OOG)");

    // replay test
    await expect(sendUserOp(signedUserOp))
      .to.revertedWithCustomError(entrypoint, "FailedOp")
      .withArgs(0, ethers.constants.AddressZero, "HASH_EXIST");
    expect(await smartWallet.getDeposit()).to.eq(postDeposit);
  });

  it("new owner should not be the same as before", async () => {
    const {
      entrypoint,
      smartWallet,
      smartWalletOwner,
      create2,
      deployer,
      sendUserOp,
      smartWalletImpl,
      guardians,
    } = await loadFixture(fixture);

    const newGuardians = [];
    const signedUserOp = await fillAndMultiSignForRecover(
      smartWallet,
      smartWalletOwner,
      0, //nonce
      [
        { signer: guardians[0] },
        {
          signer: guardians[1],
        },
      ],
      create2.address,
      smartWalletImpl.address,
      newGuardians,
      entrypoint
    );
    const preDeposit = await smartWallet.getDeposit();
    const recipt = await sendUserOp(signedUserOp);
    const postDeposit = await smartWallet.getDeposit();
    const revertInfo = await evRevertInfo(entrypoint, recipt);
    // is same owner
    expect(getErrorMessage(revertInfo[0].revertReason)).to.eq("IS_SAME_OWNER");
    // fee charged even if userop execution failed
    expect(postDeposit).to.lt(preDeposit);
  });

  // invalid test case
  it("new owner should not be invalid", async () => {
    const {
      entrypoint,
      smartWallet,
      smartWalletOwner,
      create2,
      deployer,
      sendUserOp,
      smartWalletImpl,
      guardians,
    } = await loadFixture(fixture);

    const newGuardians = [];
    // all invalid new owner addresses
    const newOwnerAddrs = [ethers.constants.AddressZero];
    for (let i = 0; i < newOwnerAddrs.length; ++i) {
      const newOwnerAddr = newOwnerAddrs[i];
      const signedUserOp = await fillAndMultiSignForRecover(
        smartWallet,
        smartWalletOwner,
        0, //nonce
        [
          { signer: guardians[0] },
          {
            signer: guardians[1],
          },
        ],
        create2.address,
        smartWalletImpl.address,
        newGuardians,
        entrypoint
      );
      const preDeposit = await smartWallet.getDeposit();
      const recipt = await sendUserOp(signedUserOp);
      const postDeposit = await smartWallet.getDeposit();
      const revertInfo = await evRevertInfo(entrypoint, recipt);
      // is same owner
      expect(getErrorMessage(revertInfo[0].revertReason)).to.eq(
        "IS_SAME_OWNER"
      );
      // fee charged even if userop execution failed
      expect(postDeposit).to.lt(preDeposit);
    }
  });

  it("will fail when recover from owner", async () => {
    const {
      entrypoint,
      smartWallet,
      smartWalletOwner,
      create2,
      deployer,
      sendUserOp,
      smartWalletImpl,
      guardians,
    } = await loadFixture(fixture);
    const newOwner = await ethers.Wallet.createRandom();
    await expect(smartWallet.recover(newOwner.address, [])).to.rejectedWith(
      "account: not EntryPoint"
    );
  });
  it("will fail when recover from execute", async () => {});
  it("recover success even if wallet is locked", async () => {
    const {
      entrypoint,
      smartWallet,
      smartWalletOwner,
      create2,
      deployer,
      sendUserOp,
      smartWalletImpl,
      guardians,
    } = await loadFixture(fixture);

    // lock wallet first
    await smartWallet.lock();

    const newOwner = await ethers.Wallet.createRandom();
    const newGuardians = [];
    const signedUserOp = await fillAndMultiSignForRecover(
      smartWallet,
      newOwner,
      0, //nonce
      [
        { signer: guardians[0] },
        {
          signer: guardians[1],
        },
      ],
      create2.address,
      smartWalletImpl.address,
      newGuardians,
      entrypoint
    );
    await sendUserOp(signedUserOp);
    expect(await smartWallet.getOwner()).to.eq(newOwner.address);
  });

  describe("guardians test", () => {
    it("recover with new guardians", async () => {});

    it("recover with empty guardians", async () => {});
  });
});
