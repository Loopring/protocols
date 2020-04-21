import { executeMetaTransaction, TransactionOptions } from "./MetaTransaction";
import { Artifacts } from "./Artifacts";
import { addGuardian } from "./GuardianUtils";
import { assertEventEmitted } from "../../util/Events";
import BN = require("bn.js");

export interface Context {
  contracts: any;

  owners: string[];
  guardians: string[];
  miscAddresses: string[];

  useMetaTx: boolean;

  controllerImpl: any;
  walletFactoryModule: any;
  walletRegistryImpl: any;
  moduleRegistryImpl: any;
  walletENSManager: any;

  recoveryModule: any;
  guardianModule: any;
  lockModule: any;
  inheritanceModule: any;
  whitelistModule: any;
  quotaModule: any;
  quotaTransfers: any;
  approvedTransfers: any;
  erc1271Module: any;

  baseWallet: any;

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
    walletFactoryModule: await contracts.WalletFactoryModule.deployed(),
    walletRegistryImpl: await contracts.WalletRegistryImpl.deployed(),
    moduleRegistryImpl: await contracts.ModuleRegistryImpl.deployed(),
    walletENSManager: await contracts.WalletENSManager.deployed(),

    recoveryModule: await contracts.RecoveryModule.deployed(),
    guardianModule: await contracts.GuardianModule.deployed(),
    lockModule: await contracts.LockModule.deployed(),
    inheritanceModule: await contracts.InheritanceModule.deployed(),
    whitelistModule: await contracts.WhitelistModule.deployed(),
    quotaModule: await contracts.QuotaModule.deployed(),
    quotaTransfers: await contracts.QuotaTransfers.deployed(),
    approvedTransfers: await contracts.ApprovedTransfers.deployed(),
    erc1271Module: await contracts.ERC1271Module.deployed(),

    baseWallet: await contracts.BaseWallet.deployed(),
    securityStore: await contracts.SecurityStore.deployed(),
    whitelistStore: await contracts.WhitelistStore.deployed(),
    quotaStore: await contracts.QuotaStore.deployed(),
    priceCacheStore: await contracts.PriceCacheStore.deployed()
  };
  return context;
}

export async function createContext(context?: Context) {
  context = context === undefined ? await getContext() : context;
  // Create a new wallet factory module
  const walletFactoryModule = await context.contracts.WalletFactoryModule.new(
    context.controllerImpl.address,
    context.contracts.BaseWallet.address
  );
  await context.moduleRegistryImpl.registerModule(walletFactoryModule.address);
  await context.walletRegistryImpl.setWalletFactory(
    walletFactoryModule.address
  );
  await context.walletENSManager.addManager(walletFactoryModule.address);
  context.walletFactoryModule = walletFactoryModule;

  return context;
}

export function getAllModuleAddresses(ctx: Context) {
  return [
    ctx.recoveryModule.address,
    ctx.guardianModule.address,
    ctx.lockModule.address,
    ctx.inheritanceModule.address,
    ctx.whitelistModule.address,
    ctx.quotaModule.address,
    ctx.quotaTransfers.address,
    ctx.approvedTransfers.address,
    ctx.erc1271Module.address
  ];
}

export async function createWallet(
  ctx: Context,
  owner: string,
  numGuardians: number = 0,
  modules?: string[]
) {
  modules = modules === undefined ? getAllModuleAddresses(ctx) : modules;

  const wallet = await ctx.walletFactoryModule.computeWalletAddress(owner);
  await ctx.walletFactoryModule.createWallet(owner, "", modules, {
    from: owner
  });
  // Add the guardians
  const guardians = ctx.guardians.slice(0, numGuardians);
  const group = 0;
  for (const guardian of guardians) {
    await addGuardian(ctx, owner, wallet, guardian, group, false);
  }
  return { wallet, guardians };
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
    const result = await executeMetaTransaction(
      ctx,
      contract,
      data,
      wallet,
      signers,
      options
    );

    const event = await assertEventEmitted(contract, "ExecutedMetaTx");
    if (!event.success) {
      // Check if the return data contains the revert reason.
      // If it does we can easily re-throw the actual revert reason of the function call done in the meta tx
      if (event.returnData && event.returnData.startsWith("0x08c379a0")) {
        const decoded = web3.eth.abi.decodeParameters(
          ["string"],
          event.returnData.slice(10)
        );
        assert.fail("Meta tx call revert: " + decoded[0]);
      } else {
        assert.fail("Meta tx call failed");
      }
    }
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
