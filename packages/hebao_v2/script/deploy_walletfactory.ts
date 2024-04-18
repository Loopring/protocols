import { ethers } from "hardhat";
import { deployWalletImpl, deploySingle } from "./deploy_utils";

async function main() {
  const deployer = (await ethers.getSigners())[0];
  // prepare create2 deployer before
  const create2Addr = "0x391fD52903D1531fd45F41c4A354533c91289F5F";
  const create2 = await ethers.getContractAt(
    "LoopringCreate2Deployer",
    create2Addr,
    deployer
  );
  if ((await create2.owner()) !== deployer.address) {
    throw new Error(
      `deployer(${deployer.address}) is not owner of LoopringCreate2Deployer(${create2Addr})`
    );
  }

  // deploy wallet implementation
  const smartWalletImpl = await deployWalletImpl(
    create2,
    "0xd54f3bDe60B73614905BA3881954d9FeB2476360"
  );

  const implStorage = await deploySingle(
    create2,
    "DelayedImplementationManager",
    [smartWalletImpl.address]
  );

  const forwardProxy = await deploySingle(create2, "ForwardProxy", [
    implStorage.address,
  ]);

  const walletFactory = await deploySingle(create2, "WalletFactory", [
    forwardProxy.address,
  ]);

  if ((await create2.owner()) !== deployer.address) {
    if (create2.pendingOwner() === deployer.address) {
      // claim ownership
      await (await create2.claimOwnership()).wait();
    } else {
      throw new Error(
        `deployer: ${deployer.address} is not owner of create2: ${create2.address}`
      );
    }
  }

  const factoryCurrentOwner = await walletFactory.owner();
  if (create2.address == factoryCurrentOwner) {
    await create2.setTarget(walletFactory.address);
    const transferWalletFactoryOwnership =
      await walletFactory.populateTransaction.transferOwnership(
        deployer.address
      );
    // transfer ownership of wallet factory from create2 to deployer
    await create2.transact(transferWalletFactoryOwnership.data);
    console.log("transfer ownership of wallet factory successfully");
  } else {
    console.log(`ownership of wallet factory is transfered already`);
  }

  // operator
  const operatorList = [
    //dev
    "0x8Ea180381D0DbFC9E40842Fc1ccDBBc2445D196f",
    // uat
    "0xbd64ef53FB86860fD72D4f35120B900CFDd9c521",
    // prod
    "0xb1a6bf349c947a540a5fe6f1e89992acdad836ab",
    "0xedee915ae45cc4b2fdd1ce12a2f70dca0b2ad9e5",
    "0xd15953bd7cbcb36b69d4b9961b56f59cc2553d2e",
    "0xA5b2DA9ddfCc4E554bB255D9989fdD7be3858Bc9",
  ];
  console.log(`----- prepare operators for wallet factory -----`);
  for (const operator of operatorList) {
    if (!(await walletFactory.isOperator(operator))) {
      await (await walletFactory.addOperator(operator)).wait();
    }
  }
  console.log(`---- all operators is added for wallet factory -----`);

  // transfer DelayedImplementationManager ownership to deployer
  const managerCurrentOwner = await implStorage.owner();
  if (create2.address == managerCurrentOwner) {
    await create2.setTarget(implStorage.address);
    const transferImplStorageOwnership =
      await implStorage.populateTransaction.transferOwnership(deployer.address);
    await create2.transact(transferImplStorageOwnership.data);
    console.log("transfer ownership of implStorage successfully");
  } else {
    console.log(`ownership of implStorage is transfered already`);
  }
  // const oldOwner = "0x7D3C67E008709D076e1e6F33da4c5296D4383C0C";
  const oldOwner = undefined;

  // update to new impl, deployed using eip4337 version
  const newImpl = "0x05aBa4EF2B0ddc5fCab1A13B72ABCe10032214D7";
  const currImpl = await implStorage.currImpl();
  if (currImpl !== newImpl) {
    const nextImpl = await implStorage.nextImpl();
    if (nextImpl !== newImpl) {
      await (await implStorage.delayedUpgradeTo(newImpl, 1)).wait();
      console.log("prepare to upgrade");
    } else {
      console.log("already prepare to upgrade");
    }

    // update after one day
    const { timestamp } = await ethers.provider.getBlock("latest");
    if ((await implStorage.nextEffectiveTime()) <= timestamp) {
      await (await implStorage.executeUpgrade()).wait();
      // check
      console.log(`upgrade to new impl(${newImpl}) successfully`);
      if (
        oldOwner !== undefined &&
        (await walletFactory.owner()) === deployer.address
      ) {
        // transfer ownership to offical after upgrade
        await (await implStorage.transferOwnership(oldOwner)).wait();
      }
    } else {
      console.log(`wait for one day`);
    }
  }
  if (
    oldOwner !== undefined &&
    (await walletFactory.owner()) === deployer.address
  ) {
    // transfer ownership to offical
    await (await walletFactory.transferOwnership(oldOwner)).wait();
  }

  // transfer ownership of create2 back to previous owner
  // await (await create2.transferOwnership(oldOwner)).wait();
  // only called by old owner
  // await (await create2.claimOwnership()).wait()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
