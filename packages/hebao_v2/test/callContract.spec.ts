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
    it.only("wallet owner should be able to call other contract", async () => {
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
  });
});
