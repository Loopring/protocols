// run on arbitrum: npx hardhat run --network arbitrum scripts/deploy-and-setup.ts

const hre = require("hardhat");
const ethers = hre.ethers;
import { newWalletImpl, newWalletFactoryContract } from "../test/commons";
import { signCreateWallet } from "../test/helper/signatureUtils";
import BN = require("bn.js");

async function newSingleFactory() {
  // https://eips.ethereum.org/EIPS/eip-2470
  const singleFactoryAddress = "0xce0042B868300000d44A59004Da54A005ffdcf9f";

  const iface = new ethers.utils.Interface([
    "function deploy(bytes memory _initCode, bytes32 _salt) public returns (address payable createdContract)",
  ]);
  const [signer] = await ethers.getSigners();
  return new ethers.Contract(singleFactoryAddress, iface, signer);
}

async function deploySingle(
  contractName: string,
  args?: any[],
  libs?: Map<string, any>,
) {
  // use same salt for all deployments:
  const salt = ethers.utils.formatBytes32String("0x5");
  const gasLimit = hre.network.config.chainId == 5 ? 6000000 : undefined;

  const libraries = {}; // libs ? Object.fromEntries(libs) : {}; // requires lib: ["es2019"]
  libs && libs.forEach((value, key) => (libraries[key] = value));
  console.log("libraries:", libraries);

  const contract = await ethers.getContractFactory(contractName, { libraries });
  let deployableCode = contract.bytecode;
  if (args && args.length > 0) {
    deployableCode = ethers.utils.hexConcat([
      deployableCode,
      contract.interface.encodeDeploy(args),
    ]);
  }

  const deployFactory = await newSingleFactory();
  await deployFactory.deploy(deployableCode, salt, { gasLimit });
  const deployedAddress = ethers.utils.getCreate2Address(
    deployFactory.address,
    salt,
    ethers.utils.keccak256(deployableCode),
  );

  console.log(contractName, "deployed, address:", deployedAddress);
  return deployedAddress;
}

export async function deployWalletImpl() {
  const ERC1271LibAddr = await deploySingle("ERC1271Lib");
  const ERC20LibAddr = await deploySingle("ERC20Lib");
  const GuardianLibAddr = await deploySingle("GuardianLib");
  const InheritanceLibAddr = await deploySingle("InheritanceLib");
  const QuotaLibAddr = await deploySingle("QuotaLib");
  const UpgradeLibAddr = await deploySingle("UpgradeLib");
  const WhitelistLibAddr = await deploySingle("WhitelistLib");
  const LockLibAddr = await deploySingle(
    "LockLib",
    undefined,
    new Map([["GuardianLib", GuardianLibAddr]]),
  );
  const RecoverLibAddr = await deploySingle(
    "RecoverLib",
    undefined,
    new Map([["GuardianLib", GuardianLibAddr]]),
  );
  const MetaTxLibAddr = await deploySingle(
    "MetaTxLib",
    undefined,
    new Map([["ERC20Lib", ERC20LibAddr]]),
  );

  const blankOwner = await (await ethers.getSigners())[0].getAddress();
  const SmartWalletAddr = await deploySingle(
    "SmartWallet",
    [ethers.constants.AddressZero, blankOwner],
    new Map([
      ["ERC1271Lib", ERC1271LibAddr],
      ["ERC20Lib", ERC20LibAddr],
      ["GuardianLib", GuardianLibAddr],
      ["InheritanceLib", InheritanceLibAddr],
      ["LockLib", LockLibAddr],
      ["MetaTxLib", MetaTxLibAddr],
      ["QuotaLib", QuotaLibAddr],
      ["RecoverLib", RecoverLibAddr],
      ["UpgradeLib", UpgradeLibAddr],
      ["WhitelistLib", WhitelistLibAddr],
    ]),
  );

  return SmartWalletAddr;
}

export async function deployWalletFactory(smartWalletAddr: string) {
  const walletFactoryAddr = await deploySingle("WalletFactory", [
    smartWalletAddr,
  ]);
  return walletFactoryAddr;
}
