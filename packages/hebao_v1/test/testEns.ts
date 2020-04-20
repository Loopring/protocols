import {
  Context,
  getContext,
  createContext,
  executeTransaction,
  toAmount
} from "./helpers/TestUtils";
import BN = require("bn.js");
import { ethers } from "ethers";
import { getEventsFromContract, assertEventEmitted } from "../util/Events";

contract("WalletENSManager", () => {
  let defaultCtx: Context;
  let ctx: Context;
  const walletDomain = ".loopring.io";
  const walletName = "mywalleta" + new Date().getTime();

  before(async () => {
    defaultCtx = await getContext();
    ctx = await createContext(defaultCtx);
  });

  // beforeEach(async () => {

  // });

  describe("WalletENSManager", () => {
    it("will be able get address by ens subdomain ans vice versa", async () => {
      // ethers.utils.namehash only support the characters [a-z0-9.-],
      // so only there characters are allowed in our walletName.
      // see https://docs.ethers.io/ethers.js/html/api-utils.html#namehash
      const owner = ctx.owners[0];
      const wallet = await ctx.walletFactoryModule.computeWalletAddress(owner);
      // console.log("wallet address:", wallet);
      await executeTransaction(
        ctx.walletFactoryModule.contract.methods.createWallet(
          owner,
          walletName,
          []
        ),
        ctx,
        false,
        wallet,
        [owner],
        { from: owner, gasPrice: new BN(1) }
      );

      const ensManager = ctx.walletENSManager;
      const fullName = walletName + walletDomain;
      const nameHash = ethers.utils.namehash(fullName);
      // console.log("nameHash:", nameHash);
      const ensAddr = await ensManager.resolveEns(nameHash);
      // console.log("ensAddr:", ensAddr);
      assert.equal(ensAddr, wallet, "ens address not match");

      const fullNameFromENS = await ensManager.resolveName(wallet);
      // console.log("fullNameFromENS:", fullNameFromENS);
      assert.equal(fullNameFromENS, fullName, "ens name not match");
    });
  });
});
