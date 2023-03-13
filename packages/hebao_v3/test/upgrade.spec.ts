import { expect } from "./setup";
import {
  signCreateWallet,
  signChangeMasterCopy,
} from "./helper/signatureUtils";
import { sign } from "./helper/Signature";
import {
  newWallet,
  getContractABI,
  getFirstEvent,
  getAllEvent,
  newWalletImpl,
  sortSignersAndSignatures,
} from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet", () => {
  let account1: Signer;
  let account2: Signer;
  let account3: Signer;
  let owner: string;
  let guardian1: string;
  let guardian2: string;
  let wallet: Contract;
  let newSmartWalletImpl: Contract;
  before(async () => {
    [account1, account2, account3] = await ethers.getSigners();

    owner = await account1.getAddress();
    guardian1 = await account2.getAddress();
    guardian2 = await account3.getAddress();

    wallet = await newWallet(owner, ethers.constants.AddressZero, 0, [
      guardian1,
      guardian2,
    ]);
    newSmartWalletImpl = await newWalletImpl();
  });

  describe.only("upgrade", () => {
    it("wallet owner should be able to upgrade impl with enough approvals", async () => {
      const validUntil = 9999999999;
      const currentImpl = await wallet.getMasterCopy();
      console.log("old impl:", currentImpl);
      const sig1 = signChangeMasterCopy(
        wallet.address,
        currentImpl,
        new BN(validUntil),
        newSmartWalletImpl.address,
        owner
      );
      const sig1Bs = Buffer.from(sig1.txSignature.slice(2), "hex");
      const sig2 = signChangeMasterCopy(
        wallet.address,
        currentImpl,
        new BN(validUntil),
        newSmartWalletImpl.address,
        guardian1
      );
      const sig2Bs = Buffer.from(sig2.txSignature.slice(2), "hex");
      const sortedSigs = sortSignersAndSignatures(
        [owner, guardian1],
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
