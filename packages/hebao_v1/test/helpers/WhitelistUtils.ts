import { Context, executeTransaction, getBlockTime } from "./TestUtils";
import { expectThrow } from "../../util/expectThrow";
import { advanceTimeAndBlockAsync } from "../../util/TimeTravel";
import { assertEventEmitted } from "../../util/Events";

interface WhitelistEntry {
  addr: string;
  effectiveTime: number;
}

function toPrettyList(data: any) {
  const list: WhitelistEntry[] = [];
  for (let i = 0; i < data.addresses.length; i++) {
    list.push({
      addr: data.addresses[i],
      effectiveTime: data.effectiveTimes[i].toNumber()
    });
  }
  return list;
}

export function sortWhitelist(addresses: any) {
  return addresses.sort((a: any, b: any) => (a.addr > b.addr ? 1 : -1));
}

export function assertEqual(
  whitelistBefore: WhitelistEntry[],
  whitelistAfter: WhitelistEntry[],
  useMetaTx: boolean
) {
  whitelistBefore = sortWhitelist(whitelistBefore);
  whitelistAfter = sortWhitelist(whitelistAfter);
  assert.equal(
    whitelistBefore.length,
    whitelistAfter.length,
    "addr not added to whitelist"
  );
  for (let i = 0; i < whitelistBefore.length; i++) {
    assert.equal(
      whitelistBefore[i].addr,
      whitelistAfter[i].addr,
      "address unexpected"
    );
    if (!useMetaTx) {
      assert.equal(
        whitelistBefore[i].effectiveTime,
        whitelistAfter[i].effectiveTime,
        "effectiveTime unexpected"
      );
    }
  }
}

export async function isWhitelisted(
  ctx: Context,
  wallet: string,
  addr: string
) {
  const whitelistedData = await ctx.finalSecurityModule.isWhitelisted(
    wallet,
    addr
  );
  return whitelistedData.isWhitelistedAndEffective;
}

export async function getEffectiveTime(
  ctx: Context,
  wallet: string,
  addr: string
) {
  const whitelistedData = await ctx.finalSecurityModule.isWhitelisted(
    wallet,
    addr
  );
  return whitelistedData.effectiveTime;
}

export async function addToWhitelist(
  ctx: Context,
  owner: string,
  wallet: string,
  addr: string,
  useMetaTx: boolean = true
) {
  const whitelistPendingPeriod = (await ctx.finalSecurityModule.WHITELIST_PENDING_PERIOD()).toNumber();

  let whitelistBefore = toPrettyList(
    await ctx.whitelistStore.whitelist(wallet)
  );

  // Add to the whitelist
  const tx = await executeTransaction(
    ctx.finalSecurityModule.contract.methods.addToWhitelist(wallet, addr),
    ctx,
    useMetaTx,
    wallet,
    [owner],
    { from: owner, owner, wallet }
  );
  const blockTime = await getBlockTime(tx.blockNumber);

  // Check for the Whitelisted event
  if (!useMetaTx) {
    await assertEventEmitted(
      ctx.whitelistStore,
      "Whitelisted",
      (event: any) => {
        return (
          event.wallet == wallet &&
          event.addr == addr &&
          event.whitelisted == true
        );
      }
    );
  }

  // Should not yet been whitelisted
  assert(
    !(await isWhitelisted(ctx, wallet, addr)),
    "should not be whitelisted yet"
  );

  if (!useMetaTx) {
    assert.equal(
      (await getEffectiveTime(ctx, wallet, addr)).toNumber(),
      blockTime + whitelistPendingPeriod,
      "should not be whitelisted yet"
    );
  }

  // Skip forward `pendingPeriod` seconds
  await advanceTimeAndBlockAsync(whitelistPendingPeriod);

  // Should be effective now
  assert(await isWhitelisted(ctx, wallet, addr), "should be whitelisted");

  // Check if the guardian list stored is correct
  let whitelistAfter = toPrettyList(await ctx.whitelistStore.whitelist(wallet));
  whitelistBefore.push({
    addr,
    effectiveTime: blockTime + whitelistPendingPeriod
  });
  const whitelistSize = (await ctx.whitelistStore.whitelistSize(
    wallet
  )).toNumber();
  assert.equal(
    whitelistBefore.length,
    whitelistSize,
    "whitelist count unexpected"
  );
  assertEqual(whitelistBefore, whitelistAfter, useMetaTx);
}

export async function removeFromWhitelist(
  ctx: Context,
  owner: string,
  wallet: string,
  addr: string,
  useMetaTx: boolean = true
) {
  let whitelistBefore = toPrettyList(
    await ctx.whitelistStore.whitelist(wallet)
  );

  // Start removing the guardian
  await executeTransaction(
    ctx.finalSecurityModule.contract.methods.removeFromWhitelist(wallet, addr),
    ctx,
    useMetaTx,
    wallet,
    [owner],
    { from: owner, wallet, owner }
  );

  if (!useMetaTx) {
    await assertEventEmitted(
      ctx.whitelistStore,
      "Whitelisted",
      (event: any) => {
        return (
          event.wallet == wallet &&
          event.addr == addr &&
          event.whitelisted == false
        );
      }
    );
  }

  // Should be effective WA
  assert(
    !(await isWhitelisted(ctx, wallet, addr)),
    "should not be whitelisted"
  );

  // Check if the guardian list stored is correct
  let whitelistAfter = toPrettyList(await ctx.whitelistStore.whitelist(wallet));
  whitelistBefore = whitelistBefore.filter((g: any) => g.addr !== addr);
  const whitelistSize = (await ctx.whitelistStore.whitelistSize(
    wallet
  )).toNumber();
  assert.equal(
    whitelistBefore.length,
    whitelistSize,
    "whitelist count unexpected"
  );
  assertEqual(whitelistBefore, whitelistAfter, useMetaTx);
}
