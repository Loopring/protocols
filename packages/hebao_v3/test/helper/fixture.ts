import { ethers } from "hardhat";
import { Wallet } from "ethers";
import { deploySingle, deployWalletImpl, createSmartWallet } from "./utils";
import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import {
  EntryPoint,
  SmartWalletV3,
  EntryPoint__factory,
  SmartWalletV3__factory,
  WalletFactory,
  WalletFactory__factory,
  WalletProxy__factory,
  VerifyingPaymaster,
  VerifyingPaymaster__factory,
  LoopringCreate2Deployer,
} from "../../typechain-types";
import { localUserOpSender, fillAndSign, SendUserOp } from "./AASigner";

export async function fixture() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const paymasterOwner = signers[1];
  const blankOwner = signers[2];

  // create2 factory

  let create2 = await (
    await ethers.getContractFactory("LoopringCreate2Deployer")
  ).deploy();

  // entrypoint and paymaster
  const entrypoint = EntryPoint__factory.connect(
    (await deploySingle(create2, "EntryPoint")).address,
    deployer
  );
  // const entrypointAddr = "0x515aC6B1Cd51BcFe88334039cC32e3919D13b35d";
  // const entrypoint = await ethers.getContractAt("EntryPoint", entrypointAddr);

  const paymaster = await deploySingle(create2, "VerifyingPaymaster", [
    entrypoint.address,
    paymasterOwner.address,
  ]);

  const smartWalletImpl = await deployWalletImpl(
    create2,
    entrypoint.address,
    blankOwner.address
  );

  const implStorage = await deploySingle(
    create2,
    "DelayedImplementationManager",
    // deployer as implementation manager
    [smartWalletImpl.address]
  );

  const forwardProxy = await deploySingle(create2, "ForwardProxy", [
    implStorage.address,
  ]);

  const walletFactory = WalletFactory__factory.connect(
    (await deploySingle(create2, "WalletFactory", [forwardProxy.address]))
      .address,
    deployer
  );
  // transfer wallet factory ownership to deployer
  await create2.setTarget(walletFactory.address);
  const transferWalletFactoryOwnership =
    await walletFactory.populateTransaction.transferOwnership(deployer.address);
  await create2.transact(transferWalletFactoryOwnership.data);
  await walletFactory.addOperator(deployer.address);

  // transfer DelayedImplementationManager ownership to deployer
  await create2.setTarget(implStorage.address);
  const transferImplStorageOwnership =
    await implStorage.populateTransaction.transferOwnership(deployer.address);
  await create2.transact(transferImplStorageOwnership.data);

  // create demo wallet
  const smartWalletOwner = await ethers.Wallet.createRandom().connect(
    ethers.provider
  );
  // prepare eth for walletowner
  await helpers.setBalance(
    smartWalletOwner.address,
    ethers.utils.parseEther("100")
  );
  const sendUserOp = localUserOpSender(entrypoint.address, deployer);

  const guardians: Wallet[] = [];
  for (let i = 0; i < 2; i++) {
    guardians.push(await ethers.Wallet.createRandom().connect(ethers.provider));
  }
  const smartWalletAddr = await createSmartWallet(
    smartWalletOwner,
    guardians.map((g) => g.address.toLowerCase()).sort(),
    walletFactory
  );
  const smartWallet = SmartWalletV3__factory.connect(
    smartWalletAddr,
    smartWalletOwner
  );

  // predeposit for smartwallet and paymaster in entrypoint
  await entrypoint.depositTo(smartWallet.address, {
    value: ethers.utils.parseEther("100"),
  });
  await entrypoint.depositTo(paymaster.address, {
    value: ethers.utils.parseEther("100"),
  });

  // deploy mock usdt token for test.
  const usdtToken = await deploySingle(create2, "USDT");
  return {
    entrypoint,
    paymaster: VerifyingPaymaster__factory.connect(
      paymaster.address,
      paymasterOwner
    ),
    forwardProxy,
    smartWallet,
    create2,
    deployer,
    paymasterOwner,
    blankOwner,
    smartWalletOwner,
    usdtToken,
    sendUserOp,
    smartWalletImpl,
    guardians,
  };
}
