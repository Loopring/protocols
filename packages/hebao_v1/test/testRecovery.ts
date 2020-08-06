import {
  Context,
  createContext,
  executeTransaction,
  toAmount,
  createWallet
} from "./helpers/TestUtils";
import { addGuardian } from "./helpers/GuardianUtils";
import { transferFrom } from "./helpers/TokenUtils";
import { assertEventEmitted } from "../util/Events";
import { expectThrow } from "../util/expectThrow";
import { Constants } from "./helpers/Constants";
import { SignedRequest, signRecover } from "./helpers/SignatureUtils";
import BN = require("bn.js");

contract("GuardianModule - Recovery", (accounts: string[]) => {
  let ctx: Context;
  let useMetaTx: boolean;

  const description = (descr: string, metaTx: boolean = useMetaTx) => {
    return descr + (metaTx ? " (meta tx)" : "");
  };

  beforeEach(async () => {
    ctx = await createContext();
  });

  [false, true].forEach(function(metaTx) {
    it(
      description(
        "should be able to recover wallet using a majority of guardians"
      ),
      async () => {
        useMetaTx = metaTx;
        const owner = ctx.owners[0];
        const walletAddr = await ctx.walletFactory.computeWalletAddress(
          owner,
          0
        );
        const { wallet } = await createWallet(ctx, owner);

        const newOwner = ctx.owners[1];
        const guardians = ctx.guardians.slice(0, 3);
        const group = 0;

        const metaTxSigner = ctx.miscAddresses[1];
        const { wallet: metaTxSendWallet } = await createWallet(
          ctx,
          metaTxSigner
        );
        if (useMetaTx) {
          // Transfer 0.1 ETH to the wallet to pay for the wallet creation
          await transferFrom(
            ctx,
            metaTxSigner,
            metaTxSendWallet,
            "ETH",
            toAmount("0.1")
          );
        }

        // Add the guardians
        for (const guardian of guardians) {
          await addGuardian(ctx, owner, wallet, guardian, group, true);
        }

        // Recover
        const numSignersRequired = Math.floor(guardians.length / 2 + 1);
        for (let i = 1; i <= numSignersRequired; i++) {
          const signers = guardians.slice(0, i).sort();
          const request: SignedRequest = {
            signers,
            signatures: [],
            validUntil: Math.floor(new Date().getTime()) + 3600 * 24 * 30,
            wallet
          };
          signRecover(request, newOwner, ctx.finalSecurityModule.address);

          const transaction = executeTransaction(
            ctx.finalSecurityModule.contract.methods.recover(request, newOwner),
            ctx,
            useMetaTx,
            wallet,
            [],
            {
              from: owner,
              owner: metaTxSigner,
              wallet: metaTxSendWallet,
              gasPrice: new BN(1)
            }
          );

          if (signers.length >= numSignersRequired) {
            await transaction;
            await assertEventEmitted(
              ctx.finalSecurityModule,
              "Recovered",
              (event: any) => {
                return event.wallet === wallet && event.newOwner === newOwner;
              }
            );
          } else {
            if (!useMetaTx) {
              await expectThrow(transaction, "NOT_ENOUGH_SIGNERS");
            }
          }
        }

        // Check if the new owner is now active
        const walletContract = await ctx.contracts.WalletImpl.at(wallet);
        assert.equal(
          await walletContract.owner(),
          newOwner,
          "wallet owner incorrect"
        );
      }
    );
  });
});
