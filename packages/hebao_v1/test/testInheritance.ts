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
        const inheritor = ctx.owners[1];
        const { wallet } = await createWallet(ctx, owner);

        // Try to inherit without having set an inheritor
        await expectThrow(
          executeTransaction(
            ctx.inheritanceModule.contract.methods.inherit(wallet),
            ctx,
            useMetaTx,
            wallet,
            [owner],
            { from: owner }
          ),
          useMetaTx ? "METATX_UNAUTHORIZED" : "NULL_INHERITOR"
        );

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
          { from: owner }
        );
        assert.equal(
          await getInheritor(wallet),
          inheritor,
          "unexpected inheritor"
        );

        // Try to inherit too soon
        await expectThrow(
          executeTransaction(
            ctx.inheritanceModule.contract.methods.inherit(wallet),
            ctx,
            useMetaTx,
            wallet,
            [inheritor],
            { from: inheritor }
          ),
          "NEED_TO_WAIT"
        );

        // Skip forward `waitingPeriod` seconds
        await advanceTimeAndBlockAsync(waitingPeriod);

        // Now inherit
        await executeTransaction(
          ctx.inheritanceModule.contract.methods.inherit(wallet),
          ctx,
          useMetaTx,
          wallet,
          [inheritor],
          { from: inheritor }
        );
        await assertEventEmitted(
          ctx.inheritanceModule,
          "Inherited",
          (event: any) => {
            return event.wallet == wallet && event.newOwner == inheritor;
          }
        );

        // Check if the inheritor is now the owner
        const walletContract = await ctx.contracts.BaseWallet.at(wallet);
        assert.equal(
          await walletContract.owner(),
          inheritor,
          "wallet owner incorrect"
        );

        // Try to inherit again
        await expectThrow(
          executeTransaction(
            ctx.inheritanceModule.contract.methods.inherit(wallet),
            ctx,
            useMetaTx,
            wallet,
            [inheritor],
            { from: inheritor }
          ),
          useMetaTx ? "METATX_UNAUTHORIZED" : "NULL_INHERITOR"
        );
      }
    );

    it(
      description("using modules should update last active time"),
      async () => {
        const owner = ctx.owners[0];
        const inheritor = ctx.owners[1];
        const { wallet } = await createWallet(ctx, owner);

        // All functions that should update the last active time
        const activityFunctions = [
          ctx.inheritanceModule.contract.methods.setInheritor(wallet, inheritor)
        ];

        assert.equal(
          await getLastActiveTime(wallet),
          0,
          "unexpected last active time"
        );

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
          { from: owner }
        );

        // Skip forward `waitingPeriod`
        await advanceTimeAndBlockAsync(waitingPeriod);

        for (const activityFunction of activityFunctions) {
          // Use the function updating the last active time
          const tx = await executeTransaction(
            activityFunction,
            ctx,
            useMetaTx,
            wallet,
            [owner],
            { from: owner }
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
              ctx.inheritanceModule.contract.methods.inherit(wallet),
              ctx,
              useMetaTx,
              wallet,
              [inheritor],
              { from: inheritor }
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
        }

        // Inherit
        await executeTransaction(
          ctx.inheritanceModule.contract.methods.inherit(wallet),
          ctx,
          useMetaTx,
          wallet,
          [inheritor],
          { from: inheritor }
        );
      }
    );
  });
});
