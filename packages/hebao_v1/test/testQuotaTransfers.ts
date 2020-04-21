import {
  Context,
  getContext,
  createContext,
  createWallet,
  executeTransaction,
  getBlockTime,
  toAmount
} from "./helpers/TestUtils";
import { addToWhitelist, isWhitelisted } from "./helpers/WhitelistUtils";
import { expectThrow } from "../util/expectThrow";
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";
import { assertEventEmitted, assertEventsEmitted } from "../util/Events";
import {
  addBalance,
  getTokenAddress,
  getBalance,
  getAllowance
} from "./helpers/TokenUtils";
import BN = require("bn.js");

const TestTargetContract = artifacts.require("TestTargetContract");

contract("Transfers", (accounts: string[]) => {
  let defaultCtx: Context;
  let ctx: Context;

  let priceOracleMock: any;
  let targetContract: any;

  const quotaPeriod = 24 * 3600; // 1 day

  let delayPeriod: number;

  let useMetaTx: boolean = false;

  const setOraclePrice = async (token: string, amount: BN, assetValue: BN) => {
    // Return 0 as the default
    await priceOracleMock.givenAnyReturnUint(new BN(0));
    // Set the specified price
    token = await getTokenAddress(ctx, token);
    const data = ctx.priceCacheStore.contract.methods
      .tokenPrice(token, amount.toString(10))
      .encodeABI();
    await priceOracleMock.givenCalldataReturnUint(data, assetValue);
  };

  const description = (descr: string, metaTx: boolean = useMetaTx) => {
    return descr + (metaTx ? " (meta tx)" : "");
  };

  const isPendingTx = async (wallet: string, pendingTxId: string) => {
    return (
      (
        await ctx.quotaTransfers.pendingTransactions(wallet, pendingTxId)
      ).toNumber() > 0
    );
  };

  const isPendingTxUsable = async (wallet: string, pendingTxId: string) => {
    return ctx.quotaTransfers.isPendingTxUsable(wallet, pendingTxId);
  };

  const transferTokenChecked = async (
    owner: string,
    wallet: string,
    token: string,
    to: string,
    amount: BN,
    logdata: string,
    options: any = {}
  ) => {
    let assetValue = options.assetValue ? options.assetValue : new BN(0);
    let isWhitelisted = options.isWhitelisted ? options.isWhitelisted : false;
    let willBePending = options.willBePending ? options.willBePending : false;
    let isPending = options.isPending ? options.isPending : false;
    let approved = options.signers ? true : false;
    token = await getTokenAddress(ctx, token);

    // Set the value of the transfer on the price oracle
    await setOraclePrice(token, amount, assetValue);

    if (!willBePending) {
      // Make sure the wallet has enough funds
      await addBalance(ctx, wallet, token, amount);
    }

    // Cache quota data
    const oldAvailableQuota = await ctx.quotaStore.availableQuota(wallet);
    const oldSpentQuota = await ctx.quotaStore.spentQuota(wallet);
    // Cache balance data
    const oldBalanceWallet = await getBalance(ctx, token, wallet);
    const oldBalanceTo = await getBalance(ctx, token, to);

    // Transfer the tokens
    let tx;
    if (approved) {
      tx = await executeTransaction(
        ctx.approvedTransfers.contract.methods.transferToken(
          wallet,
          options.signers,
          token,
          to,
          amount.toString(10),
          logdata
        ),
        ctx,
        useMetaTx,
        wallet,
        options.signers,
        { from: owner }
      );
    } else {
      tx = await executeTransaction(
        ctx.quotaTransfers.contract.methods.transferToken(
          wallet,
          token,
          to,
          amount.toString(10),
          logdata,
          willBePending
        ),
        ctx,
        useMetaTx,
        wallet,
        [owner],
        { from: owner }
      );
    }
    if (willBePending) {
      const blockTime = await getBlockTime(tx.blockNumber);
      const event = await assertEventEmitted(
        ctx.quotaTransfers,
        "PendingTxCreated",
        (event: any) => {
          return (
            event.wallet === wallet &&
            event.timestamp == blockTime + delayPeriod
          );
        }
      );
      assert(await isPendingTx(wallet, event.txid), "tx should be pending");
    } else {
      await assertEventEmitted(
        approved ? ctx.approvedTransfers : ctx.quotaTransfers,
        "Transfered",
        (event: any) => {
          return (
            event.wallet === wallet &&
            event.token === token &&
            event.to === to &&
            event.amount.eq(amount) &&
            (logdata === "0x"
              ? event.logdata === null
              : event.logdata === logdata)
          );
        }
      );
    }
    if (isPending) {
      const event = await assertEventEmitted(
        ctx.quotaTransfers,
        "PendingTxExecuted",
        (event: any) => {
          return event.wallet === wallet;
        }
      );
      assert(
        !(await isPendingTx(wallet, event.txid)),
        "tx should not be pending"
      );
      assert(
        !(await isPendingTxUsable(wallet, event.txid)),
        "tx should not be pending and usable"
      );
    }

    // Check quota
    const newAvailableQuota = await ctx.quotaStore.availableQuota(wallet);
    const newSpentQuota = await ctx.quotaStore.spentQuota(wallet);
    const quotaDelta =
      isWhitelisted || willBePending || isPending || approved
        ? new BN(0)
        : assetValue;
    assert(
      oldAvailableQuota.eq(newAvailableQuota.add(quotaDelta)),
      "incorrect available quota"
    );
    assert(
      newSpentQuota.eq(oldSpentQuota.add(quotaDelta)),
      "incorrect spent quota"
    );
    // Check balances
    const newBalanceWallet = await getBalance(ctx, token, wallet);
    const newBalanceTo = await getBalance(ctx, token, to);
    const balalanceDelta = willBePending ? new BN(0) : amount;
    assert(
      oldBalanceWallet.eq(newBalanceWallet.add(balalanceDelta)),
      "incorrect wallet balance"
    );
    assert(
      newBalanceTo.eq(oldBalanceTo.add(balalanceDelta)),
      "incorrect to balance"
    );
  };

  const callContractChecked = async (
    owner: string,
    wallet: string,
    to: string,
    value: BN,
    nonce: number,
    options: any = {}
  ) => {
    let assetValue = options.assetValue ? options.assetValue : new BN(0);
    let isWhitelisted = options.isWhitelisted ? options.isWhitelisted : false;
    let willBePending = options.willBePending ? options.willBePending : false;
    let isPending = options.isPending ? options.isPending : false;
    let approved = options.signers ? true : false;

    const token = await getTokenAddress(ctx, "ETH");
    const data = targetContract.contract.methods
      .functionPayable(nonce)
      .encodeABI();

    // Set the value of the transfer on the price oracle
    await setOraclePrice(token, value, assetValue);

    if (!willBePending) {
      // Make sure the wallet has enough funds
      await addBalance(ctx, wallet, token, value);
    }

    // Cache quota data
    const oldAvailableQuota = await ctx.quotaStore.availableQuota(wallet);
    const oldSpentQuota = await ctx.quotaStore.spentQuota(wallet);
    // Cache balance data
    const oldBalanceWallet = await getBalance(ctx, token, wallet);
    const oldBalanceTo = await getBalance(ctx, token, to);
    // Cache test data
    const testValueBefore = (await targetContract.value()).toNumber();

    // Call the contract
    let tx;
    if (approved) {
      tx = await executeTransaction(
        ctx.approvedTransfers.contract.methods.callContract(
          wallet,
          options.signers,
          to,
          value.toString(10),
          data
        ),
        ctx,
        useMetaTx,
        wallet,
        options.signers,
        { from: owner }
      );
    } else {
      tx = await executeTransaction(
        ctx.quotaTransfers.contract.methods.callContract(
          wallet,
          to,
          value.toString(10),
          data,
          willBePending
        ),
        ctx,
        useMetaTx,
        wallet,
        [owner],
        { from: owner }
      );
    }
    if (willBePending) {
      const blockTime = await getBlockTime(tx.blockNumber);
      const event = await assertEventEmitted(
        ctx.quotaTransfers,
        "PendingTxCreated",
        (event: any) => {
          return (
            event.wallet === wallet &&
            event.timestamp == blockTime + delayPeriod
          );
        }
      );
      assert(await isPendingTx(wallet, event.txid), "tx should be pending");
    } else {
      await assertEventEmitted(
        approved ? ctx.approvedTransfers : ctx.quotaTransfers,
        "ContractCalled",
        (event: any) => {
          return (
            event.wallet === wallet &&
            event.to === to &&
            event.value.eq(value) &&
            event.data === data
          );
        }
      );
    }
    if (isPending) {
      const event = await assertEventEmitted(
        ctx.quotaTransfers,
        "PendingTxExecuted",
        (event: any) => {
          return event.wallet === wallet;
        }
      );
      assert(
        !(await isPendingTx(wallet, event.txid)),
        "tx should not be pending"
      );
      assert(
        !(await isPendingTxUsable(wallet, event.txid)),
        "tx should not be pending and usable"
      );
    }

    // Check quota
    const newAvailableQuota = await ctx.quotaStore.availableQuota(wallet);
    const newSpentQuota = await ctx.quotaStore.spentQuota(wallet);
    const quotaDelta =
      isWhitelisted || willBePending || isPending || approved
        ? new BN(0)
        : assetValue;
    assert(
      oldAvailableQuota.eq(newAvailableQuota.add(quotaDelta)),
      "incorrect available quota"
    );
    assert(
      newSpentQuota.eq(oldSpentQuota.add(quotaDelta)),
      "incorrect available quota"
    );
    // Check balances
    const newBalanceWallet = await getBalance(ctx, token, wallet);
    const newBalanceTo = await getBalance(ctx, token, to);
    const balalanceDelta = willBePending ? new BN(0) : value;
    assert(
      oldBalanceWallet.eq(newBalanceWallet.add(balalanceDelta)),
      "incorrect wallet balance"
    );
    assert(
      newBalanceTo.eq(oldBalanceTo.add(balalanceDelta)),
      "incorrect to balance"
    );
    // Check test value
    const testValueAfter = (await targetContract.value()).toNumber();
    const expectedTestValueAfter = willBePending ? testValueBefore : nonce;
    assert.equal(
      testValueAfter,
      expectedTestValueAfter,
      "unexpected test value"
    );
  };

  const approveTokenChecked = async (
    owner: string,
    wallet: string,
    token: string,
    to: string,
    amount: BN,
    options: any = {}
  ) => {
    let isWhitelisted = options.isWhitelisted ? options.isWhitelisted : false;
    let assetValue = options.assetValue ? options.assetValue : new BN(0);
    let approved = options.signers ? true : false;
    token = await getTokenAddress(ctx, token);

    // Cache quota data
    const oldAvailableQuota = await ctx.quotaStore.availableQuota(wallet);
    const oldSpentQuota = await ctx.quotaStore.spentQuota(wallet);
    // Cache balance data
    const oldAllowanceTo = await getAllowance(ctx, token, wallet, to);

    // Set the value of the transfer on the price oracle
    await setOraclePrice(token, amount, assetValue);
    let allowanceDelta = new BN(0);
    if (amount.gt(oldAllowanceTo)) {
      allowanceDelta = amount.sub(oldAllowanceTo);
      const quotaFraction = amount.div(allowanceDelta);
      await setOraclePrice(
        token,
        amount.div(quotaFraction),
        assetValue.div(quotaFraction)
      );
      assetValue = assetValue.div(quotaFraction);
    } else {
      assetValue = new BN(0);
    }

    // Approve the tokens
    if (approved) {
      await executeTransaction(
        ctx.approvedTransfers.contract.methods.approveToken(
          wallet,
          options.signers,
          token,
          to,
          amount.toString(10)
        ),
        ctx,
        useMetaTx,
        wallet,
        options.signers,
        { from: owner }
      );
    } else {
      await executeTransaction(
        ctx.quotaTransfers.contract.methods.approveToken(
          wallet,
          token,
          to,
          amount.toString(10)
        ),
        ctx,
        useMetaTx,
        wallet,
        [owner],
        { from: owner }
      );
    }
    await assertEventEmitted(
      approved ? ctx.approvedTransfers : ctx.quotaTransfers,
      "Approved",
      (event: any) => {
        return (
          event.wallet === wallet &&
          event.token === token &&
          event.to === to &&
          event.amount.eq(amount)
        );
      }
    );

    // Check quota
    const newAvailableQuota = await ctx.quotaStore.availableQuota(wallet);
    const newSpentQuota = await ctx.quotaStore.spentQuota(wallet);
    const quotaDelta = isWhitelisted || approved ? new BN(0) : assetValue;
    assert(
      oldAvailableQuota.eq(newAvailableQuota.add(quotaDelta)),
      "incorrect available quota"
    );
    assert(
      newSpentQuota.eq(oldSpentQuota.add(quotaDelta)),
      "incorrect available quota"
    );
    // Check Allowance
    const newAllowanceTo = await getAllowance(ctx, token, wallet, to);
    assert(newAllowanceTo.eq(amount), "incorrect allowance");
  };

  const approveThenCallContractChecked = async (
    owner: string,
    wallet: string,
    token: string,
    to: string,
    amount: BN,
    nonce: number,
    options: any = {}
  ) => {
    let isWhitelisted = options.isWhitelisted ? options.isWhitelisted : false;
    let assetValue = options.assetValue ? options.assetValue : new BN(0);
    let approved = options.signers ? true : false;

    token = await getTokenAddress(ctx, token);

    const data = targetContract.contract.methods
      .functionPayable(nonce)
      .encodeABI();

    // Cache quota data
    const oldAvailableQuota = await ctx.quotaStore.availableQuota(wallet);
    const oldSpentQuota = await ctx.quotaStore.spentQuota(wallet);
    // Cache balance data
    const oldAllowanceTo = await getAllowance(ctx, token, wallet, to);

    // Set the value of the transfer on the price oracle
    await setOraclePrice(token, amount, assetValue);
    let allowanceDelta = new BN(0);
    if (amount.gt(oldAllowanceTo)) {
      allowanceDelta = amount.sub(oldAllowanceTo);
      const quotaFraction = amount.div(allowanceDelta);
      await setOraclePrice(
        token,
        amount.div(quotaFraction),
        assetValue.div(quotaFraction)
      );
      assetValue = assetValue.div(quotaFraction);
    } else {
      assetValue = new BN(0);
    }

    // Approve the tokens and call the contract
    if (approved) {
      await executeTransaction(
        ctx.approvedTransfers.contract.methods.approveThenCallContract(
          wallet,
          options.signers,
          token,
          to,
          amount.toString(10),
          data
        ),
        ctx,
        useMetaTx,
        wallet,
        options.signers,
        { from: owner }
      );
    } else {
      await executeTransaction(
        ctx.quotaTransfers.contract.methods.approveThenCallContract(
          wallet,
          token,
          to,
          amount.toString(10),
          data
        ),
        ctx,
        useMetaTx,
        wallet,
        [owner],
        { from: owner }
      );
    }
    await assertEventEmitted(
      approved ? ctx.approvedTransfers : ctx.quotaTransfers,
      "Approved",
      (event: any) => {
        return (
          event.wallet === wallet &&
          event.token === token &&
          event.to === to &&
          event.amount.eq(amount)
        );
      }
    );
    await assertEventEmitted(
      approved ? ctx.approvedTransfers : ctx.quotaTransfers,
      "ContractCalled",
      (event: any) => {
        return (
          event.wallet === wallet &&
          event.to === to &&
          event.value.eq(new BN(0)) &&
          event.data === data
        );
      }
    );

    // Check quota
    const newAvailableQuota = await ctx.quotaStore.availableQuota(wallet);
    const newSpentQuota = await ctx.quotaStore.spentQuota(wallet);
    const quotaDelta = isWhitelisted || approved ? new BN(0) : assetValue;
    assert(
      oldAvailableQuota.eq(newAvailableQuota.add(quotaDelta)),
      "incorrect available quota"
    );
    assert(
      newSpentQuota.eq(oldSpentQuota.add(quotaDelta)),
      "incorrect available quota"
    );
    // Check Allowance
    const newAllowanceTo = await getAllowance(ctx, token, wallet, to);
    assert(newAllowanceTo.eq(amount), "incorrect allowance");
    // Check test value
    const testValueAfter = (await targetContract.value()).toNumber();
    assert.equal(testValueAfter, nonce, "unexpected test value");
  };

  const transferTokensFullBalanceChecked = async (
    owner: string,
    wallet: string,
    tokens: string[],
    to: string,
    logdata: string,
    amounts: BN[],
    options: any = {}
  ) => {
    let approved = options.signers ? true : false;

    const oldBalancesWallet: BN[] = [];
    const oldBalancesTo: BN[] = [];
    for (let i = 0; i < tokens.length; i++) {
      tokens[i] = await getTokenAddress(ctx, tokens[i]);

      // Cache balance data
      oldBalancesWallet.push(await getBalance(ctx, tokens[i], wallet));
      oldBalancesTo.push(await getBalance(ctx, tokens[i], to));
    }

    // Transfer the tokens
    if (approved) {
      await executeTransaction(
        ctx.approvedTransfers.contract.methods.transferTokensFullBalance(
          wallet,
          options.signers,
          tokens,
          to,
          logdata
        ),
        ctx,
        useMetaTx,
        wallet,
        options.signers,
        { from: owner }
      );
    } else {
      await executeTransaction(
        ctx.quotaTransfers.contract.methods.transferTokensFullBalance(
          wallet,
          tokens,
          to,
          logdata
        ),
        ctx,
        useMetaTx,
        wallet,
        [owner],
        { from: owner }
      );
    }
    const events = await assertEventsEmitted(
      approved ? ctx.approvedTransfers : ctx.quotaTransfers,
      "Transfered",
      tokens.length,
      (event: any) => {
        return (
          event.wallet === wallet &&
          event.to === to &&
          (logdata === "0x"
            ? event.logdata === null
            : event.logdata === logdata)
        );
      }
    );

    for (let i = 0; i < tokens.length; i++) {
      // Check balances
      const newBalanceWallet = await getBalance(ctx, tokens[i], wallet);
      const newBalanceTo = await getBalance(ctx, tokens[i], to);
      assert(
        oldBalancesWallet[i].eq(newBalanceWallet.add(amounts[i])),
        "incorrect wallet balance"
      );
      assert(
        newBalanceTo.eq(oldBalancesTo[i].add(amounts[i])),
        "incorrect to balance"
      );

      // Check event data
      assert.equal(events[i].token, tokens[i], "unexpected token address");
      assert(events[i].amount.eq(amounts[i]), "unexpected transfer address");
    }
  };

  const cancelPendingTxChecked = async (
    owner: string,
    wallet: string,
    pendingTxId: string
  ) => {
    await executeTransaction(
      ctx.quotaTransfers.contract.methods.cancelPendingTx(wallet, pendingTxId),
      ctx,
      useMetaTx,
      wallet,
      [owner],
      { from: owner }
    );
    const event = await assertEventEmitted(
      ctx.quotaTransfers,
      "PendingTxCancelled",
      (event: any) => {
        return event.wallet === wallet && event.txid === pendingTxId;
      }
    );
    assert(
      !(await isPendingTx(wallet, event.txid)),
      "tx should not be pending"
    );
    assert(
      !(await isPendingTxUsable(wallet, event.txid)),
      "tx should not be pending and usable"
    );
  };

  before(async () => {
    defaultCtx = await getContext();
    priceOracleMock = await defaultCtx.contracts.MockContract.new();
    await defaultCtx.controllerImpl.setPriceOracle(priceOracleMock.address);
  });

  beforeEach(async () => {
    ctx = await createContext(defaultCtx);
    targetContract = await TestTargetContract.new();
    delayPeriod = (await ctx.quotaModule.delayPeriod()).toNumber();
  });

  [false, true].forEach(function(metaTx) {
    describe(description("TransferToken", metaTx), () => {
      it(
        description(
          "owner should be able to transfer tokens using daily quota",
          metaTx
        ),
        async () => {
          useMetaTx = metaTx;
          const owner = ctx.owners[0];
          const to = ctx.miscAddresses[0];
          const { wallet } = await createWallet(ctx, owner);

          const quota = await ctx.quotaStore.currentQuota(wallet);

          // Try to transfer more than the quota
          await expectThrow(
            transferTokenChecked(
              owner,
              wallet,
              "ETH",
              to,
              toAmount("0.7"),
              "0x",
              { assetValue: quota.add(new BN(1)) }
            ),
            "QUOTA_EXCEEDED"
          );

          // Transfer the complete quota
          await transferTokenChecked(
            owner,
            wallet,
            "ETH",
            to,
            toAmount("0.7"),
            "0xa45d",
            { assetValue: quota }
          );

          // Try to transfer an additional small amount
          await expectThrow(
            transferTokenChecked(
              owner,
              wallet,
              "LRC",
              to,
              toAmount("100"),
              "0x00a1d441",
              { assetValue: quota.div(new BN(100)) }
            ),
            "QUOTA_EXCEEDED"
          );

          // Skip forward `quotaPeriod` to revert used quota back to 0
          await advanceTimeAndBlockAsync(quotaPeriod);

          // Use up the quota in multiple transfers
          const transferValue = quota.div(new BN(3));
          await transferTokenChecked(
            owner,
            wallet,
            "ETH",
            to,
            toAmount("0.7"),
            "0x1234",
            { assetValue: transferValue }
          );
          await transferTokenChecked(
            owner,
            wallet,
            "LRC",
            to,
            toAmount("1000"),
            "0x",
            { assetValue: transferValue }
          );
          await transferTokenChecked(
            owner,
            wallet,
            "WETH",
            to,
            toAmount("50"),
            "0x",
            { assetValue: transferValue }
          );

          // Try to transfer an additional amount
          await expectThrow(
            transferTokenChecked(
              owner,
              wallet,
              "ETH",
              to,
              toAmount("0.7"),
              "0x",
              { assetValue: transferValue }
            ),
            "QUOTA_EXCEEDED"
          );

          // Skip forward `quotaPeriod/2`
          await advanceTimeAndBlockAsync(quotaPeriod / 2);

          // Transfer now successfully
          await transferTokenChecked(
            owner,
            wallet,
            "ETH",
            to,
            toAmount("0.7"),
            "0x",
            { assetValue: transferValue }
          );
        }
      );

      it(
        description(
          "owner should be able to transfer without limits to whitelisted addresses",
          metaTx
        ),
        async () => {
          useMetaTx = metaTx;
          const owner = ctx.owners[0];
          const to = ctx.miscAddresses[0];
          const { wallet } = await createWallet(ctx, owner);

          const quota = await ctx.quotaStore.currentQuota(wallet);
          const transferValue = quota.div(new BN(3));

          // Use up a part of the quota
          await transferTokenChecked(
            owner,
            wallet,
            "ETH",
            to,
            toAmount("0.7"),
            "0x1234",
            { assetValue: transferValue }
          );

          // Whitelist the destination
          await addToWhitelist(ctx, owner, wallet, to);

          // Shouldn't use the quota anymore
          await transferTokenChecked(
            owner,
            wallet,
            "LRC",
            to,
            toAmount("10000"),
            "0xffaa",
            { assetValue: transferValue, isWhitelisted: true }
          );

          // Should be able to transfer more than the quota
          await transferTokenChecked(
            owner,
            wallet,
            "ETH",
            to,
            toAmount("0.7"),
            "0x",
            { assetValue: quota.add(new BN(1)), isWhitelisted: true }
          );
        }
      );

      it(
        description(
          "owner should be able to transfer without limits using a pending tx",
          metaTx
        ),
        async () => {
          useMetaTx = metaTx;
          const owner = ctx.owners[0];
          const to = ctx.miscAddresses[0];
          const { wallet } = await createWallet(ctx, owner);

          const quota = await ctx.quotaStore.currentQuota(wallet);
          const transferValue = quota.add(new BN(1));

          // Create a transfer exceeding the daily quota which will create a pending tx
          await transferTokenChecked(
            owner,
            wallet,
            "LRC",
            to,
            toAmount("1000"),
            "0x12",
            { assetValue: transferValue, willBePending: true }
          );
          const pendingTx1Event = await assertEventEmitted(
            ctx.quotaTransfers,
            "PendingTxCreated"
          );

          // Try to execute the pending tx immediately
          await expectThrow(
            transferTokenChecked(
              owner,
              wallet,
              "LRC",
              to,
              toAmount("1000"),
              "0x12",
              { assetValue: transferValue, willBePending: true }
            ),
            "DUPLICATE_PENDING_TX"
          );

          // Create another transfer exceeding the daily quota which will create a pending tx
          await transferTokenChecked(
            owner,
            wallet,
            "LRC",
            to,
            toAmount("1000"),
            "0x34",
            { assetValue: transferValue, willBePending: true }
          );
          const pendingTx2Event = await assertEventEmitted(
            ctx.quotaTransfers,
            "PendingTxCreated"
          );

          // Cancel the 2nd pending tx
          await cancelPendingTxChecked(owner, wallet, pendingTx2Event.txid);
          // Should not be possible to cancel a pending tx that doesn't exist
          await expectThrow(
            cancelPendingTxChecked(owner, wallet, pendingTx2Event.txid),
            "NOT_FOUND"
          );

          // Skip forward `pendingPeriod - 100`
          await advanceTimeAndBlockAsync(delayPeriod - 100);
          // The tx should not yet be usable
          assert(
            !(await isPendingTxUsable(wallet, pendingTx1Event.txid)),
            "pending tx should be usable"
          );
          // Skip forward the complete `pendingPeriod`
          await advanceTimeAndBlockAsync(delayPeriod);
          // The tx should now be usable
          assert(
            await isPendingTxUsable(wallet, pendingTx1Event.txid),
            "pending tx should be usable"
          );

          // Now execute the 1st pending tx
          await transferTokenChecked(
            owner,
            wallet,
            "LRC",
            to,
            toAmount("1000"),
            "0x12",
            { assetValue: transferValue, isPending: true }
          );
        }
      );
    });

    describe(description("CallContract", metaTx), () => {
      it(
        description(
          "owner should be able to call a contract (with value) using daily quota",
          metaTx
        ),
        async () => {
          useMetaTx = metaTx;
          const owner = ctx.owners[0];
          const to = targetContract.address;
          const { wallet } = await createWallet(ctx, owner);

          const quota = await ctx.quotaStore.currentQuota(wallet);
          let nonce = 0;

          // Try to transfer more than the quota
          await expectThrow(
            callContractChecked(owner, wallet, to, toAmount("0.07"), ++nonce, {
              assetValue: quota.add(new BN(1))
            }),
            "QUOTA_EXCEEDED"
          );

          // Transfer the complete quota
          await callContractChecked(
            owner,
            wallet,
            to,
            toAmount("0.07"),
            ++nonce,
            { assetValue: quota }
          );

          // Try to transfer an additional small amount
          await expectThrow(
            callContractChecked(owner, wallet, to, toAmount("1"), ++nonce, {
              assetValue: quota.div(new BN(100))
            }),
            "QUOTA_EXCEEDED"
          );

          // Skip forward `quotaPeriod` to revert used quota back to 0
          await advanceTimeAndBlockAsync(quotaPeriod);

          // Use up the quota in multiple transfers
          const transferValue = quota.div(new BN(3));
          await callContractChecked(
            owner,
            wallet,
            to,
            toAmount("0.7"),
            ++nonce,
            { assetValue: transferValue }
          );
          await callContractChecked(owner, wallet, to, toAmount("1"), ++nonce, {
            assetValue: transferValue
          });
          await callContractChecked(
            owner,
            wallet,
            to,
            toAmount("0.5"),
            ++nonce,
            { assetValue: transferValue }
          );

          // Try to transfer an additional amount
          await expectThrow(
            callContractChecked(owner, wallet, to, toAmount("0.2"), ++nonce, {
              assetValue: transferValue
            }),
            "QUOTA_EXCEEDED"
          );

          // Skip forward `quotaPeriod/2`
          await advanceTimeAndBlockAsync(quotaPeriod / 2);

          // Transfer now successfully
          await callContractChecked(owner, wallet, to, toAmount("0.3"), nonce, {
            assetValue: transferValue
          });
        }
      );

      it(
        description(
          "owner should be able to call a contract (with value) without limits to whitelisted addresses",
          metaTx
        ),
        async () => {
          useMetaTx = metaTx;
          const owner = ctx.owners[0];
          const to = targetContract.address;
          const { wallet } = await createWallet(ctx, owner);

          const quota = await ctx.quotaStore.currentQuota(wallet);
          const transferValue = quota.div(new BN(3));
          let nonce = 0;

          // Use up a part of the quota
          await callContractChecked(
            owner,
            wallet,
            to,
            toAmount("0.7"),
            ++nonce,
            { assetValue: transferValue }
          );

          // Whitelist the destination
          await addToWhitelist(ctx, owner, wallet, to);

          // Shouldn't use the quota anymore
          await callContractChecked(
            owner,
            wallet,
            to,
            toAmount("0.25"),
            ++nonce,
            { assetValue: transferValue, isWhitelisted: true }
          );

          // Should be able to transfer more than the quota
          await callContractChecked(
            owner,
            wallet,
            to,
            toAmount("0.35"),
            ++nonce,
            { assetValue: quota.add(new BN(1)), isWhitelisted: true }
          );
        }
      );

      it(
        description(
          "owner should be able to call a contract (with value) without limits using a pending tx",
          metaTx
        ),
        async () => {
          useMetaTx = metaTx;
          const owner = ctx.owners[0];
          const to = targetContract.address;
          const { wallet } = await createWallet(ctx, owner);

          const quota = await ctx.quotaStore.currentQuota(wallet);
          const transferValue = quota.add(new BN(1));

          // Create a transfer exceeding the daily quota which will create a pending tx
          await callContractChecked(owner, wallet, to, toAmount("1"), 1, {
            assetValue: transferValue,
            willBePending: true
          });
          const pendingTx1Event = await assertEventEmitted(
            ctx.quotaTransfers,
            "PendingTxCreated"
          );

          // Try to execute the pending tx immediately
          await expectThrow(
            callContractChecked(owner, wallet, to, toAmount("1"), 1, {
              assetValue: transferValue,
              willBePending: true
            }),
            "DUPLICATE_PENDING_TX"
          );

          // Create another transfer exceeding the daily quota which will create a pending tx
          await callContractChecked(owner, wallet, to, toAmount("1"), 2, {
            assetValue: transferValue,
            willBePending: true
          });
          const pendingTx2Event = await assertEventEmitted(
            ctx.quotaTransfers,
            "PendingTxCreated"
          );

          // Cancel the 2nd pending tx
          await cancelPendingTxChecked(owner, wallet, pendingTx2Event.txid);
          // Should not be possible to cancel a pending tx that doesn't exist
          await expectThrow(
            cancelPendingTxChecked(owner, wallet, pendingTx2Event.txid),
            "NOT_FOUND"
          );

          // Skip forward `pendingPeriod - 100`
          await advanceTimeAndBlockAsync(delayPeriod - 100);
          // The tx should not yet be usable
          assert(
            !(await isPendingTxUsable(wallet, pendingTx1Event.txid)),
            "pending tx should be usable"
          );
          // Skip forward the complete `pendingPeriod`
          await advanceTimeAndBlockAsync(delayPeriod);
          // The tx should now be usable
          assert(
            await isPendingTxUsable(wallet, pendingTx1Event.txid),
            "pending tx should be usable"
          );

          // Now execute the 1st pending tx
          await callContractChecked(owner, wallet, to, toAmount("1"), 1, {
            assetValue: transferValue,
            isPending: true
          });
        }
      );

      it(
        description(
          "owner should not be able to call a token contract",
          metaTx
        ),
        async () => {
          useMetaTx = metaTx;
          const owner = ctx.owners[0];
          const to = await getTokenAddress(ctx, "LRC");
          const { wallet } = await createWallet(ctx, owner);

          // Set a price for the token
          await setOraclePrice(to, toAmount("1"), toAmount("1"));

          // Do a call to a token contract
          await expectThrow(
            callContractChecked(owner, wallet, to, new BN(0), 1, {
              assetValue: new BN(1)
            }),
            "CALL_DISALLOWED"
          );
        }
      );

      it(
        description(
          "owner should not be able to call the wallet itself",
          metaTx
        ),
        async () => {
          useMetaTx = metaTx;
          const owner = ctx.owners[0];
          const to = await getTokenAddress(ctx, "LRC");
          const { wallet } = await createWallet(ctx, owner);

          // Do a call to a token contract
          await expectThrow(
            callContractChecked(owner, wallet, wallet, new BN(0), 1),
            "CALL_DISALLOWED"
          );
        }
      );
    });

    describe(description("approveToken", metaTx), () => {
      it(
        description(
          "owner should be able to approve an address using daily quota",
          metaTx
        ),
        async () => {
          useMetaTx = metaTx;
          const owner = ctx.owners[0];
          let to = ctx.miscAddresses[0];
          const { wallet } = await createWallet(ctx, owner);

          const quota = await ctx.quotaStore.currentQuota(wallet);

          // Try to approve more than the quota
          await expectThrow(
            approveTokenChecked(owner, wallet, "WETH", to, toAmount("0.7"), {
              assetValue: quota.add(new BN(1))
            }),
            "QUOTA_EXCEEDED"
          );

          // Transfer the complete quota
          await approveTokenChecked(
            owner,
            wallet,
            "WETH",
            to,
            toAmount("0.7"),
            { assetValue: quota }
          );

          // Try to transfer an additional small amount
          await expectThrow(
            approveTokenChecked(owner, wallet, "REP", to, toAmount("100"), {
              assetValue: quota.div(new BN(100))
            }),
            "QUOTA_EXCEEDED"
          );

          // Skip forward `quotaPeriod` to revert used quota back to 0
          await advanceTimeAndBlockAsync(quotaPeriod);

          // Use up the quota in multiple transfers (incrementing the same allowance)
          const approveValue = quota.div(new BN(2));
          await approveTokenChecked(owner, wallet, "LRC", to, toAmount("1"), {
            assetValue: approveValue
          });
          await approveTokenChecked(owner, wallet, "LRC", to, toAmount("2"), {
            assetValue: approveValue.mul(new BN(2))
          });

          // Try to approve an additional amount
          await expectThrow(
            approveTokenChecked(owner, wallet, "LRC", to, toAmount("4"), {
              assetValue: approveValue.mul(new BN(4))
            }),
            "QUOTA_EXCEEDED"
          );

          // Skip forward `quotaPeriod/2`
          await advanceTimeAndBlockAsync(quotaPeriod);

          // Approve now successfully
          await approveTokenChecked(owner, wallet, "LRC", to, toAmount("4"), {
            assetValue: approveValue.mul(new BN(4))
          });

          // Lower the approval without using up any quota
          await approveTokenChecked(owner, wallet, "LRC", to, toAmount("2"), {
            assetValue: approveValue.mul(new BN(2))
          });
          await approveTokenChecked(owner, wallet, "LRC", to, toAmount("1"), {
            assetValue: approveValue.mul(new BN(1))
          });
          await approveTokenChecked(owner, wallet, "LRC", to, toAmount("0"), {
            assetValue: approveValue.mul(new BN(0))
          });
        }
      );

      it(
        description(
          "owner should be able to approve a whitelisted addresses without limits",
          metaTx
        ),
        async () => {
          useMetaTx = metaTx;
          const owner = ctx.owners[0];
          let to = ctx.miscAddresses[0];
          const { wallet } = await createWallet(ctx, owner);

          const quota = await ctx.quotaStore.currentQuota(wallet);
          const transferValue = quota.div(new BN(3));

          // Use up a part of the quota
          await approveTokenChecked(
            owner,
            wallet,
            "WETH",
            to,
            toAmount("0.7"),
            { assetValue: transferValue }
          );

          // Whitelist the destination
          await addToWhitelist(ctx, owner, wallet, to);

          // Shouldn't use the quota anymore
          await approveTokenChecked(owner, wallet, "LRC", to, toAmount("100"), {
            assetValue: transferValue,
            isWhitelisted: true
          });

          // Should be able to transfer more than the quota
          await approveTokenChecked(
            owner,
            wallet,
            "REP",
            to,
            toAmount("0.35"),
            { assetValue: quota.add(new BN(1)), isWhitelisted: true }
          );
        }
      );
    });

    describe(description("approveThenCallContract", metaTx), () => {
      it(
        description(
          "owner should be able to approve an address and call a function using daily quota",
          metaTx
        ),
        async () => {
          useMetaTx = metaTx;
          const owner = ctx.owners[0];
          let to = targetContract.address;
          const { wallet } = await createWallet(ctx, owner);

          const quota = await ctx.quotaStore.currentQuota(wallet);
          let nonce = 0;

          // Try to approve more than the quota
          await expectThrow(
            approveThenCallContractChecked(
              owner,
              wallet,
              "WETH",
              to,
              toAmount("0.7"),
              ++nonce,
              { assetValue: quota.add(new BN(1)) }
            ),
            "QUOTA_EXCEEDED"
          );

          // Transfer the complete quota
          await approveThenCallContractChecked(
            owner,
            wallet,
            "WETH",
            to,
            toAmount("0.7"),
            ++nonce,
            { assetValue: quota }
          );

          // Try to transfer an additional small amount
          await expectThrow(
            approveThenCallContractChecked(
              owner,
              wallet,
              "REP",
              to,
              toAmount("100"),
              ++nonce,
              { assetValue: quota.div(new BN(100)) }
            ),
            "QUOTA_EXCEEDED"
          );

          // Skip forward `quotaPeriod` to revert used quota back to 0
          await advanceTimeAndBlockAsync(quotaPeriod);

          // Use up the quota in multiple transfers (incrementing the same allowance)
          const approveValue = quota.div(new BN(2));
          await approveThenCallContractChecked(
            owner,
            wallet,
            "LRC",
            to,
            toAmount("1"),
            ++nonce,
            { assetValue: approveValue }
          );
          await approveThenCallContractChecked(
            owner,
            wallet,
            "LRC",
            to,
            toAmount("2"),
            ++nonce,
            { assetValue: approveValue.mul(new BN(2)) }
          );

          // Try to approve an additional amount
          await expectThrow(
            approveThenCallContractChecked(
              owner,
              wallet,
              "LRC",
              to,
              toAmount("4"),
              ++nonce,
              { assetValue: approveValue.mul(new BN(4)) }
            ),
            "QUOTA_EXCEEDED"
          );

          // Skip forward `quotaPeriod/2`
          await advanceTimeAndBlockAsync(quotaPeriod);

          // Approve now successfully
          await approveThenCallContractChecked(
            owner,
            wallet,
            "LRC",
            to,
            toAmount("4"),
            ++nonce,
            { assetValue: approveValue.mul(new BN(4)) }
          );

          // Lower the approval without using up any quota
          await approveThenCallContractChecked(
            owner,
            wallet,
            "LRC",
            to,
            toAmount("2"),
            ++nonce,
            { assetValue: approveValue.mul(new BN(2)) }
          );
          await approveThenCallContractChecked(
            owner,
            wallet,
            "LRC",
            to,
            toAmount("1"),
            ++nonce,
            { assetValue: approveValue.mul(new BN(1)) }
          );
          await approveThenCallContractChecked(
            owner,
            wallet,
            "LRC",
            to,
            toAmount("0"),
            ++nonce,
            { assetValue: approveValue.mul(new BN(0)) }
          );
        }
      );

      it(
        description(
          "owner should be able to approve a whitelisted addresses and call a function without limits",
          metaTx
        ),
        async () => {
          useMetaTx = metaTx;
          const owner = ctx.owners[0];
          let to = targetContract.address;
          const { wallet } = await createWallet(ctx, owner);

          const quota = await ctx.quotaStore.currentQuota(wallet);
          const transferValue = quota.div(new BN(3));
          let nonce = 0;

          // Use up a part of the quota
          await approveThenCallContractChecked(
            owner,
            wallet,
            "WETH",
            to,
            toAmount("0.7"),
            ++nonce,
            { assetValue: transferValue }
          );

          // Whitelist the destination
          await addToWhitelist(ctx, owner, wallet, to);

          // Shouldn't use the quota anymore
          await approveThenCallContractChecked(
            owner,
            wallet,
            "LRC",
            to,
            toAmount("100"),
            ++nonce,
            { assetValue: transferValue, isWhitelisted: true }
          );

          // Should be able to transfer more than the quota
          await approveThenCallContractChecked(
            owner,
            wallet,
            "REP",
            to,
            toAmount("0.35"),
            ++nonce,
            { assetValue: quota.add(new BN(1)), isWhitelisted: true }
          );
        }
      );
    });

    describe(description("transferTokensFullBalance", metaTx), () => {
      it(
        description(
          "owner should be able to tranfer complete balances to whitelisted address",
          metaTx
        ),
        async () => {
          useMetaTx = metaTx;
          const owner = ctx.owners[0];
          let to = ctx.miscAddresses[0];
          const { wallet } = await createWallet(ctx, owner);

          const tokens = ["REP", "ETH", "LRC"];
          const amounts = [
            toAmount("1234.5"),
            toAmount("0.4321"),
            toAmount("567.8")
          ];

          // Make sure the wallet has the expected funds
          for (let i = 0; i < tokens.length; i++) {
            await addBalance(ctx, wallet, tokens[i], amounts[i]);
          }

          // Try to transfer to an address that isn't whitelisted
          await expectThrow(
            transferTokensFullBalanceChecked(
              owner,
              wallet,
              tokens,
              to,
              "0xffaa",
              amounts
            ),
            "PROHIBITED"
          );

          // Whitelist the destination address
          await addToWhitelist(ctx, owner, wallet, to);

          // Now transfer the complete balances
          await transferTokensFullBalanceChecked(
            owner,
            wallet,
            tokens,
            to,
            "0xffaa",
            amounts
          );
        }
      );
    });
  });

  describe("ApprovedTransfers", () => {
    it("owner should be able to transfer without limits with majority", async () => {
      useMetaTx = true;
      const owner = ctx.owners[0];
      const to = ctx.miscAddresses[0];
      const { wallet, guardians } = await createWallet(ctx, owner, 2);

      const quota = await ctx.quotaStore.currentQuota(wallet);
      const transferValue = quota.mul(new BN(2));

      // Transfer
      const numSignersRequired = Math.floor((1 + guardians.length) / 2) + 1;
      for (let i = 0; i < numSignersRequired; i++) {
        const signers = [owner, ...guardians.slice(0, i)].sort();
        const transaction = transferTokenChecked(
          owner,
          wallet,
          "ETH",
          to,
          toAmount("0.7"),
          "0x1234",
          { assetValue: transferValue, signers }
        );
        if (signers.length >= numSignersRequired) {
          const tx = await transaction;
        } else {
          await expectThrow(transaction, "NOT_ENOUGH_SIGNERS");
        }
      }
    });

    it("owner should be able to tranfer complete balances with majority", async () => {
      useMetaTx = true;
      const owner = ctx.owners[0];
      let to = ctx.miscAddresses[0];
      const { wallet, guardians } = await createWallet(ctx, owner, 2);

      const tokens = ["REP", "ETH", "LRC"];
      const amounts = [
        toAmount("1234.5"),
        toAmount("0.4321"),
        toAmount("567.8")
      ];

      // Make sure the wallet has the expected funds
      for (let i = 0; i < tokens.length; i++) {
        await addBalance(ctx, wallet, tokens[i], amounts[i]);
      }

      // Transfer full balances
      const numSignersRequired = Math.floor((1 + guardians.length) / 2) + 1;
      for (let i = 0; i < numSignersRequired; i++) {
        const signers = [owner, ...guardians.slice(0, i)].sort();
        const transaction = transferTokensFullBalanceChecked(
          owner,
          wallet,
          tokens,
          to,
          "0xffaa",
          amounts,
          { signers }
        );
        if (signers.length >= numSignersRequired) {
          const tx = await transaction;
        } else {
          await expectThrow(transaction, "NOT_ENOUGH_SIGNERS");
        }
      }
    });

    it("owner should be able to approve without limits with majority", async () => {
      useMetaTx = true;
      const owner = ctx.owners[0];
      let to = ctx.miscAddresses[0];
      const { wallet, guardians } = await createWallet(ctx, owner, 2);

      const quota = await ctx.quotaStore.currentQuota(wallet);
      const transferValue = quota.mul(new BN(3));

      // Should be able to apprve more than the quota
      const numSignersRequired = Math.floor((1 + guardians.length) / 2) + 1;
      for (let i = 0; i < numSignersRequired; i++) {
        const signers = [owner, ...guardians.slice(0, i)].sort();
        const transaction = approveTokenChecked(
          owner,
          wallet,
          "WETH",
          to,
          toAmount("0.7"),
          { assetValue: transferValue, signers }
        );
        if (signers.length >= numSignersRequired) {
          const tx = await transaction;
        } else {
          await expectThrow(transaction, "NOT_ENOUGH_SIGNERS");
        }
      }
    });

    it("owner should be able to call a contract (with value) without limits with majority", async () => {
      useMetaTx = true;
      const owner = ctx.owners[0];
      const to = targetContract.address;
      const { wallet, guardians } = await createWallet(ctx, owner, 2);

      const quota = await ctx.quotaStore.currentQuota(wallet);
      const transferValue = quota.mul(new BN(3));
      let nonce = 0;

      // Should be able to transfer more than the quota
      const numSignersRequired = Math.floor((1 + guardians.length) / 2) + 1;
      for (let i = 0; i < numSignersRequired; i++) {
        const signers = [owner, ...guardians.slice(0, i)].sort();
        const transaction = callContractChecked(
          owner,
          wallet,
          to,
          toAmount("0.35"),
          ++nonce,
          { assetValue: transferValue, signers }
        );
        if (signers.length >= numSignersRequired) {
          const tx = await transaction;
        } else {
          await expectThrow(transaction, "NOT_ENOUGH_SIGNERS");
        }
      }
    });

    it("owner should be able to approve with limits and call a function with majority", async () => {
      useMetaTx = true;
      const owner = ctx.owners[0];
      let to = targetContract.address;
      const { wallet, guardians } = await createWallet(ctx, owner, 2);

      const quota = await ctx.quotaStore.currentQuota(wallet);
      const transferValue = quota.mul(new BN(3));
      let nonce = 0;

      // Should be able to approve more than the quota
      const numSignersRequired = Math.floor((1 + guardians.length) / 2) + 1;
      for (let i = 0; i < numSignersRequired; i++) {
        const signers = [owner, ...guardians.slice(0, i)].sort();
        const transaction = approveThenCallContractChecked(
          owner,
          wallet,
          "REP",
          to,
          toAmount("0.35"),
          ++nonce,
          { assetValue: transferValue, signers }
        );
        if (signers.length >= numSignersRequired) {
          const tx = await transaction;
        } else {
          await expectThrow(transaction, "NOT_ENOUGH_SIGNERS");
        }
      }
    });

    it("owner should not be able to call the wallet itself", async () => {
      useMetaTx = true;
      const owner = ctx.owners[0];
      const { wallet, guardians } = await createWallet(ctx, owner, 2);
      const signers = [owner, ...guardians].sort();

      // Do a call to a token contract
      await expectThrow(
        callContractChecked(owner, wallet, wallet, new BN(0), 1, { signers }),
        "CALL_DISALLOWED"
      );
    });
  });
});
