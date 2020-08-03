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

  const createExchange = async (bSetupTestState: boolean = true) => {
    exchangeID = await ctx.createExchange(
      ctx.testContext.stateOwners[0],
      bSetupTestState
    );
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

    it("Should be able to update an account", async () => {
      await createExchange();

      const balance = new BN(web3.utils.toWei("5484.24", "ether"));
      const token = ctx.getTokenAddress("LRC");
      const fee = ctx.getRandomFee();

      // Fund the payer
      await ctx.deposit(ownerA, ownerA, token, balance);

      // Send some funds over to the new account
      await ctx.transfer(ownerA, ownerB, token, fee.mul(new BN(10)), token, fee, {transferToNew: true});

      // Update the key pair of the new account
      let newKeyPair = ctx.getKeyPairEDDSA();
      await ctx.requestAccountUpdate(ownerB, token, fee, newKeyPair, {authMethod: AuthMethod.ECDSA});

      // Update the key pair of the new account again to disable EdDSA signatures
      await ctx.requestAccountUpdate(ownerB, token, fee, ctx.getZeroKeyPairEDDSA());

      // Transfer some funds using an ECDSA signature
      await ctx.transfer(ownerB, ownerA, token, fee.mul(new BN(10)), token, fee, {authMethod: AuthMethod.ECDSA});

      // Enable EdDSA signature again
      newKeyPair = ctx.getKeyPairEDDSA();
      await ctx.requestAccountUpdate(ownerB, token, fee, newKeyPair, {authMethod: AuthMethod.ECDSA});

      // Submit
      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

      // Try to update the account without approval
      await ctx.requestAccountUpdate(ownerB, token, fee, newKeyPair, {authMethod: AuthMethod.NONE});

      // Submit
      await ctx.submitTransactions();
      await expectThrow(
        ctx.submitPendingBlocks(),
        "TX_NOT_APPROVED"
      );
    });
  });
});
