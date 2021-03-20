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
    console.log("account1:", account1);

    // TestPriceOracle = await (await ethers.getContractFactory("TestPriceOracle"))
    //   .deploy();

    // const ERC1271Lib = await (await ethers.getContractFactory("ERC1271Lib"))
    //   .deploy();
    // const ERC20Lib = await (await ethers.getContractFactory("ERC20Lib"))
    //   .deploy();
    // const GuardianLib = await (await ethers.getContractFactory("GuardianLib"))
    //   .deploy();
    // const InheritanceLib = await (await ethers.getContractFactory("InheritanceLib"))
    //   .deploy();
    // const LockLib = await (await ethers.getContractFactory("LockLib", {
    //   libraries: {
    //     GuardianLib: GuardianLib.address
    //   }
    // }))
    //   .deploy();
    // const MetaTxLib = await (await ethers.getContractFactory("MetaTxLib", {
    //   libraries: {
    //     ERC20Lib: ERC20Lib.address
    //   }
    // }))
    //   .deploy();
    // const QuotaLib = await (await ethers.getContractFactory("QuotaLib"))
    //   .deploy();
    // const RecoverLib = await (await ethers.getContractFactory("RecoverLib", {
    //   libraries: {
    //     GuardianLib: GuardianLib.address
    //   }
    // }))
    //   .deploy();
    // const UpgradeLib = await (await ethers.getContractFactory("UpgradeLib"))
    //   .deploy();
    // const WhitelistLib = await (await ethers.getContractFactory("WhitelistLib"))
    //   .deploy();

    // SmartWallet = await (await ethers.getContractFactory("SmartWallet", {
    //   libraries: {
    //     ERC1271Lib: ERC1271Lib.address,
    //     ERC20Lib: ERC20Lib.address,
    //     GuardianLib: GuardianLib.address,
    //     InheritanceLib: InheritanceLib.address,
    //     LockLib: LockLib.address,
    //     MetaTxLib: MetaTxLib.address,
    //     QuotaLib: QuotaLib.address,
    //     RecoverLib: RecoverLib.address,
    //     UpgradeLib: UpgradeLib.address,
    //     WhitelistLib: WhitelistLib.address
    //   }
    // }))
    //   .deploy(TestPriceOracle.address);

    // WalletFactory = await (await ethers.getContractFactory("WalletFactory"))
    //   .deploy(SmartWallet.address);

    // await WalletFactory.deployed();
  });

  describe("create wallet", () => {
    it("should be able to create new wallet", async () => {
      console.log("xxxxxxxxxxxxxxxx");

      // const signature = signCreateWallet(
      //   WalletFactory.address,
      //   await account1.getAddress(),
      //   [],
      //   new BN(0),
      //   ethers.constants.AddressZero,
      //   ethers.constants.AddressZero,
      //   ethers.constants.AddressZero,
      //   new BN(0),
      //   1
      // );

      // console.log("signature:", signature);

      // const walletConfig: any = {
      //   owner: await account2.getAddress(),
      //   guardians: [],
      //   quota: 0,
      //   inheritor: ethers.constants.AddressZero,
      //   feeRecipient: await account3.getAddress(),
      //   feeToken: ethers.constants.AddressZero,
      //   feeAmount: 0,
      //   signature
      // };

      // expect(await ERC20.name()).to.equal(name);
    });
  });
});
