import { ethers } from "hardhat";
import * as typ from "./solidityTypes";
import { Wallet, Signer, BigNumber, BigNumberish } from "ethers";
import {
  EntryPoint,
  SmartWallet,
  EntryPoint__factory,
  SmartWallet__factory,
  WalletFactory,
  WalletFactory__factory,
  WalletProxy__factory,
  Create2Factory,
} from "../../typechain-types";
import { TransactionResponse } from "@ethersproject/abstract-provider";
import { Deferrable, resolveProperties } from "@ethersproject/properties";
import {
  BaseProvider,
  Provider,
  TransactionRequest,
  TransactionReceipt,
} from "@ethersproject/providers";
import {
  hexConcat,
  defaultAbiCoder,
  arrayify,
  keccak256,
  getCreate2Address,
  hexZeroPad,
  hexlify,
  Interface,
} from "ethers/lib/utils";
import { BytesLike, hexValue } from "@ethersproject/bytes";
import { UserOperation } from "./AASigner";

let counter = 0;

// create non-random account, so gas calculations are deterministic
export function createAccountOwner(): Wallet {
  const privateKey = keccak256(
    Buffer.from(arrayify(BigNumber.from(++counter)))
  );
  return new ethers.Wallet(privateKey, ethers.provider);
}

export function callDataCost(data: string): number {
  return ethers.utils
    .arrayify(data)
    .map((x) => (x === 0 ? 4 : 16))
    .reduce((sum, x) => sum + x);
}

export interface WalletConfig {
  accountOwner: typ.address;
  guardians: typ.address[];
  quota: typ.uint;
  inheritor: typ.address;
}

export async function createRandomAccount(
  accountOwner: Wallet,
  entryPoint: EntryPoint,
  walletFactory: WalletFactory
) {
  const guardians: Wallet[] = [];
  for (let i = 0; i < 2; i++) {
    guardians.push(
      await ethers.Wallet.createRandom().connect(entryPoint.provider)
    );
  }
  const walletConfig = await createRandomWalletConfig(
    accountOwner.address,
    undefined,
    guardians
  );

  const { proxy: account } = await createAccount(
    accountOwner,
    walletConfig,
    entryPoint.address,
    walletFactory
  );

  return { account, guardians };
}

// Deploys an implementation and a proxy pointing to this implementation
export async function createAccount(
  ethersSigner: Signer,
  walletConfig: WalletConfig,
  entryPoint: string,
  _factory: WalletFactory
): Promise<{
  proxy: SmartWallet;
  accountFactory: WalletFactory;
  implementation: string;
}> {
  const accountFactory = _factory;
  const implementation = await accountFactory.accountImplementation();
  const salt = ethers.utils.randomBytes(32);
  await accountFactory.createAccount(
    walletConfig.accountOwner,
    walletConfig.guardians,
    walletConfig.quota,
    walletConfig.inheritor,
    salt
  );
  const accountAddress = await accountFactory.getAddress(
    walletConfig.accountOwner,
    walletConfig.guardians,
    walletConfig.quota,
    walletConfig.inheritor,
    salt
  );
  const proxy = SmartWallet__factory.connect(accountAddress, ethersSigner);
  return {
    implementation,
    accountFactory,
    proxy,
  };
}

export async function createAccountV2(
  ethersSigner: Signer,
  walletConfig: WalletConfig,
  entryPoint: string,
  implementation: string,
  accountFactory: Create2Factory
) {
  // const implementation = await accountFactory.accountImplementation();
  const salt = ethers.utils.randomBytes(32);
  await accountFactory.deploy(
    getWalletCode(implementation, walletConfig),
    salt
  );
  const accountAddress = calculateWalletAddress(
    implementation,
    walletConfig,
    salt,
    accountFactory.address
  );
  const proxy = SmartWallet__factory.connect(accountAddress, ethersSigner);
  return {
    implementation,
    accountFactory,
    proxy,
  };
}

// helper function to create the initCode to deploy the account, using our account factory.
export function getAccountInitCode(
  walletConfig: WalletConfig,
  factory: WalletFactory,
  salt: BigNumberish
): BytesLike {
  return hexConcat([
    factory.address,
    factory.interface.encodeFunctionData("createAccount", [
      walletConfig.accountOwner,
      walletConfig.guardians,
      walletConfig.quota,
      walletConfig.inheritor,
      salt,
    ]),
  ]);
}

function getPaymasterHash(userOp: UserOperation) {
  return keccak256(
    defaultAbiCoder.encode(
      [
        "address",
        "uint256",
        "bytes32",
        "bytes32",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
      ],
      [
        userOp.sender,
        userOp.nonce,
        keccak256(userOp.initCode),
        keccak256(userOp.callData),
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
      ]
    )
  );
}

export async function getPaymasterData(
  userOp: UserOperation,
  payMasterAddress: string,
  paymasterOwner: Signer,
  token: string,
  valueOfEth: BigNumberish
) {
  const message = arrayify(getPaymasterHash(userOp));
  const signature = await paymasterOwner.signMessage(message);

  const enc =
    payMasterAddress.toLowerCase() +
    defaultAbiCoder
      .encode(["address", "uint256", "bytes"], [token, valueOfEth, signature])
      .substring(2);
  return enc;
}

export async function getPaymasterAndData(
  payMasterAddress: string,
  paymasterOwner: Signer,
  hash: string,
  usdcToken: string,
  valueOfEth: BigNumberish
) {
  const sig = await paymasterOwner.signMessage(arrayify(hash));
  const paymasterCalldata = ethers.utils.defaultAbiCoder.encode(
    ["address", "uint256", "bytes"],
    [usdcToken, valueOfEth, sig]
  );
  return hexConcat([payMasterAddress, paymasterCalldata]);
}

export function getWalletCode(
  implementationAddress: string,
  walletConfig: WalletConfig
) {
  // const ownerAddress = await this.signer.getAddress();
  const initializeCall = new Interface(
    SmartWallet__factory.abi
  ).encodeFunctionData("initialize", [
    walletConfig.accountOwner,
    walletConfig.guardians,
    walletConfig.quota,
    walletConfig.inheritor,
  ]);
  return new WalletProxy__factory().getDeployTransaction(
    implementationAddress,
    initializeCall
  ).data!;
}

/**
 * calculate wallet address by owner address
 * @param walletLogicAddress the wallet logic contract address
 * @param salt the salt number,default is 0
 * @returns
 */
export function calculateWalletAddress(
  walletLogicAddress: string,
  walletConfig: WalletConfig,
  salt: BigNumberish,
  create2Factory: string
) {
  const initCodeWithArgs = getWalletCode(walletLogicAddress, walletConfig);
  const initCodeHash = keccak256(initCodeWithArgs);
  const walletAddress = getCreate2Address(
    create2Factory,
    hexZeroPad(hexlify(salt), 32),
    initCodeHash
  );
  return walletAddress;
}

export function computeRequiredPreFund(
  userOp: UserOperation,
  usePaymaster = false
) {
  // get required fund
  const requiredGas = BigNumber.from(userOp.verificationGasLimit)
    .mul(usePaymaster ? 3 : 1)
    .add(userOp.callGasLimit)
    .add(userOp.preVerificationGas);

  const requiredPrefund = requiredGas.mul(userOp.maxFeePerGas);
  return requiredPrefund;
}

export async function activateCreate2WalletOp(
  walletLogicAddress: string,
  walletFactory: Create2Factory,
  walletConfig: WalletConfig,
  callData?: BytesLike,
  salt?: BytesLike
) {
  salt = salt ?? ethers.utils.randomBytes(32);
  const walletAddress = calculateWalletAddress(
    walletLogicAddress,
    walletConfig,
    salt,
    walletFactory.address
  );
  let initCode: BytesLike | undefined;
  const size = await walletFactory?.provider
    .getCode(walletAddress)
    .then((x) => x.length);
  if (size == 2) {
    const walletInitCodeWithArgs = walletFactory.interface.encodeFunctionData(
      "deploy",
      [getWalletCode(walletLogicAddress, walletConfig), salt]
    );
    initCode = hexConcat([walletFactory.address, walletInitCodeWithArgs]);
  }
  return {
    sender: walletAddress,
    initCode,
    callData: callData ?? "0x",
    nonce: 0,
  };
}

export async function activateWalletOp(
  walletFactory: WalletFactory,
  walletConfig: WalletConfig,
  callData?: BytesLike,
  _salt?: BigNumberish
) {
  // userOperation.paymasterAndData = payMasterAddress;
  // userOperation.maxFeePerGas = maxFeePerGas;
  // userOperation.maxPriorityFeePerGas = maxPriorityFeePerGas;

  const salt = _salt ?? ethers.utils.randomBytes(32);
  const walletLogicAddress = await walletFactory.accountImplementation();
  const walletAddress = calculateWalletAddress(
    walletLogicAddress,
    walletConfig,
    salt,
    walletFactory.address
  );
  let initCode: BytesLike | undefined;
  const size = await walletFactory?.provider
    .getCode(walletAddress)
    .then((x) => x.length);
  if (size == 2) {
    initCode = getAccountInitCode(walletConfig, walletFactory, salt);
  }
  return {
    sender: walletAddress,
    initCode,
    callData: callData ?? "0x",
    nonce: 0,
  };
}

export async function createRandomWalletConfig(
  owner?: string,
  quota?: number,
  guardians = []
) {
  // const guardians = [];

  if (!guardians.length) {
    for (let i = 0; i < 3; i++) {
      guardians.push(await ethers.Wallet.createRandom());
    }
  }
  const walletConfig = {
    accountOwner: owner ?? (await ethers.Wallet.createRandom().address),
    guardians: guardians.map((g) => g.address.toLowerCase()).sort(),
    quota: quota ?? 0,
    inheritor: await ethers.Wallet.createRandom().address,
  };
  return walletConfig;
}

/**
 * process exception of ValidationResult
 * usage: entryPoint.simulationResult(..).catch(simulationResultCatch)
 */
export function simulationResultCatch(e: any): any {
  if (e.errorName !== "ValidationResult") {
    throw e;
  }
  return e.errorArgs;
}

export function getCallData(
  tx: Partial<{ to: string; data?: BytesLike; value?: BigNumberish }>
) {
  const execFromEntryPoint =
    SmartWallet__factory.createInterface().encodeFunctionData("execute", [
      tx.to,
      tx.value ?? 0,
      tx.data ?? "0x",
    ]);
  return execFromEntryPoint;
}

export function getBatchCallData(
  txs: Partial<{ to: string; data?: BytesLike }>[]
) {
  const dest = txs.map((tx) => tx.to);
  const datas = txs.map((tx) => tx.data ?? "0x");
  return SmartWallet__factory.createInterface().encodeFunctionData(
    "executeBatch",
    [dest, datas]
  );
}

export async function createTransaction(
  transaction: Deferrable<TransactionRequest>,
  ethersProvider: BaseProvider,
  wallet: SmartWallet,
  initCode?: BytesLike
) {
  const tx: TransactionRequest = await resolveProperties(transaction);

  const execFromEntryPoint = await wallet.populateTransaction.execute(
    tx.to!,
    tx.value ?? 0,
    tx.data ?? "0x"
  );

  let { gasPrice, maxPriorityFeePerGas, maxFeePerGas } = tx;
  // gasPrice is legacy, and overrides eip1559 values:
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (gasPrice) {
    maxPriorityFeePerGas = gasPrice;
    maxFeePerGas = gasPrice;
  }
  return {
    sender: wallet.address,
    initCode,
    nonce: initCode == null ? tx.nonce : 100, // TODO fix it
    callData: execFromEntryPoint.data!,
    callGasLimit: execFromEntryPoint.gasLimit,
    maxPriorityFeePerGas,
    maxFeePerGas,
  };
}

export async function createBatchTransactions(
  transactions: Deferrable<TransactionRequest>[],
  ethersProvider: BaseProvider,
  wallet: SmartWallet,
  initCode?: BytesLike
) {
  const txs: TransactionRequest[] = await Promise.all(
    transactions.map((tx) => resolveProperties(tx))
  );

  let execFromEntryPoint;
  if (txs.length == 1) {
    const tx = txs[0];
    execFromEntryPoint = await wallet.populateTransaction.execute(
      tx.to!,
      tx.value ?? 0,
      tx.data ?? "0x"
    );
  } else {
    const dest = txs.map((tx) => tx.to);
    const datas = txs.map((tx) => tx.data ?? "0x");
    execFromEntryPoint = await wallet.populateTransaction.executeBatch(
      dest,
      datas
    );
  }

  let { gasPrice, maxPriorityFeePerGas, maxFeePerGas } = execFromEntryPoint;
  // gasPrice is legacy, and overrides eip1559 values:
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (gasPrice) {
    maxPriorityFeePerGas = gasPrice;
    maxFeePerGas = gasPrice;
  }
  return {
    sender: wallet.address,
    initCode,
    nonce: initCode == null ? execFromEntryPoint.nonce : 100, // TODO fix it
    callData: execFromEntryPoint.data!,
    callGasLimit: execFromEntryPoint.gasLimit,
    maxPriorityFeePerGas,
    maxFeePerGas,
  };
}

export async function evInfo(
  entryPoint: EntryPoint,
  rcpt: TransactionReceipt
): Promise<any> {
  // TODO: checking only latest block...
  const block = rcpt.blockNumber;
  const ev = await entryPoint.queryFilter(
    entryPoint.filters.UserOperationEvent(),
    block
  );
  // if (ev.length === 0) return {}
  return ev.map((event) => {
    const { nonce, actualGasUsed } = event.args;
    const gasUsed = rcpt.gasUsed.toNumber();
    return {
      nonce: nonce.toNumber(),
      gasUsed: gasUsed,
      diff: gasUsed - actualGasUsed.toNumber(),
    };
  });
}

export async function create2Deploy(
  deployFactory: Create2Factory,
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
  } else {
    const gasLimit = await deployFactory.estimateGas.deploy(
      deployableCode,
      salt
    );
    const tx = await deployFactory.deploy(deployableCode, salt, { gasLimit });
    await tx.wait();
  }

  return contract.attach(deployedAddress);
}
