import {
  Context,
  getContext,
  createContext,
  createWallet,
  executeTransaction,
  sortAddresses
} from "./helpers/TestUtils";
import { addGuardian } from "./helpers/GuardianUtils";
import { expectThrow } from "../util/expectThrow";
import { SignedRequest, signAddToWhitelistWA } from "./helpers/SignatureUtils";

contract("GuardianUtils", (accounts: string[]) => {
  let defaultCtx: Context;
  let ctx: Context;

  before(async () => {
    defaultCtx = await getContext();
  });

  beforeEach(async () => {
    ctx = await createContext(defaultCtx);
  });

  it("should only be able to use the wallet owner and guardians for majority", async () => {
    const owner = ctx.owners[0];
    const { wallet, guardians } = await createWallet(ctx, owner, 3);

    // Add to the whitelist
    const addr = ctx.guardians[10];
    const signers = [owner, ...guardians, ctx.miscAddresses[0]].sort();

    const request: SignedRequest = {
      signers,
      signatures: [],
      validUntil: Math.floor(new Date().getTime()) + 3600 * 24 * 30,
      wallet
    };

    signAddToWhitelistWA(request, addr, ctx.finalSecurityModule.address);

    await expectThrow(
      executeTransaction(
        ctx.finalSecurityModule.contract.methods.addToWhitelistWA(
          request,
          addr
        ),
        ctx,
        false,
        wallet,
        [],
        { from: owner }
      ),
      "SIGNER_NOT_GUARDIAN"
    );
  });

  it("when owner is requied but not included in signers", async () => {
    const owner = ctx.owners[0];
    const { wallet, guardians } = await createWallet(ctx, owner, 3);

    // Add to the whitelist
    const addr = ctx.guardians[10];
    const signers = guardians.sort();

    const request: SignedRequest = {
      signers,
      signatures: [],
      validUntil: Math.floor(new Date().getTime()) + 3600 * 24 * 30,
      wallet
    };

    signAddToWhitelistWA(request, addr, ctx.finalSecurityModule.address);

    await expectThrow(
      executeTransaction(
        ctx.finalSecurityModule.contract.methods.addToWhitelistWA(
          request,
          addr
        ),
        ctx,
        false,
        wallet,
        [],
        { from: owner }
      ),
      "WALLET_OWNER_SIGNATURE_REQUIRED"
    );
  });

  it("when owner is requied, owner is used in majority computing", async () => {
    const owner = ctx.owners[0];
    const { wallet, guardians } = await createWallet(ctx, owner, 3);

    // Add to the whitelist
    const addr = ctx.guardians[10];
    const signers = [owner, ...guardians.slice(0, 2)].sort();

    const request: SignedRequest = {
      signers,
      signatures: [],
      validUntil: Math.floor(new Date().getTime()) + 3600 * 24 * 30,
      wallet
    };

    signAddToWhitelistWA(request, addr, ctx.finalSecurityModule.address);

    executeTransaction(
      ctx.finalSecurityModule.contract.methods.addToWhitelistWA(request, addr),
      ctx,
      false,
      wallet,
      [],
      { from: owner }
    );
  });
});
