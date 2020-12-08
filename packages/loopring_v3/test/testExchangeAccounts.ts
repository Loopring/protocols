import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { AuthMethod } from "./types";

contract("Exchange", (accounts: string[]) => {
  let ctx: ExchangeTestUtil;
  let exchangeID = 0;
  let operatorAccountID: number;
  let operator: string;

  let ownerA: string;
  let ownerB: string;
  let ownerC: string;
  let ownerD: string;

  const createExchange = async (setupTestState: boolean = true) => {
    exchangeID = await ctx.createExchange(ctx.testContext.stateOwners[0], {
      setupTestState
    });
    operatorAccountID = await ctx.getActiveOperator(exchangeID);
    operator = ctx.getAccount(operatorAccountID).owner;
  };

  before(async () => {
    ctx = new ExchangeTestUtil();
    await ctx.initialize(accounts);
    exchangeID = 1;

    ownerA = ctx.testContext.orderOwners[0];
    ownerB = ctx.testContext.orderOwners[1];
    ownerC = ctx.testContext.orderOwners[2];
    ownerD = ctx.testContext.orderOwners[3];
  });

  after(async () => {
    await ctx.stop();
  });

  describe("Accounts", function() {
    this.timeout(0);

    it("Should be able to create an account", async () => {
      await createExchange();

      const token = ctx.getTokenAddress("LRC");
      const fee = new BN(0);

      // Create the account
      let newKeyPair = ctx.getKeyPairEDDSA();
      await ctx.requestAccountUpdate(ownerA, token, fee, newKeyPair, {
        authMethod: AuthMethod.ECDSA
      });

      // Submit
      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

      // Try to create the account with EdDSA
      await ctx.requestAccountUpdate(ownerB, token, fee, newKeyPair, {
        authMethod: AuthMethod.EDDSA
      });

      // Submit
      await expectThrow(ctx.submitTransactions(), "invalid block");
    });

    it("Should be able to update an account", async () => {
      await createExchange();

      const balance = new BN(web3.utils.toWei("5484.24", "ether"));
      const token = ctx.getTokenAddress("LRC");
      const fee = ctx.getRandomFee();

      // Fund the payer
      await ctx.deposit(ownerA, ownerA, token, balance);

      // Send some funds over to the new account
      await ctx.transfer(
        ownerA,
        ownerB,
        token,
        fee.mul(new BN(10)),
        token,
        fee,
        { transferToNew: true }
      );

      // Update the key pair of the new account
      let newKeyPair = ctx.getKeyPairEDDSA();
      await ctx.requestAccountUpdate(ownerB, token, fee, newKeyPair, {
        authMethod: AuthMethod.ECDSA
      });

      // Update the key pair of the new account again to disable EdDSA signatures
      await ctx.requestAccountUpdate(
        ownerB,
        token,
        fee,
        ctx.getZeroKeyPairEDDSA(),
        { maxFee: fee.mul(new BN(3)) }
      );

      // Transfer some funds using an ECDSA signature
      await ctx.transfer(
        ownerB,
        ownerA,
        token,
        fee.mul(new BN(10)),
        token,
        fee,
        { authMethod: AuthMethod.ECDSA }
      );

      // Enable EdDSA signature again
      newKeyPair = ctx.getKeyPairEDDSA();
      await ctx.requestAccountUpdate(ownerB, token, fee, newKeyPair, {
        authMethod: AuthMethod.ECDSA,
        maxFee: fee.mul(new BN(3))
      });

      // Submit
      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

      // Try to update the account without approval
      await ctx.requestAccountUpdate(ownerB, token, fee, newKeyPair, {
        authMethod: AuthMethod.NONE
      });

      // Submit
      await ctx.submitTransactions();
      await expectThrow(ctx.submitPendingBlocks(), "TX_NOT_APPROVED");
    });

    it("Should be able to verify an L2 signature", async () => {
      await createExchange();

      const token = ctx.getTokenAddress("LRC");
      const fee = new BN(0);

      // Create the account
      let newKeyPair = ctx.getKeyPairEDDSA();
      await ctx.requestAccountUpdate(ownerA, token, fee, newKeyPair, {
        authMethod: AuthMethod.ECDSA
      });

      // Verify the data
      await ctx.requestSignatureVerification(
        ownerA,
        ctx.hashToFieldElement(
          "0xe58c1e35c9b00a5c962c98dfd135846e87d9813d6c9f3e92fb4ca6037fb3f021"
        )
      );

      // Submit
      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

      // Verify different data
      await ctx.requestSignatureVerification(
        ownerA,
        ctx.hashToFieldElement(
          "0xe58c1e35c9b00a5c962c98dfd135846e87d9813d6c9f3e92fb4ca6037fb3f021"
        ),
        {
          dataToSign: ctx.hashToFieldElement(
            "0xe58c1e35c9b00a5c962c98dfd135846e87d9813d6c9f3e92fb4ca6037fb4f021"
          )
        }
      );
      await expectThrow(ctx.submitTransactions(), "invalid block");
    });

    [AuthMethod.EDDSA, AuthMethod.ECDSA].forEach(function(authMethod) {
      it(
        "Should not be able to update an account with fee > maxFee (" +
          authMethod +
          ")",
        async () => {
          await createExchange();

          const balance = new BN(web3.utils.toWei("5484.24", "ether"));
          const token = ctx.getTokenAddress("LRC");
          const fee = ctx.getRandomFee();

          // Fund the payer
          await ctx.deposit(ownerA, ownerA, token, balance);

          // Update the key pair of the new account
          let newKeyPair = ctx.getKeyPairEDDSA();
          await ctx.requestAccountUpdate(ownerA, token, fee, newKeyPair, {
            maxFee: fee.div(new BN(2)),
            authMethod
          });

          // Commit the transfers
          if (authMethod === AuthMethod.EDDSA) {
            await expectThrow(ctx.submitTransactions(), "invalid block");
          } else {
            await ctx.submitTransactions();
            await expectThrow(
              ctx.submitPendingBlocks(),
              "ACCOUNT_UPDATE_FEE_TOO_HIGH"
            );
          }
        }
      );
    });
  });
});
