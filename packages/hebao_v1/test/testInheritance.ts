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

  let inheritWaitingPeriod: number;

  const getInheritor = async (wallet: string) => {
    const inheritorData = await ctx.finalSecurityModule.inheritor(wallet);
    return inheritorData._inheritor;
  };

  const getLastActiveTime = async (wallet: string) => {
    const inheritorData = await ctx.finalSecurityModule.inheritor(wallet);
    return Number(inheritorData.lastActive);
  };

  before(async () => {
    defaultCtx = await getContext();
  });

  beforeEach(async () => {
    ctx = await createContext(defaultCtx);
    inheritWaitingPeriod = (
      await ctx.finalSecurityModule.inheritWaitingPeriod()
    ).toNumber();
  });

  [false, true].forEach(function(useMetaTx) {
    const description = (descr: string, metaTx: boolean = useMetaTx) => {
      return descr + (metaTx ? " (meta tx)" : "");
    };

    it(
      description("owner should be able to set an inheritor and inherit"),
      async () => {
        const owner = ctx.owners[0];
        const newOwner = ctx.owners[5];
        const inheritorEOA = ctx.owners[1];
        const { wallet } = await createWallet(ctx, owner);
        const inheritorWallet = await createWallet(ctx, inheritorEOA);
        const inheritor = inheritorWallet.wallet;

        // Check if the newOwner is now the owner
        const walletContract = await ctx.contracts.WalletImpl.at(wallet);

        const opt = useMetaTx ? { owner, wallet } : { from: owner };

        // Try to inherit without having set an inheritor
        if (!useMetaTx) {
          await expectThrow(
            executeTransaction(
              ctx.finalSecurityModule.contract.methods.inherit(
                wallet,
                newOwner
              ),
              ctx,
              useMetaTx,
              wallet,
              [],
              { from: owner }
            ),
            "NOT_ALLOWED"
          );
        }

        // Set the inheritor
        await executeTransaction(
          ctx.finalSecurityModule.contract.methods.setInheritor(
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
          await getInheritor(wallet),
          inheritor,
          "unexpected inheritor"
        );

        // if(!useMetaTx) {
        //   // Try to inherit too soon
        //   try{
        //     executeTransaction(
        //       ctx.finalSecurityModule.contract.methods.inherit(wallet, ctx.miscAddresses[1]),
        //       ctx,
        //       true,
        //       wallet,
        //       [],
        //       { owner: inheritorEOA, wallet: inheritor }
        //     );
        //   } catch (err) {}
        //   // assert owner not changed.
        //   assert.equal(
        //     await walletContract.owner(),
        //     owner,
        //     "wallet owner incorrect"
        //   );
        // }

        // Skip forward `inheritWaitingPeriod` seconds
        await advanceTimeAndBlockAsync(inheritWaitingPeriod);

        // Now inherit
        await executeTransaction(
          ctx.finalSecurityModule.contract.methods.inherit(wallet, newOwner),
          ctx,
          true,
          wallet,
          [],
          { owner: inheritorEOA, wallet: inheritor }
        );
        assert.equal(
          await walletContract.owner(),
          newOwner,
          "wallet owner incorrect"
        );
        assert.equal(
          await getInheritor(wallet),
          "0x" + "00".repeat(20),
          "unexpected inheritor"
        );

        // Try to inherit again
        const newOwner2 = ctx.miscAddresses[2];
        executeTransaction(
          ctx.finalSecurityModule.contract.methods.inherit(wallet, newOwner2),
          ctx,
          true,
          wallet,
          [],
          { owner: inheritorEOA, wallet: inheritor }
        );
        assert.equal(
          await walletContract.owner(),
          newOwner,
          "wallet owner incorrect"
        );
      }
    );

    it(
      description("using modules should update last active time"),
      async () => {
        const owner = ctx.owners[0];
        const newOwner = ctx.owners[4];
        const inheritorEOA = ctx.owners[1];
        const { wallet } = await createWallet(ctx, owner);
        const inheritorWallet = await createWallet(ctx, inheritorEOA);
        const inheritor = inheritorWallet.wallet;

        const opt = useMetaTx ? { owner, wallet } : { from: owner };

        // All functions that should update the last active time
        const activityFunctions = [
          ctx.finalSecurityModule.contract.methods.setInheritor(
            wallet,
            inheritor
          )
        ];

        assert.equal(
          await getLastActiveTime(wallet),
          0,
          "unexpected last active time"
        );

        // Use the function updating the last active time
        const tx = await executeTransaction(
          ctx.finalSecurityModule.contract.methods.setInheritor(
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
          await getBlockTime(tx.blockNumber || tx.receipt.blockNumber),
          "unexpected last active time"
        );

        // if (!useMetaTx) {
        //   // Skip forward `inheritWaitingPeriod` - 100
        //   await advanceTimeAndBlockAsync(inheritWaitingPeriod - 100);

        //   executeTransaction(
        //     ctx.finalSecurityModule.contract.methods.inherit(wallet, newOwner),
        //     ctx,
        //     true,
        //     wallet,
        //     [],
        //     { owner: inheritorEOA, wallet: inheritorWallet.wallet }
        //   );

        //   // Last active time should be unchanged
        //   assert.equal(
        //     await getLastActiveTime(wallet),
        //     await getBlockTime(tx.blockNumber || tx.receipt.blockNumber),
        //     "unexpected last active time"
        //   );

        //   await advanceTimeAndBlockAsync(200);

        // } else {
        //     await advanceTimeAndBlockAsync(inheritWaitingPeriod);
        // }

        await advanceTimeAndBlockAsync(inheritWaitingPeriod);

        // Last active time should be unchanged
        assert.equal(
          await getLastActiveTime(wallet),
          await getBlockTime(tx.blockNumber || tx.receipt.blockNumber),
          "unexpected last active time"
        );

        // Inherit
        const tx2 = await executeTransaction(
          ctx.finalSecurityModule.contract.methods.inherit(wallet, newOwner),
          ctx,
          true,
          wallet,
          [],
          { owner: inheritorEOA, wallet: inheritorWallet.wallet }
        );

        assert.equal(
          await getLastActiveTime(wallet),
          await getBlockTime(tx2.blockNumber || tx2.receipt.blockNumber),
          "unexpected last active time"
        );
      }
    );
  });
});
