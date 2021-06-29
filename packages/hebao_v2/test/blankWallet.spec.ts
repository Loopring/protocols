import { expect } from "./setup";
import { signCreateWallet } from "./helper/signatureUtils";
import {
  newWalletFactoryContract,
  getFirstEvent,
  attachWallet
} from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("walletFactory", () => {
  let account1: Signer;
  let account2: Signer;
  let account3: Signer;

  describe("owner setter", () => {
    it("should be able to set owner", async () => {
      [account1, account2, account3] = await ethers.getSigners();
      const ownerSetter = await account3.getAddress();
      const walletFactory = await newWalletFactoryContract(ownerSetter);

      const salt = new Date().getTime();
      const signature = signCreateWallet(
        walletFactory.address,
        ownerSetter,
        [],
        new BN(0),
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        new BN(0),
        salt
      );
      // console.log("signature:", signature);

      const walletConfig: any = {
        owner: ownerSetter,
        guardians: [],
        quota: 0,
        inheritor: ethers.constants.AddressZero,
        feeRecipient: ethers.constants.AddressZero,
        feeToken: ethers.constants.AddressZero,
        feeAmount: 0,
        signature: Buffer.from(signature.txSignature.slice(2), "hex")
      };

      const walletAddrComputed = await walletFactory.computeWalletAddress(
        ownerSetter,
        salt
      );

      const tx = await walletFactory.createWallet(walletConfig, salt);

      let wallet = await attachWallet(walletAddrComputed);

      // check owner before:
      const ownerBefore = (await wallet.wallet()).owner;
      expect(ownerBefore.toLowerCase()).to.equal(ownerSetter.toLowerCase());

      const newOwner = "0x" + "12".repeat(20);
      // other accounts can not set owner:
      wallet = await wallet.connect(account2);
      try {
        await wallet.setOwner(newOwner);
      } catch (err) {
        // console.log("err:", err.message);
        expect(err.message.includes("NOT_ALLOWED_TO_SET_OWNER"));
      }

      // ownerSetter should be able to set owner if owner if 0x0:
      wallet = await wallet.connect(account3);
      const setOwnerTx = await wallet.setOwner(newOwner);
      const ownerAfter = (await wallet.wallet()).owner;
      expect(ownerAfter.toLowerCase()).to.equal(newOwner.toLowerCase());
      await setOwnerTx.wait();

      // ownerSetter should not be able to set owner again if owne is not 0x0:
      const newOwner2 = "0x" + "34".repeat(20);
      try {
        await wallet.setOwner(newOwner2);
      } catch (err) {
        expect(err.message.includes("NOT_ALLOWED_TO_SET_OWNER"));
      }
    });
  });
});
