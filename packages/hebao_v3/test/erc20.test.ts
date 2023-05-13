import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumberish, Wallet, PopulatedTransaction } from "ethers";
import {
  signChangeDailyQuotaWA,
  signApproveTokenWA,
  signCallContractWA,
} from "./helper/signatureUtils";
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
import { fillAndSign, UserOperation, fillUserOp } from "./helper/AASigner";
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

    const recipt = await sendTx(
      [approve, transferToken, callcontract],
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint,
      sendUserOp
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
      const tx = await smartWallet.populateTransaction.approveTokenWA(
        usdtToken.address,
        toAddr,
        amount.toString()
      );
      const partialUserOp = {
        sender: smartWallet.address,
        nonce: 0,
        callData: tx.data,
        callGasLimit: "126880",
      };
      const userOp = await fillUserOp(
        partialUserOp,
        create2.address,
        entrypoint
      );
      const validUntil = new Date().getTime() + 1000 * 3600 * 24; // one day
      const masterCopy = smartWalletImpl.address;
      const sig1 = signApproveTokenWA(
        masterCopy,
        smartWallet.address,
        new BN(validUntil),
        usdtToken.address,
        toAddr,
        amount,
        smartWalletOwner.address,
        smartWalletOwner.privateKey.slice(2)
      );
      const sig2 = signApproveTokenWA(
        masterCopy,
        smartWallet.address,
        new BN(validUntil),
        usdtToken.address,
        toAddr,
        amount,
        guardians[0].address,
        guardians[0].privateKey.slice(2)
      );

      const sortedSigs = sortSignersAndSignatures(
        [smartWalletOwner.address, guardians[0].address],
        [
          Buffer.from(sig1.txSignature.slice(2), "hex"),
          Buffer.from(sig2.txSignature.slice(2), "hex"),
        ]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: smartWallet.address,
      };

      const signature = ethers.utils.defaultAbiCoder.encode(
        [
          "tuple(address[] signers,bytes[] signatures,uint256 validUntil,address wallet)",
        ],
        [approval]
      );
      const signedUserOp = {
        ...userOp,
        signature,
      };
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
      const tx = await smartWallet.populateTransaction.callContractWA(
        testTarget.address,
        0,
        functionDefault.data
      );
      const partialUserOp = {
        sender: smartWallet.address,
        nonce: 0,
        callData: tx.data,
      };
      const userOp = await fillUserOp(
        partialUserOp,
        create2.address,
        entrypoint
      );
      const validUntil = new Date().getTime() + 1000 * 3600 * 24; // one day
      const masterCopy = smartWalletImpl.address;
      const sig1 = signCallContractWA(
        masterCopy,
        smartWallet.address,
        new BN(validUntil),
        testTarget.address,
        new BN(0),
        Buffer.from(functionDefault.data.slice(2), "hex"),
        smartWalletOwner.address,
        smartWalletOwner.privateKey.slice(2)
      );
      const sig2 = signCallContractWA(
        masterCopy,
        smartWallet.address,
        new BN(validUntil),
        testTarget.address,
        new BN(0),
        Buffer.from(functionDefault.data.slice(2), "hex"),
        guardians[0].address,
        guardians[0].privateKey.slice(2)
      );

      const sortedSigs = sortSignersAndSignatures(
        [smartWalletOwner.address, guardians[0].address],
        [
          Buffer.from(sig1.txSignature.slice(2), "hex"),
          Buffer.from(sig2.txSignature.slice(2), "hex"),
        ]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: smartWallet.address,
      };

      const signature = ethers.utils.defaultAbiCoder.encode(
        [
          "tuple(address[] signers,bytes[] signatures,uint256 validUntil,address wallet)",
        ],
        [approval]
      );
      const signedUserOp = {
        ...userOp,
        signature,
      };
      const recipt = await sendUserOp(signedUserOp);
      // TODO(check result)
    });

    it("approveThenCallContract test", async () => {
      const { testTarget } = await loadFixture(fixture);
      const callData = testTarget.interface.encodeFunctionData(
        "functionPayable",
        [10]
      );
    });
  });
});
