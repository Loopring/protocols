import {
  Context,
  getContext,
  createContext,
  createWallet,
  executeTransaction,
  toAmount,
  sortAddresses
} from "./helpers/TestUtils";
import { addBalance, getBalance, getTokenAddress } from "./helpers/TokenUtils";
import { assertEventEmitted, assertEventsEmitted } from "../util/Events";
import { expectThrow } from "../util/expectThrow";
import BN = require("bn.js");
import { SignatureType } from "./helpers/Signature";
import { addGuardian } from "./helpers/GuardianUtils";

contract("MetaTxmodule", () => {
  let defaultCtx: Context;
  let ctx: Context;

  let priceOracleMock: any;

  const setOraclePrice = async (assetValue: BN) => {
    await priceOracleMock.givenAnyReturnUint(assetValue);
  };

  before(async () => {
    defaultCtx = await getContext();
    priceOracleMock = await defaultCtx.contracts.MockContract.new();
    await defaultCtx.controllerImpl.setPriceOracle(priceOracleMock.address);
  });

  beforeEach(async () => {
    ctx = await createContext(defaultCtx);
  });

  it("should not be able to execute a meta tx with an invalid signature", async () => {
    const owner = ctx.owners[0];
    const { wallet } = await createWallet(ctx, owner);
    const tests = [
      { type: SignatureType.ILLEGAL, error: "INVALID_SIGNATURES" },
      { type: SignatureType.INVALID, error: "INVALID_SIGNATURES" },
      { type: SignatureType.EIP_712, error: "INVALID_SIGNATURES" },
      { type: SignatureType.ETH_SIGN, error: "INVALID_SIGNATURES" },
      { type: SignatureType.WALLET, error: "INVALID_SIGNATURES" }
    ];
    for (let i = 0; i < tests.length; i++) {
      await expectThrow(
        executeTransaction(
          ctx.inheritanceModule.contract.methods.setInheritor(
            wallet,
            ctx.miscAddresses[0]
          ),
          ctx,
          true,
          wallet,
          [owner],
          {
            from: owner,
            signatureTypes: [tests[i].type],
            checkSignatures: false
          }
        ),
        tests[i].error
      );
    }
  });

  it("should be able to sign with EIP712", async () => {
    const owner = ctx.owners[0];
    const { wallet, guardians } = await createWallet(ctx, owner, 3);
    const signers = [owner, ...guardians].sort();
    const signatureTypes = new Array(signers.length).fill(
      SignatureType.EIP_712
    );
    await executeTransaction(
      ctx.whitelistModule.contract.methods.addToWhitelistImmediately(
        wallet,
        ctx.miscAddresses[0]
      ),
      ctx,
      true,
      wallet,
      signers,
      { from: owner, signatureTypes }
    );
  });

  it("should be able to sign with ETH_SIGN", async () => {
    const owner = ctx.owners[0];
    const { wallet, guardians } = await createWallet(ctx, owner, 3);
    const signers = [owner, ...guardians].sort();
    const signatureTypes = new Array(signers.length).fill(
      SignatureType.ETH_SIGN
    );
    await executeTransaction(
      ctx.whitelistModule.contract.methods.addToWhitelistImmediately(
        wallet,
        ctx.miscAddresses[0]
      ),
      ctx,
      true,
      wallet,
      signers,
      { from: owner, signatureTypes }
    );
  });

  it("should be able to sign with WALLET", async () => {
    const ownerA = ctx.owners[0];
    const ownerB = ctx.owners[1];
    const { wallet: walletA } = await createWallet(ctx, ownerA);
    const { wallet: walletB } = await createWallet(ctx, ownerB);

    // Add walletB as a guardian to walletA
    await addGuardian(ctx, ownerA, walletA, walletB, 0);

    const signers = sortAddresses([ownerA, walletB]);
    let signatureTypes = [SignatureType.EIP_712, SignatureType.WALLET];
    if (signers[0] !== ownerA) {
      signatureTypes = signatureTypes.reverse();
    }
    await executeTransaction(
      ctx.whitelistModule.contract.methods.addToWhitelistImmediately(
        walletA,
        ctx.miscAddresses[0]
      ),
      ctx,
      true,
      walletA,
      signers,
      { from: ownerA, signatureTypes }
    );
  });

  it("should not be able execute the same meta tx twice (nonce)", async () => {
    const owner = ctx.owners[0];
    const { wallet, guardians } = await createWallet(ctx, owner, 3);
    const signers = [owner, ...guardians].sort();
    // The current nonce
    const nonce = (await ctx.whitelistModule.lastNonce(wallet)).toNumber() + 1;
    await executeTransaction(
      ctx.whitelistModule.contract.methods.addToWhitelistImmediately(
        wallet,
        ctx.miscAddresses[0]
      ),
      ctx,
      true,
      wallet,
      signers,
      { from: owner, nonce }
    );
    await expectThrow(
      executeTransaction(
        ctx.whitelistModule.contract.methods.addToWhitelistImmediately(
          wallet,
          ctx.miscAddresses[0]
        ),
        ctx,
        true,
        wallet,
        signers,
        { from: owner, nonce }
      ),
      "NONCE_TOO_SMALL"
    );
  });

  it("should not be able execute the same meta tx twice (hash)", async () => {
    const owner = ctx.owners[0];
    const { wallet, guardians } = await createWallet(ctx, owner, 3);
    const signers = [owner, ...guardians].sort();
    // Disable the nonce so the hash is used
    const nonce = 0;
    await executeTransaction(
      ctx.whitelistModule.contract.methods.addToWhitelistImmediately(
        wallet,
        ctx.miscAddresses[0]
      ),
      ctx,
      true,
      wallet,
      signers,
      { from: owner, nonce }
    );
    await expectThrow(
      executeTransaction(
        ctx.whitelistModule.contract.methods.addToWhitelistImmediately(
          wallet,
          ctx.miscAddresses[0]
        ),
        ctx,
        true,
        wallet,
        signers,
        { from: owner, nonce }
      ),
      "INVALID_HASH"
    );
  });

  it("relayer should provide enough gas to the meta tx", async () => {
    const owner = ctx.owners[0];
    const { wallet, guardians } = await createWallet(ctx, owner, 3);
    const signers = [owner, ...guardians].sort();
    await expectThrow(
      executeTransaction(
        ctx.whitelistModule.contract.methods.addToWhitelistImmediately(
          wallet,
          ctx.miscAddresses[0]
        ),
        ctx,
        true,
        wallet,
        signers,
        { from: owner, gas: 1000000, gasLimit: 1000001 }
      ),
      "INSUFFICIENT_GAS"
    );
  });

  it("failing call should still produce a valid meta tx", async () => {
    const owner = ctx.owners[0];
    const { wallet, guardians } = await createWallet(ctx, owner, 3);
    const signers = [owner, ...guardians].sort();
    await expectThrow(
      executeTransaction(
        ctx.whitelistModule.contract.methods.addToWhitelistImmediately(
          wallet,
          ctx.miscAddresses[0]
        ),
        ctx,
        true,
        wallet,
        signers,
        { from: owner, gas: 1000000, gasLimit: 1000 }
      ),
      "Meta tx call failed"
    );
  });

  ["ETH", "LRC"].forEach(function(gasToken) {
    it(
      "should be able to pay (using the daily quota) for a meta tx (" +
        gasToken +
        ")",
      async () => {
        const owner = ctx.owners[0];
        const { wallet, guardians } = await createWallet(ctx, owner, 3);
        const signers = [owner, ...guardians].sort();

        const feeRecipient = ctx.miscAddresses[2];
        const gasOverhead = 50000;
        const gasPrice = new BN(7);
        const assetValue = new BN(3);

        // Set the value of the transfer on the price oracle
        await setOraclePrice(assetValue);

        // Transfer enough tokens to pay for the meta tx
        await addBalance(ctx, wallet, gasToken, toAmount("1"));

        // Balances
        const oldBalanceWallet = await getBalance(ctx, gasToken, wallet);
        const oldBalanceRecipient = await getBalance(
          ctx,
          gasToken,
          feeRecipient
        );
        // Quota
        const oldSpentQuota = await ctx.quotaStore.spentQuota(wallet);

        await executeTransaction(
          ctx.whitelistModule.contract.methods.addToWhitelistImmediately(
            wallet,
            ctx.miscAddresses[0]
          ),
          ctx,
          true,
          wallet,
          signers,
          {
            from: ctx.miscAddresses[0],
            feeRecipient,
            gasToken,
            gasPrice,
            gasOverhead
          }
        );
        const event = await assertEventEmitted(
          ctx.whitelistModule,
          "MetaTxExecuted"
        );
        const gasCost = event.gasUsed.add(new BN(gasOverhead)).mul(gasPrice);

        // Balances
        const newBalanceWallet = await getBalance(ctx, gasToken, wallet);
        const newBalanceRecipient = await getBalance(
          ctx,
          gasToken,
          feeRecipient
        );
        assert(
          oldBalanceWallet.eq(newBalanceWallet.add(gasCost)),
          "incorrect wallet balance"
        );
        assert(
          newBalanceRecipient.eq(oldBalanceRecipient.add(gasCost)),
          "incorrect recipient balance"
        );
        // Quota
        const newSpentQuota = await ctx.quotaStore.spentQuota(wallet);
        assert(
          newSpentQuota.eq(oldSpentQuota.add(assetValue)),
          "incorrect spent quota"
        );
      }
    );
  });
});
