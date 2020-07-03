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
import { signCreateWallet } from "./helpers/SignatureUtils";
import util = require("util");

contract("BaseENSManager", () => {
  let defaultCtx: Context;
  let ctx: Context;
  const walletDomain = ".loopring.eth";

  before(async () => {
    defaultCtx = await getContext();
    ctx = await createContext(defaultCtx);
  });

  describe("BaseENSManager", () => {
    it("should only be able to register ENS by manager", async () => {
      const owner = ctx.miscAddresses[0];
      const wallet = await ctx.walletFactoryModule.computeWalletAddress(owner);
      const walletName = "mywalleta" + new Date().getTime();
      const modules: string[] = [ctx.guardianModule.address];

      // sign with non-manager address:
      let signer = ctx.miscAddresses[1];
      let ensApproval = await getEnsApproval(wallet, walletName, signer);
      let txSignature = signCreateWallet(
        ctx.walletFactoryModule.address,
        owner,
        walletName,
        ensApproval,
        modules
      );

      await expectThrow(
        executeTransaction(
          ctx.walletFactoryModule.contract.methods.createWallet(
            owner,
            walletName,
            ensApproval,
            modules,
            txSignature
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
      ensApproval = await getEnsApproval(wallet, walletName, signer);
      txSignature = signCreateWallet(
        ctx.walletFactoryModule.address,
        owner,
        walletName,
        ensApproval,
        modules
      );

      await executeTransaction(
        ctx.walletFactoryModule.contract.methods.createWallet(
          owner,
          walletName,
          ensApproval,
          modules,
          txSignature
        ),
        ctx,
        false,
        wallet,
        [owner],
        { from: owner, gasPrice: new BN(0), gasLimit: 6700000 }
      );
    });

    it.only("will be able get address by ens subdomain ans vice versa", async () => {
      // ethers.utils.namehash only support the characters [a-z0-9.-],
      // so only there characters are allowed in our walletName.
      // see https://docs.ethers.io/ethers.js/html/api-utils.html#namehash
      const owner = ctx.miscAddresses[1];
      const wallet = await ctx.walletFactoryModule.computeWalletAddress(owner);
      const walletName = "mywalleta" + new Date().getTime();
      const modules: string[] = [ctx.guardianModule.address];

      const signer = ctx.owners[0];
      const ensApproval = await getEnsApproval(wallet, walletName, signer);
      const txSignature = signCreateWallet(
        ctx.walletFactoryModule.address,
        owner,
        walletName,
        ensApproval,
        modules
      );

      await executeTransaction(
        ctx.walletFactoryModule.contract.methods.createWallet(
          {
            owner,
            label: walletName,
            labelApproval: ensApproval,
            modules
          },
          txSignature
        ),
        ctx,
        false,
        wallet,
        [owner],
        { from: owner, gasPrice: new BN(1) }
      );

      const ensManager = ctx.baseENSManager;
      const fullName = walletName + walletDomain;
      const nameHash = ethers.utils.namehash(fullName);

      const ensAddr = await ensManager.resolveEns(nameHash);
      assert.equal(ensAddr, wallet, "ens address not match");

      const fullNameFromENS = await ensManager.resolveName(wallet);
      assert.equal(fullNameFromENS, fullName, "ens name not match");
    });
  });
});
