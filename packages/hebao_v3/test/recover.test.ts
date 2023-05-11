import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { signRecover } from "./helper/signatureUtils";
import { fixture } from "./helper/fixture";
import {
  PaymasterOption,
  evInfo,
  evRevertInfo,
  sortSignersAndSignatures,
  getErrorMessage,
} from "./helper/utils";
import { fillUserOp, getUserOpHash } from "./helper/AASigner";
import BN = require("bn.js");

describe("recover test", () => {
  async function recoverTxToSignedUserOp(
    smartWallet,
    recover,
    create2,
    entrypoint,
    masterCopy,
    newOwnerAddr,
    guardians
  ) {
    const partialUserOp = {
      sender: smartWallet.address,
      nonce: 0,
      callData: recover.data,
      callGasLimit: "126880",
    };
    const userOp = await fillUserOp(partialUserOp, create2.address, entrypoint);
    // const masterCopy = smartWalletImpl.address;
    const validUntil = 9999999999;
    const sig1 = signRecover(
      masterCopy,
      smartWallet.address,
      new BN(validUntil),
      newOwnerAddr,
      [],
      guardians[0].address,
      guardians[0].privateKey.slice(2)
    );
    const sig1Bs = Buffer.from(sig1.txSignature.slice(2), "hex");

    const sig2 = signRecover(
      masterCopy,
      smartWallet.address,
      new BN(validUntil),
      newOwnerAddr,
      [],
      guardians[1].address,
      guardians[1].privateKey.slice(2)
    );
    const sig2Bs = Buffer.from(sig2.txSignature.slice(2), "hex");

    const sortedSigs = sortSignersAndSignatures(
      [guardians[0].address, guardians[1].address],
      [sig1Bs, sig2Bs]
    );

    const approval = {
      signers: sortedSigs.sortedSigners,
      signatures: sortedSigs.sortedSignatures,
      validUntil,
      wallet: smartWallet.address,
    };
    const signature = ethers.utils.defaultAbiCoder.encode(
      [
        "tuple(address[] signers,bytes[] signatures,uint256 validUntil,address wallet)",
      ],
      [approval]
    );
    const signedUserOp = {
      ...userOp,
      signature,
    };
    return signedUserOp;
  }

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
    const recover = await smartWallet.populateTransaction.recover(
      newOwner.address,
      newGuardians
    );
    const signedUserOp = await recoverTxToSignedUserOp(
      smartWallet,
      recover,
      create2,
      entrypoint,
      smartWalletImpl.address,
      newOwner.address,
      guardians
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
    const recover = await smartWallet.populateTransaction.recover(
      smartWalletOwner.address,
      newGuardians
    );
    const signedUserOp = await recoverTxToSignedUserOp(
      smartWallet,
      recover,
      create2,
      entrypoint,
      smartWalletImpl.address,
      smartWalletOwner.address,
      guardians
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

  it("new owner shoulb not be invalid", async () => {
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
    const newOwnerAddrs = [create2.address, ethers.constants.AddressZero];
    for (let i = 0; i < newOwnerAddrs.length; ++i) {
      const newOwnerAddr = newOwnerAddrs[i];
      const recover = await smartWallet.populateTransaction.recover(
        newOwnerAddr,
        newGuardians
      );
      const signedUserOp = await recoverTxToSignedUserOp(
        smartWallet,
        recover,
        create2,
        entrypoint,
        smartWalletImpl.address,
        newOwnerAddr,
        guardians
      );
      const preDeposit = await smartWallet.getDeposit();
      const recipt = await sendUserOp(signedUserOp);
      const postDeposit = await smartWallet.getDeposit();
      const revertInfo = await evRevertInfo(entrypoint, recipt);
      // is same owner
      expect(getErrorMessage(revertInfo[0].revertReason)).to.eq(
        "INVALID_NEW_WALLET_OWNER"
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
    const recover = await smartWallet.populateTransaction.recover(
      newOwner.address,
      newGuardians
    );
    const signedUserOp = await recoverTxToSignedUserOp(
      smartWallet,
      recover,
      create2,
      entrypoint,
      smartWalletImpl.address,
      newOwner.address,
      guardians
    );
    await sendUserOp(signedUserOp);
    expect(await smartWallet.getOwner()).to.eq(newOwner.address);
  });

  describe("guardians test", () => {
    it("recover with new guardians", async () => {});

    it("recover with empty guardians", async () => {});
  });
});
