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
  if (deployer.address != factoryCurrentOwner) {
    await create2.setTarget(walletFactory.address);
    const transferWalletFactoryOwnership =
      await walletFactory.populateTransaction.transferOwnership(
        deployer.address
      );
    // transfer ownership of wallet factory from create2 to deployer
    await create2.transact(transferWalletFactoryOwnership.data);
  }

  // operator
  const operator = "0x";
  if (!(await walletFactory.isOperator(operator))) {
    await (await walletFactory.addOperator(operator)).wait();
  }

  // transfer DelayedImplementationManager ownership to deployer
  const managerCurrentOwner = await implStorage.owner();
  if (deployer.address != managerCurrentOwner) {
    await create2.setTarget(implStorage.address);
    const transferImplStorageOwnership =
      await implStorage.populateTransaction.transferOwnership(deployer.address);
    await create2.transact(transferImplStorageOwnership.data);
  }

  // update to new impl, deployed using eip4337 version
  const newImpl = "0x";
  await (await implStorage.delayedUpgradeTo(newImpl, 1)).wait();

  // update after one day
  await (await implStorage.executeUpgrade()).wait();

  const oldOwner = "0x";
  // transfer ownership of create2 back to previous owner
  await (await create2.transferOwnership(oldOwner)).wait();
  // only called by old owner
  // await (await create2.claimOwnership()).wait()
  // transfer ownership of wallet factory and impl storage to offical
  await (await implStorage.transferOwnership(oldOwner)).wait();
  await (await walletFactory.transferOwnership(oldOwner)).wait();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
