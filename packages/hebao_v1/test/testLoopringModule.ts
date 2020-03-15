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
    await defaultCtx.securityStore.addManager(loopringModule.address);
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
  });
});
