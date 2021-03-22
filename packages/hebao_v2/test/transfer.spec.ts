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
  let wallet: Contract;

  before(async () => {
    [account1] = await ethers.getSigners();

    const owner = await account1.getAddress();
    wallet = await newWallet(owner, ethers.constants.AddressZero, 0);
  });

  describe("transfer token", () => {
    it("owner should be able to do transfer eth of wallet", async () => {
      const tx = await wallet.addToWhitelist(whiteListedAddr);
    });
  });
});
