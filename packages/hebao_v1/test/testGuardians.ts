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

contract("GuardiansModule", (accounts: string[]) => {
  let defaultCtx: Context;
  let ctx: Context;

  let MAX_GUARDIANS: number;
  let pendingPeriod: number;
  let confirmPeriod: number;

  let useMetaTx: boolean = false;

  const description = (descr: string, metaTx: boolean = useMetaTx) => {
    return descr + (metaTx ? " (meta tx)" : "");
  };

  const addGuardianChecked = async (
    owner: string,
    wallet: string,
    guardian: string,
    group: number
  ) => {
    await addGuardian(ctx, owner, wallet, guardian, group, useMetaTx);
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

    MAX_GUARDIANS = (
      await defaultCtx.guardianModule.MAX_GUARDIANS()
    ).toNumber();
    pendingPeriod = (
      await defaultCtx.guardianModule.pendingPeriod()
    ).toNumber();
    confirmPeriod = (
      await defaultCtx.guardianModule.confirmPeriod()
    ).toNumber();
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

        await addGuardianChecked(owner, wallet, ctx.guardians[0], 0);
        await addGuardianChecked(owner, wallet, ctx.guardians[1], 0);
        await addGuardianChecked(owner, wallet, ctx.guardians[2], 1);
        await removeGuardianChecked(owner, wallet, ctx.guardians[1]);
        await removeGuardianChecked(owner, wallet, ctx.guardians[2]);
        await removeGuardianChecked(owner, wallet, ctx.guardians[0]);
      }
    );

    it(
      description("owner should be able to update the group of a guardian"),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const { wallet } = await createWallet(ctx, owner);

        await addGuardianChecked(owner, wallet, ctx.guardians[0], 0);
        await addGuardianChecked(owner, wallet, ctx.guardians[1], 0);
        await addGuardianChecked(owner, wallet, ctx.guardians[1], 1);
        await addGuardianChecked(owner, wallet, ctx.guardians[0], 6);
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
          await addGuardianChecked(owner, wallet, accounts[20 + i], 0);
        }

        // Try to add another one
        await expectThrow(
          addGuardianChecked(owner, wallet, accounts[20 + i], 0),
          "TOO_MANY_GUARDIANS"
        );
      }
    );

    it(
      description("owner should be able to cancel guardians additions"),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const { wallet } = await createWallet(ctx, owner);
        const group = 0;

        // The first guardian is added immediately (so cannot be cancelled)
        await addGuardianChecked(owner, wallet, ctx.guardians[0], group);

        // Try to cancel the first guardian
        await expectThrow(
          executeTransaction(
            ctx.guardianModule.contract.methods.cancelGuardianAddition(
              wallet,
              ctx.guardians[0],
              group
            ),
            ctx,
            useMetaTx,
            wallet,
            [owner],
            { from: owner }
          ),
          "INVALID_GUARDIAN"
        );

        // Add the second guardian which is added after a delay
        await executeTransaction(
          ctx.guardianModule.contract.methods.addGuardian(
            wallet,
            ctx.guardians[1],
            group
          ),
          ctx,
          useMetaTx,
          wallet,
          [owner],
          { from: owner }
        );

        // Now cancel
        await executeTransaction(
          ctx.guardianModule.contract.methods.cancelGuardianAddition(
            wallet,
            ctx.guardians[1],
            group
          ),
          ctx,
          useMetaTx,
          wallet,
          [owner],
          { from: owner }
        );
        await assertEventEmitted(
          ctx.guardianModule,
          "GuardianAdditionCancelled",
          (event: any) => {
            return event.wallet == wallet && event.guardian == ctx.guardians[1];
          }
        );

        // Try to cancel again
        await expectThrow(
          executeTransaction(
            ctx.guardianModule.contract.methods.cancelGuardianAddition(
              wallet,
              ctx.guardians[1],
              group
            ),
            ctx,
            useMetaTx,
            wallet,
            [owner],
            { from: owner }
          ),
          "INVALID_GUARDIAN"
        );

        // Skip forward `pendingPeriod` seconds
        await advanceTimeAndBlockAsync(pendingPeriod);

        // Try to confirm
        await expectThrow(
          executeTransaction(
            ctx.guardianModule.contract.methods.confirmGuardianAddition(
              wallet,
              ctx.guardians[1],
              group
            ),
            ctx,
            useMetaTx,
            wallet,
            [owner],
            { from: owner }
          ),
          "NOT_PENDING"
        );

        // Make sure the cancelled guardian isn't a guardian
        assert(
          !(await ctx.securityStore.isGuardian(wallet, ctx.guardians[1])),
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
        const group = 0;

        // The first guardian is added immediately (so cannot be cancelled)
        await addGuardianChecked(owner, wallet, ctx.guardians[0], group);
        await addGuardianChecked(owner, wallet, ctx.guardians[1], group);

        // Remove the first guardian
        await executeTransaction(
          ctx.guardianModule.contract.methods.removeGuardian(
            wallet,
            ctx.guardians[0]
          ),
          ctx,
          useMetaTx,
          wallet,
          [owner],
          { from: owner }
        );

        // Now cancel
        await executeTransaction(
          ctx.guardianModule.contract.methods.cancelGuardianRemoval(
            wallet,
            ctx.guardians[0]
          ),
          ctx,
          useMetaTx,
          wallet,
          [owner],
          { from: owner }
        );
        await assertEventEmitted(
          ctx.guardianModule,
          "GuardianRemovalCancelled",
          (event: any) => {
            return event.wallet == wallet && event.guardian == ctx.guardians[0];
          }
        );

        // Try to cancel again
        await expectThrow(
          executeTransaction(
            ctx.guardianModule.contract.methods.cancelGuardianRemoval(
              wallet,
              ctx.guardians[0]
            ),
            ctx,
            useMetaTx,
            wallet,
            [owner],
            { from: owner }
          ),
          "INVALID_GUARDIAN"
        );

        // Skip forward `pendingPeriod` seconds
        await advanceTimeAndBlockAsync(pendingPeriod);

        // Try to confirm
        await expectThrow(
          executeTransaction(
            ctx.guardianModule.contract.methods.confirmGuardianRemoval(
              wallet,
              ctx.guardians[1]
            ),
            ctx,
            useMetaTx,
            wallet,
            [owner],
            { from: owner }
          ),
          "NOT_PENDING"
        );

        // Make sure the cancelled guardian is still a guardian
        assert(
          await ctx.securityStore.isGuardian(wallet, ctx.guardians[0]),
          "should be guardian"
        );
      }
    );

    it(
      description(
        "owner should not be able to confirm guardian addition after expired"
      ),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const { wallet } = await createWallet(ctx, owner);
        const group = 0;

        // The first guardian is added immediately (so cannot be cancelled)
        await addGuardianChecked(owner, wallet, ctx.guardians[0], group);

        // Add the second guardian which is added after a delay
        await executeTransaction(
          ctx.guardianModule.contract.methods.addGuardian(
            wallet,
            ctx.guardians[1],
            group
          ),
          ctx,
          useMetaTx,
          wallet,
          [owner],
          { from: owner }
        );

        // Skip forward `pendingPeriod` + `confirmPeriod` seconds
        await advanceTimeAndBlockAsync(pendingPeriod + confirmPeriod);

        // Try to confirm
        await expectThrow(
          executeTransaction(
            ctx.guardianModule.contract.methods.confirmGuardianAddition(
              wallet,
              ctx.guardians[1],
              group
            ),
            ctx,
            useMetaTx,
            wallet,
            [owner],
            { from: owner }
          ),
          "TOO_EARLY_OR_EXPIRED"
        );

        // Now cancel
        await executeTransaction(
          ctx.guardianModule.contract.methods.cancelGuardianAddition(
            wallet,
            ctx.guardians[1],
            group
          ),
          ctx,
          useMetaTx,
          wallet,
          [owner],
          { from: owner }
        );

        // Make sure the expired guardian is not a guardian
        assert(
          !(await ctx.securityStore.isGuardian(wallet, ctx.guardians[1])),
          "should not be guardian"
        );
      }
    );

    it(
      description(
        "owner should not be able to confirm guardian removal after expired"
      ),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const { wallet } = await createWallet(ctx, owner);
        const group = 0;

        // The first guardian is added immediately (so cannot be cancelled)
        await addGuardianChecked(owner, wallet, ctx.guardians[0], group);

        // Now remove the guardian
        await executeTransaction(
          ctx.guardianModule.contract.methods.removeGuardian(
            wallet,
            ctx.guardians[0]
          ),
          ctx,
          useMetaTx,
          wallet,
          [owner],
          { from: owner }
        );

        // Skip forward `pendingPeriod` + `confirmPeriod` seconds
        await advanceTimeAndBlockAsync(pendingPeriod + confirmPeriod);

        // Try to confirm
        await expectThrow(
          executeTransaction(
            ctx.guardianModule.contract.methods.confirmGuardianRemoval(
              wallet,
              ctx.guardians[0]
            ),
            ctx,
            useMetaTx,
            wallet,
            [owner],
            { from: owner }
          ),
          "TOO_EARLY_OR_EXPIRED"
        );

        // Now cancel
        await executeTransaction(
          ctx.guardianModule.contract.methods.cancelGuardianRemoval(
            wallet,
            ctx.guardians[0]
          ),
          ctx,
          useMetaTx,
          wallet,
          [owner],
          { from: owner }
        );

        // Make sure the expired guardian is not a guardian
        assert(
          await ctx.securityStore.isGuardian(wallet, ctx.guardians[0]),
          "should be guardian"
        );
      }
    );

    it(
      description(
        "owner should not be able to confirm guardian removal after expired"
      ),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const { wallet } = await createWallet(ctx, owner);
        const group = 0;

        // The first guardian is added immediately (so cannot be cancelled)
        await addGuardianChecked(owner, wallet, ctx.guardians[0], group);

        // Now remove the guardian
        await executeTransaction(
          ctx.guardianModule.contract.methods.removeGuardian(
            wallet,
            ctx.guardians[0]
          ),
          ctx,
          useMetaTx,
          wallet,
          [owner],
          { from: owner }
        );

        // Skip forward `pendingPeriod` + `confirmPeriod` seconds
        await advanceTimeAndBlockAsync(pendingPeriod + confirmPeriod);

        // Try to confirm
        await expectThrow(
          executeTransaction(
            ctx.guardianModule.contract.methods.confirmGuardianRemoval(
              wallet,
              ctx.guardians[0]
            ),
            ctx,
            useMetaTx,
            wallet,
            [owner],
            { from: owner }
          ),
          "TOO_EARLY_OR_EXPIRED"
        );

        // Now cancel
        await executeTransaction(
          ctx.guardianModule.contract.methods.cancelGuardianRemoval(
            wallet,
            ctx.guardians[0]
          ),
          ctx,
          useMetaTx,
          wallet,
          [owner],
          { from: owner }
        );

        // Make sure the guardian is not removed
        assert(
          await ctx.securityStore.isGuardian(wallet, ctx.guardians[0]),
          "should be guardian"
        );
      }
    );
  });

  it(
    description("anyone should be able to confirm guardian addition"),
    async () => {
      useMetaTx = false;
      const owner = ctx.owners[0];
      const { wallet } = await createWallet(ctx, owner);
      const group = 0;

      // The first guardian is added immediately (so cannot be cancelled)
      await addGuardianChecked(owner, wallet, ctx.guardians[0], group);

      // Add the second guardian which is added after a delay
      await executeTransaction(
        ctx.guardianModule.contract.methods.addGuardian(
          wallet,
          ctx.guardians[1],
          group
        ),
        ctx,
        useMetaTx,
        wallet,
        [owner],
        { from: owner }
      );

      // Skip forward `pendingPeriod` + 1 seconds
      await advanceTimeAndBlockAsync(pendingPeriod + 1);

      const user = accounts[10];

      // Try to confirm
      await executeTransaction(
        ctx.guardianModule.contract.methods.confirmGuardianAddition(
          wallet,
          ctx.guardians[1],
          group
        ),
        ctx,
        useMetaTx,
        wallet,
        [user],
        { from: user }
      );

      assert(
        await ctx.securityStore.isGuardian(wallet, ctx.guardians[1]),
        "should be guardian"
      );
    }
  );

  it(
    description(
      "anyone should be able to confirm guardian removal before expired"
    ),
    async () => {
      useMetaTx = false;
      const owner = ctx.owners[0];
      const { wallet } = await createWallet(ctx, owner);
      const group = 0;

      // The first guardian is added immediately (so cannot be cancelled)
      await addGuardianChecked(owner, wallet, ctx.guardians[0], group);

      // Now remove the guardian
      await executeTransaction(
        ctx.guardianModule.contract.methods.removeGuardian(
          wallet,
          ctx.guardians[0]
        ),
        ctx,
        useMetaTx,
        wallet,
        [owner],
        { from: owner }
      );

      // Skip forward `pendingPeriod` + 1 seconds
      await advanceTimeAndBlockAsync(pendingPeriod + 1);
      const user = accounts[10];

      // Try to confirm
      await executeTransaction(
        ctx.guardianModule.contract.methods.confirmGuardianRemoval(
          wallet,
          ctx.guardians[0]
        ),
        ctx,
        useMetaTx,
        wallet,
        [user],
        { from: user }
      );

      // Make sure the guardian is removed
      assert(
        !(await ctx.securityStore.isGuardian(wallet, ctx.guardians[0])),
        "should not be guardian"
      );
    }
  );
});
