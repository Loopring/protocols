import { expect } from "./setup";
import { signCreateWallet } from "./helper/signatureUtils";
import { sign } from "./helper/Signature";
import { newWallet, getContractABI, getFirstEvent } from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet", () => {
  let account1: Signer;
  let account2: Signer;
  let owner: string;
  let wallet: Contract;
  let LRC: Contract;
  let TestContract: Contract;
  before(async () => {
    [account1, account2] = await ethers.getSigners();

    owner = await account2.getAddress();
    wallet = (await newWallet(owner, ethers.constants.AddressZero, 0)).connect(
      account2
    );
    LRC = await (await ethers.getContractFactory("LRC")).deploy();
    TestContract = await (await ethers.getContractFactory(
      "TestTargetContract"
    )).deploy();
  });

  describe("callContract", () => {
    it("wallet owner should be able to call other contract", async () => {
      const callData = TestContract.interface.encodeFunctionData(
        "functionDefault",
        [10]
      );
      const tx = await wallet.callContract(
        TestContract.address,
        0,
        callData,
        false
      );
      const event = await getFirstEvent(
        TestContract,
        tx.blockNumber,
        "Invoked"
      );
      // console.log("event", event);
      // console.log("wallet address:", wallet.address);
      expect(event.args.sender).to.equal(wallet.address);
    });

    it("wallet owner should be able to approve token", async () => {
      const spender = "0x" + "11".repeat(20);
      const tx = wallet.approveToken(
        LRC.address,
        spender,
        ethers.utils.parseEther("1000"),
        true
      );
      const allowance = await LRC.allowance(wallet.address, spender);
      // console.log("allowance:", allowance);
      expect(allowance).to.equal(ethers.utils.parseEther("1000"));
    });

    it("approveThenCallContract", async () => {
      const spender = TestContract.address;
      const tx = wallet.approveToken(
        LRC.address,
        spender,
        ethers.utils.parseEther("1000"),
        true
      );
      const allowance = await LRC.allowance(wallet.address, spender);
      expect(allowance).to.equal(ethers.utils.parseEther("1000"));

      const callData = TestContract.interface.encodeFunctionData(
        "functionDefault",
        [10]
      );
      const tx2 = await wallet.callContract(
        TestContract.address,
        0,
        callData,
        false
      );
      const event = await getFirstEvent(
        TestContract,
        tx2.blockNumber,
        "Invoked"
      );
      // console.log("event", event);
      // console.log("wallet address:", wallet.address);
      expect(event.args.sender).to.equal(wallet.address);
    });
  });
});
