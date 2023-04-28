import { ethers } from "hardhat";

export async function fixture() {
  const create2 = await (
    await ethers.getContractFactory("LoopringCreate2Deployer")
  ).deploy();
  const salt = ethers.utils.formatBytes32String("0x5");

  // deploy contracts
  const entryPointFactory = await ethers.getContractFactory("EntryPoint");
  const deployableCode = entryPointFactory.getDeployTransaction().data;
  await create2.deploy(deployableCode, salt);
  return {};
}
