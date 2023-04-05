import { ethers } from "hardhat";
import { Contract, Wallet, Signer, BigNumber } from "ethers";
import { localUserOpSender, fillAndSign } from "../test/helper/AASigner";
import { parseEther, arrayify, hexConcat, hexlify } from "ethers/lib/utils";
import {
  EntryPoint,
  SmartWallet,
  EntryPoint__factory,
  SmartWallet__factory,
  WalletFactory,
  WalletFactory__factory,
  WalletProxy__factory,
  Create2Factory,
} from "../typechain-types";
import {
  activateCreate2WalletOp,
  createAccountOwner,
  simulationResultCatch,
  computeRequiredPreFund,
} from "../test/helper/utils";

async function deploySingle(
  deployFactory: Contract,
  contractName: string,
  args?: any[],
  libs?: Map<string, any>
) {
  // use same salt for all deployments:
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

export async function deployWalletImpl(
  deployFactory: Contract,
  entryPointAddr: string,
  blankOwner: string
) {
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
  // const blankOwner = await (await ethers.getSigners())[0].getAddress();

  const smartWallet = await deploySingle(
    deployFactory,
    "SmartWallet",
    [ethers.constants.AddressZero, entryPointAddr, blankOwner],
    new Map([
      ["ERC1271Lib", ERC1271Lib.address],
      ["ERC20Lib", ERC20Lib.address],
      ["GuardianLib", GuardianLib.address],
      ["InheritanceLib", InheritanceLib.address],
      ["LockLib", LockLib.address],
      ["QuotaLib", QuotaLib.address],
      ["RecoverLib", RecoverLib.address],
      ["UpgradeLib", UpgradeLib.address],
      ["WhitelistLib", WhitelistLib.address],
    ])
  );
  return smartWallet;
}

async function createDemoWallet(
  create2: Create2Factory,
  entrypoint: Contract,
  deployer: Signer,
  smartWalletImplAddr: string
) {
  const accountOwner = new ethers.Wallet(process.env.TEST_ACCOUNT_PRIVATE_KEY);
  // default config
  const walletConfig = {
    accountOwner: accountOwner.address,
    guardians: [],
    quota: 0,
    inheritor: ethers.constants.AddressZero,
  };
  // use fixed salt to create the same wallet
  const salt = ethers.utils.formatBytes32String("0x5");
  const activateOp = await activateCreate2WalletOp(
    smartWalletImplAddr,
    create2,
    walletConfig,
    "0x",
    salt
  );
  const myAddress = activateOp.sender;

  if ((await ethers.provider.getCode(myAddress)) != "0x") {
    console.log(
      accountOwner.address,
      "'s smart wallet ",
      "is deployed already at: ",
      myAddress
    );
  } else {
    const newOp = await fillAndSign(
      activateOp,
      accountOwner,
      create2.address,
      entrypoint
    );

    const requiredPrefund = computeRequiredPreFund(newOp);

    // prefund missing amount
    const currentBalance = await entrypoint.balanceOf(myAddress);
    if (requiredPrefund.gt(currentBalance)) {
      await (
        await entrypoint.depositTo(myAddress, {
          value: requiredPrefund.sub(currentBalance),
        })
      ).wait();
    }

    // const result = await entrypoint.callStatic.simulateValidation(newOp).catch(simulationResultCatch);
    // console.log(result);
    const sendUserOp = localUserOpSender(entrypoint.address, deployer);
    await sendUserOp(newOp);
    console.log("wallet is created at: ", myAddress);
  }

  return myAddress;
}

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const paymasterOwner = process.env.PAYMASTER_OWNER ?? deployer.address;
  const blankOwner = process.env.BLANK_OWNER ?? deployer.address;

  // create2 factory
  // const create2 = await (
  // await ethers.getContractFactory("Create2Factory")
  // ).deploy();
  // console.log("create2 factory is deployed at : ", create2.address);
  const create2Addr = "0x515aC6B1Cd51BcFe88334039cC32e3919D13b35d";
  const create2 = await ethers.getContractAt("Create2Factory", create2Addr);

  // entrypoint and paymaster
  const entrypoint = await deploySingle(create2, "EntryPoint");
  // const entrypointAddr = "0x515aC6B1Cd51BcFe88334039cC32e3919D13b35d";
  // const entrypoint = await ethers.getContractAt("EntryPoint", entrypointAddr);

  const paymaster = await deploySingle(create2, "VerifyingPaymaster", [
    entrypoint.address,
    paymasterOwner,
  ]);

  const smartWalletImpl = await deployWalletImpl(
    create2,
    entrypoint.address,
    blankOwner
  );

  const implStorage = await deploySingle(
    create2,
    "DelayedImplementationManager",
    // deployer as implementation manager
    [smartWalletImpl.address, deployer.address]
  );

  const forwardProxy = await deploySingle(create2, "ForwardProxy", [
    implStorage.address,
  ]);

  // create demo wallet
  const smartWalletAddr = await createDemoWallet(
    create2,
    entrypoint,
    deployer,
    forwardProxy.address
  );
  const smartWallet = smartWalletImpl.attach(smartWalletAddr);
  console.log("masterCopy: ", await smartWallet.getMasterCopy());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
