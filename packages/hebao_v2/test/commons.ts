const glob = require("glob");
const fs = require("fs");
const { ethers } = require("hardhat");
import { Contract } from "ethers";
import BN = require("bn.js");

import { signCreateWallet } from "./helper/signatureUtils";

export async function newWalletImpl() {
  const ERC1271Lib = await (await ethers.getContractFactory(
    "ERC1271Lib"
  )).deploy();
  const ERC20Lib = await (await ethers.getContractFactory("ERC20Lib")).deploy();
  const GuardianLib = await (await ethers.getContractFactory(
    "GuardianLib"
  )).deploy();
  const InheritanceLib = await (await ethers.getContractFactory(
    "InheritanceLib"
  )).deploy();
  const LockLib = await (await ethers.getContractFactory("LockLib", {
    libraries: {
      GuardianLib: GuardianLib.address
    }
  })).deploy();
  const MetaTxLib = await (await ethers.getContractFactory("MetaTxLib", {
    libraries: {
      ERC20Lib: ERC20Lib.address
    }
  })).deploy();
  const QuotaLib = await (await ethers.getContractFactory("QuotaLib")).deploy();
  const RecoverLib = await (await ethers.getContractFactory("RecoverLib", {
    libraries: {
      GuardianLib: GuardianLib.address
    }
  })).deploy();
  const UpgradeLib = await (await ethers.getContractFactory(
    "UpgradeLib"
  )).deploy();
  const WhitelistLib = await (await ethers.getContractFactory(
    "WhitelistLib"
  )).deploy();

  const smartWallet = await (await ethers.getContractFactory("SmartWallet", {
    libraries: {
      ERC1271Lib: ERC1271Lib.address,
      ERC20Lib: ERC20Lib.address,
      GuardianLib: GuardianLib.address,
      InheritanceLib: InheritanceLib.address,
      LockLib: LockLib.address,
      MetaTxLib: MetaTxLib.address,
      QuotaLib: QuotaLib.address,
      RecoverLib: RecoverLib.address,
      UpgradeLib: UpgradeLib.address,
      WhitelistLib: WhitelistLib.address
    }
  })).deploy(ethers.constants.AddressZero);

  return smartWallet;
}

export async function newWalletFactoryContract(deployer?: string) {
  let testPriceOracle: Contract;
  let smartWallet: Contract;
  let walletFactory: Contract;

  testPriceOracle = await (await ethers.getContractFactory(
    "TestPriceOracle"
  )).deploy();

  const ERC1271Lib = await (await ethers.getContractFactory(
    "ERC1271Lib"
  )).deploy();
  const ERC20Lib = await (await ethers.getContractFactory("ERC20Lib")).deploy();
  const GuardianLib = await (await ethers.getContractFactory(
    "GuardianLib"
  )).deploy();
  const InheritanceLib = await (await ethers.getContractFactory(
    "InheritanceLib"
  )).deploy();
  const LockLib = await (await ethers.getContractFactory("LockLib", {
    libraries: {
      GuardianLib: GuardianLib.address
    }
  })).deploy();
  const MetaTxLib = await (await ethers.getContractFactory("MetaTxLib", {
    libraries: {
      ERC20Lib: ERC20Lib.address
    }
  })).deploy();
  const QuotaLib = await (await ethers.getContractFactory("QuotaLib")).deploy();
  const RecoverLib = await (await ethers.getContractFactory("RecoverLib", {
    libraries: {
      GuardianLib: GuardianLib.address
    }
  })).deploy();
  const UpgradeLib = await (await ethers.getContractFactory(
    "UpgradeLib"
  )).deploy();
  const WhitelistLib = await (await ethers.getContractFactory(
    "WhitelistLib"
  )).deploy();

  smartWallet = await (await ethers.getContractFactory("SmartWallet", {
    libraries: {
      ERC1271Lib: ERC1271Lib.address,
      ERC20Lib: ERC20Lib.address,
      GuardianLib: GuardianLib.address,
      InheritanceLib: InheritanceLib.address,
      LockLib: LockLib.address,
      MetaTxLib: MetaTxLib.address,
      QuotaLib: QuotaLib.address,
      RecoverLib: RecoverLib.address,
      UpgradeLib: UpgradeLib.address,
      WhitelistLib: WhitelistLib.address
    }
  })).deploy(ethers.constants.AddressZero /*testPriceOracle.address*/);

  walletFactory = await (await ethers.getContractFactory(
    "WalletFactory"
  )).deploy(smartWallet.address);

  await walletFactory.deployed();

  if (deployer) {
    return await walletFactory.connect(deployer);
  } else {
    return walletFactory;
  }
}

export async function newWallet(
  owner: string,
  feeRecipient: string,
  salt: number
) {
  const walletFactory = await newWalletFactoryContract();

  const signature = signCreateWallet(
    walletFactory.address,
    owner,
    [],
    new BN(0),
    ethers.constants.AddressZero,
    feeRecipient,
    ethers.constants.AddressZero,
    new BN(0),
    salt
  );
  // console.log("signature:", signature);

  const walletConfig: any = {
    owner,
    guardians: [],
    quota: 0,
    inheritor: ethers.constants.AddressZero,
    feeRecipient,
    feeToken: ethers.constants.AddressZero,
    feeAmount: 0,
    signature: Buffer.from(signature.txSignature.slice(2), "hex")
  };

  const walletAddrComputed = await walletFactory.computeWalletAddress(
    owner,
    salt
  );

  await walletFactory.createWallet(walletConfig, salt);

  const smartWallet = await (await ethers.getContractFactory("SmartWallet", {
    libraries: {
      ERC1271Lib: ethers.constants.AddressZero,
      ERC20Lib: ethers.constants.AddressZero,
      GuardianLib: ethers.constants.AddressZero,
      InheritanceLib: ethers.constants.AddressZero,
      LockLib: ethers.constants.AddressZero,
      MetaTxLib: ethers.constants.AddressZero,
      QuotaLib: ethers.constants.AddressZero,
      RecoverLib: ethers.constants.AddressZero,
      UpgradeLib: ethers.constants.AddressZero,
      WhitelistLib: ethers.constants.AddressZero
    }
  })).attach(walletAddrComputed);

  // console.log("SmartWallet:", smartWallet);
  return smartWallet;
}

export async function getAllEvent(
  contract: any,
  fromBlock: number
) {
  const events = await contract.queryFilter(
    { address: contract.address },
    fromBlock
  );
  return events;
}

export async function getFirstEvent(
  contract: any,
  fromBlock: number,
  eventName: string
) {
  const events = await contract.queryFilter(
    { address: contract.address },
    fromBlock
  );
  // console.log("events:", events);

  for (const e of events) {
    if (e.event === eventName) return e;
  }

  return undefined;
}

export async function advanceTime(time: number) {
  const res = await ethers.provider.send("evm_increaseTime", time);
  return res;
}

export async function getBlockTimestamp(blockNumber: number) {
  const block = await ethers.provider.getBlock(blockNumber);
  return block.timestamp;
}

export function timeAlmostEqual(t1: number, t2: number, deviation: number) {
  return t1 >= t2 - deviation && t1 <= t2 + deviation;
}

export async function getContractABI(contractName: string) {
  if (!contractName) return undefined;

  return new Promise((resolve, reject) => {
    glob("./artifacts/**/*.json", function(err, files) {
      if (err) return reject(err);
      for (const f of files) {
        if (f.endsWith(contractName + ".json")) {
          const abi = JSON.parse(fs.readFileSync(f, "ascii")).abi;
          resolve(abi);
        }
      }
      resolve(undefined);
    });
  });
}
