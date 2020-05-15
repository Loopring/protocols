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
import { expectThrow } from "../util/expectThrow";
import { Constants } from "./helpers/Constants";
import { sign } from "./helpers/Signature";

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

      const hashBuf = Buffer.from(web3.utils.sha3(walletName).slice(2), "hex");

      // sign with non-manager address:
      let signer = ctx.miscAddresses[1];
      let signature = await sign(undefined, signer, hashBuf);
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
        "INVALID_ENS_SIGNER"
      );

      signer = ctx.owners[0];
      signature = await sign(undefined, signer, hashBuf);
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
      const owner = ctx.miscAddresses[0];
      const wallet = await ctx.walletFactoryModule.computeWalletAddress(owner);
      // console.log("wallet address:", wallet);
      const walletName = "mywalleta" + new Date().getTime();

      const signer = ctx.owners[0];
      const hashBuf = Buffer.from(web3.utils.sha3(walletName).slice(2), "hex");
      const signature = await sign(undefined, signer, hashBuf);

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
