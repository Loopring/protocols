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

    TestPriceOracle = await (await ethers.getContractFactory("TestPriceOracle"))
      .connect(account1)
      .deploy();

    // * contracts/base/libwallet/ERC1271Lib.sol:ERC1271Lib
    // * contracts/base/libwallet/ERC20Lib.sol:ERC20Lib
    // * contracts/base/libwallet/GuardianLib.sol:GuardianLib
    // * contracts/base/libwallet/InheritanceLib.sol:InheritanceLib
    // * contracts/base/libwallet/LockLib.sol:LockLib
    // * contracts/base/libwallet/MetaTxLib.sol:MetaTxLib
    // * contracts/base/libwallet/QuotaLib.sol:QuotaLib
    // * contracts/base/libwallet/RecoverLib.sol:RecoverLib
    // * contracts/base/libwallet/UpgradeLib.sol:UpgradeLib
    // * contracts/base/libwallet/WhitelistLib.sol:WhitelistLib
    const ERC1271Lib = await (await ethers.getContractFactory("ERC1271Lib"))
      .connect(account1)
      .deploy();
    const ERC20Lib = await (await ethers.getContractFactory("ERC20Lib"))
      .connect(account1)
      .deploy();
    const GuardianLib = await (await ethers.getContractFactory("GuardianLib"))
      .connect(account1)
      .deploy();
    const InheritanceLib = await (await ethers.getContractFactory("InheritanceLib"))
      .connect(account1)
      .deploy();
    const LockLib = await (await ethers.getContractFactory("LockLib", {
      libraries: {
        GuardianLib: GuardianLib.address
      }
    }))
      .connect(account1)
      .deploy();
    const MetaTxLib = await (await ethers.getContractFactory("MetaTxLib", {
      libraries: {
        ERC20Lib: ERC20Lib.address
      }
    }))
      .connect(account1)
      .deploy();
    const QuotaLib = await (await ethers.getContractFactory("QuotaLib"))
      .connect(account1)
      .deploy();
    const RecoverLib = await (await ethers.getContractFactory("RecoverLib", {
      libraries: {
        GuardianLib: GuardianLib.address
      }
    }))
      .connect(account1)
      .deploy();
    const UpgradeLib = await (await ethers.getContractFactory("UpgradeLib"))
      .connect(account1)
      .deploy();
    const WhitelistLib = await (await ethers.getContractFactory("WhitelistLib"))
      .connect(account1)
      .deploy();

    SmartWallet = await (await ethers.getContractFactory("SmartWallet", {
      libraries: {
        ERC1271Lib: ERC1271Lib.address,
        ERC20Lib: ERC20Lib.address,
        GuardianLib: GuardianLib.address,
        InheritanceLib: InheritanceLib.address,
        LockLib: LockLib.address,
        MetaTxLib: MetaTxLib.address,
        QuotaLib: QuotaLib.address,
        RecoverLib: RecoverLib.address,
        UpgradeLib: UpgradeLib.address,
        WhitelistLib: WhitelistLib.address
      }
    }))
      .connect(account1)
      .deploy(TestPriceOracle.address);

    WalletFactory = await (await ethers.getContractFactory("WalletFactory"))
      .connect(account1)
      .deploy(SmartWallet.address);
  });

  describe("create wallet", () => {
    it.only("should be able to create new wallet", async () => {
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
