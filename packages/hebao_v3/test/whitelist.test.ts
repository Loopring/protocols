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
import { fillUserOp, fillAndMultiSign } from "./helper/AASigner";
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
    const addr = "0x" + "12".repeat(20);

    const tx = await smartWallet.populateTransaction.addToWhitelistWA(addr);
    const partialUserOp = {
      sender: smartWallet.address,
      nonce: 0,
      callData: tx.data,
    };
    const signedUserOp = await fillAndMultiSign(
      partialUserOp,
      [guardians[0], smartWalletOwner],
      create2.address,
      entrypoint
    );

    const recipt = await sendUserOp(signedUserOp);
    const effectiveTime = await smartWallet.getWhitelistEffectiveTime(addr);
    const blockTime = await getBlockTimestamp(recipt.blockNumber);
    expect(effectiveTime.toNumber()).to.equal(blockTime);

    // advance one day
    await time.increase(ONE_DAY);
    expect(await smartWallet.isWhitelisted(addr)).to.be.true;
  });
});
