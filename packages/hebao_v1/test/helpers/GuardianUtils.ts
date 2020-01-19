import { Context, executeTransaction } from "./TestUtils";
import { expectThrow } from "../../util/expectThrow";
import { advanceTimeAndBlockAsync } from "../../util/TimeTravel";
import { assertEventEmitted } from "../../util/Events";

export function sortGuardians(guardians: any) {
  return guardians.sort((a: any, b: any) => (a.addr > b.addr ? 1 : -1));
}

export async function addGuardian(
  ctx: Context,
  owner: string,
  wallet: string,
  guardian: string,
  group: number,
  useMetaTx: boolean = true
) {
  const pendingPeriod = (await ctx.guardianModule.pendingPeriod()).toNumber();

  let guardiansBefore = await ctx.securityStore.guardians(wallet);

  const wasGuardian = await ctx.securityStore.isGuardian(wallet, guardian);

  // Start adding the guardian
  await executeTransaction(
    ctx.guardianModule.contract.methods.addGuardian(wallet, guardian, group),
    ctx,
    useMetaTx,
    wallet,
    [owner],
    { from: owner }
  );
  if (guardiansBefore.length === 0) {
    // The first guardian can be added immediately
    await assertEventEmitted(
      ctx.guardianModule,
      "GuardianAdded",
      (event: any) => {
        return (
          event.wallet == wallet &&
          event.guardian == guardian &&
          event.group == group
        );
      }
    );
  } else {
    // Subsequent guardians can be added with a delay
    await assertEventEmitted(
      ctx.guardianModule,
      "GuardianAdditionPending",
      (event: any) => {
        return (
          event.wallet == wallet &&
          event.guardian == guardian &&
          event.group == group
        );
      }
    );

    // Try to confirm immediately
    await expectThrow(
      executeTransaction(
        ctx.guardianModule.contract.methods.confirmGuardianAddition(
          wallet,
          guardian,
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

    // Skip forward `pendingPeriod` seconds
    await advanceTimeAndBlockAsync(pendingPeriod);

    // Confirm guardian addition
    await executeTransaction(
      ctx.guardianModule.contract.methods.confirmGuardianAddition(
        wallet,
        guardian,
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
      "GuardianAdded",
      (event: any) => {
        return (
          event.wallet == wallet &&
          event.guardian == guardian &&
          event.group == group
        );
      }
    );
  }

  // Check if now guardian
  assert(
    await ctx.securityStore.isGuardian(wallet, guardian),
    "should be guardian"
  );

  if (wasGuardian) {
    // Strip out the guardian from the before array as we will add it again with updated group
    guardiansBefore = guardiansBefore.filter((g: any) => g.addr !== guardian);
  }

  // Check if the guardian list stored is correct
  let guardiansAfter = await ctx.securityStore.guardians(wallet);
  const numGuardians = (
    await ctx.securityStore.numGuardians(wallet)
  ).toNumber();
  guardiansBefore.push({ addr: guardian, group });
  guardiansBefore = sortGuardians(guardiansBefore);
  guardiansAfter = sortGuardians(guardiansAfter);
  assert.equal(
    guardiansBefore.length,
    numGuardians,
    "guardian count unexpected"
  );
  assert.equal(
    guardiansBefore.length,
    guardiansAfter.length,
    "guardian not added"
  );
  for (let i = 0; i < guardiansBefore.length; i++) {
    assert.equal(
      guardiansBefore[i].addr,
      guardiansAfter[i].addr,
      "guardian address unexpected"
    );
    assert.equal(
      guardiansBefore[i].group,
      guardiansAfter[i].group,
      "guardian group unexpected"
    );
  }
}

export async function removeGuardian(
  ctx: Context,
  owner: string,
  wallet: string,
  guardian: string,
  useMetaTx: boolean = true
) {
  const pendingPeriod = (await ctx.guardianModule.pendingPeriod()).toNumber();

  let guardiansBefore = await ctx.securityStore.guardians(wallet);

  // Start removing the guardian
  await executeTransaction(
    ctx.guardianModule.contract.methods.removeGuardian(wallet, guardian),
    ctx,
    useMetaTx,
    wallet,
    [owner],
    { from: owner }
  );
  await assertEventEmitted(
    ctx.guardianModule,
    "GuardianRemovalPending",
    (event: any) => {
      return event.wallet == wallet && event.guardian == guardian;
    }
  );

  // Try to confirm immediately
  await expectThrow(
    executeTransaction(
      ctx.guardianModule.contract.methods.confirmGuardianRemoval(
        wallet,
        guardian
      ),
      ctx,
      useMetaTx,
      wallet,
      [owner],
      { from: owner }
    ),
    "TOO_EARLY_OR_EXPIRED"
  );

  // Skip forward `pendingPeriod` seconds
  await advanceTimeAndBlockAsync(pendingPeriod);

  // Confirm guardian removal
  await executeTransaction(
    ctx.guardianModule.contract.methods.confirmGuardianRemoval(
      wallet,
      guardian
    ),
    ctx,
    useMetaTx,
    wallet,
    [owner],
    { from: owner }
  );
  await assertEventEmitted(
    ctx.guardianModule,
    "GuardianRemoved",
    (event: any) => {
      return event.wallet == wallet && event.guardian == guardian;
    }
  );

  // Check if not guardian anymore
  assert(
    !(await ctx.securityStore.isGuardian(wallet, guardian)),
    "should not be guardian"
  );

  // Check if the guardian list stored is correct
  let guardiansAfter = await ctx.securityStore.guardians(wallet);
  guardiansBefore = guardiansBefore.filter((g: any) => g.addr !== guardian);
  guardiansBefore = sortGuardians(guardiansBefore);
  guardiansAfter = sortGuardians(guardiansAfter);
  assert(
    guardiansBefore.length === guardiansAfter.length,
    "guardian not removed"
  );
  for (let i = 0; i < guardiansAfter.length; i++) {
    assert(
      guardiansBefore[i].addr === guardiansAfter[i].addr,
      "guardian address mismatch"
    );
    assert(
      guardiansBefore[i].group == guardiansAfter[i].group,
      "guardian group mismatch"
    );
  }
}
