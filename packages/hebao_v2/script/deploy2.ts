import { ethers } from "hardhat";
import { deployWalletImpl } from "./deploy_utils";

async function main() {
  const deployer = (await ethers.getSigners())[0];
  const create2Addr = "0x391fD52903D1531fd45F41c4A354533c91289F5F";
  if ((await ethers.provider.getCode(create2Addr)) === "0x") {
    throw new Error(`deploy LoopringCreate2Deployer contract first please!`);
  }
  const create2 = await ethers.getContractAt(
    "LoopringCreate2Deployer",
    create2Addr,
  );

  // deploy wallet implementation
  const smartWalletImpl = await deployWalletImpl(create2, deployer.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
