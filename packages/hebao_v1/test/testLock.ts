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
import { SignedRequest, signUnlock } from "./helpers/SignatureUtils";
import util = require("util");

contract("GuardianModule - Lock", (accounts: string[]) => {
  let defaultCtx: Context;
  let ctx: Context;
  let finalSecurityModule2: any;

  let useMetaTx: boolean = false;
  let wallet: any;
  let guardians: any;
  let guardianWallet1: any;
  let guardianWallet2: any;
  let fakeGuardianWallet: any;

  const isLocked = async (wallet: string) => {
    return ctx.finalSecurityModule.isLocked(wallet);
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
      ctx.finalSecurityModule.contract.methods.lock(wallet),
      ctx,
      useMetaTx,
      wallet,
      [],
      opt
    );

    await assertEventEmitted(
      ctx.finalSecurityModule,
      "WalletLocked",
      (event: any) => {
        return event.wallet == wallet;
      }
    );

    const blockTime = await getBlockTime(tx.blockNumber);

    assert(await isLocked(wallet), "wallet needs to be locked");
  };

  const unlockChecked = async (wallet: string, owner: string) => {
    const signers = [owner, ...guardians.slice(0, 2)].sort();

    const wasLocked = await isLocked(wallet);
    // Unlock the wallet
    const request: SignedRequest = {
      signers,
      signatures: [],
      validUntil: Math.floor(new Date().getTime()) + 3600 * 24 * 30,
      wallet
    };
    signUnlock(request, ctx.finalSecurityModule.address);

    await executeTransaction(
      ctx.finalSecurityModule.contract.methods.unlock(request),
      ctx,
      useMetaTx,
      wallet,
      [],
      { from: owner }
    );
    assert(!(await isLocked(wallet)), "wallet needs to be unlocked");
  };

  const description = (descr: string, metaTx: boolean = useMetaTx) => {
    return descr + (metaTx ? " (meta tx)" : "");
  };

  before(async () => {
    // Create another lock module for testing
    defaultCtx = await getContext();
    ctx = await createContext(defaultCtx);
    finalSecurityModule2 = await defaultCtx.contracts.FinalSecurityModule.new(
      defaultCtx.controllerImpl.address,
      defaultCtx.finalCoreModule.address
    );
    await defaultCtx.moduleRegistryImpl.registerModule(
      finalSecurityModule2.address
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
  });

  [false, true].forEach(function(metaTx) {
    useMetaTx = metaTx;
    it(
      description(
        "guardians or owner/wallet should be able to lock/unlock the wallet"
      ),
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
        }

        // // Lock the wallet
        await lockChecked(wallet, guardians[0], owner, guardianWallet1);

        // Try to lock the wallet again
        if (!useMetaTx) {
          await expectThrow(lockChecked(wallet, guardians[1]), "LOCKED");
        }
        // Unlock the wallet (using a different guardian)
        await unlockChecked(wallet, owner);
        // Try to unlock the wallet again (should not throw)
        await unlockChecked(wallet, owner);
      }
    );
  });
});
