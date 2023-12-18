import { Contract, Signer } from "ethers";
import { ethers } from "hardhat";
import { signCreateWallet } from "./helper/signatureUtils";
import BN = require("bn.js");
import { expect } from "chai";
import { advanceTime } from "./commons";

function sortAddrs(addrs: string[]) {
  return addrs.sort((a, b) => {
    const numA = parseInt(a.slice(2, 10), 16);
    const numB = parseInt(b.slice(2, 10), 16);
    return numA - numB;
  });
}

async function newWalletImpl(config?: { ownerSetter: string }) {
  // create environments
  const testPriceOracle = await (
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

  const ownerSetter = config?.ownerSetter ?? ethers.constants.AddressZero;
  const SmartWalletFactory = await ethers.getContractFactory("SmartWallet", {
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
  });
  const smartWalletImpl = await SmartWalletFactory.deploy(
    ethers.constants.AddressZero /*testPriceOracle.address*/,
    ownerSetter
  );
  return { SmartWalletFactory, smartWalletImpl };
}

describe("DelayedImplementationManager", () => {
  let account1: Signer;
  let account2: Signer;
  let account3: Signer;
  let owner: string;
  let guardian1: string;
  let guardian2: string;
  let wallet: Contract;
  let newSmartWalletImpl: Contract;
  let forwardProxy: Contract;
  let implStorage: Contract;

  before(async () => {
    [account1, account2, account3] = await ethers.getSigners();

    owner = await account1.getAddress();
    guardian1 = await account2.getAddress();
    guardian2 = await account3.getAddress();
    const guardians = sortAddrs([guardian1, guardian2]);
    const feeRecipient = ethers.constants.AddressZero;
    const salt = 0;

    // create environments
    const { smartWalletImpl, SmartWalletFactory } = await newWalletImpl();

    console.log("smartWalletImpl.address: ", smartWalletImpl.address);
    implStorage = await (
      await ethers.getContractFactory("DelayedImplementationManager")
    ).deploy(smartWalletImpl.address);
    forwardProxy = await (
      await ethers.getContractFactory("ForwardProxy")
    ).deploy(implStorage.address);
    console.log("forwardProxy.address: ", forwardProxy.address);

    const walletFactory = await (
      await ethers.getContractFactory("WalletFactory")
    ).deploy(forwardProxy.address);
    await walletFactory.addOperator(owner);

    // create smart wallet
    const signature = signCreateWallet(
      walletFactory.address,
      owner,
      guardians,
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
      guardians,
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

    await walletFactory.createWallet(walletConfig, 0);

    wallet = await SmartWalletFactory.attach(walletAddrComputed);
  });

  it("upgrade for user wallet", async () => {
    const currentImpl = await wallet.getMasterCopy();
    expect(currentImpl).to.eq(forwardProxy.address);
    expect(ethers.constants.AddressZero).to.eq(await wallet.blankOwner());

    const ownerSetter = "0xB7101ff647ac42e776bA857907DdBE743522AA95";
    const { smartWalletImpl: newSmartWalletImpl } = await newWalletImpl({
      ownerSetter,
    });
    await implStorage.delayedUpgradeTo(newSmartWalletImpl.address, 1);
    await advanceTime(3600 * 24);
    await implStorage.executeUpgrade();
    const blankOwner = await wallet.blankOwner();
    expect(ownerSetter).to.eq(blankOwner);
  });
});
