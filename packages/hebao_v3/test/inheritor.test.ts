import { expect } from "chai";
import { ethers } from "hardhat";
import { fixture } from "./helper/fixture";
import {
  getBlockTimestamp,
  getCurrentQuota,
  sortSignersAndSignatures,
  sendTx,
} from "./helper/utils";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { signChangeDailyQuotaWA } from "./helper/signatureUtils";
import { fillUserOp, fillAndSign } from "./helper/AASigner";
import BN from "bn.js";
import { increase } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time";

describe("inheritor test", () => {
  it("basic success testcase", async () => {
    const { smartWallet, deployer, create2, entrypoint, sendUserOp } =
      await loadFixture(fixture);
    const inheritor = ethers.Wallet.createRandom().connect(ethers.provider);

    // check before
    const walletDataBefore = await smartWallet.wallet();
    expect(walletDataBefore["inheritor"]).to.eq(ethers.constants.AddressZero);
    expect(walletDataBefore["inheritWaitingPeriod"]).to.eq(0);

    const waitingPeriod = 3600 * 24 * 30;
    await smartWallet.setInheritor(inheritor.address, waitingPeriod);

    const walletData = await smartWallet.wallet();
    expect(walletData["inheritor"]).to.eq(inheritor.address);
    expect(walletData["inheritWaitingPeriod"]).to.eq(waitingPeriod);

    // advance time
    const validBlockTime = walletData["lastActive"].add(
      walletData["inheritWaitingPeriod"]
    );
    await time.increaseTo(validBlockTime);

    // inherit
    const newOwner = ethers.Wallet.createRandom().connect(ethers.provider);
    const tx = await smartWallet.populateTransaction.inherit(
      newOwner.address,
      true /*remove all guardians*/
    );

    const partialUserOp = {
      sender: smartWallet.address,
      nonce: 1,
      callData: tx.data,
    };

    const recipt = await sendTx(
      [tx],
      smartWallet,
      inheritor,
      create2,
      entrypoint,
      sendUserOp,
      undefined,
      false
    );
    expect(await smartWallet.getOwner()).to.eq(newOwner.address);
  });

  it("inherit successfully from inheritor directly", async () => {});
});
