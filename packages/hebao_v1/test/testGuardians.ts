import {
  Context,
  getContext,
  createContext,
  executeTransaction,
  createWallet
} from "./helpers/TestUtils";
import { addGuardian, removeGuardian } from "./helpers/GuardianUtils";
import { expectThrow } from "../util/expectThrow";
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";
import { assertEventEmitted } from "../util/Events";
import BN = require("bn.js");

contract("GuardiansModule-Guardian", (accounts: string[]) => {
  let defaultCtx: Context;
  let ctx: Context;

  let MAX_GUARDIANS: number;
  let guardianPendingPeriod: number;

  let useMetaTx: boolean = false;

  const description = (descr: string, metaTx: boolean = useMetaTx) => {
    return descr + (metaTx ? " (meta tx)" : "");
  };

  const addGuardianChecked = async (
    owner: string,
    wallet: string,
    guardian: string
  ) => {
    await addGuardian(ctx, owner, wallet, guardian, useMetaTx);
  };

  const removeGuardianChecked = async (
    owner: string,
    wallet: string,
    guardian: string
  ) => {
    await removeGuardian(ctx, owner, wallet, guardian, useMetaTx);
  };

  before(async () => {
    defaultCtx = await getContext();

    MAX_GUARDIANS = (await defaultCtx.finalSecurityModule.MAX_GUARDIANS()).toNumber();
    guardianPendingPeriod = (await defaultCtx.finalSecurityModule.GUARDIAN_PENDING_PERIOD()).toNumber();
  });

  beforeEach(async () => {
    ctx = await createContext(defaultCtx);
  });

  [false, true].forEach(function(metaTx) {
    it(
      description("owner should be able to add and remove guardians"),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const { wallet } = await createWallet(ctx, owner);

        await addGuardianChecked(owner, wallet, ctx.guardians[0]);
        await addGuardianChecked(owner, wallet, ctx.guardians[1]);
        await addGuardianChecked(owner, wallet, ctx.guardians[2]);
        await removeGuardianChecked(owner, wallet, ctx.guardians[1]);
        await removeGuardianChecked(owner, wallet, ctx.guardians[2]);
        await removeGuardianChecked(owner, wallet, ctx.guardians[0]);
      }
    );

    it(
      description("owner should be able to add up to MAX_GUARDIANS guardians"),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const { wallet } = await createWallet(ctx, owner);

        // First add `MAX_GUARDIANS` guardians
        let i = 0;
        for (; i < MAX_GUARDIANS; i++) {
          await addGuardianChecked(owner, wallet, accounts[20 + i]);
        }

        // Try to add another one
        if (!useMetaTx) {
          await expectThrow(
            addGuardianChecked(owner, wallet, accounts[20 + i]),
            "TOO_MANY_GUARDIANS"
          );
        }
      }
    );

    it(
      description("owner should be able to cancel guardians additions"),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const { wallet } = await createWallet(ctx, owner);

        // The first guardian is added WA (so cannot be cancelled)
        await addGuardianChecked(owner, wallet, ctx.guardians[0]);

        const opt = useMetaTx
          ? { owner, wallet, gasPrice: new BN(0) }
          : { from: owner };

        // Add the second guardian which is added after a delay
        await executeTransaction(
          ctx.finalSecurityModule.contract.methods.addGuardian(
            wallet,
            ctx.guardians[2]
          ),
          ctx,
          useMetaTx,
          wallet,
          [owner],
          opt
        );

        // Now cancel
        await executeTransaction(
          ctx.finalSecurityModule.contract.methods.removeGuardian(
            wallet,
            ctx.guardians[2]
          ),
          ctx,
          useMetaTx,
          wallet,
          [owner],
          opt
        );

        await assertEventEmitted(
          ctx.finalSecurityModule,
          "GuardianRemoved",
          (event: any) => {
            return event.wallet == wallet && event.guardian == ctx.guardians[2];
          }
        );

        // Skip forward `guardianPendingPeriod` seconds
        await advanceTimeAndBlockAsync(guardianPendingPeriod);

        // Make sure the cancelled guardian isn't a guardian
        assert(
          !(await ctx.securityStore.isGuardian(
            wallet,
            ctx.guardians[2],
            false
          )),
          "should not be guardian"
        );
      }
    );

    it(
      description("owner should be able to cancel guardians removals"),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const { wallet } = await createWallet(ctx, owner);

        // The first guardian is added WA (so cannot be cancelled)
        await addGuardianChecked(owner, wallet, ctx.guardians[0]);

        const opt = useMetaTx
          ? { owner, wallet, gasPrice: new BN(0) }
          : { from: owner };

        // Remove the first guardian
        await executeTransaction(
          ctx.finalSecurityModule.contract.methods.removeGuardian(
            wallet,
            ctx.guardians[0]
          ),
          ctx,
          useMetaTx,
          wallet,
          [owner],
          opt
        );

        // Now cancel
        await executeTransaction(
          ctx.finalSecurityModule.contract.methods.addGuardian(
            wallet,
            ctx.guardians[0]
          ),
          ctx,
          useMetaTx,
          wallet,
          [owner],
          opt
        );
        await assertEventEmitted(
          ctx.finalSecurityModule,
          "GuardianAdded",
          (event: any) => {
            return event.wallet == wallet && event.guardian == ctx.guardians[0];
          }
        );

        // Skip forward `guardianPendingPeriod` seconds
        await advanceTimeAndBlockAsync(guardianPendingPeriod);

        // Make sure the cancelled guardian is still a guardian
        assert(
          await ctx.securityStore.isGuardian(wallet, ctx.guardians[0], false),
          "should be guardian"
        );
      }
    );
  });
});
