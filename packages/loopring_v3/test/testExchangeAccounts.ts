import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil, WalletUtils } from "./testExchangeUtil";
import { AuthMethod, Guardian, Wallet, PermissionData } from "./types";

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

    it("Should be able to create a new account", async () => {
      await createExchange();

      const balance = new BN(web3.utils.toWei("5484.24", "ether"));
      const token = ctx.getTokenAddress("LRC");
      const fee = ctx.getRandomFee();

      // Wallet
      const guardians: Guardian[] = [];
      guardians.push({addr: ownerB, group: 0});
      guardians.push({addr: ownerC, group: 0});
      const wallet: Wallet = {
        accountID: 0,
        guardians,
        inheritor: ownerD,
        inheritableSince: 0
      };

      // Fund the payer
      await ctx.deposit(ownerA, ownerA, token, balance);

      // Create a new account with keypair but without a wallet
      await ctx.requestNewAccount(ownerA, token, fee, ownerB, ctx.getKeyPairEDDSA(), undefined);

      // Create a new account without a keypair/wallet
      await ctx.requestNewAccount(ownerA, token, fee, ownerC, ctx.getZeroKeyPairEDDSA(), undefined);

      // Create a new account with a keypair and wallet
      await ctx.requestNewAccount(ownerA, token, fee, ownerD, ctx.getKeyPairEDDSA(), wallet);

      // Submit
      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();
    });

    it("Should be able to update an account", async () => {
      await createExchange();

      const balance = new BN(web3.utils.toWei("5484.24", "ether"));
      const token = ctx.getTokenAddress("LRC");
      const fee = ctx.getRandomFee();

      // Wallet
      const guardians: Guardian[] = [];
      guardians.push({addr: ownerB, group: 0});
      guardians.push({addr: ownerC, group: 0});
      const wallet: Wallet = {
        accountID: 0,
        guardians,
        inheritor: ownerD,
        inheritableSince: 0
      };

      // Fund the payer
      await ctx.deposit(ownerA, ownerA, token, balance);

      // Create a new account
      await ctx.requestNewAccount(ownerA, token, balance, ownerB, ctx.getKeyPairEDDSA());

      // Send some funds over to the new account
      await ctx.transfer(ownerA, ownerB, token, fee.mul(new BN(10)), token, fee);

      // Update the key pair of the new account
      let newKeyPair = ctx.getKeyPairEDDSA();
      await ctx.requestAccountUpdate(ownerB, token, fee, newKeyPair, undefined);

      // Set a wallet
      await ctx.requestAccountUpdate(ownerB, token, fee, newKeyPair, wallet);

      // Update the key pair of the new account again to disable EdDSA signatures
      await ctx.requestAccountUpdate(ownerB, token, fee, ctx.getZeroKeyPairEDDSA(), wallet);

      // Transfer some funds using an ECDSA signature
      await ctx.transfer(ownerB, ownerA, token, fee.mul(new BN(10)), token, fee, {authMethod: AuthMethod.ECDSA});

      // Enable EdDSA signature again
      newKeyPair = ctx.getKeyPairEDDSA();
      await ctx.requestAccountUpdate(ownerB, token, fee, newKeyPair, wallet, {authMethod: AuthMethod.ECDSA});

      // Remove the wallet
      newKeyPair = ctx.getKeyPairEDDSA();
      await ctx.requestAccountUpdate(ownerB, token, fee, newKeyPair, undefined, {authMethod: AuthMethod.EDDSA});

      // Submit
      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();
    });

    it("Should be able to change the account owner", async () => {
      await createExchange();

      const balance = new BN(web3.utils.toWei("5484.24", "ether"));
      const token = ctx.getTokenAddress("LRC");
      const fee = ctx.getRandomFee();

      // Fund the payer
      await ctx.deposit(ownerA, ownerA, token, balance);

      // Wallet
      const guardians: Guardian[] = [];
      guardians.push({addr: ownerB, group: 0});
      guardians.push({addr: ownerC, group: 0});
      const wallet: Wallet = {
        accountID: ctx.accounts[ctx.exchangeId].length,
        guardians,
        inheritor: ownerD,
        inheritableSince: 0
      };

      // Create a new account
      await ctx.requestNewAccount(ownerA, token, balance, ownerB, ctx.getKeyPairEDDSA(), wallet);

      // Send some funds over to the new account
      await ctx.transfer(ownerA, ownerB, token, fee.mul(new BN(10)), token, fee);

      // Setup data necessary for recovery using a wallet
      let newOwner = ownerC;
      const accountB = ctx.findAccount(ownerB);
      const permissionData: PermissionData = {signers: [], signatures: []};
      const walletDataHash = WalletUtils.getWalletHash(wallet, ctx.statelessWallet.address);
      const walletCalldata = ctx.statelessWallet.contract.methods.recover(
        accountB.accountID,
        accountB.nonce,
        accountB.owner,
        newOwner,
        "0x" + walletDataHash.toString("hex"),
        wallet,
        permissionData
      ).encodeABI();

      // Transfer ownership with the help of the wallet data
      await ctx.requestOwnerChange(ownerB, token, fee, newOwner, {authMethod: AuthMethod.WALLET, walletCalldata});

      // Transfer ownership again with the help of a signature of the original owner
      newOwner = ownerD;
      await ctx.requestOwnerChange(ownerC, token, fee, newOwner, {authMethod: AuthMethod.ECDSA});

      // Transfer some funds using an ECDSA signature
      await ctx.transfer(newOwner, ownerA, token, fee.mul(new BN(10)), token, fee, {authMethod: AuthMethod.ECDSA});

      // Submit
      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();
    });
  });
});
