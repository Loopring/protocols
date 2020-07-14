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
    modulesToRemove: string[]
  ) => {
    const walletContract = await ctx.contracts.WalletImpl.at(wallet);

    if (useMetaTx) {
      // Transfer 0.1 ETH to the wallet to pay for the wallet creation
      await transferFrom(ctx, owner, wallet, "ETH", toAmount("0.1"));
    }

    // Create an upgrader module
    const upgraderModule = await ctx.contracts.UpgraderModule.new(
      ctx.controllerImpl.address,
      Constants.zeroAddress,
      modulesToAdd,
      modulesToRemove
    );
    await ctx.moduleRegistryImpl.registerModule(upgraderModule.address);

    // Do the upgrade
    await executeTransaction(
      walletContract.contract.methods.addModule(upgraderModule.address),
      ctx,
      useMetaTx,
      wallet,
      [],
      useMetaTx ? { wallet, owner } : { from: owner, gasPrice: new BN(1) }
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

  [/*false,*/ true].forEach(function(metaTx) {
    it(
      description(
        "owner should be able to upgrade the wallet implementation",
        metaTx
      ),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const { wallet } = await createWallet(ctx, owner, 0, [
          ctx.guardianModule.address,
          ctx.erc1271Module.address,
          ctx.forwarderModule.address
        ]);
        const walletContract = await ctx.contracts.OwnedUpgradabilityProxy.at(
          wallet
        );
        const walletImpl = await ctx.contracts.WalletImpl.at(wallet);

        // Create a new wallet implementation contract
        const newBaseWallet = await ctx.contracts.WalletImpl.new();

        // Create an upgrader module
        const upgraderModule = await ctx.contracts.UpgraderModule.new(
          ctx.controllerImpl.address,
          newBaseWallet.address,
          [],
          []
        );
        await ctx.moduleRegistryImpl.registerModule(upgraderModule.address);

        // Check current wallet implementation
        assert.equal(
          await walletContract.implementation(),
          ctx.walletImpl.address,
          "wallet implementation incorrect"
        );

        // Do the upgrade
        await executeTransaction(
          walletImpl.contract.methods.addModule(upgraderModule.address),
          ctx,
          useMetaTx,
          wallet,
          [],
          useMetaTx ? { wallet, owner } : { from: owner }
        );

        // Check the new wallet implementation
        assert.equal(
          await walletContract.implementation(),
          newBaseWallet.address,
          "wallet implementation incorrect"
        );

        assert(
          await walletImpl.hasModule(ctx.forwarderModule.address),
          "wallet should still has forwarder module"
        );

        assert(
          await walletImpl.hasModule(ctx.erc1271Module.address),
          "wallet should still has erc1271 module"
        );

        assert(
          await walletImpl.hasModule(ctx.guardianModule.address),
          "wallet should still has guardian module"
        );

        // Make sure the wallet is still fully functional
        await executeTransaction(
          walletImpl.contract.methods.addModule(ctx.whitelistModule.address),
          ctx,
          useMetaTx,
          wallet,
          [],
          useMetaTx ? { wallet, owner } : { from: owner }
        );
      }
    );

    // it(
    //   description(
    //     "owner should be able to add modules directly on the wallet",
    //     metaTx
    //   ),
    //   async () => {
    //     useMetaTx = metaTx;
    //     const owner = ctx.owners[0];
    //     const { wallet } = await createWallet(ctx, owner, 0, [
    //       ctx.erc1271Module.address,
    //       ctx.forwarderModule.address
    //     ]);
    //     const walletContract = await ctx.contracts.WalletImpl.at(wallet);

    //     // Add the module
    //     await walletContract.addModule(ctx.guardianModule.address, {
    //       from: owner
    //     });
    //     // Check for the `ModuleAdded` event on the wallet
    //     await assertEventEmitted(
    //       walletContract,
    //       "ModuleAdded",
    //       (event: any) => {
    //         return event.module === ctx.guardianModule.address;
    //       }
    //     );
    //     // Check if the module has been added
    //     assert(
    //       await walletContract.hasModule(ctx.guardianModule.address),
    //       "module not added"
    //     );

    //     // Try to add the same module again
    //     await expectThrow(
    //       walletContract.addModule(ctx.guardianModule.address, { from: owner }),
    //       "MODULE_EXISTS"
    //     );

    //     // Make sure the module is now authorized
    //     await ctx.guardianModule.addGuardian(wallet, ctx.miscAddresses[0], 0, {
    //       from: owner
    //     });
    //   }
    // );

    it(
      description(
        "owner should be able to add/remove modules using an upgrader module",
        metaTx
      ),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const { wallet } = await createWallet(ctx, owner, 0, [
          ctx.erc1271Module.address,
          ctx.forwarderModule.address
        ]);

        const modules = getAllModuleAddresses(ctx).filter(
          addr =>
            addr !== ctx.erc1271Module.address &&
            addr !== ctx.forwarderModule.address
        );

        await addAndRemoveModulesChecked(owner, wallet, [modules[0]], []);
        await addAndRemoveModulesChecked(
          owner,
          wallet,
          [modules[1], modules[2]],
          []
        );
        // Add a module that was already added, remove a module that has not yet been added
        await addAndRemoveModulesChecked(
          owner,
          wallet,
          [modules[2]],
          [modules[3]]
        );
        await addAndRemoveModulesChecked(
          owner,
          wallet,
          [modules[3]],
          [modules[0], modules[2]]
        );
        await addAndRemoveModulesChecked(
          owner,
          wallet,
          [],
          [modules[1], modules[3]]
        );
      }
    );
  });
});
