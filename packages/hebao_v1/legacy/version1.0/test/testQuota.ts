import {
  Context,
  getContext,
  createContext,
  createWallet,
  executeTransaction,
  getBlockTime,
  toAmount
} from "./helpers/TestUtils";
import { expectThrow } from "../util/expectThrow";
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";
import { assertEventEmitted } from "../util/Events";
import BN = require("bn.js");

contract("QuotaTransfers - changeQuota", (accounts: string[]) => {
  let defaultCtx: Context;
  let ctx: Context;

  let delayPeriod: number;
  let defaultQuota: BN;

  let useMetaTx: boolean = false;

  const description = (descr: string, metaTx: boolean = useMetaTx) => {
    return descr + (metaTx ? " (meta tx)" : "");
  };

  const changeDailyQuotaChecked = async (
    owner: string,
    wallet: string,
    newQuota: BN
  ) => {
    const oldQuota = await ctx.quotaStore.currentQuota(wallet);

    // Start changing the daily quota
    const tx = await executeTransaction(
      ctx.quotaTransfers.contract.methods.changeDailyQuota(
        wallet,
        newQuota.toString(10)
      ),
      ctx,
      useMetaTx,
      wallet,
      [owner],
      { from: owner }
    );
    const blockTime = await getBlockTime(tx.blockNumber);

    // The quota needs to be changed after `delayPeriod`
    await assertEventEmitted(ctx.quotaStore, "QuotaScheduled", (event: any) => {
      return (
        event.wallet == wallet &&
        event.pendingQuota.eq(newQuota) &&
        event.pendingUntil == blockTime + delayPeriod
      );
    });

    // Quota still needs to be the old value
    assert(
      (await ctx.quotaStore.currentQuota(wallet)).eq(oldQuota),
      "quota incorrect"
    );
    // Pending quota data needs to be correct
    {
      const pendingQuotaData = await ctx.quotaStore.pendingQuota(wallet);
      assert(
        pendingQuotaData._pendingQuota.eq(newQuota),
        "pending quota incorrect"
      );
      assert.equal(
        pendingQuotaData._pendingUntil.toNumber(),
        blockTime + delayPeriod,
        "pending time incorrect"
      );
    }

    // Skip forward `delayPeriod` seconds
    await advanceTimeAndBlockAsync(delayPeriod);

    // Quota needs to be the new value
    assert(
      (await ctx.quotaStore.currentQuota(wallet)).eq(newQuota),
      "quota incorrect"
    );
    // Pending quota data needs to be correct
    {
      const pendingQuotaData = await ctx.quotaStore.pendingQuota(wallet);
      assert.equal(pendingQuotaData._pendingUntil, 0, "pending time incorrect");
    }
  };

  before(async () => {
    defaultCtx = await getContext();
  });

  beforeEach(async () => {
    ctx = await createContext(defaultCtx);
    delayPeriod = (await ctx.quotaTransfers.delayPeriod()).toNumber();
    defaultQuota = await ctx.quotaStore.defaultQuota();
  });

  it(
    description("wallet should have the default daily quota by default"),
    async () => {
      const owner = ctx.owners[0];
      const { wallet } = await createWallet(ctx, owner);

      assert(
        (await ctx.quotaStore.currentQuota(wallet)).eq(defaultQuota),
        "incorrect default quota"
      );
    }
  );

  [false, true].forEach(function(metaTx) {
    it(
      description("owner should be able to change the daily quota"),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const { wallet } = await createWallet(ctx, owner);

        await changeDailyQuotaChecked(owner, wallet, toAmount("7"));
        await changeDailyQuotaChecked(owner, wallet, toAmount("24"));
        await changeDailyQuotaChecked(owner, wallet, toAmount("1"));
      }
    );
  });

  it(
    description(
      "should be able to change the daily quota immediately with majority"
    ),
    async () => {
      const owner = ctx.owners[0];
      const { wallet, guardians } = await createWallet(ctx, owner, 3);

      const newQuota = toAmount("9");

      // Change the daily quota immediately
      const numSignersRequired = Math.floor(1 + guardians.length / 2 + 1);
      for (let i = 0; i < numSignersRequired; i++) {
        const signers = [owner, ...guardians.slice(0, i)].sort();
        const transaction = executeTransaction(
          ctx.quotaTransfers.contract.methods.changeDailyQuotaImmediately(
            wallet,
            newQuota.toString(10)
          ),
          ctx,
          true,
          wallet,
          signers
        );
        if (signers.length >= numSignersRequired) {
          const tx = await transaction;
          const blockTime = await getBlockTime(tx.blockNumber);
          // The quota needs to be changed immediately
          await assertEventEmitted(
            ctx.quotaStore,
            "QuotaScheduled",
            (event: any) => {
              return (
                event.wallet == wallet &&
                event.pendingQuota.eq(newQuota) &&
                event.pendingUntil == blockTime
              );
            }
          );
          assert(
            (await ctx.quotaStore.currentQuota(wallet)).eq(newQuota),
            "quota incorrect"
          );
        } else {
          await expectThrow(transaction, "NOT_ENOUGH_SIGNERS");
        }
      }
    }
  );
});
