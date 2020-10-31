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

const tests = [
  {
    description: "Group 0 (no majority)",
    ownerSigns: true,
    guardians: [
      { group: 0, signs: true },
      { group: 0, signs: false },
      { group: 0, signs: false }
    ],
    success: false
  },
  {
    description: "Group 0 (majority)",
    ownerSigns: true,
    guardians: [
      { group: 0, signs: true },
      { group: 0, signs: true },
      { group: 0, signs: false }
    ],
    success: true
  },
  {
    description: "Group 1 (no majority)",
    ownerSigns: true,
    guardians: [
      { group: 1, signs: false },
      { group: 1, signs: false },
      { group: 1, signs: false }
    ],
    success: false
  },
  {
    description: "Group 1 (majority)",
    ownerSigns: true,
    guardians: [
      { group: 1, signs: false },
      { group: 1, signs: true },
      { group: 1, signs: false }
    ],
    success: true
  },
  {
    description: "Group 7 (no majority)",
    ownerSigns: true,
    guardians: [
      { group: 7, signs: false },
      { group: 7, signs: false },
      { group: 7, signs: false },
      { group: 7, signs: true }
    ],
    success: false
  },
  {
    description: "Group 7 (majority)",
    ownerSigns: true,
    guardians: [
      { group: 7, signs: true },
      { group: 7, signs: false },
      { group: 7, signs: false },
      { group: 7, signs: true }
    ],
    success: true
  },
  {
    description: "Group 11 (no majority)",
    ownerSigns: true,
    guardians: [
      { group: 11, signs: false },
      { group: 11, signs: true },
      { group: 11, signs: false },
      { group: 11, signs: true }
    ],
    success: false
  },
  {
    description: "Group 11 (no majority)",
    ownerSigns: true,
    guardians: [
      { group: 11, signs: false },
      { group: 11, signs: true },
      { group: 11, signs: true },
      { group: 11, signs: true }
    ],
    success: true
  },
  {
    description: "Multiple same type groups (groups 1-5) (no majority)",
    ownerSigns: true,
    guardians: [
      { group: 2, signs: false },
      { group: 2, signs: false },
      { group: 3, signs: false },
      { group: 3, signs: true },
      { group: 5, signs: false }
    ],
    success: false
  },
  {
    description: "Multiple same type groups (groups 1-5) (majority)",
    ownerSigns: true,
    guardians: [
      { group: 2, signs: false },
      { group: 2, signs: false },
      { group: 3, signs: false },
      { group: 3, signs: true },
      { group: 5, signs: true }
    ],
    success: true
  },
  {
    description:
      "Complex with multiple groups with different types (no majority)",
    ownerSigns: true,
    guardians: [
      { group: 0, signs: true },
      { group: 3, signs: false },
      { group: 3, signs: true },
      { group: 5, signs: false },
      { group: 7, signs: false },
      { group: 10, signs: false },
      { group: 10, signs: false },
      { group: 15, signs: false },
      { group: 15, signs: true },
      { group: 15, signs: false }
    ],
    success: false
  },
  {
    description: "Complex with multiple groups with different types (majority)",
    ownerSigns: true,
    guardians: [
      { group: 0, signs: false },
      { group: 3, signs: false },
      { group: 3, signs: true },
      { group: 5, signs: false },
      { group: 7, signs: true },
      { group: 10, signs: false },
      { group: 10, signs: false },
      { group: 15, signs: false },
      { group: 15, signs: true },
      { group: 15, signs: true }
    ],
    success: true
  }
];

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

  tests.forEach(function(test) {
    it(test.description, async () => {
      const owner = ctx.owners[0];
      const { wallet } = await createWallet(ctx, owner, 0);

      let signers: string[] = test.ownerSigns ? [owner] : [];
      for (const [i, guardian] of test.guardians.entries()) {
        await addGuardian(ctx, owner, wallet, ctx.guardians[i]);
        if (guardian.signs) {
          signers.push(ctx.guardians[i]);
        }
      }
      signers = sortAddresses(signers);
      const request: SignedRequest = {
        signers,
        signatures: [],
        validUntil: Math.floor(new Date().getTime()) + 3600 * 24 * 30,
        wallet
      };

      const addr = ctx.miscAddresses[0];
      signAddToWhitelistWA(request, addr, ctx.finalSecurityModule.address);

      const transaction = executeTransaction(
        ctx.finalSecurityModule.contract.methods.addToWhitelistWA(
          request,
          ctx.miscAddresses[0]
        ),
        ctx,
        false,
        wallet,
        [],
        { from: owner }
      );
      if (test.success) {
        await transaction;
      } else {
        await expectThrow(transaction, "NOT_ENOUGH_SIGNERS");
      }
    });
  });
});
