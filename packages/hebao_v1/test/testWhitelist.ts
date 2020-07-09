import {
  Context,
  getContext,
  createContext,
  createWallet,
  executeTransaction,
  getBlockTime
} from "./helpers/TestUtils";
import {
  addToWhitelist,
  removeFromWhitelist,
  isWhitelisted,
  getEffectiveTime
} from "./helpers/WhitelistUtils";
import { expectThrow } from "../util/expectThrow";
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";
import { assertEventEmitted } from "../util/Events";
import {
  SignedRequest,
  signAddToWhitelistImmediately
} from "./helpers/SignatureUtils";

contract("WhitelistModule", (accounts: string[]) => {
  let defaultCtx: Context;
  let ctx: Context;

  let useMetaTx: boolean = false;

  const description = (descr: string, metaTx: boolean = useMetaTx) => {
    return descr + (metaTx ? " (meta tx)" : "");
  };

  const addToWhitelistChecked = async (
    owner: string,
    wallet: string,
    addr: string
  ) => {
    await addToWhitelist(ctx, owner, wallet, addr, useMetaTx);
  };

  const removeFromWhitelistChecked = async (
    owner: string,
    wallet: string,
    addr: string
  ) => {
    await removeFromWhitelist(ctx, owner, wallet, addr, useMetaTx);
  };

  before(async () => {
    defaultCtx = await getContext();
  });

  beforeEach(async () => {
    ctx = await createContext(defaultCtx);
  });

  [false, true].forEach(function(metaTx) {
    it(
      description(
        "owner should be able to add/remove addresses to/from the whitelist"
      ),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const { wallet } = await createWallet(ctx, owner);

        await addToWhitelistChecked(owner, wallet, ctx.guardians[0]);
        await addToWhitelistChecked(owner, wallet, ctx.guardians[1]);
        await addToWhitelistChecked(owner, wallet, ctx.guardians[2]);
        await removeFromWhitelistChecked(owner, wallet, ctx.guardians[1]);
        await removeFromWhitelistChecked(owner, wallet, ctx.guardians[2]);
        await removeFromWhitelistChecked(owner, wallet, ctx.guardians[0]);
      }
    );
  });

  it(
    description(
      "should be able to add addresses to the whitelist immediately with majority"
    ),
    async () => {
      const owner = ctx.owners[0];
      const { wallet, guardians } = await createWallet(ctx, owner, 3);

      // Add to the whitelist
      const addr = ctx.guardians[10];
      const signers = [owner, ...guardians.slice(0, 2)].sort();
      const request: SignedRequest = {
        signers,
        signatures: [],
        validUntil: Math.floor(new Date().getTime() / 1000) + 3600 * 24 * 30,
        wallet
      };
      signAddToWhitelistImmediately(request, addr, ctx.whitelistModule.address);

      const tx = await executeTransaction(
        ctx.whitelistModule.contract.methods.addToWhitelistImmediately(
          request,
          addr
        ),
        ctx,
        true,
        wallet,
        [],
        { from: owner, owner, wallet }
      );
      const blockTime = await getBlockTime(tx.blockNumber);

      // if(!useMetaTx) {
      //   // The first guardian can be added immediately
      //   await assertEventEmitted(
      //     ctx.whitelistStore,
      //     "Whitelisted",
      //     (event: any) => {
      //       return (
      //         event.wallet == wallet &&
      //           event.addr == addr &&
      //           event.whitelisted == true
      //       );
      //     }
      //   );
      // }

      // Should be effective immediately
      assert(
        await isWhitelisted(ctx, wallet, addr),
        "should be whitelisted immediately"
      );
    }
  );
});
