import { expect } from "./setup";
import { signCreateWallet } from "./helper/signatureUtils";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
  attachWallet,
  newWalletFactoryContract,
  getBlockTimestamp,
  getFirstEvent,
} from "./commons";
import { baseFixture } from "./helper/fixture";
import {
  createRandomWalletConfig,
  activateWalletOp,
  createAccountOwner,
} from "./helper/utils";
import { localUserOpSender, fillAndSign } from "./helper/AASigner";
import { SmartWallet__factory } from "../typechain-types";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("walletFactory", () => {
  // let account1: Signer;
  // let account2: Signer;
  // let account3: Signer;

  describe("A EOA", () => {
    it("should be able to create a new wallet with owner's signature", async () => {
      const { walletFactory, deployer, accountOwner } = await loadFixture(
        baseFixture
      );
      const walletConfig = await createRandomWalletConfig(accountOwner.address);

      const salt = ethers.utils.randomBytes(32);
      const tx = await walletFactory.createAccount(
        walletConfig.accountOwner,
        walletConfig.guardians,
        walletConfig.quota,
        walletConfig.inheritor,
        salt
      );
      const recipt = await tx.wait();
      console.log("event name: ", recipt.events[0].event);

      const accountAddress = await walletFactory.getAddress(
        walletConfig.accountOwner,
        walletConfig.guardians,
        walletConfig.quota,
        walletConfig.inheritor,
        salt
      );
      const smartWallet = SmartWallet__factory.connect(
        accountAddress,
        accountOwner
      );
      // get WalletCreated event:
      const fromBlock = tx.blockNumber;
      const walletCreatedEvent = await getFirstEvent(
        walletFactory,
        fromBlock,
        "WalletCreated"
      );
      expect(accountOwner.address).to.equal(walletCreatedEvent.args.owner);
      expect(smartWallet.address).to.equal(walletCreatedEvent.args.wallet);

      // const smartWallet = await attachWallet(walletAddrComputed);

      // Check creation timestamp
      const blockTime = await getBlockTimestamp(tx.blockNumber);
      const creationTimestamp = await smartWallet.getCreationTimestamp();
      expect(creationTimestamp.toNumber()).to.equal(blockTime);

      // Check owner
      const walletOwner = await smartWallet.getOwner();
      expect(walletOwner).to.equal(accountOwner.address);
    });

    it("should be able to charge fees when creating a new wallet", async () => {
      const { walletFactory, deployer, accountOwner, entrypoint } =
        await loadFixture(baseFixture);
      const walletConfig = await createRandomWalletConfig(accountOwner.address);
      const activateOp = await activateWalletOp(walletFactory, walletConfig);

      // prefund
      const walletEthBalanceBefore = ethers.utils.parseEther("0.1");
      await entrypoint.depositTo(activateOp.sender, {
        value: walletEthBalanceBefore,
      });

      const newOp = await fillAndSign(
        activateOp,
        accountOwner,
        walletFactory.address,
        entrypoint
      );
      const beneficiary = createAccountOwner();
      const beneficiaryEthBalanceBefore = await beneficiary.getBalance();
      const sendUserOp = localUserOpSender(
        entrypoint.address,
        deployer,
        beneficiary.address
      );

      // send create wallet tx
      const rcpt = await sendUserOp(newOp);

      // get WalletCreated event:
      const fromBlock = rcpt.blockNumber;
      const walletCreatedEvent = await getFirstEvent(
        walletFactory,
        fromBlock,
        "WalletCreated"
      );
      expect(accountOwner.address).to.equal(walletCreatedEvent.args.owner);
      expect(activateOp.sender).to.equal(walletCreatedEvent.args.wallet);
      const smartWallet = SmartWallet__factory.connect(
        activateOp.sender,
        ethers.provider
      );

      // Check creation timestamp
      const blockTime = await getBlockTimestamp(rcpt.blockNumber);
      const creationTimestamp = await smartWallet.getCreationTimestamp();
      expect(creationTimestamp.toNumber()).to.equal(blockTime);

      // Check owner
      const walletOwner = await smartWallet.getOwner();
      expect(walletOwner).to.equal(accountOwner.address);

      const walletEthBalanceAfter = await entrypoint.balanceOf(
        activateOp.sender
      );
      const beneficiaryEthBalanceAfter = await beneficiary.getBalance();
      // get actualGasCost
      const userOpEvents = await entrypoint.queryFilter(
        entrypoint.filters.UserOperationEvent(),
        rcpt.blockNumber
      );
      expect(userOpEvents.length).to.eq(1);
      const actualGasCost = userOpEvents[0].args.actualGasCost;

      expect(walletEthBalanceBefore.sub(walletEthBalanceAfter)).to.equal(
        actualGasCost
      );
      expect(beneficiaryEthBalanceBefore.add(actualGasCost)).to.equal(
        beneficiaryEthBalanceAfter
      );
    });
  });
});
