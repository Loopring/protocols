import {
  Context,
  createContext,
  getContext,
  executeTransaction,
  createWallet,
  createWallet2,
  getBlockTime
} from "./helpers/TestUtils";
import { assertEventEmitted } from "../util/Events";
import { expectThrow } from "../util/expectThrow";
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";
import util = require("util");

contract("GuardianModule - Lock", (accounts: string[]) => {
  let defaultCtx: Context;
  let ctx: Context;
  let packedSecurityModule2: any;

  let defaultLockPeriod: number;

  let useMetaTx: boolean = false;
  let wallet: any;
  let guardians: any;
  let guardianWallet1: any;
  let guardianWallet2: any;
  let fakeGuardianWallet: any;

  const isLocked = async (wallet: string) => {
    return ctx.packedSecurityModule.isLocked(wallet);
  };

  const lockChecked = async (
    wallet: string,
    guardian: string,
    from?: string,
    guardianWallet?: any
  ) => {
    from = from === undefined ? guardian : from;
    const opt = useMetaTx
      ? { owner: guardian, wallet: guardianWallet, from }
      : { from };

    const blockNumberBefore = await web3.eth.getBlockNumber();
    // Lock the wallet
    const tx = await executeTransaction(
      ctx.packedSecurityModule.contract.methods.lock(wallet),
      ctx,
      useMetaTx,
      wallet,
      [],
      opt
    );

    await assertEventEmitted(
      ctx.packedSecurityModule,
      "WalletLock",
      (event: any) => {
        return event.wallet == wallet;
      }
    );

    const getWalletLock = await ctx.packedSecurityModule.getLock(wallet);
    const blockTime = await getBlockTime(tx.blockNumber);

    assert(await isLocked(wallet), "wallet needs to be locked");
    // Check the lock data
    const lockData = await ctx.packedSecurityModule.getLock(wallet);
    assert.equal(
      lockData._lockedBy,
      ctx.packedSecurityModule.address,
      "wallet locker unexpected"
    );
  };

  const unlockChecked = async (
    wallet: string,
    guardian: string,
    from?: string,
    guardianWallet?: any,
    packedSecurityModule: any = ctx.packedSecurityModule
  ) => {
    const opt = useMetaTx
      ? { owner: guardian, wallet: guardianWallet, from }
      : { from };

    const wasLocked = await isLocked(wallet);
    // Unlock the wallet
    await executeTransaction(
      packedSecurityModule.contract.methods.unlock(wallet),
      ctx,
      useMetaTx,
      wallet,
      [],
      opt
    );
    if (wasLocked && useMetaTx) {
      await assertEventEmitted(
        packedSecurityModule,
        "WalletLock",
        (event: any) => {
          return event.wallet == wallet && event.lock == 0;
        }
      );
    }
    assert(!(await isLocked(wallet)), "wallet needs to be unlocked");
  };

  const description = (descr: string, metaTx: boolean = useMetaTx) => {
    return descr + (metaTx ? " (meta tx)" : "");
  };

  before(async () => {
    // Create another lock module for testing
    defaultCtx = await getContext();
    ctx = await createContext(defaultCtx);
    packedSecurityModule2 = await defaultCtx.contracts.PackedSecurityModule.new(
      defaultCtx.controllerImpl.address,
      defaultCtx.packedCoreModule.address,
      3600 * 24,
      3600 * 24 * 365,
      3600 * 24
    );
    await defaultCtx.moduleRegistryImpl.registerModule(
      packedSecurityModule2.address
    );

    fakeGuardianWallet = (await createWallet(ctx, ctx.miscAddresses[0])).wallet;
  });

  beforeEach(async () => {
    const owner = ctx.owners[0];
    ctx = await createContext(defaultCtx);

    if (useMetaTx) {
      guardians = ctx.guardians.slice(0, 2);
      guardianWallet1 = (await createWallet(ctx, guardians[0])).wallet;
      guardianWallet2 = (await createWallet(ctx, guardians[1])).wallet;
      const _wallet = await createWallet2(ctx, owner, [
        guardianWallet1,
        guardianWallet2
      ]);
      // console.log('_wallet:', _wallet);
      wallet = _wallet.wallet;
    } else {
      const _wallet = await createWallet(ctx, owner, 2);
      wallet = _wallet.wallet;
      guardians = _wallet.guardians;
    }

    defaultLockPeriod = (
      await ctx.controllerImpl.defaultLockPeriod()
    ).toNumber();
  });

  [false, true].forEach(function(metaTx) {
    useMetaTx = metaTx;
    it(
      description("guardians should be able to lock/unlock the wallet"),
      async () => {
        const owner = ctx.owners[0];

        if (!useMetaTx) {
          // Try to lock/unlock from an address that is not a guardian while pretending
          // to be a guardian
          await expectThrow(
            lockChecked(
              wallet,
              ctx.miscAddresses[0],
              ctx.miscAddresses[0],
              fakeGuardianWallet
            ),
            useMetaTx ? "NOT_FROM_GUARDIAN" : "NOT_FROM_GUARDIAN"
          );
          await expectThrow(
            unlockChecked(wallet, guardians[1]),
            useMetaTx ? "METATX_UNAUTHORIZED" : "NOT_FROM_GUARDIAN"
          );

          // Try to lock/unlock from an address that is not a guardian
          await expectThrow(
            lockChecked(wallet, owner, owner),
            useMetaTx ? "METATX_UNAUTHORIZED" : "NOT_FROM_GUARDIAN"
          );
          await expectThrow(
            unlockChecked(wallet, owner),
            useMetaTx ? "METATX_UNAUTHORIZED" : "NOT_FROM_GUARDIAN"
          );
        }

        // // Lock the wallet
        await lockChecked(wallet, guardians[0], undefined, guardianWallet1);

        // Try to lock the wallet again
        if (!useMetaTx) {
          await expectThrow(lockChecked(wallet, guardians[1]), "LOCKED");
        }
        // Unlock the wallet (using a different guardian)
        await unlockChecked(wallet, guardians[1], undefined, guardianWallet2);
        // Try to unlock the wallet again (should not throw)
        await unlockChecked(wallet, guardians[0], undefined, guardianWallet1);
      }
    );

    it(
      description(
        "wallet lock should automatically expire after `defaultLockPeriod`"
      ),
      async () => {
        const owner = ctx.owners[0];
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
        // Lock the wallet
        await lockChecked(wallet, guardians[0], undefined, guardianWallet1);

        if (!useMetaTx) {
          // Try to unlock a lock set by a different module
          await expectThrow(
            unlockChecked(
              wallet,
              guardians[1],
              undefined,
              undefined,
              packedSecurityModule2
            ),
            "UNABLE_TO_UNLOCK"
          );
        }
      }
    );
  });
});
