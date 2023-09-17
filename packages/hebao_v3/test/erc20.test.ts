import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumberish, Wallet, PopulatedTransaction } from "ethers";
import {
  loadFixture,
  setBalance,
} from "@nomicfoundation/hardhat-network-helpers";
import { fixture } from "./helper/fixture";
import {
  sendTx,
  PaymasterOption,
  evInfo,
  sortSignersAndSignatures,
  getCurrentQuota,
  createSmartWallet,
  getFirstEvent,
} from "./helper/utils";
import {
  UserOperation,
  fillUserOp,
  fillAndMultiSignForApproveToken,
  fillAndMultiSignForCallContract,
  fillAndMultiSignForApproveThenCallContract,
} from "./helper/AASigner";
import {
  SmartWalletV3,
  EntryPoint,
  LoopringCreate2Deployer,
  SmartWalletV3__factory,
} from "../typechain-types";
import BN from "bn.js";

describe("erc20 test", () => {
  it("basic success test", async () => {
    // execute approve, transfer and call contract using batch way
    const {
      entrypoint,
      smartWallet,
      smartWalletOwner,
      create2,
      deployer,
      sendUserOp,
      smartWalletImpl,
      guardians,
      usdtToken,
      testTarget,
    } = await loadFixture(fixture);
    // prepare usdt tokens
    const initTokenAmount = ethers.utils.parseUnits("1000", 6);
    await usdtToken.setBalance(smartWallet.address, initTokenAmount);

    const tokenAmount = ethers.utils.parseUnits("100", 6);
    const receiver = deployer.address;
    const approve = await smartWallet.populateTransaction.approveToken(
      usdtToken.address,
      receiver,
      tokenAmount,
      false
    );
    const transferToken = await smartWallet.populateTransaction.transferToken(
      usdtToken.address,
      receiver,
      tokenAmount,
      "0x",
      false
    );

    const functionDefault =
      await testTarget.populateTransaction.functionDefault(0);
    const callcontract = await smartWallet.populateTransaction.callContract(
      receiver,
      0,
      functionDefault.data,
      false
    );

    const callData = testTarget.interface.encodeFunctionData(
      "functionPayable",
      [10]
    );
    const approveThenCall =
      await smartWallet.populateTransaction.approveThenCallContract(
        usdtToken.address,
        testTarget.address,
        ethers.utils.parseEther("10000"),
        ethers.utils.parseEther("0.01"),
        callData,
        false
      );

    const recipt = await sendTx(
      [approve, transferToken, callcontract, approveThenCall],
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint,
      sendUserOp,
      undefined,
      false
    );
    expect(await usdtToken.balanceOf(receiver)).to.eq(tokenAmount);
  });

  it("execute from wallet owner", async () => {
    const {
      entrypoint,
      smartWallet,
      smartWalletOwner,
      create2,
      deployer,
      sendUserOp,
      smartWalletImpl,
      guardians,
      usdtToken,
      testTarget,
    } = await loadFixture(fixture);
    // prepare usdt tokens
    const initTokenAmount = ethers.utils.parseUnits("1000", 6);
    await usdtToken.setBalance(smartWallet.address, initTokenAmount);

    const tokenAmount = ethers.utils.parseUnits("100", 6);
    const receiver = deployer.address;
    // approve first
    await smartWallet.populateTransaction.approveToken(
      usdtToken.address,
      receiver,
      tokenAmount,
      false
    );
    // then transfer token
    await smartWallet.transferToken(
      usdtToken.address,
      receiver,
      tokenAmount,
      "0x",
      false
    );
    expect(await usdtToken.balanceOf(receiver)).to.eq(tokenAmount);
    // finally call contract
    const functionDefault =
      await testTarget.populateTransaction.functionDefault(0);
    await expect(
      smartWallet.populateTransaction.callContract(
        receiver,
        0,
        functionDefault.data,
        false
      )
    ).not.to.reverted;

    // approvethencall
    const callData = testTarget.interface.encodeFunctionData(
      "functionPayable",
      [10]
    );
    const tx = await smartWallet.approveThenCallContract(
      usdtToken.address,
      testTarget.address,
      ethers.utils.parseEther("10000"),
      ethers.utils.parseEther("0.01"),
      callData,
      false
    );
    const event = await getFirstEvent(testTarget, tx.blockNumber, "Invoked");
    expect(event.args.sender).to.equal(smartWallet.address);
  });

  describe("execute tx with approval", () => {
    it("approve token test", async () => {
      const {
        entrypoint,
        smartWallet,
        smartWalletOwner,
        create2,
        deployer,
        sendUserOp,
        smartWalletImpl,
        guardians,
        usdtToken,
      } = await loadFixture(fixture);

      const toAddr = deployer.address;
      const amount = new BN(100);
      const signedUserOp = await fillAndMultiSignForApproveToken(
        smartWallet,
        smartWalletOwner,
        0, //nonce
        [
          { signer: smartWalletOwner },
          {
            signer: guardians[0],
          },
        ],
        create2.address,
        smartWalletImpl.address,
        usdtToken.address,
        toAddr,
        amount.toString(),
        entrypoint
      );

      const recipt = await sendUserOp(signedUserOp);
      // check allowance
      const allowance = await usdtToken.allowance(smartWallet.address, toAddr);
      expect(allowance).to.eq(amount.toString());
    });

    it("callcontract test", async () => {
      const {
        entrypoint,
        smartWallet,
        smartWalletOwner,
        create2,
        deployer,
        sendUserOp,
        smartWalletImpl,
        guardians,
        usdtToken,
        testTarget,
      } = await loadFixture(fixture);

      const toAddr = deployer.address;
      const amount = new BN(100);
      const functionDefault =
        await testTarget.populateTransaction.functionDefault(0);
      // fillAndMultiSignForCallContract
      const signedUserOp = await fillAndMultiSignForCallContract(
        smartWallet,
        smartWalletOwner,
        0, //nonce
        [
          { signer: smartWalletOwner },
          {
            signer: guardians[0],
          },
        ],
        create2.address,
        smartWalletImpl.address,
        testTarget.address,
        0,
        functionDefault.data,
        entrypoint
      );
      const recipt = await sendUserOp(signedUserOp);
      const event = await getFirstEvent(
        testTarget,
        recipt.blockNumber,
        "Invoked"
      );
      expect(event.args.sender).to.equal(smartWallet.address);
    });

    it("approveThenCallContract test", async () => {
      const {
        sendUserOp,
        entrypoint,
        create2,
        guardians,
        testTarget,
        usdtToken,
        smartWallet: wallet,
        smartWalletOwner,
        smartWalletImpl,
        smartWallet,
      } = await loadFixture(fixture);
      const callData = testTarget.interface.encodeFunctionData(
        "functionPayable",
        [10]
      );
      const amount = ethers.utils.parseEther("10000");
      const value = ethers.utils.parseEther("50");
      const signedUserOp = await fillAndMultiSignForApproveThenCallContract(
        smartWallet,
        smartWalletOwner,
        0, //nonce
        [
          { signer: smartWalletOwner },
          {
            signer: guardians[0],
          },
        ],
        create2.address,
        smartWalletImpl.address,
        usdtToken.address,
        testTarget.address,
        amount.toString(),
        value,
        callData,
        entrypoint
      );

      const recipt = await sendUserOp(signedUserOp);
      const event = await getFirstEvent(
        testTarget,
        recipt.blockNumber,
        "Invoked"
      );
      expect(event.args.sender).to.equal(wallet.address);
    });
  });
});
