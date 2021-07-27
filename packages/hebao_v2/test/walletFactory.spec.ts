import { expect } from "./setup";
import { signCreateWallet } from "./helper/signatureUtils";
import { attachWallet, newWalletFactoryContract, getBlockTimestamp, getFirstEvent } from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("walletFactory", () => {
  let account1: Signer;
  let account2: Signer;
  let account3: Signer;

  describe("any EOA", () => {
    it("should be able to create new wallet", async () => {
      const walletFactory = await newWalletFactoryContract();
      [account1, account2, account3] = await ethers.getSigners();

      const owner = await account2.getAddress();
      const salt = 1;
      const signature = signCreateWallet(
        walletFactory.address,
        owner,
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
        owner,
        guardians: [],
        quota: 0,
        inheritor: ethers.constants.AddressZero,
        feeRecipient: ethers.constants.AddressZero,
        feeToken: ethers.constants.AddressZero,
        feeAmount: 0,
        signature: Buffer.from(signature.txSignature.slice(2), "hex")
      };

      const walletAddrComputed = await walletFactory.computeWalletAddress(
        owner,
        salt
      );

      const tx = await walletFactory.createWallet(walletConfig, salt);

      // get WalletCreated event:
      const fromBlock = tx.blockNumber;
      const walletCreatedEvent = await getFirstEvent(
        walletFactory,
        fromBlock,
        "WalletCreated"
      );
      expect(owner).to.equal(walletCreatedEvent.args.owner);
      expect(walletAddrComputed).to.equal(walletCreatedEvent.args.wallet);

      const smartWallet = await attachWallet(walletAddrComputed);

      // Check creation timestamp
      const blockTime = await getBlockTimestamp(tx.blockNumber);
      const creationTimestamp = await smartWallet.getCreationTimestamp();
      expect(creationTimestamp.toNumber()).to.equal(blockTime);

      // Check owner
      const walletOwner = await smartWallet.getOwner();
      expect(walletOwner).to.equal(owner);
    });
  });
});
