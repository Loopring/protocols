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
import { signCreateWallet } from "./helpers/SignatureUtils";

contract("WalletFactory", () => {
  let defaultCtx: Context;
  let ctx: Context;

  let useMetaTx: boolean = false;
  const walletDomain = ".loopring.eth";

  const createWalletChecked = async (
    owner: string,
    walletName: string = ""
  ) => {
    const wallet = await ctx.walletFactory.computeWalletAddress(owner);

    if (useMetaTx) {
      // Transfer 0.1 ETH to the wallet to pay for the wallet creation
      await transferFrom(ctx, owner, wallet, "ETH", toAmount("0.1"));
    }

    const modules = [
      ctx.guardianModule.address,
      ctx.whitelistModule.address,
      ctx.quotaTransferModule.address,
      ctx.approvedTransferModule.address,
      ctx.dappTransferModule.address,
      ctx.erc1271Module.address
    ];

    const signer = ctx.owners[0];
    const ensApproval = await getEnsApproval(wallet, walletName, signer);
    const txSignature = signCreateWallet(
      ctx.walletFactory.address,
      owner,
      walletName,
      ensApproval,
      modules
    );

    const tx = await executeTransaction(
      ctx.walletFactory.contract.methods.createWallet(
        owner,
        walletName,
        ensApproval,
        modules,
        txSignature
      ),
      ctx,
      useMetaTx,
      wallet,
      [],
      { owner, wallet, from: owner, gasPrice: new BN(1) }
    );

    console.log("tx gas usage: ", tx.gasUsed);

    await assertEventEmitted(
      ctx.walletFactory,
      "WalletCreated",
      (event: any) => {
        return event.wallet === wallet && event.owner === owner;
      }
    );
    if (walletName !== "") {
      await assertEventEmitted(
        ctx.baseENSManager,
        "Registered",
        (event: any) => {
          return (
            event._ens === walletName + walletDomain && event._owner === wallet
          );
        }
      );
    } else {
      await assertNoEventEmitted(ctx.baseENSManager, "Registered");
    }

    const walletContract = await ctx.contracts.WalletImpl.at(wallet);
    assert.equal(await walletContract.owner(), owner, "wallet owner incorrect");

    // Try to create the wallet again
    await expectThrow(
      executeTransaction(
        ctx.walletFactory.contract.methods.createWallet(
          owner,
          walletName,
          ensApproval,
          modules,
          txSignature
        ),
        ctx,
        useMetaTx,
        wallet,
        [],
        { owner, wallet, from: owner, gasPrice: new BN(1) }
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
    // it(
    //   description("user should be able to create a wallet without ENS", metaTx),
    //   async () => {
    //     useMetaTx = metaTx;
    //     await createWalletChecked(ctx.owners[0]);
    //   }
    // );

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

  // describe("anyone", () => {
  //   it("should not be able to create a wallet for the owner", async () => {
  //     const owner = ctx.owners[0];
  //     const wallet = await ctx.walletFactory.computeWalletAddress(owner);
  //     await expectThrow(
  //       executeTransaction(
  //         ctx.walletFactory.contract.methods.createWallet(
  //           owner,
  //           "",
  //           Constants.emptyBytes,
  //           []
  //         ),
  //         ctx,
  //         false,
  //         wallet,
  //         [owner],
  //         { from: ctx.owners[1] }
  //       ),
  //       "NOT_FROM_METATX_OR_OWNER"
  //     );
  //   });
  // });
});
