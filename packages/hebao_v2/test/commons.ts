const { ethers } = require("hardhat");
import { Contract } from "ethers";

export async function newWalletFactoryContract(deployer?: string) {
  let testPriceOracle: Contract;
  let smartWallet: Contract;
  let walletFactory: Contract;

  testPriceOracle = await (await ethers.getContractFactory("TestPriceOracle"))
    .deploy();

  const ERC1271Lib = await (await ethers.getContractFactory("ERC1271Lib"))
    .deploy();
  const ERC20Lib = await (await ethers.getContractFactory("ERC20Lib"))
    .deploy();
  const GuardianLib = await (await ethers.getContractFactory("GuardianLib"))
    .deploy();
  const InheritanceLib = await (await ethers.getContractFactory("InheritanceLib"))
    .deploy();
  const LockLib = await (await ethers.getContractFactory("LockLib", {
    libraries: {
      GuardianLib: GuardianLib.address
    }
  }))
    .deploy();
  const MetaTxLib = await (await ethers.getContractFactory("MetaTxLib", {
    libraries: {
      ERC20Lib: ERC20Lib.address
    }
  }))
    .deploy();
  const QuotaLib = await (await ethers.getContractFactory("QuotaLib"))
    .deploy();
  const RecoverLib = await (await ethers.getContractFactory("RecoverLib", {
    libraries: {
      GuardianLib: GuardianLib.address
    }
  }))
    .deploy();
  const UpgradeLib = await (await ethers.getContractFactory("UpgradeLib"))
    .deploy();
  const WhitelistLib = await (await ethers.getContractFactory("WhitelistLib"))
    .deploy();

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
  }))
    .deploy(testPriceOracle.address);

  walletFactory = await (await ethers.getContractFactory("WalletFactory"))
    .deploy(smartWallet.address);

  await walletFactory.deployed();

  if (deployer) {
    return await walletFactory.connect(deployer)
  } else {
    return walletFactory;
  }
}
