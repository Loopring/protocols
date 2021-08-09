// run on arbitrum: npx hardhat run --network arbitrum scripts/deploy-and-setup.ts

const hre = require("hardhat");
const ethers = hre.ethers;
import { newWalletImpl, newWalletFactoryContract } from "../test/commons";
import { signCreateWallet } from "../test/helper/signatureUtils";
import BN = require("bn.js");

async function newWallet(walletFactoryAddress: string) {
  const ownerAccount = (await ethers.getSigners())[0];
  const ownerAddr = await ownerAccount.getAddress();
  const salt = new Date().getTime();
  const signature = signCreateWallet(
    walletFactoryAddress,
    ownerAddr,
    [],
    new BN(0),
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    new BN(0),
    salt
  );
  const walletConfig: any = {
    owner: ownerAddr,
    guardians: [],
    quota: 0,
    inheritor: ethers.constants.AddressZero,
    feeRecipient: ethers.constants.AddressZero,
    feeToken: ethers.constants.AddressZero,
    maxFeeAmount: 0,
    salt,
    signature: Buffer.from(signature.txSignature.slice(2), "hex")
  };

  const walletFactory = await (await ethers.getContractFactory(
    "WalletFactory"
  )).attach(walletFactoryAddress);

  const walletAddrComputed = await walletFactory.computeWalletAddress(
    ownerAddr,
    salt
  );
  console.log("walletAddrcomputed:", walletAddrComputed);

  const tx = await walletFactory.createWallet(walletConfig, 0, {
    gasLimit: 10000000
  });
  console.log("tx:", tx);
  const receipt = await tx.wait();
  console.log("receipt:", receipt);

  return walletAddrComputed;
}

async function newWalletFactory() {
  const walletFactory = await newWalletFactoryContract();
  return walletFactory;
}

async function addManager(contractAddr: string, manager: string) {
  const managableContract = await (await ethers.getContractFactory(
    "OwnerManagable"
  )).attach(contractAddr);
  await managableContract.addManager(manager);

  const isManager = await managableContract.isManager(manager);
  console.log("isManager:", isManager);
}

// [20210729] deployed at arbitrum testnet: 0xd5535729714618E57C42a072B8d56E72517f3800 (proxy)
async function deployOfficialGuardian() {
  const ownerAccount = (await ethers.getSigners())[0];
  const ownerAddr = await ownerAccount.getAddress();

  const proxy = await (await ethers.getContractFactory(
    "OwnedUpgradeabilityProxy"
  )).deploy();
  console.log("officialGuardian proxy address:", proxy.address);

  const officialGuardian = await (await ethers.getContractFactory(
    "OfficialGuardian"
  )).deploy();
  // console.log("officialGuardian address:", officialGuardian.address);

  await proxy.upgradeTo(officialGuardian.address);
  const proxyAsOfficialGuardian = await (await ethers.getContractFactory(
    "OfficialGuardian"
  )).attach(proxy.address);
  await proxyAsOfficialGuardian.initOwner(ownerAddr);
  await proxyAsOfficialGuardian.addManager(ownerAddr);
  console.log("add", ownerAddr, "as a manager");

  return proxy.address;
}

async function getWalletImplAddr(walletFactoryAddress: string) {
  const walletFactory = await (await ethers.getContractFactory(
    "WalletFactory"
  )).attach(walletFactoryAddress);

  const masterCopy = await walletFactory.walletImplementation();
  console.log("masterCopy:", masterCopy);
}

async function main() {
  const ownerAccount = (await ethers.getSigners())[0];
  const ownerAddr = await ownerAccount.getAddress();

  const walletFactory = await newWalletFactory();
  const masterCopy = await walletFactory.walletImplementation();
  console.log("walletFactory:", walletFactory.address);
  console.log("masterCopy:", masterCopy);

  await newWallet(walletFactory.address);

  // await getWalletImplAddr(walletFactory.address);
  const officialGuardianAddr = await deployOfficialGuardian();
  // await addManager(officialGuardianAddr, ownerAddr);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
