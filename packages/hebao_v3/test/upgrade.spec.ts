import { expect } from "./setup";
import {
  signCreateWallet,
  signChangeMasterCopy,
} from "./helper/signatureUtils";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { sign } from "./helper/Signature";
import {
  newWallet,
  getContractABI,
  getFirstEvent,
  getAllEvent,
  newWalletImpl,
  sortSignersAndSignatures,
} from "./commons";
import { baseFixture, fixture, walletImplFixture } from "./helper/fixture";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet", () => {
  describe("upgrade", () => {
    it("wallet owner should be able to upgrade impl with enough approvals", async () => {
      const {
        account: wallet,
        guardians,
        accountOwner,
      } = await loadFixture(fixture);
      const newSmartWalletImpl = await loadFixture(walletImplFixture);
      const validUntil = 9999999999;
      const currentImpl = await wallet.getMasterCopy();
      console.log("old impl:", currentImpl);
      const sig1 = signChangeMasterCopy(
        wallet.address,
        currentImpl,
        new BN(validUntil),
        newSmartWalletImpl.address,
        accountOwner.address,
        accountOwner.privateKey.slice(2)
      );
      const sig1Bs = Buffer.from(sig1.txSignature.slice(2), "hex");
      const sig2 = signChangeMasterCopy(
        wallet.address,
        currentImpl,
        new BN(validUntil),
        newSmartWalletImpl.address,
        guardians[0].address,
        guardians[0].privateKey.slice(2)
      );
      const sig2Bs = Buffer.from(sig2.txSignature.slice(2), "hex");
      const sortedSigs = sortSignersAndSignatures(
        [accountOwner.address, guardians[0].address],
        [sig1Bs, sig2Bs]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: wallet.address,
      };

      const tx = await wallet.changeMasterCopy(
        approval,
        newSmartWalletImpl.address
      );

      const masterCopyOfWallet = await wallet.getMasterCopy();
      console.log("masterCopyofwallet:", masterCopyOfWallet);

      expect(masterCopyOfWallet).to.equal(newSmartWalletImpl.address);
    });
  });
});
