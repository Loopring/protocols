import { executeMetaTx, TransactionOptions } from "./MetaTx";
import { Artifacts } from "./Artifacts";
import { addGuardian } from "./GuardianUtils";
import { assertEventEmitted } from "../../util/Events";
import BN = require("bn.js");
import { Constants } from "./Constants";
import { sign, SignatureType } from "./Signature";
import { signCreateWallet } from "./SignatureUtils";

export interface Context {
  contracts: any;

  owners: string[];
  guardians: string[];
  miscAddresses: string[];

  useMetaTx: boolean;

  controllerImpl: any;
  walletFactory: any;
  moduleRegistryImpl: any;
  baseENSManager: any;

  finalSecurityModule: any;
  finalTransferModule: any;
  finalCoreModule: any;

  walletImpl: any;

  hashStore: any;
  securityStore: any;
  whitelistStore: any;
  quotaStore: any;
  cachedPriceOracle: any;
}

export async function getContext() {
  const accounts = await web3.eth.getAccounts();
  web3.eth.defaultAccount = accounts[0];

  const contracts = new Artifacts(artifacts);
  const context: Context = {
    contracts,

    owners: accounts.slice(1, 21),
    guardians: accounts.slice(21, 40),
    miscAddresses: accounts.slice(40, 50),

    useMetaTx: true,

    controllerImpl: await contracts.ControllerImpl.deployed(),
    walletFactory: await contracts.WalletFactory.deployed(),
    moduleRegistryImpl: await contracts.ModuleRegistryImpl.deployed(),
    baseENSManager: await contracts.BaseENSManager.deployed(),

    finalCoreModule: await contracts.FinalCoreModule.deployed(),
    finalSecurityModule: await contracts.FinalSecurityModule.deployed(),
    finalTransferModule: await contracts.FinalTransferModule.deployed(),

    walletImpl: await contracts.WalletImpl.deployed(),

    hashStore: await contracts.HashStore.deployed(),
    securityStore: await contracts.SecurityStore.deployed(),
    whitelistStore: await contracts.WhitelistStore.deployed(),
    quotaStore: await contracts.QuotaStore.deployed(),
    cachedPriceOracle: await contracts.CachedPriceOracle.new(
      Constants.zeroAddress
    )
  };
  return context;
}

export async function createContext(context?: Context, options: any = {}) {
  context = context === undefined ? await getContext() : context;
  const priceOracle =
    options.priceOracle !== undefined
      ? options.priceOracle
      : context.cachedPriceOracle.address;

  // Create new controller
  const controllerImpl = await context.contracts.ControllerImpl.new(
    context.hashStore.address,
    context.quotaStore.address,
    context.securityStore.address,
    context.whitelistStore.address,
    context.moduleRegistryImpl.address,
    await context.controllerImpl.feeCollector(),
    await context.controllerImpl.ensManager(),
    priceOracle
  );
  context.controllerImpl = controllerImpl;

  // Create a new wallet factory
  const walletFactory = await context.contracts.WalletFactory.new(
    context.controllerImpl.address,
    context.walletImpl.address,
    true
  );

  await context.baseENSManager.addManager(walletFactory.address);
  await context.controllerImpl.initWalletFactory(walletFactory.address);
  context.walletFactory = walletFactory;

  // Create new modules
  const finalCoreModule = await context.contracts.FinalCoreModule.new(
    context.controllerImpl.address
  );
  const finalSecurityModule = await context.contracts.FinalSecurityModule.new(
    context.controllerImpl.address,
    finalCoreModule.address
  );
  const finalTransferModule = await context.contracts.FinalTransferModule.new(
    context.controllerImpl.address,
    finalCoreModule.address
  );

  await context.moduleRegistryImpl.registerModule(finalCoreModule.address);
  await context.moduleRegistryImpl.registerModule(finalSecurityModule.address);
  await context.moduleRegistryImpl.registerModule(finalTransferModule.address);

  context.finalCoreModule = finalCoreModule;
  context.finalSecurityModule = finalSecurityModule;
  context.finalTransferModule = finalTransferModule;

  return context;
}
export function getAllModuleAddresses(ctx: Context) {
  return [
    ctx.finalCoreModule.address,
    ctx.finalSecurityModule.address,
    ctx.finalTransferModule.address
  ];
}

export async function createWallet(
  ctx: Context,
  owner: string,
  numGuardians: number = 0,
  modules?: string[]
) {
  modules = modules === undefined ? getAllModuleAddresses(ctx) : modules;

  const salt = new Date().getTime();

  const wallet = await ctx.walletFactory.computeWalletAddress(owner, salt);
  const walletName = "mywalleta" + new Date().getTime();

  const ensApproval = await getEnsApproval(
    wallet,
    owner,
    walletName,
    ctx.owners[0]
  );
  const { txSignature } = signCreateWallet(
    ctx.walletFactory.address,
    owner,
    salt,
    Constants.zeroAddress,
    walletName,
    true,
    modules
  );

  await ctx.walletFactory.createWallet(
    owner,
    salt,
    walletName,
    ensApproval,
    true,
    modules,
    txSignature,
    {
      from: owner
    }
  );
  // Add the guardians
  const guardians = ctx.guardians.slice(0, numGuardians);
  for (const guardian of guardians) {
    await addGuardian(ctx, owner, wallet, guardian, false);
  }
  return { wallet, guardians };
}

export async function createWallet2(
  ctx: Context,
  owner: string,
  guardianAddrs: string[] = [],
  modules?: string[]
) {
  modules = modules === undefined ? getAllModuleAddresses(ctx) : modules;
  const salt = new Date().getTime();

  const wallet = await ctx.walletFactory.computeWalletAddress(owner, salt);
  const walletName = "mywalleta" + new Date().getTime();

  const ensApproval = await getEnsApproval(
    wallet,
    owner,
    walletName,
    ctx.owners[0]
  );
  const { txSignature } = signCreateWallet(
    ctx.walletFactory.address,
    owner,
    salt,
    Constants.zeroAddress,
    walletName,
    true,
    modules
  );

  await ctx.walletFactory.createWallet(
    owner,
    salt,
    walletName,
    ensApproval,
    true,
    modules,
    txSignature,
    {
      from: owner
    }
  );
  // Add the guardians
  for (const guardian of guardianAddrs) {
    await addGuardian(ctx, owner, wallet, guardian, false);
  }
  return { wallet, guardians: guardianAddrs };
}

export async function executeTransaction(
  txData: any,
  ctx: Context,
  useMetaTx: boolean,
  wallet: string,
  signers: string[],
  options: TransactionOptions = {}
) {
  const contract = txData._parent;
  const data = txData.encodeABI();
  const txAwareHash = options.txAwareHash || Constants.emptyBytes32;
  if (useMetaTx) {
    const result = await executeMetaTx(
      ctx,
      contract,
      txAwareHash,
      data,
      options
    );

    const event = await assertEventEmitted(
      ctx.finalCoreModule,
      "MetaTxExecuted"
    );
    assert.equal(event.from, options.wallet, "MetaTx from not match");
    return result;
  } else {
    const from = options.from ? options.from : web3.eth.defaultAccount;
    return web3.eth.sendTransaction({
      to: contract._address,
      from,
      gas: 4000000,
      data
    });
  }
}

export async function getBlockTime(blockNumber: number) {
  const block = await web3.eth.getBlock(blockNumber);
  return block.timestamp;
}

export function description(descr: string, metaTx: boolean) {
  return descr + (metaTx ? " (meta tx)" : "");
}

export function toAmount(value: string) {
  return new BN(web3.utils.toWei(value, "ether"));
}

export function sortAddresses(addresses: string[]) {
  return addresses.sort((a: string, b: string) => {
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });
}

export async function getEnsApproval(
  wallet: string,
  owner: string,
  walletName: string,
  signer: string
) {
  const messageBuf = Buffer.concat([
    Buffer.from(wallet.slice(2), "hex"),
    Buffer.from(owner.slice(2), "hex"),
    Buffer.from(walletName, "utf8")
  ]);

  const messageHash = web3.utils.sha3(messageBuf);
  const hashBuf = Buffer.from(messageHash.slice(2), "hex");

  let signature = sign(signer, hashBuf, SignatureType.ETH_SIGN);
  signature = signature.slice(0, -2);
  return signature;
}
