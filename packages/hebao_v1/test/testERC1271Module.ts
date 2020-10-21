import {
  Context,
  getContext,
  createContext,
  executeTransaction,
  toAmount,
  createWallet
} from "./helpers/TestUtils";
import BN = require("bn.js");
import ethUtil = require("ethereumjs-util");
import { expectThrow } from "../util/expectThrow";
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";
import { sign, SignatureType } from "./helpers/Signature";

contract("ERC1271Module", () => {
  let defaultCtx: Context;
  let ctx: Context;

  const MAGICVALUE = "0x20c13b0b";
  const MAGICVALUE_B32 = "0x1626ba7e";
  const FAILEDVALUE = "0x00000000";

  before(async () => {
    defaultCtx = await getContext();
    ctx = await createContext(defaultCtx);
  });

  beforeEach(async () => {
    ctx = await createContext(defaultCtx);
  });

  describe("Wallet", () => {
    it("should be able to verify a signature signed by wallet owner", async () => {
      const owner = ctx.owners[0];
      const { wallet, guardians } = await createWallet(ctx, owner, 2);
      const hash = ethUtil.keccak("1234");
      const sig = sign(owner, hash);

      // convert wallet to a ERC1271 module then it can invoke the isValidSignature method
      const walletContract = await ctx.contracts.FinalCoreModule.at(wallet);
      const isValid = await walletContract.contract.methods[
        "isValidSignature(bytes32,bytes)"
      ](hash, sig).call();
      assert.equal(MAGICVALUE_B32, isValid, "signature verify failed.");
    });

    it("should not able to verify a signature when wallet is locked", async () => {
      const owner = ctx.owners[1];
      const { wallet, guardians } = await createWallet(ctx, owner, 2);
      const hash = ethUtil.keccak("1234");
      const sig = sign(owner, hash);

      const defaultLockPeriod = (
        await ctx.finalSecurityModule.LOCK_PERIOD()
      ).toNumber();

      const walletContract = await ctx.contracts.FinalCoreModule.at(wallet);

      // lock wallet:
      await ctx.finalSecurityModule.contract.methods.lock(wallet).send({
        from: guardians[0],
        gas: 1000000,
        gasPrice: 10e9
      });
      assert(
        await ctx.finalSecurityModule.isLocked(wallet),
        "wallet needs to be locked"
      );
      const isValidBefore = await walletContract.contract.methods[
        "isValidSignature(bytes32,bytes)"
      ](hash, sig).call();
      assert.equal(
        FAILEDVALUE,
        isValidBefore,
        "verification should be failed, but succeeded."
      );

      // unlock
      await advanceTimeAndBlockAsync(defaultLockPeriod);

      // verify agian:
      const isValidAfter = await walletContract.contract.methods[
        "isValidSignature(bytes32,bytes)"
      ](hash, sig).call();
      assert.equal(MAGICVALUE_B32, isValidAfter, "signature verify failed.");
    });
  });
});
