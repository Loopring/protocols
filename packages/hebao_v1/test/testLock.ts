import {
  Context,
  createContext,
  getContext,
  executeTransaction,
  createWallet,
  getBlockTime
} from "./helpers/TestUtils";
import { assertEventEmitted } from "../util/Events";
import { expectThrow } from "../util/expectThrow";
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";
import util = require("util");

contract("GuardianModule - Lock", (accounts: string[]) => {
  let defaultCtx: Context;
  let ctx: Context;
  let guardianModule2: any;

  let defaultLockPeriod: number;

  let useMetaTx: boolean = false;

  const isLocked = async (wallet: string) => {
    return ctx.guardianModule.isLocked(wallet);
  };

  const lockChecked = async (
    wallet: string,
    guardian: string,
    from?: string,
    guardianWallet?: any
  ) => {
    from = from === undefined ? guardian : from;
    const opt = useMetaTx
      ? { owner: guardian, wallet: guardianWallet.wallet }
      : { from };

    console.log(`wallet: ${wallet}`);

    // Lock the wallet
    const tx = await executeTransaction(
      ctx.guardianModule.contract.methods.lock(wallet),
      ctx,
      useMetaTx,
      wallet,
      [],
      opt
    );
    if (!useMetaTx) {
      await assertEventEmitted(
        ctx.guardianModule,
        "WalletLock",
        (event: any) => {
          return event.wallet == wallet;
        }
      );
    }

    const getWalletLock = await ctx.guardianModule.getLock(wallet);
    const blockTime = await getBlockTime(tx.blockNumber);

    console.log(`getWalletLock: ${util.inspect(getWalletLock)}`);
    console.log(`blockTime: ${blockTime}`);

    // const locked = await isLocked(wallet)
    // console.log(`locked: ${locked}`);

    assert(await isLocked(wallet), "wallet needs to be locked");
    // Check the lock data
    const lockData = await ctx.guardianModule.getLock(wallet);
    assert.equal(
      lockData._lockedBy,
      ctx.guardianModule.address,
      "wallet locker unexpected"
    );
  };

  const unlockChecked = async (
    wallet: string,
    guardian: string,
    guardianModule: any = ctx.guardianModule,
    from?: string,
    guardianWallet?: any
  ) => {
    from = from === undefined ? guardian : from;
    const opt = useMetaTx
      ? { owner: guardian, wallet: guardianWallet.wallet }
      : { from };

    const wasLocked = await isLocked(wallet);
    // Unlock the wallet
    await executeTransaction(
      guardianModule.contract.methods.unlock(wallet),
      ctx,
      useMetaTx,
      wallet,
      [],
      opt
    );
    if (wasLocked) {
      await assertEventEmitted(guardianModule, "WalletLock", (event: any) => {
        return event.wallet == wallet && event.lock == 0;
      });
    }
    assert(!(await isLocked(wallet)), "wallet needs to be unlocked");
  };

  const description = (descr: string, metaTx: boolean = useMetaTx) => {
    return descr + (metaTx ? " (meta tx)" : "");
  };

  before(async () => {
    // Create another lock module for testing
    defaultCtx = await getContext();
    guardianModule2 = await defaultCtx.contracts.GuardianModule.new(
      defaultCtx.controllerImpl.address,
      defaultCtx.forwarderModule.address,
      3600 * 24
    );
    await defaultCtx.moduleRegistryImpl.registerModule(guardianModule2.address);
  });

  beforeEach(async () => {
    ctx = await createContext(defaultCtx);
    defaultLockPeriod = (
      await ctx.controllerImpl.defaultLockPeriod()
    ).toNumber();
  });

  // TODO: lock not work with MetaTx.
  [false /*, true*/].forEach(function(metaTx) {
    useMetaTx = metaTx;
    it(
      description("guardians should be able to lock/unlock the wallet"),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const { wallet, guardians } = await createWallet(ctx, owner, 2);
        const guardianWallet1 = await createWallet(ctx, guardians[0]);
        const guardianWallet2 = await createWallet(ctx, guardians[1]);

        if (!useMetaTx) {
          // Try to lock/unlock from an address that is not a guardian while pretending
          // to be a guardian
          await expectThrow(
            lockChecked(wallet, guardians[1], ctx.miscAddresses[0]),
            useMetaTx ? "METATX_UNAUTHORIZED" : "NOT_FROM_GUARDIAN"
          );
          await expectThrow(
            unlockChecked(
              wallet,
              guardians[1],
              ctx.guardianModule,
              ctx.miscAddresses[0]
            ),
            useMetaTx ? "METATX_UNAUTHORIZED" : "NOT_FROM_GUARDIAN"
          );

          // Try to lock/unlock from an address that is not a guardian
          await expectThrow(
            lockChecked(wallet, owner, owner),
            useMetaTx ? "METATX_UNAUTHORIZED" : "NOT_FROM_GUARDIAN"
          );
          await expectThrow(
            unlockChecked(wallet, owner, ctx.guardianModule, owner),
            useMetaTx ? "METATX_UNAUTHORIZED" : "NOT_FROM_GUARDIAN"
          );
        }

        // Lock the wallet
        await lockChecked(wallet, guardians[0], undefined, guardianWallet1);
        // Try to lock the wallet again
        if (!useMetaTx) {
          await expectThrow(lockChecked(wallet, guardians[1]), "LOCKED");
        }
        // Unlock the wallet (using a different guardian)
        await unlockChecked(wallet, guardians[1]);
        // Try to unlock the wallet again (should not throw)
        await unlockChecked(wallet, guardians[0]);
      }
    );

    it(
      description(
        "wallet lock should automatically expire after `defaultLockPeriod`"
      ),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const { wallet, guardians } = await createWallet(ctx, owner, 2);
        const guardianWallet1 = await createWallet(ctx, guardians[0]);
        const guardianWallet2 = await createWallet(ctx, guardians[1]);

        // Lock the wallet
        await lockChecked(wallet, guardians[0], undefined, guardianWallet1);
        // Skip forward `defaultLockPeriod` / 2 seconds
        await advanceTimeAndBlockAsync(defaultLockPeriod / 2);
        // Check if the wallet is still locked
        assert(await isLocked(wallet), "wallet still needs to be locked");
        // Skip forward the complete `defaultLockPeriod`
        await advanceTimeAndBlockAsync(defaultLockPeriod / 2);
        // Check if the wallet is now unlocked
        assert(!(await isLocked(wallet)), "wallet needs to be unlocked");
        // Lock the wallet again
        await lockChecked(wallet, guardians[0], undefined, guardianWallet1);
      }
    );

    it(
      description(
        "should not be able to unlock a lock set by a different module"
      ),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const { wallet, guardians } = await createWallet(ctx, owner, 2);
        const guardianWallet1 = await createWallet(ctx, guardians[0]);
        const guardianWallet2 = await createWallet(ctx, guardians[1]);

        // Lock the wallet
        await lockChecked(wallet, guardians[0], undefined, guardianWallet1);

        if (!useMetaTx) {
          // Try to unlock a lock set by a different module
          await expectThrow(
            unlockChecked(wallet, guardians[1], guardianModule2),
            "UNABLE_TO_UNLOCK"
          );
        }
      }
    );
  });
});
