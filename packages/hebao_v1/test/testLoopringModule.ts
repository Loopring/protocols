import {
  Context,
  getContext,
  createContext,
  createWallet,
  executeTransaction,
  description
} from "./helpers/TestUtils";
import BN = require("bn.js");
import { ethers } from "ethers";
import { getEventsFromContract, assertEventEmitted } from "../util/Events";

const LoopringModule = artifacts.require("LoopringModule");
const DummyExchange = artifacts.require("test/DummyExchange");

contract("LoopringModule", () => {
  let defaultCtx: Context;
  let ctx: Context;
  let loopringModule: any;
  let dummyExchange: any;

  before(async () => {
    defaultCtx = await getContext();
    loopringModule = await LoopringModule.new(
      defaultCtx.controllerImpl.address
    );
    dummyExchange = await DummyExchange.new(defaultCtx.controllerImpl.address);

    await defaultCtx.moduleRegistryImpl.registerModule(loopringModule.address);
  });

  beforeEach(async () => {
    ctx = await createContext(defaultCtx);
  });

  [false, true].forEach(function(metaTx) {
    it(
      description(
        "wallet should be able to register or update an account in loopring exchange",
        true
      ),
      async () => {
        const owner = ctx.owners[0];
        const { wallet } = await createWallet(ctx, owner);
        const walletContract = await ctx.contracts.BaseWallet.at(wallet);
        await walletContract.addModule(loopringModule.address, {
          from: owner
        });

        await executeTransaction(
          loopringModule.contract.methods.createOrUpdateDEXAccount(
            wallet,
            dummyExchange.address,
            0,
            0,
            []
          ),
          ctx,
          true,
          wallet,
          [owner],
          { from: owner }
        );

        await assertEventEmitted(loopringModule, "AccountUpdated");
        const result = await loopringModule.getDEXAccount(
          wallet,
          dummyExchange.address
        );
        // console.log("result:", result);
        assert(
          result.accountId.toNumber() > 0,
          "wallet not registered as an account"
        );
      }
    );

    it(
      description(
        "wallet should be able to deposit in a loopring exchange",
        metaTx
      ),
      async () => {
        const owner = ctx.owners[0];
        const { wallet } = await createWallet(ctx, owner);
        const walletContract = await ctx.contracts.BaseWallet.at(wallet);
        await walletContract.addModule(loopringModule.address, {
          from: owner
        });

        await web3.eth.sendTransaction({
          from: owner,
          to: wallet,
          value: "1" + "0".repeat(20)
        });
        await executeTransaction(
          loopringModule.contract.methods.depositToDEX(
            wallet,
            dummyExchange.address,
            "0x" + "00".repeat(20),
            "1" + "0".repeat(20)
          ),
          ctx,
          true,
          wallet,
          [owner],
          { from: owner }
        );

        await assertEventEmitted(loopringModule, "Deposit");
      }
    );

    it(
      description(
        "wallet should be able to do withdrawal in a loopring exchange",
        metaTx
      ),
      async () => {
        const owner = ctx.owners[0];
        const { wallet } = await createWallet(ctx, owner);
        const walletContract = await ctx.contracts.BaseWallet.at(wallet);
        await walletContract.addModule(loopringModule.address, {
          from: owner
        });

        await executeTransaction(
          loopringModule.contract.methods.withdrawFromDEX(
            wallet,
            dummyExchange.address,
            "0x" + "00".repeat(20),
            "1" + "0".repeat(20)
          ),
          ctx,
          true,
          wallet,
          [owner],
          { from: owner }
        );

        await assertEventEmitted(loopringModule, "Withdrawal");
      }
    );

    it(
      description(
        "wallet should be able to approve token to an exchange",
        metaTx
      ),
      async () => {
        const owner = ctx.owners[0];
        const { wallet } = await createWallet(ctx, owner);
        const walletContract = await ctx.contracts.BaseWallet.at(wallet);
        await walletContract.addModule(loopringModule.address, {
          from: owner
        });

        await executeTransaction(
          loopringModule.contract.methods.approveExchange(
            wallet,
            dummyExchange.address,
            ctx.contracts.LRCToken.address,
            "1" + "0".repeat(20)
          ),
          ctx,
          true,
          wallet,
          [owner],
          { from: owner }
        );

        await assertEventEmitted(loopringModule, "Approval");
      }
    );
  });
});
