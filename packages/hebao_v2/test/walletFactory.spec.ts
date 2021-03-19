import { expect } from "./setup";
import { signCreateWallet } from "./helper/signatureUtils";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet lock", () => {
  let account1: Signer;
  let account2: Signer;
  let account3: Signer;

  let TestPriceOracle: Contract;
  let SmartWallet: Contract;
  let WalletFactory: Contract;

  before(async () => {
    [account1, account2, account3] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("GTO");

    const hardhatToken = await Token.deploy();

    // console.log("account1:", account1);

    // const factory = await ethers.getContractFactory("TestPriceOracle");
    // console.log("factory:", factory);
    // TestPriceOracle = await factory.deploy();
    // console.log("TestPriceOracle:", TestPriceOracle);

    // SmartWallet = await (await ethers.getContractFactory("SmartWallet"))
    //   .connect(account1)
    //   .deploy(TestPriceOracle.address);

    // WalletFactory = await (await ethers.getContractFactory("WalletFactory"))
    //   .connect(account1)
    //   .deploy(SmartWallet.address);
  });

  describe("create wallet", () => {
    it.only("should be able to create new wallet", async () => {
      const signature = signCreateWallet(
        WalletFactory.address,
        await account1.getAddress(),
        [],
        new BN(0),
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        new BN(0),
        1
      );

      const walletConfig: any = {
        owner: await account2.getAddress(),
        guardians: [],
        quota: 0,
        inheritor: ethers.constants.AddressZero,
        feeRecipient: await account3.getAddress(),
        feeToken: ethers.constants.AddressZero,
        feeAmount: 0,
        signature
      };

      // expect(await ERC20.name()).to.equal(name);
    });
  });
});
