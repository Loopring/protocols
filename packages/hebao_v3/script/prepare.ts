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
  const tokens = [
    "0xD69d3e64D71844BBDdA51Cd7f23ED3631E9FAC49",
    "0xae2C46ddb314B9Ba743C6dEE4878F151881333D9",
  ];
  for (const token of tokens) {
    if (await paymaster.registeredToken(token)) {
      console.log(`token: ${token} is registerd already`);
    } else {
      await (await paymaster.addToken(token)).wait();
      console.log(`token: ${token} is registerd successfully`);
    }
    // check success
  }
  const operators = ["0xE6FDa200797a5B8116e69812344cE7D2A9F17B0B"];
  const signerRole = await paymaster.SIGNER();
  for (const operator of operators) {
    if (await paymaster.hasRole(signerRole, operator)) {
      console.log(`operator ${operator} has permission already`);
    } else {
      await (await paymaster.grantRole(signerRole, operator)).wait();
      console.log(`grant role to ${operator} successfully`);
    }
  }

  // prepare transaction fee for paymaster in entrypoint
  const balance = await paymaster.getDeposit();
  const minBalance = ethers.utils.parseEther("0.1");
  if (balance.lt(minBalance)) {
    console.log(
      `current balance: ${balance.toString()} is less than minBalance${minBalance.toString()}`
    );
    await (await paymaster.deposit({ value: minBalance })).wait();
  } else {
    console.log(
      `current balance: ${balance.toString()} is enough to pay transaction fee`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
