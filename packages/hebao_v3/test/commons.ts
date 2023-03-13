const glob = require("glob");
const fs = require("fs");
const { ethers } = require("hardhat");
import { Contract } from "ethers";
import BN = require("bn.js");
import ethUtil = require("ethereumjs-util");

import { signCreateWallet } from "./helper/signatureUtils";

export async function newWalletImpl() {
  const ERC1271Lib = await (
    await ethers.getContractFactory("ERC1271Lib")
  ).deploy();
  const ERC20Lib = await (await ethers.getContractFactory("ERC20Lib")).deploy();
  const GuardianLib = await (
    await ethers.getContractFactory("GuardianLib")
  ).deploy();
  const InheritanceLib = await (
    await ethers.getContractFactory("InheritanceLib")
  ).deploy();
  const LockLib = await (
    await ethers.getContractFactory("LockLib", {
      libraries: {
        GuardianLib: GuardianLib.address,
      },
    })
  ).deploy();
  const MetaTxLib = await (
    await ethers.getContractFactory("MetaTxLib", {
      libraries: {
        ERC20Lib: ERC20Lib.address,
      },
    })
  ).deploy();
  const QuotaLib = await (await ethers.getContractFactory("QuotaLib")).deploy();
  const RecoverLib = await (
    await ethers.getContractFactory("RecoverLib", {
      libraries: {
        GuardianLib: GuardianLib.address,
      },
    })
  ).deploy();
  const UpgradeLib = await (
    await ethers.getContractFactory("UpgradeLib")
  ).deploy();
  const WhitelistLib = await (
    await ethers.getContractFactory("WhitelistLib")
  ).deploy();

  const smartWallet = await (
    await ethers.getContractFactory("SmartWallet", {
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
        WhitelistLib: WhitelistLib.address,
      },
    })
  ).deploy(ethers.constants.AddressZero, ethers.constants.AddressZero);

  return smartWallet;
}

export async function newWalletFactoryContract(deployer?: string) {
  let testPriceOracle: Contract;
  let smartWallet: Contract;
  let walletFactory: Contract;

  testPriceOracle = await (
    await ethers.getContractFactory("TestPriceOracle")
  ).deploy();

  const ERC1271Lib = await (
    await ethers.getContractFactory("ERC1271Lib")
  ).deploy();
  const ERC20Lib = await (await ethers.getContractFactory("ERC20Lib")).deploy();
  const GuardianLib = await (
    await ethers.getContractFactory("GuardianLib")
  ).deploy();
  const InheritanceLib = await (
    await ethers.getContractFactory("InheritanceLib")
  ).deploy();
  const LockLib = await (
    await ethers.getContractFactory("LockLib", {
      libraries: {
        GuardianLib: GuardianLib.address,
      },
    })
  ).deploy();
  const MetaTxLib = await (
    await ethers.getContractFactory("MetaTxLib", {
      libraries: {
        ERC20Lib: ERC20Lib.address,
      },
    })
  ).deploy();
  const QuotaLib = await (await ethers.getContractFactory("QuotaLib")).deploy();
  const RecoverLib = await (
    await ethers.getContractFactory("RecoverLib", {
      libraries: {
        GuardianLib: GuardianLib.address,
      },
    })
  ).deploy();
  const UpgradeLib = await (
    await ethers.getContractFactory("UpgradeLib")
  ).deploy();
  const WhitelistLib = await (
    await ethers.getContractFactory("WhitelistLib")
  ).deploy();

  const ownerSetter = deployer ? deployer : ethers.constants.AddressZero;
  smartWallet = await (
    await ethers.getContractFactory("SmartWallet", {
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
        WhitelistLib: WhitelistLib.address,
      },
    })
  ).deploy(
    ethers.constants.AddressZero /*testPriceOracle.address*/,
    ownerSetter
  );

  walletFactory = await (
    await ethers.getContractFactory("WalletFactory")
  ).deploy(smartWallet.address);

  await walletFactory.deployed();

  if (deployer) {
    const _signer = await addrToSigner(deployer);
    // console.log("_signer:", _signer);
    return await walletFactory.connect(_signer);
  } else {
    return walletFactory;
  }
}

export async function newWallet(
  owner: string,
  feeRecipient: string,
  salt: number,
  guardians?: string[]
) {
  const walletFactory = await newWalletFactoryContract();
  const _guardians = guardians ? sortAddrs(guardians) : [];

  const signature = signCreateWallet(
    walletFactory.address,
    owner,
    _guardians,
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
    guardians: _guardians,
    quota: 0,
    inheritor: ethers.constants.AddressZero,
    feeRecipient,
    feeToken: ethers.constants.AddressZero,
    maxFeeAmount: 0,
    salt,
    signature: Buffer.from(signature.txSignature.slice(2), "hex"),
  };

  const walletAddrComputed = await walletFactory.computeWalletAddress(
    owner,
    salt
  );

  const tx = await walletFactory.createWallet(walletConfig, 0);
  // const allEvents = await getAllEvent(walletFactory, tx.blockNumber);
  // console.log(allEvents);

  const smartWallet = await attachWallet(walletAddrComputed);

  // console.log("SmartWallet:", smartWallet);
  return smartWallet;
}

export async function attachWallet(wallet: string) {
  const smartWallet = await (
    await ethers.getContractFactory("SmartWallet", {
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
        WhitelistLib: ethers.constants.AddressZero,
      },
    })
  ).attach(wallet);

  return smartWallet;
}

export async function getAllEvent(contract: any, fromBlock: number) {
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
  await ethers.provider.send("evm_increaseTime", [time]);
  await ethers.provider.send("evm_mine");
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
    glob("./artifacts/**/*.json", function (err, files) {
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

export async function addrToSigner(addr: string) {
  const signers = await ethers.getSigners();
  for (const signer of signers) {
    const signerAddr = await signer.getAddress();
    if (addr.toLowerCase() === signerAddr.toLowerCase()) {
      return signer;
    }
  }

  throw new Error("signer not found:" + addr);
}

export function sortSignersAndSignatures(
  signers: string[],
  signatures: Buffer[]
) {
  const sigMap = new Map();
  signers.forEach(function (signer, i) {
    sigMap.set(signer, signatures[i]);
  });

  const sortedSigners = signers.sort((a, b) => {
    const numA = parseInt(a.slice(2, 10), 16);
    const numB = parseInt(b.slice(2, 10), 16);
    return numA - numB;
  });
  const sortedSignatures = sortedSigners.map((s) => sigMap.get(s));
  return { sortedSigners, sortedSignatures };
}

export async function getCurrentQuota(quotaInfo: any, blockNumber: number) {
  const blockTime = await getBlockTimestamp(blockNumber);
  const pendingUntil = quotaInfo.pendingUntil.toNumber();

  return pendingUntil <= blockTime
    ? quotaInfo.pendingQuota
    : quotaInfo.currentQuota;
}

function sortAddrs(addrs: string[]) {
  return addrs.sort((a, b) => {
    const numA = parseInt(a.slice(2, 10), 16);
    const numB = parseInt(b.slice(2, 10), 16);
    return numA - numB;
  });
}
