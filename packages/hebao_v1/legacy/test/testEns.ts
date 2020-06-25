import {
  Context,
  getContext,
  createContext,
  executeTransaction,
  toAmount,
  getEnsApproval
} from "./helpers/TestUtils";
import BN = require("bn.js");
import { ethers } from "ethers";
import { getEventsFromContract, assertEventEmitted } from "../util/Events";
import { expectThrow } from "../util/expectThrow";
import { Constants } from "./helpers/Constants";
import { sign, SignatureType } from "./helpers/Signature";

contract("WalletENSManager", () => {
  let defaultCtx: Context;
  let ctx: Context;
  const walletDomain = ".loopring.eth";

  before(async () => {
    defaultCtx = await getContext();
    ctx = await createContext(defaultCtx);
  });

  describe("WalletENSManager", () => {
    it("should only be able to register ENS by manager", async () => {
      const owner = ctx.miscAddresses[0];
      const wallet = await ctx.walletFactoryModule.computeWalletAddress(owner);
      const walletName = "mywalleta" + new Date().getTime();

      // sign with non-manager address:
      let signer = ctx.miscAddresses[1];
      let signature = await getEnsApproval(wallet, walletName, signer);
      await expectThrow(
        executeTransaction(
          ctx.walletFactoryModule.contract.methods.createWallet(
            owner,
            walletName,
            signature,
            []
          ),
          ctx,
          false,
          wallet,
          [owner],
          { from: owner, gasPrice: new BN(1) }
        ),
        "UNAUTHORIZED"
      );

      signer = ctx.owners[0];
      signature = await getEnsApproval(wallet, walletName, signer);
      await executeTransaction(
        ctx.walletFactoryModule.contract.methods.createWallet(
          owner,
          walletName,
          signature,
          []
        ),
        ctx,
        false,
        wallet,
        [owner],
        { from: owner, gasPrice: new BN(1) }
      );
    });

    it("will be able get address by ens subdomain ans vice versa", async () => {
      // ethers.utils.namehash only support the characters [a-z0-9.-],
      // so only there characters are allowed in our walletName.
      // see https://docs.ethers.io/ethers.js/html/api-utils.html#namehash
      const owner = ctx.miscAddresses[1];
      const wallet = await ctx.walletFactoryModule.computeWalletAddress(owner);
      const walletName = "mywalleta" + new Date().getTime();

      const signer = ctx.owners[0];
      const signature = await getEnsApproval(wallet, walletName, signer);

      await executeTransaction(
        ctx.walletFactoryModule.contract.methods.createWallet(
          owner,
          walletName,
          signature,
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

      const ensAddr = await ensManager.resolveEns(nameHash);
      assert.equal(ensAddr, wallet, "ens address not match");

      const fullNameFromENS = await ensManager.resolveName(wallet);
      assert.equal(fullNameFromENS, fullName, "ens name not match");
    });
  });
});
