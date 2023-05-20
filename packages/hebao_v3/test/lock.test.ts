import { ethers } from "hardhat";
import { expect } from "chai";
import {
  loadFixture,
  setBalance,
} from "@nomicfoundation/hardhat-network-helpers";
import { signUnlock } from "./helper/signatureUtils";
import {
  SmartWalletV3,
  EntryPoint,
  LoopringCreate2Deployer,
} from "../typechain-types";
import { fixture } from "./helper/fixture";
import { BigNumberish, Wallet, PopulatedTransaction } from "ethers";
import {
  PaymasterOption,
  evInfo,
  evRevertInfo,
  sortSignersAndSignatures,
  getErrorMessage,
  sendTx,
} from "./helper/utils";
import {
  fillUserOp,
  getUserOpHash,
  UserOperation,
  fillAndMultiSign,
} from "./helper/AASigner";
import BN from "bn.js";

describe("lock test", () => {
  async function getApprovalSignedUserOp(
    tx: PopulatedTransaction,
    create2: LoopringCreate2Deployer,
    masterCopy: string,
    smartWallet: SmartWalletV3,
    smartWalletOwner: Wallet,
    guardians: Wallet[],
    entrypoint: EntryPoint
  ) {
    const partialUserOp = {
      sender: smartWallet.address,
      nonce: 0,
      callData: tx.data,
      callGasLimit: "126880",
    };
    const signedUserOp = await fillAndMultiSign(
      partialUserOp,
      [smartWalletOwner, guardians[0]],
      create2.address,
      entrypoint
    );
    return signedUserOp;
  }
  it("basic success testcase", async () => {
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
    // lock wallet from owner first
    await smartWallet.lock();
    expect((await smartWallet.wallet()).locked).to.equal(true);
    // TODO(allow to double lock?)
    await expect(smartWallet.lock()).not.to.reverted;

    // unlock wallet using guardians approval
    const unlock = await smartWallet.populateTransaction.unlock();
    const masterCopy = smartWalletImpl.address;
    const signedUserOp = await getApprovalSignedUserOp(
      unlock,
      create2,
      masterCopy,
      smartWallet,
      smartWalletOwner,
      guardians,
      entrypoint
    );
    const recipt = await sendUserOp(signedUserOp);

    // check
    expect((await smartWallet.wallet()).locked).to.equal(false);

    // replay test
    await expect(sendUserOp(signedUserOp))
      .to.revertedWithCustomError(entrypoint, "FailedOp")
      .withArgs(0, ethers.constants.AddressZero, "HASH_EXIST");
  });
  describe("lock test", () => {
    it("lock success from guardian", async () => {
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
      await setBalance(guardians[0].address, ethers.utils.parseEther("100"));
      await expect(smartWallet.connect(guardians[0]).lock()).not.to.reverted;
      // check wallet is lock
      expect((await smartWallet.wallet()).locked).to.equal(true);
      // others cannot lock wallet
      await expect(smartWallet.connect(deployer).lock()).to.revertedWith(
        "NOT_FROM_WALLET_OR_OWNER_OR_GUARDIAN"
      );
    });

    it("lock success from entrypoint using `execute` api ", async () => {
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
      const lock = await smartWallet.populateTransaction.lock();

      const recipt = await sendTx(
        [lock],
        smartWallet,
        smartWalletOwner,
        create2,
        entrypoint,
        sendUserOp
      );
      expect((await smartWallet.wallet()).locked).to.equal(true);
    });
    it("lock success directly from entrypoint", async () => {
      const { entrypoint, smartWallet, smartWalletOwner, create2, sendUserOp } =
        await loadFixture(fixture);
      const lock = await smartWallet.populateTransaction.lock();

      const recipt = await sendTx(
        [lock],
        smartWallet,
        smartWalletOwner,
        create2,
        entrypoint,
        sendUserOp,
        undefined,
        false
      );
      expect((await smartWallet.wallet()).locked).to.equal(true);
    });
  });
  describe("unlock test", () => {
    it("cannot unlock directly from wallet owner", async () => {
      const { smartWallet } = await loadFixture(fixture);
      await expect(smartWallet.unlock()).to.rejectedWith(
        "account: not EntryPoint"
      );
    });
    it("cannot unlock from entrypoint using `execute` api", async () => {
      const { entrypoint, smartWallet, smartWalletOwner, create2, sendUserOp } =
        await loadFixture(fixture);
      const unlock = await smartWallet.populateTransaction.unlock();

      await expect(
        sendTx(
          [unlock],
          smartWallet,
          smartWalletOwner,
          create2,
          entrypoint,
          sendUserOp
        )
      ).to.revertedWith("account: not EntryPoint");
    });
  });
});
