import { expect } from "./setup";
import { signCreateWallet } from "./helper/signatureUtils";
import {
  attachWallet,
  newWalletFactoryContract,
  getBlockTimestamp,
  getFirstEvent
} from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("walletFactory", () => {
  let account1: Signer;
  let account2: Signer;
  let account3: Signer;

  describe("A EOA", () => {
    it("should be able to create a new wallet with owner's signature", async () => {
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
        maxFeeAmount: 0,
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

    it("should be able to charge fees when creating a new wallet", async () => {
      const walletFactory = await newWalletFactoryContract();
      [account1, account2, account3] = await ethers.getSigners();

      const owner = await account2.getAddress();
      const feeRecipient = "0x" + "13".repeat(20);
      const maxFeeAmount = ethers.utils.parseEther("0.01");
      const salt = new Date().getTime();
      const signature = signCreateWallet(
        walletFactory.address,
        owner,
        [],
        new BN(0),
        ethers.constants.AddressZero,
        feeRecipient,
        ethers.constants.AddressZero,
        maxFeeAmount,
        salt
      );
      // console.log("signature:", signature);

      const walletConfig: any = {
        owner,
        guardians: [],
        quota: 0,
        inheritor: ethers.constants.AddressZero,
        feeRecipient,
        feeToken: ethers.constants.AddressZero,
        maxFeeAmount,
        feeAmount: maxFeeAmount,
        signature: Buffer.from(signature.txSignature.slice(2), "hex")
      };

      const walletAddrComputed = await walletFactory.computeWalletAddress(
        owner,
        salt
      );

      await account2.sendTransaction({
        from: owner,
        to: walletAddrComputed,
        value: ethers.utils.parseEther("0.1")
      });
      const feeRecipientEthBalanceBefore = await ethers.provider.getBalance(
        feeRecipient
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

      const walletEthBalanceAfter = await ethers.provider.getBalance(
        walletAddrComputed
      );
      const feeRecipientEthBalanceAfter = await ethers.provider.getBalance(
        feeRecipient
      );
      expect(
        ethers.utils.parseEther("0.1").sub(walletEthBalanceAfter)
      ).to.equal(walletConfig.feeAmount);
      expect(feeRecipientEthBalanceBefore.add(walletConfig.feeAmount)).to.equal(
        feeRecipientEthBalanceAfter
      );
    });

    it("require(feeAmount <= maxFeeAmount) when creating a new wallet", async () => {
      const walletFactory = await newWalletFactoryContract();
      [account1, account2, account3] = await ethers.getSigners();

      const owner = await account2.getAddress();
      const feeRecipient = "0x" + "14".repeat(20);
      const maxFeeAmount = ethers.utils.parseEther("0.01");
      const salt = new Date().getTime();
      const signature = signCreateWallet(
        walletFactory.address,
        owner,
        [],
        new BN(0),
        ethers.constants.AddressZero,
        feeRecipient,
        ethers.constants.AddressZero,
        maxFeeAmount,
        salt
      );
      // console.log("signature:", signature);

      const walletConfig: any = {
        owner,
        guardians: [],
        quota: 0,
        inheritor: ethers.constants.AddressZero,
        feeRecipient,
        feeToken: ethers.constants.AddressZero,
        maxFeeAmount,
        feeAmount: maxFeeAmount.add(ethers.utils.parseEther("0.00001")),
        signature: Buffer.from(signature.txSignature.slice(2), "hex")
      };

      const walletAddrComputed = await walletFactory.computeWalletAddress(
        owner,
        salt
      );

      await account2.sendTransaction({
        from: owner,
        to: walletAddrComputed,
        value: ethers.utils.parseEther("0.1")
      });
      const feeRecipientEthBalanceBefore = await ethers.provider.getBalance(
        feeRecipient
      );

      try {
        const tx = await walletFactory.createWallet(walletConfig, salt);
      } catch (err) {
        expect(err.message.includes("INVALID_FEE_AMOUNT"));
      }

      walletConfig.feeAmount = maxFeeAmount.sub(
        ethers.utils.parseEther("0.00001")
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

      const walletEthBalanceAfter = await ethers.provider.getBalance(
        walletAddrComputed
      );
      const feeRecipientEthBalanceAfter = await ethers.provider.getBalance(
        feeRecipient
      );
      expect(
        ethers.utils.parseEther("0.1").sub(walletEthBalanceAfter)
      ).to.equal(walletConfig.feeAmount);
      expect(feeRecipientEthBalanceBefore.add(walletConfig.feeAmount)).to.equal(
        feeRecipientEthBalanceAfter
      );
    });
  });
});
