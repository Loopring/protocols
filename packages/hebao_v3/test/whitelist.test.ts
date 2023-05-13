import { fixture } from "./helper/fixture";
import {
  loadFixture,
  setBalance,
  time,
} from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { getBlockTimestamp, sortSignersAndSignatures } from "./helper/utils";
import { signAddToWhitelistWA } from "./helper/signatureUtils";
import { fillUserOp } from "./helper/AASigner";
import BN from "bn.js";

describe("whitelist test", () => {
  const ONE_DAY = 3600 * 24;
  it("owner should be able to add address to its whitelist", async () => {
    const whiteListedAddr = "0x" + "11".repeat(20);
    const { smartWallet } = await loadFixture(fixture);
    const tx = await smartWallet.addToWhitelist(whiteListedAddr);
    const effectiveTime = await smartWallet.getWhitelistEffectiveTime(
      whiteListedAddr
    );
    const blockTime = await getBlockTimestamp(tx.blockNumber);
    expect(effectiveTime.toNumber()).to.equal(blockTime + 3600 * 24);

    // advance one day
    await time.increase(ONE_DAY);
    expect(await smartWallet.isWhitelisted(whiteListedAddr)).to.be.true;

    // remove it from whitelist
    await smartWallet.removeFromWhitelist(whiteListedAddr);
    expect(await smartWallet.getWhitelistEffectiveTime(whiteListedAddr)).to.eq(
      0
    );
    expect(await smartWallet.isWhitelisted(whiteListedAddr)).to.be.false;
  });

  it("majority(owner required) should be able to whitelist address immediately", async () => {
    const {
      smartWallet,
      smartWalletImpl,
      smartWalletOwner,
      guardians,
      create2,
      entrypoint,
      sendUserOp,
    } = await loadFixture(fixture);
    const salt = new Date().getTime();
    const masterCopy = await smartWalletImpl.address;
    const validUntil = new Date().getTime() + 1000 * 3600 * 24; // one day
    const addr = "0x" + "12".repeat(20);
    const sig1 = signAddToWhitelistWA(
      masterCopy,
      smartWallet.address,
      new BN(validUntil),
      addr,
      smartWalletOwner.address,
      smartWalletOwner.privateKey.slice(2)
    );
    const sig2 = signAddToWhitelistWA(
      masterCopy,
      smartWallet.address,
      new BN(validUntil),
      addr,
      guardians[0].address,
      guardians[0].privateKey.slice(2)
    );

    const sortedSigs = sortSignersAndSignatures(
      [smartWalletOwner.address, guardians[0].address],
      [
        Buffer.from(sig1.txSignature.slice(2), "hex"),
        Buffer.from(sig2.txSignature.slice(2), "hex"),
      ]
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

    const tx = await smartWallet.populateTransaction.addToWhitelistWA(addr);
    const partialUserOp = {
      sender: smartWallet.address,
      nonce: 0,
      callData: tx.data,
    };
    const userOp = await fillUserOp(partialUserOp, create2.address, entrypoint);
    const signedUserOp = {
      ...userOp,
      signature,
    };

    const recipt = await sendUserOp(signedUserOp);
    const effectiveTime = await smartWallet.getWhitelistEffectiveTime(addr);
    const blockTime = await getBlockTimestamp(recipt.blockNumber);
    expect(effectiveTime.toNumber()).to.equal(blockTime);

    // advance one day
    await time.increase(ONE_DAY);
    expect(await smartWallet.isWhitelisted(addr)).to.be.true;
  });
});
