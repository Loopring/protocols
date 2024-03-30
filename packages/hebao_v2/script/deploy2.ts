import { ethers } from "hardhat";
import { Contract, Wallet, Signer } from "ethers";
import { signCreateWalletV2 } from "../test/helper/signatureUtils";
import { sortSignersAndSignatures } from "../test/commons";
import {
  MetaTx,
  signCallContractWA,
  signRecover,
  signMetaTx,
  signUnlock,
} from "../test/helper/signatureUtils";
import {
  deploySingle,
  deployWalletImpl,
  adjustNonce,
  createSmartWallet,
} from "./deploy_utils";
import BN = require("bn.js");

const hre = require("hardhat");

function getUnlockCalldata(
  wallet: Contract,
  walletOwner: Wallet,
  masterCopy: string,
  guardians: Wallet[]
) {
  const validUntil = new Date().getTime() + 1000 * 3600 * 24; // one day
  const sig1 = signUnlock(
    masterCopy,
    wallet.address,
    new BN(validUntil),
    walletOwner.address
  );
  const sig2 = signUnlock(
    masterCopy,
    wallet.address,
    new BN(validUntil),
    guardians[0].address
  );

  const sortedSigs = sortSignersAndSignatures(
    [walletOwner.address, guardians[0].address],
    [
      Buffer.from(sig1.txSignature.slice(2), "hex"),
      Buffer.from(sig2.txSignature.slice(2), "hex"),
    ]
  );

  const approval = {
    signers: sortedSigs.sortedSigners,
    signatures: sortedSigs.sortedSignatures,
    validUntil,
    wallet: wallet.address,
  };
  return wallet.interface.encodeFunctionData("unlock", [approval]);
}

async function executeMetaTx(
  wallet: Contract,
  walletOwner: Wallet,
  executor: Signer & { address: string },
  masterCopy: string,
  guardians: Wallet[]
) {
  const ethAmount = 1;

  let actionCalldataLists = [];

  const testContract = await (
    await ethers.getContractFactory("TestTargetContract")
  ).deploy();

  // transfer ETH:
  // const transferTo = "0x" + "30".repeat(20);
  // actionCalldataLists.push(wallet.interface.encodeFunctionData("transferToken", [
  // ethers.constants.AddressZero,
  // transferTo,
  // ethAmount,
  // [],
  // false,
  // ]));

  // addGuardian
  // actionCalldataLists.push(wallet.interface.encodeFunctionData("addGuardian", [executor.address]));
  // actionCalldataLists.push(wallet.interface.encodeFunctionData("removeGuardian", [executor.address]));
  // due to that executor is guardian
  await (await wallet.connect(guardians[0]).lock()).wait();
  actionCalldataLists.push(
    getUnlockCalldata(wallet, walletOwner, masterCopy, guardians)
  );
  const callData = testContract.interface.encodeFunctionData(
    "functionDefault",
    [10]
  );
  actionCalldataLists.push(
    wallet.interface.encodeFunctionData("callContract", [
      testContract.address,
      0,
      callData,
      false,
    ])
  );

  for (let i = 0; i < actionCalldataLists.length; ++i) {
    let data = actionCalldataLists[i];
    wallet = wallet.connect(executor);
    const metaTx: MetaTx = {
      to: wallet.address,
      nonce: new BN(new Date().getTime()),
      gasToken: ethers.constants.AddressZero,
      gasPrice: new BN(1).pow(new BN(9)),
      gasLimit: new BN(1000000),
      gasOverhead: new BN(85000),
      feeRecipient: executor.address,
      requiresSuccess: true,
      data: Buffer.from(data.slice(2), "hex"),
      signature: Buffer.from(""),
      approvedHash: Buffer.from(
        "0000000000000000000000000000000000000000000000000000000000000000",
        "hex"
      ),
    };
    const metaTxSig = signMetaTx(
      masterCopy,
      metaTx,
      walletOwner.address,
      walletOwner.privateKey.slice(2)
    );

    //prepare eth for wallet
    await (
      await executor.sendTransaction({
        to: wallet.address,
        value: ethers.utils.parseEther("0.001"),
      })
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
}

async function main() {
  const deployer = (await ethers.getSigners())[0];
  const thirdStage = true;
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
  const smartWalletImpl = await deployWalletImpl(create2, deployer.address);

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
    const guardians = [
      new ethers.Wallet(process.env.PRIVATE_KEY).connect(ethers.provider),
    ];
    guardians.push(ethers.Wallet.createRandom().connect(ethers.provider));
    const smartWalletAddr = await createSmartWallet(
      owner,
      walletFactory,
      guardians
    );
    const wallet = await smartWalletImpl.attach(smartWalletAddr);
    console.log("masterCopy: ", await wallet.getMasterCopy());
    // metatx transfer eth
    await executeMetaTx(
      wallet,
      owner,
      deployer,
      smartWalletImpl.address,
      guardians
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
