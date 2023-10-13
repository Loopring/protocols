import { ethers } from "hardhat";
import * as typ from "./solidityTypes";
import { Wallet, Signer, BigNumber, BigNumberish } from "ethers";
import BN from "bn.js";
import { signCreateWallet } from "./signatureUtils";
import { Contract } from "ethers";
import {
  EntryPoint,
  SmartWallet,
  SmartWalletV3,
  EntryPoint__factory,
  SmartWallet__factory,
  WalletFactory,
  WalletFactory__factory,
  WalletProxy__factory,
  LoopringCreate2Deployer,
  VerifyingPaymaster,
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
import { UserOperation, SendUserOp, fillAndSign } from "./AASigner";

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
  accountFactory: LoopringCreate2Deployer
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
  valueOfEth: BigNumberish,
  validUntil: BigNumberish
) {
  const sig = await paymasterOwner.signMessage(arrayify(hash));
  const paymasterCalldata = ethers.utils.defaultAbiCoder.encode(
    ["address", "uint256", "uint256", "bytes"],
    [usdcToken, valueOfEth, validUntil, sig]
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
  walletFactory: LoopringCreate2Deployer,
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
    SmartWallet__factory.createInterface().encodeFunctionData("callContract", [
      tx.to,
      tx.value ?? 0,
      tx.data ?? "0x",
      false,
    ]);
  return execFromEntryPoint;
}

export function getBatchCallData(
  txs: Partial<{ to: string; data?: BytesLike }>[]
) {
  const dest = txs.map((tx) => tx.to);
  const datas = txs.map((tx) => tx.data ?? "0x");
  return SmartWallet__factory.createInterface().encodeFunctionData(
    "selfBatchCall",
    [datas]
  );
}

export async function createTransaction(
  transaction: Deferrable<TransactionRequest>,
  ethersProvider: BaseProvider,
  wallet: SmartWallet,
  initCode?: BytesLike
) {
  const tx: TransactionRequest = await resolveProperties(transaction);

  const execFromEntryPoint = await wallet.populateTransaction.callContract(
    tx.to!,
    tx.value ?? 0,
    tx.data ?? "0x",
    false
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
  wallet: SmartWalletV3,
  useExecuteApi: boolean,
  initCode?: BytesLike
) {
  const txs: TransactionRequest[] = await Promise.all(
    transactions.map((tx) => resolveProperties(tx))
  );

  let execFromEntryPoint;
  if (txs.length == 1) {
    const tx = txs[0];
    if (useExecuteApi) {
      execFromEntryPoint = await wallet.populateTransaction.callContract(
        tx.to!,
        tx.value ?? 0,
        tx.data ?? "0x",
        false
      );
    } else {
      execFromEntryPoint = tx;
    }
  } else {
    let datas = txs.map((tx) => tx.data ?? "0x");

    if (useExecuteApi) {
      const wrappedTxs = await Promise.all(
        txs.map((tx) =>
          wallet.populateTransaction.callContract(
            tx.to,
            tx.value ?? 0,
            tx.data ?? "0x",
            false
          )
        )
      );
      datas = wrappedTxs.map((wtx) => wtx.data);
    } else {
      datas = txs.map((tx) => tx.data ?? "0x");
    }
    execFromEntryPoint = await wallet.populateTransaction.selfBatchCall(datas);
  }

  let { gasPrice, maxPriorityFeePerGas, maxFeePerGas } = execFromEntryPoint;
  // gasPrice is legacy, and overrides eip1559 values:
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (gasPrice) {
    maxPriorityFeePerGas = gasPrice;
    maxFeePerGas = gasPrice;
  }
  const nonce = await wallet.nonce();
  return {
    sender: wallet.address,
    initCode,
    // increase nonce
    nonce: nonce.add(1),
    callData: execFromEntryPoint.data!,
    callGasLimit: execFromEntryPoint.gasLimit,
    maxPriorityFeePerGas,
    maxFeePerGas,
  };
}

export async function evInfo(entryPoint: EntryPoint, rcpt: TransactionReceipt) {
  // TODO: checking only latest block...
  const block = rcpt.blockNumber;
  const ev = await entryPoint.queryFilter(
    entryPoint.filters.UserOperationEvent(),
    block
  );
  // if (ev.length === 0) return {}
  return ev.map((event) => {
    const { nonce, actualGasUsed, actualGasCost } = event.args;
    return {
      nonce,
      gasUsed: rcpt.gasUsed,
      actualGasUsed,
      actualGasCost,
    };
  });
}

export async function evRevertInfo(
  entryPoint: EntryPoint,
  rcpt: TransactionReceipt
) {
  // TODO: checking only latest block...
  const block = rcpt.blockNumber;
  const ev = await entryPoint.queryFilter(
    entryPoint.filters.UserOperationRevertReason(),
    block
  );
  // if (ev.length === 0) return {}
  return ev.map((event) => {
    const { nonce, revertReason } = event.args;
    return {
      nonce,
      gasUsed: rcpt.gasUsed,
      revertReason,
    };
  });
}

export async function create2Deploy(
  deployFactory: LoopringCreate2Deployer,
  contractName: string,
  args?: any[],
  libs?: Map<string, any>
) {
  // use same salt for all deployments:
  const salt = ethers.utils.formatBytes32String("0x5");

  const libraries = {}; // libs ? Object.fromEntries(libs) : {}; // requires lib: ["es2019"]
  libs && libs.forEach((value, key) => (libraries[key] = value));

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

export async function deploySingle(
  deployFactory: LoopringCreate2Deployer,
  contractName: string,
  args?: any[],
  libs?: Map<string, any>
) {
  // use same salt for all deployments:
  const salt = ethers.utils.hexlify(ethers.utils.randomBytes(32));

  const libraries = {}; // libs ? Object.fromEntries(libs) : {}; // requires lib: ["es2019"]
  libs && libs.forEach((value, key) => (libraries[key] = value));

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
  const gasLimit = await deployFactory.estimateGas.deploy(deployableCode, salt);
  const tx = await deployFactory.deploy(deployableCode, salt, { gasLimit });
  await tx.wait();

  return contract.attach(deployedAddress);
}

export async function deployWalletImpl(
  deployFactory: LoopringCreate2Deployer,
  entryPointAddr: string,
  blankOwner: string,
  automationAddr: string,
  priceOracleAddr = ethers.constants.AddressZero
) {
  const ERC1271Lib = await deploySingle(deployFactory, "ERC1271Lib");
  const ERC20Lib = await deploySingle(deployFactory, "ERC20Lib");
  const GuardianLib = await deploySingle(deployFactory, "GuardianLib");
  const InheritanceLib = await deploySingle(
    deployFactory,
    "InheritanceLib",
    undefined,
    new Map([["GuardianLib", GuardianLib.address]])
  );
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

  const smartWallet = await deploySingle(
    deployFactory,
    "SmartWalletV3",
    [priceOracleAddr, blankOwner, entryPointAddr, automationAddr],
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

export async function createSmartWallet(
  owner: Wallet,
  guardians: string[],
  walletFactory: WalletFactory,
  salt: string
) {
  const feeRecipient = ethers.constants.AddressZero;
  const { chainId } = await ethers.provider.getNetwork();
  // create smart wallet
  const signature = signCreateWallet(
    walletFactory.address,
    owner.address,
    guardians,
    new BN(0),
    ethers.constants.AddressZero,
    feeRecipient,
    ethers.constants.AddressZero,
    new BN(0),
    salt,
    owner.privateKey.slice(2),
    chainId
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
  return tx.wait();
}

export interface PaymasterOption {
  paymaster: VerifyingPaymaster;
  payToken: Contract;
  paymasterOwner: Signer;
  valueOfEth: BigNumberish;
  validUntil: BigNumberish;
}

async function getEthBalance(smartWallet: SmartWalletV3) {
  const ethBalance = await ethers.provider.getBalance(smartWallet.address);
  const depositBalance = await smartWallet.getDeposit();
  const totalBalance = ethBalance.add(depositBalance);
  return totalBalance;
}

export async function sendTx(
  txs: Deferrable<TransactionRequest>[],
  smartWallet: SmartWalletV3,
  smartWalletOwner: Signer,
  contractFactory: Contract,
  entrypoint: EntryPoint,
  sendUserOp: SendUserOp,
  paymasterOption?: PaymasterOption,
  useExecuteApi = true
) {
  const ethSent = txs.reduce(
    (acc, tx) => acc.add(BigNumber.from(tx.value ?? 0)),
    BigNumber.from(0)
  );
  const partialUserOp = await createBatchTransactions(
    txs,
    ethers.provider,
    smartWallet,
    useExecuteApi
  );
  // first call to fill userop
  let signedUserOp = await fillAndSign(
    partialUserOp,
    smartWalletOwner,
    contractFactory.address,
    entrypoint
  );

  // handle paymaster
  if (paymasterOption) {
    const paymaster = paymasterOption.paymaster;
    const payToken = paymasterOption.payToken;
    const valueOfEth = paymasterOption.valueOfEth;
    const validUntil = paymasterOption.validUntil;
    const packedData = ethers.utils.solidityPack(
      ["address", "uint256", "uint256"],
      [payToken.address, valueOfEth, validUntil]
    );

    const hash = await paymaster.getHash(signedUserOp, packedData);

    const paymasterAndData = await getPaymasterAndData(
      paymaster.address,
      paymasterOption.paymasterOwner,
      hash,
      payToken.address,
      valueOfEth,
      validUntil
    );
    signedUserOp.paymasterAndData = paymasterAndData;
    signedUserOp = await fillAndSign(
      signedUserOp,
      smartWalletOwner,
      contractFactory.address,
      entrypoint
    );
  }

  return await sendUserOp(signedUserOp);
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

export function getErrorMessage(revertReason: string) {
  return ethers.utils.defaultAbiCoder.decode(
    ["string"],
    "0x" + revertReason.slice(10)
  )[0];
}

export async function getBlockTimestamp(blockNumber: number) {
  const block = await ethers.provider.getBlock(blockNumber);
  return block.timestamp;
}

export async function getCurrentQuota(quotaInfo: any, blockNumber: number) {
  const blockTime = await getBlockTimestamp(blockNumber);
  const pendingUntil = quotaInfo.pendingUntil.toNumber();

  return pendingUntil <= blockTime
    ? quotaInfo.pendingQuota
    : quotaInfo.currentQuota;
}

export async function getFirstEvent(
  contract: Contract,
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
