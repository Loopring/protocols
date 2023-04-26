import { ethers } from "hardhat";
import { Contract, Wallet, Signer } from "ethers";
import { signCreateWalletV2 } from "../test/helper/signatureUtils";
import {
  MetaTx,
  signCallContractWA,
  signRecover,
  signMetaTx,
} from "../test/helper/signatureUtils";
import BN = require("bn.js");

const hre = require("hardhat");

async function deploySingle(
  deployFactory: Contract,
  contractName: string,
  args?: any[],
  libs?: Map<string, any>
): Promise<Contract> {
  // use same salt for all deployments:
  // const salt = ethers.utils.randomBytes(32);
  const salt = ethers.utils.formatBytes32String("0x5");

  const libraries = {}; // libs ? Object.fromEntries(libs) : {}; // requires lib: ["es2019"]
  libs && libs.forEach((value, key) => (libraries[key] = value));
  // console.log("libraries:", libraries);

  const contract = await ethers.getContractFactory(contractName, { libraries });

  let deployableCode = contract.bytecode;
  if (args && args.length > 0) {
    deployableCode = ethers.utils.hexConcat([
      deployableCode,
      contract.interface.encodeDeploy(args),
    ]);
  }

  const deployedAddress = ethers.utils.getCreate2Address(
    deployFactory.address,
    salt,
    ethers.utils.keccak256(deployableCode)
  );
  // check if it is deployed already
  if ((await ethers.provider.getCode(deployedAddress)) != "0x") {
    console.log(contractName, " is deployed already at: ", deployedAddress);
  } else {
    // const gasLimit = 15000000 ;
    const gasLimit = await deployFactory.estimateGas.deploy(
      deployableCode,
      salt
    );
    const tx = await deployFactory.deploy(deployableCode, salt, { gasLimit });
    await tx.wait();
    console.log(contractName, "deployed address: ", deployedAddress);
  }

  return contract.attach(deployedAddress);
}

export async function deployWalletImpl(deployFactory: Contract) {
  const ERC1271Lib = await deploySingle(deployFactory, "ERC1271Lib");
  const ERC20Lib = await deploySingle(deployFactory, "ERC20Lib");
  const GuardianLib = await deploySingle(deployFactory, "GuardianLib");
  const InheritanceLib = await deploySingle(deployFactory, "InheritanceLib");
  const QuotaLib = await deploySingle(deployFactory, "QuotaLib");
  const UpgradeLib = await deploySingle(deployFactory, "UpgradeLib");
  const WhitelistLib = await deploySingle(deployFactory, "WhitelistLib");
  const LockLib = await deploySingle(
    deployFactory,
    "LockLib",
    undefined,
    new Map([["GuardianLib", GuardianLib.address]])
  );
  const RecoverLib = await deploySingle(
    deployFactory,
    "RecoverLib",
    undefined,
    new Map([["GuardianLib", GuardianLib.address]])
  );
  const MetaTxLib = await deploySingle(
    deployFactory,
    "MetaTxLib",
    undefined,
    new Map([["ERC20Lib", ERC20Lib.address]])
  );

  const blankOwner = await (await ethers.getSigners())[0].getAddress();
  const smartWallet = await deploySingle(
    deployFactory,
    "SmartWallet",
    [ethers.constants.AddressZero, blankOwner],
    new Map([
      ["ERC1271Lib", ERC1271Lib.address],
      ["ERC20Lib", ERC20Lib.address],
      ["GuardianLib", GuardianLib.address],
      ["InheritanceLib", InheritanceLib.address],
      ["LockLib", LockLib.address],
      ["MetaTxLib", MetaTxLib.address],
      ["QuotaLib", QuotaLib.address],
      ["RecoverLib", RecoverLib.address],
      ["UpgradeLib", UpgradeLib.address],
      ["WhitelistLib", WhitelistLib.address],
    ])
  );

  return smartWallet;
}

async function adjustNonce(targetNonce: number) {
  const ownerAccount = (await ethers.getSigners())[0];
  let nonce = await ethers.provider.getTransactionCount(ownerAccount.address);
  if (targetNonce < nonce) {
    throw Error(
      `targetNonce is lower than current nonce, please increase targetNonce!`
    );
  }
  console.log("before nonce: ", nonce);
  for (let i = nonce; i < targetNonce; ++i) {
    const wasteTx = await ownerAccount.sendTransaction({
      to: ownerAccount.address,
    });
    await wasteTx.wait();
  }

  nonce = await ethers.provider.getTransactionCount(ownerAccount.address);
  console.log("after nonce: ", nonce);
}

async function createSmartWallet(owner: Wallet, walletFactory: Contract) {
  const guardians = [];
  const feeRecipient = ethers.constants.AddressZero;
  // const salt = ethers.utils.randomBytes(32);
  const salt = ethers.utils.formatBytes32String("0x5");
  const walletAddrComputed = await walletFactory.computeWalletAddress(
    owner.address,
    salt
  );
  if ((await ethers.provider.getCode(walletAddrComputed)) != "0x") {
    console.log(
      "smart wallet: ",
      owner.address,
      " is deployed already at: ",
      walletAddrComputed
    );
  } else {
    // create smart wallet
    const signature = signCreateWalletV2(
      walletFactory.address,
      owner.address,
      guardians,
      new BN(0),
      ethers.constants.AddressZero,
      feeRecipient,
      ethers.constants.AddressZero,
      new BN(0),
      salt,
      owner.privateKey.slice(2)
    );
    // console.log("signature:", signature);

    const walletConfig: any = {
      owner: owner.address,
      guardians,
      quota: 0,
      inheritor: ethers.constants.AddressZero,
      feeRecipient,
      feeToken: ethers.constants.AddressZero,
      maxFeeAmount: 0,
      salt,
      signature: Buffer.from(signature.txSignature.slice(2), "hex"),
    };

    const tx = await walletFactory.createWallet(walletConfig, 0);
    await tx.wait();
    console.log("wallet created at: ", walletAddrComputed);
  }
  return walletAddrComputed;
}

async function executeMetaTx(
  wallet: Contract,
  walletOwner: Wallet,
  executor: Signer & { address: string },
  masterCopy: string
) {
  const ethAmount = 1;

  const transferTo = "0x" + "30".repeat(20);
  // transfer ETH:
  const data = wallet.interface.encodeFunctionData("transferToken", [
    ethers.constants.AddressZero,
    transferTo,
    ethAmount,
    [],
    false,
  ]);

  wallet = wallet.connect(executor);
  const metaTx: MetaTx = {
    to: wallet.address,
    nonce: new BN(new Date().getTime()),
    gasToken: ethers.constants.AddressZero,
    gasPrice: new BN(0),
    gasLimit: new BN(1000000),
    gasOverhead: new BN(0),
    feeRecipient: executor.address,
    requiresSuccess: true,
    data: Buffer.from(data.slice(2), "hex"),
    signature: Buffer.from(""),
    approvedHash: Buffer.from(
      "0000000000000000000000000000000000000000000000000000000000000000",
      "hex"
    ),
  };
  const ownerAddr = await wallet.getOwner();
  const metaTxSig = signMetaTx(
    masterCopy,
    metaTx,
    walletOwner.address,
    walletOwner.privateKey.slice(2)
  );

  //prepare eth for wallet
  await (
    await executor.sendTransaction({ to: wallet.address, value: ethAmount })
  ).wait();
  await (
    await wallet.executeMetaTx(
      metaTx.to,
      metaTx.nonce.toString(10),
      metaTx.gasToken,
      metaTx.gasPrice.toString(10),
      metaTx.gasLimit.toString(10),
      metaTx.gasOverhead.toString(10),
      metaTx.feeRecipient,
      metaTx.requiresSuccess,
      metaTx.data,
      Buffer.from(metaTxSig.txSignature.slice(2), "hex")
    )
  ).wait();
}

async function main() {
  const deployer = (await ethers.getSigners())[0];
  // const nonce = await ethers.provider.getTransactionCount(ownerAccount.address);
  // console.log("address: ", ownerAccount.address, " nonce: ", nonce);
  // const network = await ethers.provider.getNetwork();
  // console.log('chainId: ', network.chainId);
  // deploy create2 first
  // TODO check if it is deployed already
  // await adjustNonce(11);
  const firstStage = true;
  const secondStage = true;
  const thirdStage = true;
  // const create2 = await (
  // await ethers.getContractFactory("Loopring")
  // ).deploy();
  // console.log("create2 factory is deployed at : ", create2.address);
  let create2;

  const create2Addr = "0x495F13956D92a364C895981851D98B8EfF4c6AD4";
  if ((await ethers.provider.getCode(create2Addr)) != "0x") {
    create2 = await ethers.getContractAt(
      "LoopringCreate2Deployer",
      create2Addr
    );
  } else {
    create2 = await (
      await ethers.getContractFactory("LoopringCreate2Deployer")
    ).deploy();
    console.log("create2 factory is deployed at : ", create2.address);
  }

  // deploy wallet implementation
  const smartWalletImpl = await deployWalletImpl(create2);

  const implStorage = await deploySingle(
    create2,
    "DelayedImplementationManager",
    [smartWalletImpl.address]
  );

  const forwardProxy = await deploySingle(create2, "ForwardProxy", [
    implStorage.address,
  ]);

  const walletFactory = await deploySingle(create2, "WalletFactory", [
    forwardProxy.address,
  ]);
  /////////////////////////////
  // call it once
  // transfer wallet factory ownership to deployer
  const factoryCurrentOwner = await walletFactory.owner();
  if (deployer.address != factoryCurrentOwner) {
    await create2.setTarget(walletFactory.address);
    const transferWalletFactoryOwnership =
      await walletFactory.populateTransaction.transferOwnership(
        deployer.address
      );
    await create2.transact(transferWalletFactoryOwnership.data);
    await walletFactory.addOperator(deployer.address);
  }

  // transfer DelayedImplementationManager ownership to deployer
  const managerCurrentOwner = await walletFactory.owner();
  if (deployer.address != managerCurrentOwner) {
    await create2.setTarget(implStorage.address);
    const transferImplStorageOwnership =
      await implStorage.populateTransaction.transferOwnership(deployer.address);
    await create2.transact(transferImplStorageOwnership.data);
  }

  if (thirdStage) {
    const [account1, account2, account3] = await ethers.getSigners();
    // const owner = await ethers.Wallet.createRandom();
    const owner = new ethers.Wallet(process.env.TEST_ACCOUNT_PRIVATE_KEY);
    const smartWalletAddr = await createSmartWallet(owner, walletFactory);
    const wallet = await smartWalletImpl.attach(smartWalletAddr);
    console.log("masterCopy: ", await wallet.getMasterCopy());
    // metatx transfer eth
    await executeMetaTx(wallet, owner, deployer, smartWalletImpl.address);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
