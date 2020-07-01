import { executeMetaTransaction, TransactionOptions } from "./MetaTransaction";
import { Artifacts } from "./Artifacts";
import { addGuardian } from "./GuardianUtils";
import { assertEventEmitted } from "../../util/Events";
import BN = require("bn.js");
import { Constants } from "./Constants";
import { sign, SignatureType } from "./Signature";

export interface Context {
  contracts: any;

  owners: string[];
  guardians: string[];
  miscAddresses: string[];

  useMetaTx: boolean;

  controllerImpl: any;
  walletFactoryModule: any;
  forwarderModule: any;
  walletRegistryImpl: any;
  moduleRegistryImpl: any;
  baseENSManager: any;

  guardianModule: any;
  inheritanceModule: any;
  whitelistModule: any;
  quotaTransferModule: any;
  approvedTransferModule: any;
  dappTransferModule: any;
  erc1271Module: any;

  walletImpl: any;

  securityStore: any;
  whitelistStore: any;
  quotaStore: any;
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
    forwarderModule: await contracts.ForwarderModule.deployed(),
    walletRegistryImpl: await contracts.WalletRegistryImpl.deployed(),
    moduleRegistryImpl: await contracts.ModuleRegistryImpl.deployed(),
    baseENSManager: await contracts.BaseENSManager.deployed(),

    guardianModule: await contracts.GuardianModule.deployed(),
    inheritanceModule: await contracts.InheritanceModule.deployed(),
    whitelistModule: await contracts.WhitelistModule.deployed(),
    quotaTransferModule: await contracts.QuotaTransferModule.deployed(),
    approvedTransferModule: await contracts.ApprovedTransferModule.deployed(),
    dappTransferModule: await contracts.DappTransferModule.deployed(),
    erc1271Module: await contracts.ERC1271Module.deployed(),

    walletImpl: await contracts.WalletImpl.deployed(),
    securityStore: await contracts.SecurityStore.deployed(),
    whitelistStore: await contracts.WhitelistStore.deployed(),
    quotaStore: await contracts.QuotaStore.deployed()
  };
  return context;
}

export async function createContext(context?: Context) {
  context = context === undefined ? await getContext() : context;
  // Create a new wallet factory module
  const walletFactoryModule = await context.contracts.WalletFactoryModule.new(
    context.controllerImpl.address,
    context.forwarderModule.address,
    context.contracts.WalletImpl.address,
    true
  );
  await context.moduleRegistryImpl.registerModule(walletFactoryModule.address);
  await context.walletRegistryImpl.setWalletFactory(
    walletFactoryModule.address
  );
  await context.baseENSManager.addManager(walletFactoryModule.address);
  context.walletFactoryModule = walletFactoryModule;

  return context;
}

export function getAllModuleAddresses(ctx: Context) {
  return [
    ctx.guardianModule.address,
    ctx.inheritanceModule.address,
    ctx.whitelistModule.address,
    ctx.quotaTransferModule.address,
    ctx.approvedTransferModule.address,
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
  const walletName = "mywalleta" + new Date().getTime();
  await ctx.walletFactoryModule.createWallet(
    owner,
    walletName,
    Constants.emptyBytes,
    modules,
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

    const event = await assertEventEmitted(contract, "MetaTxExecuted");
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
