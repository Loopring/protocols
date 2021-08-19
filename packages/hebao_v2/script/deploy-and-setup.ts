// run on arbitrum: npx hardhat run --network arbitrum scripts/deploy-and-setup.ts

import BN = require("bn.js");
const hre = require("hardhat");
const ethers = hre.ethers;
import { newWalletImpl, newWalletFactoryContract } from "../test/commons";
import { signCreateWallet } from "../test/helper/signatureUtils";
import { deployWalletImpl, deployWalletFactory } from "./create2-deploy";

async function newWallet(walletFactoryAddress: string, _salt?: number) {
  const ownerAccount = (await ethers.getSigners())[0];
  const ownerAddr = await ownerAccount.getAddress();
  const salt = _salt ? _salt : new Date().getTime();
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

  const gasLimit = hre.network.config.chainId == 5 ? 6000000 : undefined;
  const tx = await walletFactory.createWallet(walletConfig, 0, { gasLimit });
  // console.log("tx:", tx);
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

async function walletCreationTest() {
  const ownerAccount = (await ethers.getSigners())[0];
  const ownerAddr = await ownerAccount.getAddress();

  const walletFactory = await newWalletFactory();
  const masterCopy = await walletFactory.walletImplementation();
  console.log("walletFactory:", walletFactory.address);
  console.log("masterCopy:", masterCopy);

  await newWallet(walletFactory.address);

  // await getWalletImplAddr(walletFactory.address);
  const officialGuardianAddr = await deployOfficialGuardian();
  await addManager(officialGuardianAddr, ownerAddr);
}

async function create2Test() {
  // const smartWalletAddr = await deployWalletImpl();
  // const walletFactoryAddr = await deployWalletFactory(smartWalletAddr);
  const walletFactoryAddr = "0x5621a77f8EbC9265A60b0E83B49db998aC046B9C";
  const newWalletAddr = await newWallet(walletFactoryAddr, 1629366091004);

  console.log("newWalletAddr:", newWalletAddr);
}

async function main() {
  // await walletCreationTest();
  await create2Test();
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
