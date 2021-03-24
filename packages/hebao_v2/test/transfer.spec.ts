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

  describe("transfer token", () => {
    it.only("owner should be able to do transfer eth of wallet", async () => {
      // console.log("wallet address:", wallet.address);

      // send eth to wallet:
      const tx = await account2.sendTransaction({
        from: owner,
        to: wallet.address,
        value: ethers.utils.parseEther("100")
      });

      const walletEthBalance = await ethers.provider.getBalance(wallet.address);
      expect(walletEthBalance).to.equal(ethers.utils.parseEther("100"));

      const to = "0x" + "33".repeat(20);
      // send ether:
      const tx2 = await wallet.transferToken(
        ethers.constants.AddressZero,
        to,
        ethers.utils.parseEther("10"),
        [],
        false
      );
      const walletEthBalanceAfter = await ethers.provider.getBalance(
        wallet.address
      );
      const toBalance = await ethers.provider.getBalance(to);
      expect(walletEthBalanceAfter).to.equal(ethers.utils.parseEther("90"));
      expect(toBalance).to.equal(ethers.utils.parseEther("10"));
    });
  });
});
