const hre = require("hardhat");
const ethers = hre.ethers;
import { newWalletImpl } from "../test/commons";

// run with: npx hardhat run --network arbitrum scripts/deploy-arbitrum.ts
async function main() {
  // We get the contract to deploy
  // const TestTargetContract = await ethers.getContractFactory("TestTargetContract");
  // const testTargetContract = await TestTargetContract.deploy();
  // console.log("Greeter deployed to:", testTargetContract);

  const walletImpl = await newWalletImpl();
  console.log("walletImpl address:", walletImpl.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
