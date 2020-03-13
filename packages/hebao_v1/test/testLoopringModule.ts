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
  });

  beforeEach(async () => {
    ctx = await createContext(defaultCtx);
    loopringModule = await LoopringModule.new(ctx.controllerImpl.address);
    console.log("loopringModule: ", loopringModule.address);
    dummyExchange = await DummyExchange.new(ctx.controllerImpl.address);
  });

  [false, true].forEach(function(metaTx) {
    it(
      description("wallet should be able to register an account", metaTx),
      async () => {
        const owner = ctx.owners[0];
        const { wallet } = await createWallet(ctx, owner);

        await executeTransaction(
          loopringModule.contract.methods.createOrUpdateDEXAccount(
            wallet,
            dummyExchange.address,
            0,
            0,
            []
          ),
          ctx,
          metaTx,
          wallet,
          [owner],
          { from: owner }
        );
      }
    );

    //   it(
    //     description("wallet should be able to update an account", metaTx),
    //     async () => {

    //     }
    //   );

    //   it(
    //     description("wallet should be able to deposit", metaTx),
    //     async () => {

    //     }
    //   );

    //   it(
    //     description("wallet should be able to do withdrawal", metaTx),
    //     async () => {

    //     }
    //   );
  });
});
