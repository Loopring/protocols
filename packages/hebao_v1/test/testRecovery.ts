import {
  Context,
  createContext,
  executeTransaction
} from "./helpers/TestUtils";
import { addGuardian } from "./helpers/GuardianUtils";
import { assertEventEmitted } from "../util/Events";
import { expectThrow } from "../util/expectThrow";
import { Constants } from "./helpers/Constants";

contract("GuardianModule - Recovery", (accounts: string[]) => {
  let ctx: Context;

  beforeEach(async () => {
    ctx = await createContext();
  });

  it("should be able to recover wallet using a majority of guardians", async () => {
    const owner = ctx.owners[0];
    const wallet = await ctx.walletFactoryModule.computeWalletAddress(owner);

    await executeTransaction(
      ctx.walletFactoryModule.contract.methods.createWallet(
        owner,
        "",
        Constants.emptyBytes,
        [ctx.guardianModule.address]
      ),
      ctx,
      true,
      wallet,
      [owner],
      { from: owner }
    );

    const newOwner = ctx.owners[1];
    const guardians = ctx.guardians.slice(0, 3);
    const group = 0;

    // Add the guardians
    for (const guardian of guardians) {
      await addGuardian(ctx, owner, wallet, guardian, group, true);
    }

    // Recover
    const numSignersRequired = Math.floor(guardians.length / 2 + 1);
    for (let i = 1; i <= numSignersRequired; i++) {
      const signers = guardians.slice(0, i).sort();
      const transaction = executeTransaction(
        ctx.guardianModule.contract.methods.recover(wallet, newOwner),
        ctx,
        true,
        wallet,
        signers
      );
      if (signers.length >= numSignersRequired) {
        await transaction;
        await assertEventEmitted(
          ctx.guardianModule,
          "Recovered",
          (event: any) => {
            return (
              event.wallet === wallet &&
              event.oldOwner === owner &&
              event.newOwner === newOwner
            );
          }
        );
      } else {
        await expectThrow(transaction, "NOT_ENOUGH_SIGNERS");
      }
    }

    // Check if the new owner is now active
    const walletContract = await ctx.contracts.BaseWallet.at(wallet);
    assert.equal(
      await walletContract.owner(),
      newOwner,
      "wallet owner incorrect"
    );
  });
});
