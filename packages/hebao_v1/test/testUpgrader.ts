import {
  Context,
  getContext,
  createContext,
  createWallet,
  executeTransaction,
  toAmount,
  getAllModuleAddresses
} from "./helpers/TestUtils";
import { Constants } from "./helpers/Constants";
import { addGuardian } from "./helpers/GuardianUtils";
import { transferFrom } from "./helpers/TokenUtils";
import {
  assertEventEmitted,
  assertEventsEmitted,
  assertNoEventEmitted
} from "../util/Events";
import { expectThrow } from "../util/expectThrow";
import BN = require("bn.js");

contract("UpgraderModule", () => {
  let defaultCtx: Context;
  let ctx: Context;

  let useMetaTx: boolean = false;

  const addAndRemoveModulesChecked = async (
    owner: string,
    wallet: string,
    modulesToAdd: string[],
    modulesToRemove: string[],
    initialModule: any
  ) => {
    const walletContract = await ctx.contracts.BaseWallet.at(wallet);

    if (useMetaTx) {
      // Transfer 0.1 ETH to the wallet to pay for the wallet creation
      await transferFrom(ctx, owner, wallet, "ETH", toAmount("0.1"));
    }

    // Create an upgrader module
    const upgraderModule = await ctx.contracts.UpgraderModule.new(
      Constants.zeroAddress,
      modulesToAdd,
      modulesToRemove
    );
    await ctx.moduleRegistryImpl.registerModule(upgraderModule.address);

    // Do the upgrade
    await executeTransaction(
      initialModule.contract.methods.addModule(wallet, upgraderModule.address),
      ctx,
      useMetaTx,
      wallet,
      [owner],
      { from: owner, gasPrice: new BN(1) }
    );
    for (const moduleToAdd of modulesToAdd) {
      // Check if the module have been added
      assert(await walletContract.hasModule(moduleToAdd), "module not added");
    }
    for (const moduleToRemove of modulesToRemove) {
      // Check if the module have been added
      assert(
        !(await walletContract.hasModule(moduleToRemove)),
        "module not removed"
      );
    }
  };

  const description = (descr: string, metaTx: boolean = useMetaTx) => {
    return descr + (metaTx ? " (meta tx)" : "");
  };

  before(async () => {
    defaultCtx = await getContext();
  });

  beforeEach(async () => {
    ctx = await createContext(defaultCtx);
  });

  [false, true].forEach(function(metaTx) {
    it(
      description(
        "owner should be able to upgrade the wallet implementation",
        metaTx
      ),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const activeModule = ctx.guardianModule;
        const { wallet } = await createWallet(ctx, owner, 0, [
          activeModule.address
        ]);
        const walletContract = await ctx.contracts.OwnedUpgradabilityProxy.at(
          wallet
        );

        // Create a new wallet implementation contract
        const newBaseWallet = await ctx.contracts.BaseWallet.new();

        // Create an upgrader module
        const upgraderModule = await ctx.contracts.UpgraderModule.new(
          newBaseWallet.address,
          [],
          []
        );
        await ctx.moduleRegistryImpl.registerModule(upgraderModule.address);

        // Check current wallet implementation
        assert.equal(
          await walletContract.implementation(),
          ctx.baseWallet.address,
          "wallet implementation incorrect"
        );

        // Do the upgrade
        await executeTransaction(
          activeModule.contract.methods.addModule(
            wallet,
            upgraderModule.address
          ),
          ctx,
          useMetaTx,
          wallet,
          [owner],
          { from: owner }
        );
        // Check for the `Upgraded` event on the wallet proxy contract
        await assertEventEmitted(walletContract, "Upgraded", (event: any) => {
          return event.implementation === newBaseWallet.address;
        });

        // Check the new wallet implementation
        assert.equal(
          await walletContract.implementation(),
          newBaseWallet.address,
          "wallet implementation incorrect"
        );

        // Make sure the wallet is still fully functional
        await ctx.guardianModule.addModule(wallet, ctx.recoveryModule.address, {
          from: owner
        });
      }
    );

    it(
      description(
        "owner should be able to add modules directly on the wallet",
        metaTx
      ),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const { wallet } = await createWallet(ctx, owner, 0, []);
        const walletContract = await ctx.contracts.BaseWallet.at(wallet);

        // Try to use the module before adding it to the wallet
        await expectThrow(
          ctx.guardianModule.addModule(wallet, ctx.whitelistModule.address, {
            from: owner
          }),
          "UNAUTHORIZED"
        );

        // Add the module
        await walletContract.addModule(ctx.guardianModule.address, {
          from: owner
        });
        // Check for the `ModuleAdded` event on the wallet
        await assertEventEmitted(
          walletContract,
          "ModuleAdded",
          (event: any) => {
            return event.module === ctx.guardianModule.address;
          }
        );
        // Check if the module has been added
        assert(
          await walletContract.hasModule(ctx.guardianModule.address),
          "module not added"
        );

        // Try to add the same module again
        await expectThrow(
          walletContract.addModule(ctx.guardianModule.address, { from: owner }),
          "MODULE_EXISTS"
        );

        // Make sure the module is now authorized
        await ctx.guardianModule.addModule(wallet, ctx.recoveryModule.address, {
          from: owner
        });
      }
    );

    it(
      description(
        "owner should be able to add modules using another module",
        metaTx
      ),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const initialModule = ctx.whitelistModule;
        const { wallet } = await createWallet(ctx, owner, 0, [
          initialModule.address
        ]);
        const walletContract = await ctx.contracts.BaseWallet.at(wallet);

        // Add the module
        await executeTransaction(
          initialModule.contract.methods.addModule(
            wallet,
            ctx.guardianModule.address
          ),
          ctx,
          useMetaTx,
          wallet,
          [owner],
          { from: owner }
        );
        // Check for the `ModuleAdded` event on the wallet
        await assertEventEmitted(
          walletContract,
          "ModuleAdded",
          (event: any) => {
            return event.module === ctx.guardianModule.address;
          }
        );
        // Check if the module has been added
        assert(
          await walletContract.hasModule(ctx.guardianModule.address),
          "module not added"
        );

        // Make sure the module is now authorized
        await ctx.guardianModule.addModule(wallet, ctx.recoveryModule.address, {
          from: owner
        });
      }
    );

    it(
      description(
        "owner should be able to add/remove modules using an upgrader module",
        metaTx
      ),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const initialModule = ctx.whitelistModule;
        const modules = getAllModuleAddresses(ctx).filter(
          addr => addr !== initialModule.address
        );
        const { wallet } = await createWallet(ctx, owner, 0, [
          initialModule.address
        ]);

        await addAndRemoveModulesChecked(
          owner,
          wallet,
          [modules[0]],
          [],
          initialModule
        );
        await addAndRemoveModulesChecked(
          owner,
          wallet,
          [modules[1], modules[2]],
          [],
          initialModule
        );
        // Add a module that was already added, remove a module that has not yet been added
        await addAndRemoveModulesChecked(
          owner,
          wallet,
          [modules[2]],
          [modules[3]],
          initialModule
        );
        await addAndRemoveModulesChecked(
          owner,
          wallet,
          [modules[3]],
          [modules[0], modules[2]],
          initialModule
        );
        await addAndRemoveModulesChecked(
          owner,
          wallet,
          [],
          [modules[1], modules[3]],
          initialModule
        );
      }
    );
  });
});
