import { expect } from "./setup";
import { signCreateWallet } from "./helper/signatureUtils";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
  newWalletFactoryContract,
  getFirstEvent,
  attachWallet,
} from "./commons";
import { parseEther, arrayify, hexConcat, hexlify } from "ethers/lib/utils";
import { baseFixture } from "./helper/fixture";
import {
  createRandomWalletConfig,
  createAccount,
  createAccountOwner,
} from "./helper/utils";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet", () => {
  describe("owner setter", () => {
    it("should be able to set owner for a blank wallet", async () => {
      const { entrypoint, walletFactory, blankOwner, deployer } =
        await loadFixture(baseFixture);
      const ownerSetter = blankOwner.address;
      const account2 = await createAccountOwner();
      const walletConfig = await createRandomWalletConfig(blankOwner.address);
      const { proxy: wallet } = await createAccount(
        blankOwner,
        walletConfig,
        entrypoint.address,
        walletFactory
      );

      // prepare gas fee
      await deployer.sendTransaction({
        to: account2.address,
        value: parseEther("1"),
      });

      await deployer.sendTransaction({
        to: blankOwner.address,
        value: parseEther("1"),
      });

      // check owner before:
      const ownerBefore = (await wallet.wallet()).owner;
      expect(ownerBefore.toLowerCase()).to.equal(ownerSetter.toLowerCase());

      const newOwner = "0x" + "12".repeat(20);
      // other accounts can not set owner:
      try {
        await wallet.connect(account2).transferOwnership(newOwner);
      } catch (err) {
        // console.log("err:", err.message);
        expect(err.message.includes("NOT_ALLOWED_TO_SET_OWNER"));
      }

      // ownerSetter should be able to set owner if owner is blankOwner
      await wallet.connect(blankOwner).transferOwnership(newOwner);
      const ownerAfter = (await wallet.wallet()).owner;
      expect(ownerAfter.toLowerCase()).to.equal(newOwner.toLowerCase());

      // ownerSetter should not be able to set owner again
      const newOwner2 = "0x" + "34".repeat(20);
      try {
        await wallet.connect(blankOwner).transferOwnership(newOwner2);
      } catch (err) {
        expect(err.message.includes("NOT_ALLOWED_TO_SET_OWNER"));
      }
    });
  });
});
