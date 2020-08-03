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
  walletRegistryImpl: any;
  moduleRegistryImpl: any;
  baseENSManager: any;

  packedSecurityModule: any;
  packedTransferModule: any;
  packedCoreModule: any;

  walletImpl: any;

  securityStore: any;
  whitelistStore: any;
  quotaStore: any;
  priceCacheStore: any;
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
    walletRegistryImpl: await contracts.WalletRegistryImpl.deployed(),
    moduleRegistryImpl: await contracts.ModuleRegistryImpl.deployed(),
    baseENSManager: await contracts.BaseENSManager.deployed(),

    packedCoreModule: await contracts.PackedCoreModule.deployed(),
    packedSecurityModule: await contracts.PackedSecurityModule.deployed(),
    packedTransferModule: await contracts.PackedTransferModule.deployed(),

    walletImpl: await contracts.WalletImpl.deployed(),
    securityStore: await contracts.SecurityStore.deployed(),
    whitelistStore: await contracts.WhitelistStore.deployed(),
    quotaStore: await contracts.QuotaStore.deployed(),
    priceCacheStore: await contracts.PriceCacheStore.new(
      Constants.zeroAddress,
      3600 * 240
    )
  };
  return context;
}

export async function createContext(context?: Context) {
  context = context === undefined ? await getContext() : context;
  // Create a new wallet factory
  const walletFactory = await context.contracts.WalletFactory.new(
    context.controllerImpl.address,
    context.walletImpl.address,
    true
  );

  await context.walletRegistryImpl.setWalletFactory(walletFactory.address);
  await context.baseENSManager.addManager(walletFactory.address);
  await context.controllerImpl.initWalletFactory(walletFactory.address);
  context.walletFactory = walletFactory;

  return context;
}

export function getAllModuleAddresses(ctx: Context) {
  return [
    ctx.packedCoreModule.address,
    ctx.packedSecurityModule.address,
    ctx.packedTransferModule.address
  ];
}

export async function createWallet(
  ctx: Context,
  owner: string,
  numGuardians: number = 0,
  modules?: string[]
) {
  modules = modules === undefined ? getAllModuleAddresses(ctx) : modules;

  const wallet = await ctx.walletFactory.computeWalletAddress(owner);
  const walletName = "mywalleta" + new Date().getTime();
  const ensApproval = await getEnsApproval(wallet, walletName, ctx.owners[0]);
  const txSignature = signCreateWallet(
    ctx.walletFactory.address,
    owner,
    walletName,
    ensApproval,
    modules
  );

  await ctx.walletFactory.createWallet(
    owner,
    walletName,
    ensApproval,
    modules,
    txSignature,
    {
      from: owner
    }
  );
  // Add the guardians
  const guardians = ctx.guardians.slice(0, numGuardians);
  const group = 0;
  for (const guardian of guardians) {
    await addGuardian(ctx, owner, wallet, guardian, group, false);
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

  const wallet = await ctx.walletFactory.computeWalletAddress(owner);
  const walletName = "mywalleta" + new Date().getTime();
  const ensApproval = await getEnsApproval(wallet, walletName, ctx.owners[0]);
  const txSignature = signCreateWallet(
    ctx.walletFactory.address,
    owner,
    walletName,
    ensApproval,
    modules
  );

  await ctx.walletFactory.createWallet(
    owner,
    walletName,
    ensApproval,
    modules,
    txSignature,
    {
      from: owner
    }
  );
  // Add the guardians
  const group = 0;
  for (const guardian of guardianAddrs) {
    await addGuardian(ctx, owner, wallet, guardian, group, false);
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
  if (useMetaTx) {
    const result = await executeMetaTx(
      ctx,
      contract,
      "0x" + "00".repeat(32),
      data,
      options
    );

    const event = await assertEventEmitted(
      ctx.packedCoreModule,
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
  walletName: string,
  signer: string
) {
  const messageBuf = Buffer.concat([
    Buffer.from(wallet.slice(2), "hex"),
    Buffer.from(walletName, "utf8")
  ]);

  const messageHash = web3.utils.sha3(messageBuf);
  const hashBuf = Buffer.from(messageHash.slice(2), "hex");

  let signature = sign(signer, hashBuf, SignatureType.ETH_SIGN);
  signature = signature.slice(0, -2);
  return signature;
}
