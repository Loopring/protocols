import { ethers } from "hardhat";

import {
  EntryPoint__factory,
  SmartWalletV3__factory,
  WalletFactory__factory,
  DelayedImplementationManager__factory,
  VerifyingPaymaster__factory,
} from "./../typechain-types";
import { simulationResultCatch } from "../test/helper/utils";

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const paymasterAddr = "0x9CA6FFC3cC53a50C7322ab7B70fd413C49A55Bfd";
  const paymaster = VerifyingPaymaster__factory.connect(
    paymasterAddr,
    deployer
  );
  const token = "0xD69d3e64D71844BBDdA51Cd7f23ED3631E9FAC49";
  await (await paymaster.addToken(token)).wait();
  // check success
  console.log(await paymaster.registeredToken(token));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
