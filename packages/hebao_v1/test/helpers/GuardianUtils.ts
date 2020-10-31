import { Context, executeTransaction } from "./TestUtils";
import { expectThrow } from "../../util/expectThrow";
import { advanceTimeAndBlockAsync } from "../../util/TimeTravel";
import { assertEventEmitted, getEventsFromContract } from "../../util/Events";
import BN = require("bn.js");

export function sortGuardians(guardians: any) {
  return guardians.sort((a: any, b: any) => (a.addr > b.addr ? 1 : -1));
}

export async function addGuardian(
  ctx: Context,
  owner: string,
  wallet: string,
  guardian: string,
  useMetaTx: boolean = true
) {
  const guardianPendingPeriod = (await ctx.finalSecurityModule.GUARDIAN_PENDING_PERIOD()).toNumber();

  let guardiansBefore = await ctx.securityStore.guardians(wallet, false);

  const wasGuardian = await ctx.securityStore.isGuardian(
    wallet,
    guardian,
    false
  );

  await web3.eth.sendTransaction({
    from: owner,
    to: wallet,
    value: "1" + "0".repeat(18),
    gasLimit: "100000",
    gasPrice: "22000000000"
  });

  const opt = useMetaTx
    ? { owner, wallet, gasPrice: new BN(0) }
    : { from: owner };

  // Start adding the guardian
  await executeTransaction(
    ctx.finalSecurityModule.contract.methods.addGuardian(wallet, guardian),
    ctx,
    useMetaTx,
    wallet,
    [],
    opt
  );

  await assertEventEmitted(
    ctx.finalSecurityModule,
    "GuardianAdded",
    (event: any) => {
      return event.wallet == wallet && event.guardian == guardian;
    }
  );

  if (guardiansBefore.length === 0) {
    // The first guardian can be added WA
  } else {
    // Subsequent guardians can be added with a delay
    // Skip forward `guardianPendingPeriod + 1` seconds
    await advanceTimeAndBlockAsync(guardianPendingPeriod + 1);
  }

  // Check if now guardian
  assert(
    await ctx.securityStore.isGuardian(wallet, guardian, false),
    "should be guardian"
  );
}

export async function removeGuardian(
  ctx: Context,
  owner: string,
  wallet: string,
  guardian: string,
  useMetaTx: boolean = true
) {
  const guardianPendingPeriod = (await ctx.finalSecurityModule.GUARDIAN_PENDING_PERIOD()).toNumber();

  let guardiansBefore = await ctx.securityStore.guardians(wallet, false);

  const opt = useMetaTx
    ? { owner, wallet, gasPrice: new BN(0) }
    : { from: owner };

  // Start removing the guardian
  await executeTransaction(
    ctx.finalSecurityModule.contract.methods.removeGuardian(wallet, guardian),
    ctx,
    useMetaTx,
    wallet,
    [],
    opt
  );

  const blockNumber = await web3.eth.getBlockNumber();

  // const allEvents = await ctx.finalSecurityModule.getPastEvents(
  //   "allEvents",
  //   {
  //     fromBlock: blockNumber - 3,
  //     toBlock: blockNumber
  //   }
  // );
  // const util = require("util");
  // console.log(`allEvents: ${util.inspect(allEvents)}`);

  await assertEventEmitted(
    ctx.finalSecurityModule,
    "GuardianRemoved",
    (event: any) => {
      // console.log(`event: ${event}`);
      return event.wallet == wallet && event.guardian == guardian;
    }
  );

  // Skip forward `guardianPendingPeriod + 1` seconds
  await advanceTimeAndBlockAsync(guardianPendingPeriod + 1);

  // Check if not guardian anymore
  assert(
    !(await ctx.securityStore.isGuardian(wallet, guardian, false)),
    "should not be guardian"
  );

  // Check if the guardian list stored is correct
  let guardiansAfter = await ctx.securityStore.guardians(wallet, false);
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
  }
}
