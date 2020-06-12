import {
  Context,
  getContext,
  createContext,
  executeTransaction,
  toAmount,
  getEnsApproval
} from "./helpers/TestUtils";
import { transferFrom } from "./helpers/TokenUtils";
import { assertEventEmitted, assertNoEventEmitted } from "../util/Events";
import { expectThrow } from "../util/expectThrow";
import BN = require("bn.js");
import { Constants } from "./helpers/Constants";
import { sign } from "./helpers/Signature";

contract("WalletFactoryModule", () => {
  let defaultCtx: Context;
  let ctx: Context;

  let useMetaTx: boolean = false;
  const walletDomain = ".loopring.eth";

  const createWalletChecked = async (
    owner: string,
    walletName: string = ""
  ) => {
    const wallet = await ctx.walletFactoryModule.computeWalletAddress(owner);

    if (useMetaTx) {
      // Transfer 0.1 ETH to the wallet to pay for the wallet creation
      await transferFrom(ctx, owner, wallet, "ETH", toAmount("0.1"));
    }

    let signer = Constants.zeroAddress;
    let signature = Constants.emptyBytes;
    if (walletName) {
      signer = ctx.owners[0];
      signature = await getEnsApproval(wallet, walletName, signer);
    }
    const tx = await executeTransaction(
      ctx.walletFactoryModule.contract.methods.createWallet(
        owner,
        walletName,
        signature,
        [
          ctx.guardianModule.address,
          ctx.lockModule.address,
          ctx.recoveryModule.address,
          ctx.whitelistModule.address,
          ctx.quotaModule.address,
          ctx.quotaTransfers.address,
          ctx.approvedTransfers.address,
          ctx.dappTransfers.address,
          ctx.erc1271Module.address
        ]
      ),
      ctx,
      useMetaTx,
      wallet,
      [owner],
      { from: owner, gasPrice: new BN(1) }
    );

    console.log("tx gas usage: ", tx.gasUsed);

    await assertEventEmitted(
      ctx.walletFactoryModule,
      "WalletCreated",
      (event: any) => {
        return event.wallet === wallet && event.owner === owner;
      }
    );
    if (walletName !== "") {
      await assertEventEmitted(
        ctx.walletENSManager,
        "Registered",
        (event: any) => {
          return (
            event._ens === walletName + walletDomain && event._owner === wallet
          );
        }
      );
    } else {
      await assertNoEventEmitted(ctx.walletENSManager, "Registered");
    }

    const walletContract = await ctx.contracts.BaseWallet.at(wallet);
    assert.equal(await walletContract.owner(), owner, "wallet owner incorrect");

    // Try to create the wallet again
    await expectThrow(
      executeTransaction(
        ctx.walletFactoryModule.contract.methods.createWallet(
          owner,
          "",
          Constants.emptyBytes,
          []
        ),
        ctx,
        useMetaTx,
        wallet,
        [owner],
        { from: owner, gasPrice: new BN(1) }
      ),
      useMetaTx ? "UNAUTHORIZED" : "CREATE2_FAILED"
    );
  };

  const description = (descr: string, metaTx: boolean = useMetaTx) => {
    return descr + (metaTx ? " (meta tx)" : "");
  };

  before(async () => {
    defaultCtx = await getContext();
  });

  beforeEach(async () => {
    ctx = await createContext(defaultCtx);
  });

  [false, true].forEach(function(metaTx) {
    it(
      description("user should be able to create a wallet without ENS", metaTx),
      async () => {
        useMetaTx = metaTx;
        await createWalletChecked(ctx.owners[0]);
      }
    );

    it(
      description("user should be able to create a wallet with ENS", metaTx),
      async () => {
        useMetaTx = metaTx;
        await createWalletChecked(
          ctx.owners[0],
          "MyWallet" + (useMetaTx ? "A" : "B")
        );
      }
    );
  });

  describe("anyone", () => {
    it("should not be able to create a wallet for the owner", async () => {
      const owner = ctx.owners[0];
      const wallet = await ctx.walletFactoryModule.computeWalletAddress(owner);
      await expectThrow(
        executeTransaction(
          ctx.walletFactoryModule.contract.methods.createWallet(
            owner,
            "",
            Constants.emptyBytes,
            []
          ),
          ctx,
          false,
          wallet,
          [owner],
          { from: ctx.owners[1] }
        ),
        "NOT_FROM_METATX_OR_OWNER"
      );
    });
  });
});
