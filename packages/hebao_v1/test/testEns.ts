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
      const wallet = await ctx.walletFactory.computeWalletAddress(owner, 0);
      const walletName = "mywalleta" + new Date().getTime();
      const modules: string[] = [ctx.finalSecurityModule.address];

      // sign with non-manager address:
      let signer = ctx.miscAddresses[1];
      let ensApproval = await getEnsApproval(wallet, walletName, signer);
      let txSignature = signCreateWallet(
        ctx.walletFactory.address,
        owner,
        0,
        walletName,
        ensApproval,
        true,
        modules
      );

      await expectThrow(
        executeTransaction(
          ctx.walletFactory.contract.methods.createWallet(
            owner,
            0,
            walletName,
            ensApproval,
            true,
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
        ctx.walletFactory.address,
        owner,
        0,
        walletName,
        ensApproval,
        true,
        modules
      );

      await executeTransaction(
        ctx.walletFactory.contract.methods.createWallet(
          owner,
          0,
          walletName,
          ensApproval,
          true,
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

    it("will be able get address by ens subdomain ans vice versa", async () => {
      // ethers.utils.namehash only support the characters [a-z0-9.-],
      // so only there characters are allowed in our walletName.
      // see https://docs.ethers.io/ethers.js/html/api-utils.html#namehash
      const owner = ctx.miscAddresses[1];
      const wallet = await ctx.walletFactory.computeWalletAddress(owner, 0);
      const walletName = "mywalleta" + new Date().getTime();
      const modules: string[] = [ctx.finalSecurityModule.address];

      const signer = ctx.owners[0];
      const ensApproval = await getEnsApproval(wallet, walletName, signer);
      const txSignature = signCreateWallet(
        ctx.walletFactory.address,
        owner,
        0,
        walletName,
        ensApproval,
        true,
        modules
      );

      await executeTransaction(
        ctx.walletFactory.contract.methods.createWallet(
          owner,
          0,
          walletName,
          ensApproval,
          true,
          modules,
          txSignature
        ),
        ctx,
        false,
        wallet,
        [owner],
        { from: owner, gasPrice: new BN(1) }
      );

      // const allEvents = await ctx.walletFactory.contract.getPastEvents("allEvents", {
      //   fromBlock: web3.eth.blockNumber,
      //   toBlock: web3.eth.blockNumber
      // });
      // console.log(`allEvents: ${allEvents}`);

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
