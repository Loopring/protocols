import { expect } from "./setup";
import { signCreateWallet } from "./helper/signatureUtils";
import { sign } from "./helper/Signature";
import {
  newWallet,
  getFirstEvent,
  advanceTime,
  getBlockTimestamp,
  timeAlmostEqual
} from "./commons";
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
  before(async () => {
    [account1, account2] = await ethers.getSigners();

    owner = await account2.getAddress();
    wallet = (await newWallet(owner, ethers.constants.AddressZero, 0)).connect(
      account2
    );
    LRC = await (await ethers.getContractFactory("LRC")).deploy();
  });

  describe("upgrade", () => {
    it("wallet should be able to upgrade its implementation with enough approval", async () => {
      // no guardian
    });
  });
});
