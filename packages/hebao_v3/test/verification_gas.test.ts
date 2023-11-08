import { ethers } from "hardhat";
import { expect } from "chai";
import { Wallet, BigNumberish, BigNumber } from "ethers";
import { fixture } from "./helper/fixture";
import _ from "lodash";
import { arrayify } from "ethers/lib/utils";
import {
  loadFixture,
  setBalance,
  time,
  takeSnapshot,
} from "@nomicfoundation/hardhat-network-helpers";
import { EntryPoint } from "../typechain-types";
import {
  GuardianLib__factory,
  SmartWalletV3__factory,
} from "../typechain-types";
import {
  getBlockTimestamp,
  createSmartWallet,
  simulationResultCatch,
} from "./helper/utils";
import {
  fillUserOp,
  getUserOpHash,
  UserOperation,
  fillAndMultiSignForApproveToken,
  fillAndMultiSignForAddGuardian,
  callDataCost,
  packUserOp,
  Approval,
} from "./helper/AASigner";
import BN from "bn.js";

describe("verification gaslimit test", () => {
  async function generateApprovals(
    smartWalletOrEOASigners: { signer: Wallet; smartWalletAddress?: string }[],
    smartWalletAddr: string,
    verifyingContract: string,
    token: string,
    to: string,
    amount: BigNumberish,
    validUntil: number,
    chainId: number
  ) {
    // use typedData hash instead
    const types = {
      approveToken: [
        { name: "wallet", type: "address" },
        { name: "validUntil", type: "uint256" },
        { name: "token", type: "address" },
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
      ],
    };

    const domain = {
      name: "LoopringWallet",
      version: "2.0.0",
      chainId,
      verifyingContract,
    };
    const message = {
      types,
      domain,
      primaryType: "approveToken",
      value: {
        validUntil,
        wallet: smartWalletAddr,
        token,
        to,
        amount,
      },
    };

    const signatures = await Promise.all(
      smartWalletOrEOASigners.map((g) =>
        g.signer._signTypedData(message.domain, message.types, message.value)
      )
    );
    const [sortedSigners, sortedSignatures] = _.unzip(
      _.sortBy(
        _.zip(
          smartWalletOrEOASigners.map((g) =>
            g.smartWalletAddress
              ? g.smartWalletAddress.toLowerCase()
              : g.signer.address.toLowerCase()
          ),
          signatures
        ),
        (item) => item[0]
      )
    );

    const approval = {
      signers: sortedSigners,
      signatures: sortedSignatures,
      validUntil,
    };
    return approval;
  }

  async function estimateUserOpGas(
    entryPoint: EntryPoint,
    userOp1: UserOperation
  ) {
    const userOp = {
      ...userOp1,
      // default values for missing fields.
      paymasterAndData: "0x",
      maxFeePerGas: 0,
      maxPriorityFeePerGas: 0,
      preVerificationGas: 0,
      verificationGasLimit: 10e6,
    };

    const { returnInfo } = await entryPoint.callStatic
      .simulateValidation(userOp)
      .catch(simulationResultCatch);
    const verificationGasLimit = returnInfo.preOpGas;

    const callGasLimit = await ethers.provider.estimateGas({
      from: entryPoint.address,
      to: userOp.sender,
      data: userOp.callData,
    });
    const rate = BigNumber.from(12);
    const base = 10;

    const preVerificationGas = BigNumber.from(
      callDataCost(packUserOp(userOp, false))
    );
    return {
      preVerificationGas: preVerificationGas.mul(rate).div(base),
      callGasLimit: callGasLimit.mul(rate).div(base),
      verificationGasLimit: verificationGasLimit.mul(rate).div(base),
    };
  }

  async function getEIP1559GasPrice(maxPriorityFeePerGas1?: number) {
    const block = await ethers.provider.getBlock("latest");
    const maxPriorityFeePerGas = maxPriorityFeePerGas1 ?? 1e9; // default
    const maxFeePerGas = block.baseFeePerGas.add(maxPriorityFeePerGas);
    return {
      maxPriorityFeePerGas,
      maxFeePerGas,
    };
  }

  function encodeSignature(approval: Approval, ownerSignature: string) {
    const signature = ethers.utils.defaultAbiCoder.encode(
      [
        "tuple(address[] signers,bytes[] signatures,uint256 validUntil)",
        "bytes",
      ],
      [approval, ownerSignature]
    );
    return signature;
  }

  it("approvals of multiple guardians", async () => {
    const {
      sendUserOp,
      create2,
      entrypoint,
      smartWalletOwner,
      smartWallet,
      guardians,
      walletFactory,
      usdtToken,
      deployer,
      smartWalletImpl,
    } = await loadFixture(fixture);
    const chainId = await ethers.provider
      .getNetwork()
      .then((net) => net.chainId);

    // use new guardian signature to approve token
    const receiver = deployer.address;
    const tokenAmount = ethers.utils.parseUnits("100", 6);
    const validUntil = 0;
    const nonce = 0;
    // prepare userOp first
    const approveTokenWA = await smartWallet.populateTransaction.approveTokenWA(
      usdtToken.address,
      receiver,
      tokenAmount
    );
    // generate approvals of guardian
    const approval = await generateApprovals(
      [
        { signer: smartWalletOwner },
        { signer: guardians[0] },
        { signer: guardians[1] },
      ],
      smartWallet.address,
      smartWalletImpl.address,
      usdtToken.address,
      receiver,
      tokenAmount,
      validUntil,
      chainId
    );
    const gasPriceData = await getEIP1559GasPrice();

    // only used to estimate gas
    const fakeSignature = encodeSignature(approval, "0x" + "0".repeat(130));
    const userOp = {
      sender: smartWallet.address,
      nonce,
      callData: approveTokenWA.data,
      paymasterAndData: "0x",
      initCode: "0x",
      callGasLimit: 0,
      verificationGasLimit: 0,
      preVerificationGas: 0,
      ...gasPriceData,
      // use truly guardian signatures
      signature: fakeSignature,
    };

    // estimate all kinds of gas
    const gas = await estimateUserOpGas(entrypoint, userOp);
    const finalUserOp = {
      ...userOp,
      ...gas,
    };

    // get owner signature
    const userOpHash = getUserOpHash(finalUserOp, entrypoint.address, chainId);
    const ownerSignature = await smartWalletOwner.signMessage(
      arrayify(userOpHash)
    );
    const signature = encodeSignature(approval, ownerSignature);
    const signedUserOp = { ...finalUserOp, signature };

    const { returnInfo } = await entrypoint.callStatic
      .simulateValidation(signedUserOp)
      .catch(simulationResultCatch);
    // check estimated verificationGasLimit is greater than actual used verification gas
    expect(gas.verificationGasLimit).gt(
      returnInfo.preOpGas.sub(signedUserOp.preVerificationGas)
    );

    await sendUserOp(signedUserOp);
    expect(await usdtToken.allowance(smartWallet.address, receiver)).to.eq(
      tokenAmount
    );
  });
  it("estimate gas when using paymaster", async () => {});
});
