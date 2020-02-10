import {
  Context,
  createContext,
  getContext,
  executeTransaction,
  createWallet
} from "./helpers/TestUtils";
import { assertEventEmitted } from "../util/Events";
import { expectThrow } from "../util/expectThrow";
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";

contract("LockModule", (accounts: string[]) => {
  let defaultCtx: Context;
  let ctx: Context;
  let lockModule2: any;

  let defaultLockPeriod: number;

  let useMetaTx: boolean = false;

  const isLocked = async (wallet: string) => {
    return ctx.lockModule.isLocked(wallet);
  };

  const lockChecked = async (wallet: string, guardian: string) => {
    // Lock the wallet
    await executeTransaction(
      ctx.lockModule.contract.methods.lock(wallet, guardian),
      ctx,
      useMetaTx,
      wallet,
      [guardian],
      { from: guardian }
    );
    await assertEventEmitted(ctx.lockModule, "WalletLock", (event: any) => {
      return event.wallet == wallet;
    });
    assert(await isLocked(wallet), "wallet needs to be locked");
    // Check the lock data
    const lockData = await ctx.lockModule.getLock(wallet);
    assert.equal(
      lockData._lockedBy,
      ctx.lockModule.address,
      "wallet locker unexpected"
    );
  };

  const unlockChecked = async (
    wallet: string,
    guardian: string,
    lockModule: any = ctx.lockModule
  ) => {
    const wasLocked = await isLocked(wallet);
    // Unlock the wallet
    await executeTransaction(
      lockModule.contract.methods.unlock(wallet, guardian),
      ctx,
      useMetaTx,
      wallet,
      [guardian],
      { from: guardian }
    );
    if (wasLocked) {
      await assertEventEmitted(lockModule, "WalletLock", (event: any) => {
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
    lockModule2 = await defaultCtx.contracts.LockModule.new(
      defaultCtx.controllerImpl.address
    );
    await defaultCtx.moduleRegistryImpl.registerModule(lockModule2.address);
    await defaultCtx.securityStore.addManager(lockModule2.address);
  });

  beforeEach(async () => {
    ctx = await createContext(defaultCtx);
    defaultLockPeriod = (
      await ctx.controllerImpl.defaultLockPeriod()
    ).toNumber();
  });

  [false, true].forEach(function(metaTx) {
    it(
      description("guardians should be able to lock/unlock the wallet"),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const { wallet, guardians } = await createWallet(ctx, owner, 2);

        // Lock the wallet
        await lockChecked(wallet, guardians[0]);
        // Try to lock the wallet again
        await expectThrow(lockChecked(wallet, guardians[1]), "LOCKED");
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

        // Lock the wallet
        await lockChecked(wallet, guardians[0]);
        // Skip forward `defaultLockPeriod` / 2 seconds
        await advanceTimeAndBlockAsync(defaultLockPeriod / 2);
        // Check if the wallet is still locked
        assert(await isLocked(wallet), "wallet still needs to be locked");
        // Skip forward the complete `defaultLockPeriod`
        await advanceTimeAndBlockAsync(defaultLockPeriod / 2);
        // Check if the wallet is now unlocked
        assert(!(await isLocked(wallet)), "wallet needs to be unlocked");
        // Lock the wallet again
        await lockChecked(wallet, guardians[0]);
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

        // Lock the wallet
        await lockChecked(wallet, guardians[0]);
        // Try to unlock a lock set by a different module
        await expectThrow(
          unlockChecked(wallet, guardians[1], lockModule2),
          "UNABLE_TO_UNLOCK"
        );
      }
    );
  });
});
