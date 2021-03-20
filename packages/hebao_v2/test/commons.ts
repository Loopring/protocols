const { ethers } = require("hardhat");
import { Contract } from "ethers";

export async function getSmartContractInstance() {}

export async function newWalletFactoryContract(deployer?: string) {
  let testPriceOracle: Contract;
  let smartWallet: Contract;
  let walletFactory: Contract;

  testPriceOracle = await (await ethers.getContractFactory(
    "TestPriceOracle"
  )).deploy();

  const ERC1271Lib = await (await ethers.getContractFactory(
    "ERC1271Lib"
  )).deploy();
  const ERC20Lib = await (await ethers.getContractFactory("ERC20Lib")).deploy();
  const GuardianLib = await (await ethers.getContractFactory(
    "GuardianLib"
  )).deploy();
  const InheritanceLib = await (await ethers.getContractFactory(
    "InheritanceLib"
  )).deploy();
  const LockLib = await (await ethers.getContractFactory("LockLib", {
    libraries: {
      GuardianLib: GuardianLib.address
    }
  })).deploy();
  const MetaTxLib = await (await ethers.getContractFactory("MetaTxLib", {
    libraries: {
      ERC20Lib: ERC20Lib.address
    }
  })).deploy();
  const QuotaLib = await (await ethers.getContractFactory("QuotaLib")).deploy();
  const RecoverLib = await (await ethers.getContractFactory("RecoverLib", {
    libraries: {
      GuardianLib: GuardianLib.address
    }
  })).deploy();
  const UpgradeLib = await (await ethers.getContractFactory(
    "UpgradeLib"
  )).deploy();
  const WhitelistLib = await (await ethers.getContractFactory(
    "WhitelistLib"
  )).deploy();

  smartWallet = await (await ethers.getContractFactory("SmartWallet", {
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
  })).deploy(testPriceOracle.address);

  walletFactory = await (await ethers.getContractFactory(
    "WalletFactory"
  )).deploy(smartWallet.address);

  await walletFactory.deployed();

  if (deployer) {
    return await walletFactory.connect(deployer);
  } else {
    return walletFactory;
  }
}

export async function newWallet(owner: string, feeRecipient: string) {
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
  const walletFactory = await newWalletFactoryContract();

  const walletConfig: any = {
    owner,
    guardians: [],
    quota: 0,
    inheritor: ethers.constants.AddressZero,
    feeRecipient,
    feeToken: ethers.constants.AddressZero,
    feeAmount: 0,
    signature: []
  };

  const salt = 0;
  const walletAddrComputed = await walletFactory.computeWalletAddress(
    owner,
    salt
  );

  await walletFactory.createWallet(walletConfig, salt);

  const smartWallet = await (await ethers.getContractFactory("SmartWallet", {
    libraries: {
      ERC1271Lib: ethers.constants.AddressZero,
      ERC20Lib: ethers.constants.AddressZero,
      GuardianLib: ethers.constants.AddressZero,
      InheritanceLib: ethers.constants.AddressZero,
      LockLib: ethers.constants.AddressZero,
      MetaTxLib: ethers.constants.AddressZero,
      QuotaLib: ethers.constants.AddressZero,
      RecoverLib: ethers.constants.AddressZero,
      UpgradeLib: ethers.constants.AddressZero,
      WhitelistLib: ethers.constants.AddressZero
    }
  })).attach(walletAddrComputed);

  // console.log("SmartWallet:", smartWallet);
  return smartWallet;
}
