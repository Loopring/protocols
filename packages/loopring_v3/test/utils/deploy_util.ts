import { ethers } from "hardhat";
import assert from "assert";

export interface DeployTask {
  key?: string;
  contractName: string;
  verifiedName?: string;
  args?: any[];
  libs?: string[];
}

export async function deployTask(
  tasks: DeployTask[],
  deployResults: Record<string, string> = {}
) {
  for (const task of tasks) {
    const key = task.key ?? task.contractName;
    const libraries: Record<string, string> = {};
    task.libs?.forEach(
      (libName) => (libraries[libName] = deployResults[libName])
    );
    const args = processArgs(task.args ?? [], deployResults);
    if (ethers.utils.isAddress(deployResults[key])) {
      continue;
    }
    let contractAddr: string;
    const contractFactory = await ethers.getContractFactory(
      task.contractName,
      {
        libraries
      }
    );
    const contract = await (
      await contractFactory.deploy(...args)
    ).deployed();
    deployResults[key] = await contract.address;
  }
  return { deployResults };
}

export function processArgs(
  args: any[],
  deployResult: Record<string, string>
) {
  const newArgs: any[] = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      const newArrayArg = processArgs(arg, deployResult);
      newArgs.push(newArrayArg);
    } else {
      if (
        typeof arg === "string" &&
        (arg as string).startsWith(">>>")
      ) {
        const key = (arg as string).slice(3);
        // get addr from deployResult:
        let contractAddr: string = deployResult[key];
        assert(
          contractAddr,
          "Error: param contract " + key + " not deployed yet!"
        );
        newArgs.push(contractAddr);
      } else {
        newArgs.push(arg);
      }
    }
  }
  return newArgs;
}
