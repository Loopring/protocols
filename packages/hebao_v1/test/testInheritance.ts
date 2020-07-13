import {
  Context,
  getContext,
  createContext,
  createWallet,
  executeTransaction,
  getBlockTime
} from "./helpers/TestUtils";
import { assertEventEmitted } from "../util/Events";
import { expectThrow } from "../util/expectThrow";
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";

contract("InheritanceModule", (accounts: string[]) => {
  let defaultCtx: Context;
  let ctx: Context;

  let waitingPeriod: number;

  const getInheritor = async (wallet: string) => {
    const inheritorData = await ctx.inheritanceModule.inheritor(wallet);
    return inheritorData.who;
  };

  const getLastActiveTime = async (wallet: string) => {
    const inheritorData = await ctx.inheritanceModule.inheritor(wallet);
    return Number(inheritorData.lastActive);
  };

  before(async () => {
    defaultCtx = await getContext();
  });

  beforeEach(async () => {
    ctx = await createContext(defaultCtx);
    waitingPeriod = (await ctx.inheritanceModule.waitingPeriod()).toNumber();
  });

  [false, true].forEach(function(useMetaTx) {
    const description = (descr: string, metaTx: boolean = useMetaTx) => {
      return descr + (metaTx ? " (meta tx)" : "");
    };

    it(
      description("owner should be able to set an inheritor and inherit"),
      async () => {
        const owner = ctx.owners[0];
        const inheritorEOA = ctx.owners[1];
        const { wallet } = await createWallet(ctx, owner);
        const inheritorWallet = await createWallet(ctx, inheritorEOA);
        const inheritor = useMetaTx ? inheritorWallet.wallet : inheritorEOA;
        // console.log(`owner: ${owner}`);
        // console.log(`inheritor: ${inheritor}`);

        const opt = useMetaTx ? { owner, wallet } : { from: owner };

        // Try to inherit without having set an inheritor
        if (!useMetaTx) {
          await expectThrow(
            executeTransaction(
              ctx.inheritanceModule.contract.methods.inherit(wallet, false),
              ctx,
              useMetaTx,
              wallet,
              [owner],
              { from: owner }
            ),
            useMetaTx ? "METATX_UNAUTHORIZED" : "NOT_ALLOWED"
          );
        }

        // Set the inheritor
        await executeTransaction(
          ctx.inheritanceModule.contract.methods.setInheritor(
            wallet,
            inheritor
          ),
          ctx,
          useMetaTx,
          wallet,
          [owner],
          opt
        );

        assert.equal(
          await getInheritor(wallet),
          inheritor,
          "unexpected inheritor"
        );

        const opt2 = useMetaTx
          ? { owner: inheritorEOA, wallet: inheritorWallet.wallet }
          : { from: inheritorEOA };

        // Try to inherit too soon
        if (!useMetaTx) {
          await expectThrow(
            executeTransaction(
              ctx.inheritanceModule.contract.methods.inherit(wallet, false),
              ctx,
              useMetaTx,
              wallet,
              [],
              { from: inheritorEOA }
            ),
            "NEED_TO_WAIT"
          );
        }

        // Skip forward `waitingPeriod` seconds
        await advanceTimeAndBlockAsync(waitingPeriod);

        // Now inherit
        await executeTransaction(
          ctx.inheritanceModule.contract.methods.inherit(wallet, false),
          ctx,
          useMetaTx,
          wallet,
          [],
          opt2
        );
        if (!useMetaTx) {
          await assertEventEmitted(
            ctx.inheritanceModule,
            "Inherited",
            (event: any) => {
              return event.wallet == wallet && event.inheritor == inheritor;
            }
          );
        }

        // Check if the inheritor is now the owner
        const walletContract = await ctx.contracts.WalletImpl.at(wallet);
        assert.equal(
          await walletContract.owner(),
          inheritor,
          "wallet owner incorrect"
        );

        // Try to inherit again
        if (!useMetaTx) {
          await expectThrow(
            executeTransaction(
              ctx.inheritanceModule.contract.methods.inherit(wallet, false),
              ctx,
              useMetaTx,
              wallet,
              [],
              { from: inheritorEOA }
            ),
            useMetaTx ? "METATX_UNAUTHORIZED" : "NOT_ALLOWED"
          );
        }
      }
    );

    it(
      description("using modules should update last active time"),
      async () => {
        const owner = ctx.owners[0];
        const inheritorEOA = ctx.owners[1];
        const { wallet } = await createWallet(ctx, owner);
        const inheritorWallet = await createWallet(ctx, inheritorEOA);
        const inheritor = useMetaTx ? inheritorWallet.wallet : inheritorEOA;

        const opt = useMetaTx ? { owner, wallet } : { from: owner };
        const opt2 = useMetaTx
          ? { owner: inheritorEOA, wallet: inheritorWallet.wallet }
          : { from: inheritorEOA };

        // All functions that should update the last active time
        const activityFunctions = [
          ctx.inheritanceModule.contract.methods.setInheritor(wallet, inheritor)
        ];

        assert.equal(
          await getLastActiveTime(wallet),
          0,
          "unexpected last active time"
        );

        // Use the function updating the last active time
        if (!useMetaTx) {
          const tx = await executeTransaction(
            ctx.inheritanceModule.contract.methods.setInheritor(
              wallet,
              inheritor
            ),
            ctx,
            useMetaTx,
            wallet,
            [],
            opt
          );
          assert.equal(
            await getLastActiveTime(wallet),
            await getBlockTime(tx.blockNumber),
            "unexpected last active time"
          );

          // Skip forward `waitingPeriod` - 100
          await advanceTimeAndBlockAsync(waitingPeriod - 100);

          // Try to inherit too soon
          await expectThrow(
            executeTransaction(
              ctx.inheritanceModule.contract.methods.inherit(wallet, false),
              ctx,
              useMetaTx,
              wallet,
              [],
              opt2
            ),
            "NEED_TO_WAIT"
          );

          // Skip forward an additional 200 seconds
          await advanceTimeAndBlockAsync(200);

          // Last active time should be unchanged
          assert.equal(
            await getLastActiveTime(wallet),
            await getBlockTime(tx.blockNumber),
            "unexpected last active time"
          );

          // Inherit
          await executeTransaction(
            ctx.inheritanceModule.contract.methods.inherit(wallet, false),
            ctx,
            useMetaTx,
            wallet,
            [],
            opt2
          );
        }
      }
    );
  });
});
