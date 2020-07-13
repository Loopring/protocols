import BN = require("bn.js");
import {
  Context,
  getContext,
  createContext,
  executeTransaction,
  toAmount
} from "../helpers/TestUtils";
import { sign, SignatureType } from "../helpers/Signature";

const SignatureUtilWrapper = artifacts.require("SignatureUtilWrapper");

contract("signatureUtil", () => {
  let signatureUtilWrapper: any;
  let defaultCtx: Context;
  let ctx: Context;

  before(async () => {
    signatureUtilWrapper = await SignatureUtilWrapper.new();
    defaultCtx = await getContext();
    ctx = await createContext(defaultCtx);
  });

  describe("recoverECDSASigner", () => {
    it("should be able to recover the signer from an ecdsa signature (ETH_SIGN)", async () => {
      const src = "walletname.123";
      const signer = ctx.owners[0];
      const hashStr = web3.utils.sha3(src);
      const hashBuf = Buffer.from(hashStr.slice(2), "hex");
      const signatureStr = await sign(signer, hashBuf, SignatureType.ETH_SIGN);

      const verifyRes = await signatureUtilWrapper.verifySignature(
        hashStr,
        signer,
        signatureStr
      );

      assert(verifyRes, "verifySignature failed");

      const recoveredAddress = await signatureUtilWrapper.recoverECDSASigner(
        hashStr,
        signatureStr
      );
      assert.equal(
        signer,
        recoveredAddress,
        "recovered address not equal to signer"
      );
    });

    it("should be able to recover the signer from an ecdsa signature (EIP_712)", async () => {
      const src = "walletname.123";
      const signer = ctx.owners[0];
      const hashStr = web3.utils.sha3(src);
      const hashBuf = Buffer.from(hashStr.slice(2), "hex");
      const signatureStr = await sign(signer, hashBuf);

      const verifyRes = await signatureUtilWrapper.verifySignature(
        hashStr,
        signer,
        signatureStr
      );

      assert(verifyRes, "verifySignature failed");

      const recoveredAddress = await signatureUtilWrapper.recoverECDSASigner(
        hashStr,
        signatureStr
      );
      assert.equal(
        signer,
        recoveredAddress,
        "recovered address not equal to signer"
      );
    });
  });
});
