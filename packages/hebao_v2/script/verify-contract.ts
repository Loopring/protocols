const fs = require("fs");
const hre = require("hardhat");
const ethers = hre.ethers;

import { DeployTask } from "./types";

export async function verifyAll() {
  const deployResFile =
    "./script/data/deployment-" + hre.network.name + ".json";

  const tasks: DeployTask[] = JSON.parse(
    fs.readFileSync(deployResFile, "utf8")
  );
  for (const t of tasks) {
    console.log("verifying:", t);
    await verifyContract(t);
    console.log("verification succeeded!");
  }
}

export async function verifyContract(deployTask: DeployTask) {
  const libraries = {};
  deployTask.libs &&
    deployTask.libs.forEach((value, key) => (libraries[key] = value));

  await await hre.run("verify:verify", {
    address: deployTask.address,
    constructorArguments: deployTask.args,
    libraries
  });
}

verifyAll()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
