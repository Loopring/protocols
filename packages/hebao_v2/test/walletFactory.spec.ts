import { expect } from "chai";
import { signCreateWallet } from "./helper/signatureUtils";
import {
  attachWallet,
  newWalletFactoryContract,
  getBlockTimestamp,
  getFirstEvent,
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
        salt,
        signature: Buffer.from(signature.txSignature.slice(2), "hex"),
      };

      const walletAddrComputed = await walletFactory.computeWalletAddress(
        owner,
        salt
      );

      const tx = await walletFactory.createWallet(walletConfig, 0);

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
      const feeAmount = maxFeeAmount;
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
        salt,
        signature: Buffer.from(signature.txSignature.slice(2), "hex"),
      };

      const walletAddrComputed = await walletFactory.computeWalletAddress(
        owner,
        salt
      );

      await account2.sendTransaction({
        from: owner,
        to: walletAddrComputed,
        value: ethers.utils.parseEther("0.1"),
      });
      const feeRecipientEthBalanceBefore = await ethers.provider.getBalance(
        feeRecipient
      );

      const tx = await walletFactory.createWallet(walletConfig, feeAmount);

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
      ).to.equal(feeAmount);
      expect(feeRecipientEthBalanceBefore.add(feeAmount)).to.equal(
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
        salt,
        signature: Buffer.from(signature.txSignature.slice(2), "hex"),
      };

      const walletAddrComputed = await walletFactory.computeWalletAddress(
        owner,
        salt
      );

      await account2.sendTransaction({
        from: owner,
        to: walletAddrComputed,
        value: ethers.utils.parseEther("0.1"),
      });
      const feeRecipientEthBalanceBefore = await ethers.provider.getBalance(
        feeRecipient
      );

      let feeAmount = maxFeeAmount.add(ethers.utils.parseEther("0.00001"));
      try {
        const tx = await walletFactory.createWallet(walletConfig, feeAmount);
      } catch (err) {
        expect(err.message.includes("INVALID_FEE_AMOUNT"));
      }

      feeAmount = maxFeeAmount.sub(ethers.utils.parseEther("0.00001"));
      const tx = await walletFactory.createWallet(walletConfig, feeAmount);

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
      ).to.equal(feeAmount);
      expect(feeRecipientEthBalanceBefore.add(feeAmount)).to.equal(
        feeRecipientEthBalanceAfter
      );
    });
  });

  describe("operator management", () => {
    it("only owner can add operators", async () => {
      const walletFactory = await newWalletFactoryContract();
      [account1, account2, account3] = await ethers.getSigners();
      const account1Addr = await account1.getAddress();
      const account2Addr = await account2.getAddress();
      expect(await walletFactory.isOperator(account2Addr)).to.be.false;
      await walletFactory.addOperator(account2Addr);
      expect(await walletFactory.isOperator(account2Addr)).to.be.true;

      // others cannot add operators
      const account3Addr = await account3.getAddress();
      await expect(
        walletFactory.connect(account2).addOperator(account3Addr)
      ).to.revertedWith("UNAUTHORIZED");
    });

    it("can create wallet only by operator", async () => {
      const walletFactory = await newWalletFactoryContract();
      [account1, account2, account3] = await ethers.getSigners();
      const account1Addr = await account1.getAddress();
      const account2Addr = await account2.getAddress();
      const account3Addr = await account3.getAddress();
      // create wallet
      const owner = account2Addr;
      const salt = 1;

      const walletConfig: any = {
        owner,
        initOwner: owner,
        guardians: [],
        quota: 0,
        inheritor: ethers.constants.AddressZero,
        feeRecipient: ethers.constants.AddressZero,
        feeToken: ethers.constants.AddressZero,
        maxFeeAmount: 0,
        salt,
      };

      const walletAddrComputed = await walletFactory.computeWalletAddress(
        owner,
        salt
      );

      await expect(
        walletFactory.connect(account2).createWalletByOperator(walletConfig, 0)
      ).to.revertedWith("DISALLOWED_ON_IMPLEMENTATION_CONTRACT");
      await walletFactory.addOperator(account2Addr);
      await walletFactory
        .connect(account2)
        .createWalletByOperator(walletConfig, 0);

      // check wallet is created successfully
      const smartWallet = await attachWallet(walletAddrComputed);
      expect(await smartWallet.getOwner()).to.eq(account2Addr);

      await walletFactory.removeOperator(account2Addr);
      await expect(
        walletFactory.connect(account2).createWalletByOperator(walletConfig, 0)
      ).to.revertedWith("DISALLOWED_ON_IMPLEMENTATION_CONTRACT");
    });
  });
});
