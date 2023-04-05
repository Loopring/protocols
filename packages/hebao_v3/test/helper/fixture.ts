import { ethers } from "hardhat";
import { deployLibs } from "../commons";
import {
  createAccountOwner,
  createRandomWalletConfig,
  createRandomAccount,
  createAccountV2,
} from "./utils";
import { parseEther, arrayify, hexConcat, hexlify } from "ethers/lib/utils";

export async function walletImplFixture() {
  const libraries = await deployLibs();
  const entrypoint = await (
    await ethers.getContractFactory("EntryPoint")
  ).deploy();
  const blankOwner = await createAccountOwner();
  const priceOracle = await (
    await ethers.getContractFactory("TestPriceOracle")
  ).deploy();
  const smartWallet = await (
    await ethers.getContractFactory("SmartWallet", { libraries })
  ).deploy(
    ethers.constants.AddressZero /*price oracle*/,
    entrypoint.address,
    blankOwner.address
  );
  return smartWallet;
}

export async function proxyFixture() {
  const signers = await ethers.getSigners();
  const create2 = await (
    await ethers.getContractFactory("Create2Factory")
  ).deploy();
  const smartWalletImpl = await walletImplFixture();
  const implStorage = await (
    await ethers.getContractFactory("DelayedImplementationManager")
  ).deploy(smartWalletImpl.address, signers[0].address);
  const forwardProxy = await (
    await ethers.getContractFactory("ForwardProxy")
  ).deploy(implStorage.address);

  const entrypoint = await (
    await ethers.getContractFactory("EntryPoint")
  ).deploy();

  const accountOwner = await createAccountOwner();
  const walletConfig = await createRandomWalletConfig(accountOwner.address);

  const { proxy: account } = await createAccountV2(
    accountOwner,
    walletConfig,
    entrypoint.address,
    forwardProxy.address,
    create2
  );

  return { forwardProxy, implStorage, account, accountOwner, entrypoint };
}

export async function baseFixture() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const paymasterOwner = await createAccountOwner();
  const blankOwner = await createAccountOwner();
  const libraries = await deployLibs();
  const entrypoint = await (
    await ethers.getContractFactory("EntryPoint")
  ).deploy();
  const priceOracle = await (
    await ethers.getContractFactory("TestPriceOracle")
  ).deploy();

  const walletFactory = await (
    await ethers.getContractFactory("WalletFactory", { libraries })
  ).deploy(
    // priceOracle.address,
    ethers.constants.AddressZero /*price oracle*/,
    entrypoint.address,
    blankOwner.address
  );
  const paymaster = await (
    await ethers.getContractFactory("VerifyingPaymaster")
  ).deploy(entrypoint.address, paymasterOwner.address);

  const accountOwner = await createAccountOwner();

  await deployer.sendTransaction({
    to: accountOwner.address,
    value: parseEther("2"),
  });

  await paymaster.addStake(1, { value: parseEther("2") });
  await entrypoint.depositTo(paymaster.address, { value: parseEther("1") });

  return {
    entrypoint,
    accountOwner,
    paymaster,
    blankOwner,
    paymasterOwner,
    deployer,
    walletFactory,
  };
}

export async function fixture() {
  const context = await baseFixture();
  const { account, guardians } = await createRandomAccount(
    context.accountOwner,
    context.entrypoint,
    context.walletFactory
  );

  return {
    ...context,
    account,
    guardians,
  };
}
