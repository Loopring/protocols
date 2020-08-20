import BN = require("bn.js");
import { Context, getContext, createContext } from "./helpers/TestUtils";
import { assertEventEmitted } from "../util/Events";
import { Constants } from "./helpers/Constants";

contract("BlankWalletFactory", (accounts: string[]) => {
  let defaultCtx: Context;
  let ctx: Context;
  let blankWalletFactory: any;

  before(async () => {
    defaultCtx = await getContext();
    const BlankWalletFactory = artifacts.require("BlankWalletFactory");
    blankWalletFactory = await BlankWalletFactory.new(
      defaultCtx.controllerImpl.address,
      defaultCtx.walletImpl.address
    );
    await defaultCtx.walletRegistryImpl.setBlankWalletFactory(
      blankWalletFactory.address,
      { from: accounts[0] } // owner
    );
  });

  beforeEach(async () => {
    ctx = await createContext(defaultCtx);
  });

  describe("createWallet", async () => {
    it("anyone should be able to create a blank wallet with modules", async () => {
      const owner = ctx.owners[0];

      const wallet = await blankWalletFactory.computeWalletAddress(0, {
        from: owner
      });
      // console.log('wallet', wallet);

      const modules = [
        ctx.finalSecurityModule.address,
        ctx.finalTransferModule.address,
        ctx.finalCoreModule.address
      ];

      await blankWalletFactory.createWallet(0, modules, { from: owner });

      await assertEventEmitted(
        blankWalletFactory,
        "BlankWalletCreated",
        (event: any) => {
          return event.wallet === wallet;
        }
      );

      const walletImpl = await ctx.contracts.WalletImpl.at(wallet);
      const walletOwner = await walletImpl.owner();
      assert.equal(
        Constants.zeroAddress,
        walletOwner,
        "owner should be zero address for blank wallet"
      );
      for (const _module of modules) {
        const hasModule = await walletImpl.hasModule(_module);
        assert(hasModule, "init module not added");
      }
    });
  });
});
