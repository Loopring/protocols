import {
  Context,
  createContext,
  executeTransaction,
  createWallet
} from "./helpers/TestUtils";
import { addGuardian } from "./helpers/GuardianUtils";
import { assertEventEmitted } from "../util/Events";
import { expectThrow } from "../util/expectThrow";
import { Constants } from "./helpers/Constants";
import { SignedRequest, signRecover } from "./helpers/SignatureUtils";

contract("GuardianModule - Recovery", (accounts: string[]) => {
  let ctx: Context;
  let useMetaTx: boolean;

  const description = (descr: string, metaTx: boolean = useMetaTx) => {
    return descr + (metaTx ? " (meta tx)" : "");
  };

  beforeEach(async () => {
    ctx = await createContext();
  });

  [false, true].forEach(function(metaTx) {
    it(
      description(
        "should be able to recover wallet using a majority of guardians"
      ),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const walletAddr = await ctx.walletFactory.computeWalletAddress(owner);
        const { wallet } = await createWallet(ctx, owner);

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
          const request: SignedRequest = {
            signers,
            signatures: [],
            validUntil:
              Math.floor(new Date().getTime() / 1000) + 3600 * 24 * 30,
            wallet
          };
          signRecover(request, newOwner, ctx.guardianModule.address);

          const transaction = executeTransaction(
            ctx.guardianModule.contract.methods.recover(request, newOwner),
            ctx,
            useMetaTx,
            wallet,
            [],
            { from: owner, owner, wallet }
          );

          if (signers.length >= numSignersRequired) {
            await transaction;
            if (!useMetaTx) {
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
            }
          } else {
            if (!useMetaTx) {
              await expectThrow(transaction, "NOT_ENOUGH_SIGNERS");
            }
          }
        }

        // Check if the new owner is now active
        const walletContract = await ctx.contracts.WalletImpl.at(wallet);
        assert.equal(
          await walletContract.owner(),
          newOwner,
          "wallet owner incorrect"
        );
      }
    );
  });
});
