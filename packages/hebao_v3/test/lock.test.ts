import { ethers } from "hardhat";
import { expect } from "chai";
import {
  loadFixture,
  setBalance,
  time,
} from "@nomicfoundation/hardhat-network-helpers";
import { signUnlock } from "./helper/signatureUtils";
import {
  SmartWalletV3,
  EntryPoint,
  LoopringCreate2Deployer,
  SmartWalletV3__factory,
} from "../typechain-types";
import { fixture } from "./helper/fixture";
import { BigNumberish, Wallet, PopulatedTransaction, Contract } from "ethers";
import {
  PaymasterOption,
  evInfo,
  evRevertInfo,
  sortSignersAndSignatures,
  getErrorMessage,
  sendTx,
  createSmartWallet,
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
    entrypoint: EntryPoint,
    smartWalletImpl: Contract
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
      smartWalletImpl.address,
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
      entrypoint,
      smartWalletImpl
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

    it("lock wallet by guardian(smart wallet)", async () => {
      // create new smart wallet as guardian then add it
      const {
        entrypoint,
        smartWallet,
        smartWalletOwner,
        create2,
        deployer,
        sendUserOp,
        smartWalletImpl,
        guardians,
        walletFactory,
      } = await loadFixture(fixture);
      const guardianOwner = ethers.Wallet.createRandom().connect(
        ethers.provider
      );
      const salt = ethers.utils.formatBytes32String("0x5");
      await createSmartWallet(guardianOwner, [], walletFactory, salt);
      const smartWalletAddr = await walletFactory.computeWalletAddress(
        guardianOwner.address,
        salt
      );
      const guardian = SmartWalletV3__factory.connect(
        smartWalletAddr,
        guardianOwner
      );
      // add guardian
      expect(await smartWallet.isGuardian(guardian.address, true)).to.be.false;
      await smartWallet.addGuardian(guardian.address);
      expect(await smartWallet.isGuardian(guardian.address, true)).to.be.true;
      await time.increase(3600 * 24 * 3);
      expect(await smartWallet.isGuardian(guardian.address, false)).to.be.true;

      expect((await smartWallet.wallet()).locked).to.equal(false);
      const lock = await smartWallet.populateTransaction.lock();
      await setBalance(guardian.address, ethers.utils.parseEther("100"));
      // note that user op here is signed by guardian owner
      // instead of guardian when it is smart wallet rather than EOA
      const recipt = await sendTx(
        [lock],
        guardian,
        guardianOwner,
        create2,
        entrypoint,
        sendUserOp
      );
      // check if it is locked by the new guardian
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

      // NOTE cannot allow unlock using callcontract api
      await expect(
        sendTx(
          [unlock],
          smartWallet,
          smartWalletOwner,
          create2,
          entrypoint,
          sendUserOp
        )
      ).to.revertedWith("SELF_CALL_DISALLOWED");
    });
  });
});
