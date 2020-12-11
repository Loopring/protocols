import * as fs from "fs";
import { execAsync, newWeb3, Eth, infuraUrlGoerli } from "@freemanz/ts-utils";
import childProcess = require("child_process");
const assert = require("assert");

const web3 = newWeb3(
  "/usr/local/klzhong/private/priv-test.json",
  infuraUrlGoerli
);
const myeth = new Eth(web3, true);

interface DeployTask {
  contractName?: string;
  args?: any[];
  libs?: string[];
}

const reusedContracts = new Map([]);

const flattenSourceDir = "./loopring36-flattend-3.6.0-beta2/";
const resultFile = "./deploy-goerli-loopring-3_6_0-beta2-res.json";
const buildDir = "loopring36/build-3.6.0-beta2/";

const deployTasks: DeployTask[] = [
  {
    contractName: "ExchangeBalances"
  },
  {
    contractName: "ExchangeAdmins"
  },
  {
    contractName: "ExchangeTokens"
  },
  {
    contractName: "ExchangeWithdrawals",
    libs: ["ExchangeBalances", "ExchangeTokens"]
  },
  {
    contractName: "ExchangeGenesis",
    libs: ["ExchangeTokens"]
  },
  {
    contractName: "ExchangeDeposits",
    libs: ["ExchangeTokens"]
  },
  {
    contractName: "ExchangeBlocks",
    libs: ["ExchangeWithdrawals"]
  },
  {
    contractName: "ExchangeV3",
    libs: [
      "ExchangeBalances",
      "ExchangeAdmins",
      "ExchangeBlocks",
      "ExchangeTokens",
      "ExchangeGenesis",
      "ExchangeDeposits",
      "ExchangeWithdrawals"
    ]
  },
  {
    contractName: "AmmJoinRequest"
  },
  {
    contractName: "AmmExitRequest"
  },
  {
    contractName: "AmmStatus"
  },
  {
    contractName: "AmmWithdrawal"
  },
  {
    contractName: "LoopringAmmPool",
    libs: ["AmmJoinRequest", "AmmExitRequest", "AmmStatus", "AmmWithdrawal"]
  }
];

function loadDeployResult() {
  let deployResult = new Map();
  if (fs.existsSync(resultFile)) {
    deployResult = new Map(JSON.parse(fs.readFileSync(resultFile, "ascii")));
  }
  deployResult = new Map([...reusedContracts, ...deployResult]);
  return deployResult;
}

function processArgs(args: any[], deployResult: Map<string, string>) {
  const newArgs: any[] = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      const newArrayArg = processArgs(arg, deployResult);
      newArgs.push(newArrayArg);
    } else {
      if ((arg as string).startsWith(">>")) {
        const contractName = (arg as string).slice(2);
        // get addr from deployResult:
        let contractAddr: string = deployResult.get(contractName);
        assert(
          contractAddr,
          "Error: param contract " + contractName + " not deployed yet!"
        );
        newArgs.push(contractAddr);
      } else {
        newArgs.push(arg);
      }
    }
  }
  return newArgs;
}

function processLibs(libs: string[], deployResult: Map<string, string>) {
  let libArg = "";
  for (const lib of libs) {
    const libAddr = deployResult.get(lib);
    assert(
      web3.utils.isAddress(libAddr),
      "Error: lib" + lib + " is not deployed yet!"
    );
    if (libArg == "") {
      libArg = lib + ":" + libAddr;
    } else {
      libArg = libArg + "," + lib + ":" + libAddr;
    }
  }
  return libArg;
}

async function main() {
  const deployer = (await web3.eth.getAccounts())[0];
  const deployResult = loadDeployResult();

  for (const task of deployTasks) {
    if (web3.utils.isAddress(deployResult.get(task.contractName))) {
      console.log("task:", task, "deployed, skip.");
      continue;
    }

    const sourceFile = flattenSourceDir + task.contractName + "_flat.sol";
    childProcess.spawnSync(
      "solc",
      ["-o", buildDir, "--overwrite", "--optimize", "--abi", sourceFile],
      { stdio: "inherit" }
    );

    if (task.libs && task.libs.length > 0) {
      childProcess.spawnSync(
        "solc",
        [
          "-o",
          buildDir,
          "--overwrite",
          "--optimize",
          "--optimize-runs",
          "999999",
          "--bin",
          "--libraries",
          processLibs(task.libs, deployResult),
          sourceFile
        ],
        { stdio: "inherit" }
      );
    } else {
      childProcess.spawnSync(
        "solc",
        [
          "-o",
          buildDir,
          "--overwrite",
          "--optimize",
          "--optimize-runs",
          "999999",
          "--bin",
          sourceFile
        ],
        { stdio: "inherit" }
      );
    }

    let args: string[] = [];
    const abiFile = buildDir + task.contractName + ".abi";
    const binFile = buildDir + task.contractName + ".bin";

    if (task.args && task.args.length > 0) {
      args = processArgs(task.args, deployResult);
    }

    console.log("deploy contract", task.contractName, "...");
    const deployedAddr = await deployPlain(abiFile, binFile, args);
    deployResult.set(task.contractName, deployedAddr);
    fs.writeFileSync(
      resultFile,
      JSON.stringify([...deployResult], undefined, 2)
    );

    // // verify on etherscan:
    // const sourceCode = fs.readFileSync(sourceFile, "ascii");
    // console.log("verify source code on etherscan: contract:", task.contractName, ", address:", deployedAddr);
    // await verifyContractOnEtherScan(deployedAddr, sourceCode, task.contractName);
    // console.log("verify succeeded!");
  }
  console.log("all contracts had been deployed.");
}

async function deployPlain(abiFile: string, binFile: string, args: string[]) {
  const abi = fs.readFileSync(abiFile, "ascii");
  const bin = fs.readFileSync(binFile, "ascii");
  const addr = await myeth.deploy(abi, "0x" + bin, args, {
    gasPrice: 25e9,
    gasLimit: 8000000 /*, nonce: 341*/
  });
  return addr;
}

execAsync(main);
