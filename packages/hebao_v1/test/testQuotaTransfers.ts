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
import {
  SignedRequest,
  signTransferTokenApproved,
  signCallContractApproved,
  signApproveTokenApproved,
  signApproveThenCallContractApproved
} from "./helpers/SignatureUtils";

const TestTargetContract = artifacts.require("TestTargetContract");

contract("TransferModule - approvedTransfer", (accounts: string[]) => {
  let defaultCtx: Context;
  let ctx: Context;

  let priceOracleMock: any;
  let targetContract: any;
  let maxQuota: BN;
  let quotaPeriod: number; // 24 * 3600; // 1 day

  let useMetaTx: boolean = false;

  const setOraclePrice = async (token: string, amount: BN, assetValue: BN) => {
    // Set the specified price
    token = await getTokenAddress(ctx, token);
    const data = ctx.priceCacheStore.contract.methods
      .tokenValue(token, amount.toString(10))
      .encodeABI();
    await priceOracleMock.givenCalldataReturnUint(data, assetValue);
  };

  const setOraclePrice0 = async (token: string, amount: BN, assetValue: BN) => {
    // Return 0 as the default
    await priceOracleMock.givenAnyReturnUint(new BN(0));
  };

  const description = (descr: string, metaTx: boolean = useMetaTx) => {
    return descr + (metaTx ? " (meta tx)" : "");
  };

  const equalWithPrecision = (
    n1: BN,
    n2: BN,
    precision: number = 2,
    description: string = ""
  ) => {
    // console.log("n1:", n1.toString(10));
    // console.log("n2:", n1.toString(10));
    // console.log("n1 - n2", Math.abs(n1.sub(n2).toNumber()));
    return assert(
      Math.abs(n1.sub(n2).toNumber()) < 10 ** precision,
      description
    );
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
    let assetValue = options.assetValue ? options.assetValue : amount;
    let isWhitelisted = options.isWhitelisted ? options.isWhitelisted : false;
    const gasToken = options.gasToken ? options.gasToken : "ETH";
    const gasPrice = options.gasPrice ? options.gasPrice : new BN(0);

    token = await getTokenAddress(ctx, token);

    // Set the value of the transfer on the price oracle
    await setOraclePrice(token, amount, assetValue);

    // Make sure the wallet has enough funds
    await addBalance(ctx, wallet, token, amount.mul(new BN(2)));
    // More realistic gas measurement
    await addBalance(
      ctx,
      await ctx.controllerImpl.collectTo(),
      gasToken,
      new BN(1)
    );

    // Cache quota data
    const oldAvailableQuota = await ctx.quotaStore.availableQuota(wallet);
    const oldSpentQuota = await ctx.quotaStore.spentQuota(wallet);
    // Cache balance data
    const oldBalanceWallet = await getBalance(ctx, token, wallet);
    const oldBalanceTo = await getBalance(ctx, token, to);

    const opt = useMetaTx
      ? { wallet, owner, gasToken, gasPrice }
      : { from: owner };

    // Transfer the tokens
    // if (approved) {
    //   await executeTransaction(
    //     ctx.transferModule.contract.methods.transferToken(
    //       wallet,
    //       token,
    //       to,
    //       amount.toString(10),
    //       logdata
    //     ),
    //     ctx,
    //     useMetaTx,
    //     wallet,
    //     [],
    //     opt
    //   );
    // } else {
    const tx = await executeTransaction(
      ctx.finalTransferModule.contract.methods.transferToken(
        wallet,
        token,
        to,
        amount.toString(10),
        logdata,
        !isWhitelisted
      ),
      ctx,
      useMetaTx,
      wallet,
      [],
      opt
    );
    //  }

    await assertEventEmitted(
      ctx.finalTransferModule,
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

    if (!gasPrice.eq(new BN(0))) return;

    // Check quota
    const newAvailableQuota = await ctx.quotaStore.availableQuota(wallet);
    const newSpentQuota = await ctx.quotaStore.spentQuota(wallet);

    const quotaDelta =
      isWhitelisted || oldAvailableQuota.eq(maxQuota) ? new BN(0) : assetValue;
    equalWithPrecision(
      oldAvailableQuota,
      newAvailableQuota.add(quotaDelta),
      15,
      "incorrect available quota"
    );

    equalWithPrecision(
      newSpentQuota,
      oldSpentQuota.add(quotaDelta),
      15,
      "incorrect spent quota"
    );

    // Check balances
    const newBalanceWallet = await getBalance(ctx, token, wallet);
    const newBalanceTo = await getBalance(ctx, token, to);
    const balalanceDelta = amount;
    assert(
      oldBalanceWallet.eq(newBalanceWallet.add(balalanceDelta)),
      "incorrect wallet balance"
    );
    assert(
      newBalanceTo.eq(oldBalanceTo.add(balalanceDelta)),
      "incorrect to balance"
    );
  };

  const transferTokenWAChecked = async (
    owner: string,
    wallet: string,
    token: string,
    to: string,
    amount: BN,
    logdata: string,
    options: any = {}
  ) => {
    let assetValue = options.assetValue ? options.assetValue : amount;
    let isWhitelisted = options.isWhitelisted ? options.isWhitelisted : false;
    token = await getTokenAddress(ctx, token);

    // Make sure the wallet has enough funds
    await addBalance(ctx, wallet, token, amount);

    // Cache balance data
    const oldBalanceWallet = await getBalance(ctx, token, wallet);
    const oldBalanceTo = await getBalance(ctx, token, to);

    const request: SignedRequest = {
      signers: options.signers,
      signatures: [],
      validUntil: Math.floor(new Date().getTime()),
      wallet
    };

    signTransferTokenApproved(
      request,
      token,
      to,
      amount,
      logdata,
      ctx.finalTransferModule.address
    );

    // Transfer the tokens
    await executeTransaction(
      ctx.finalTransferModule.contract.methods.transferTokenWA(
        request,
        token,
        to,
        amount.toString(10),
        logdata
      ),
      ctx,
      useMetaTx,
      wallet,
      [],
      { wallet, owner }
    );

    await assertEventEmitted(
      ctx.finalTransferModule,
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

    // Check balances
    const newBalanceWallet = await getBalance(ctx, token, wallet);
    const newBalanceTo = await getBalance(ctx, token, to);
    const balalanceDelta = amount;
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
    let assetValue = options.assetValue ? options.assetValue : value;
    let isWhitelisted = options.isWhitelisted ? options.isWhitelisted : false;
    let approved = options.signers ? true : false;

    const token = await getTokenAddress(ctx, "ETH");
    const data = targetContract.contract.methods
      .functionPayable(nonce)
      .encodeABI();

    // Set the value of the transfer on the price oracle
    await setOraclePrice(token, value, assetValue);

    await setOraclePrice0(to, new BN(0), new BN(0));

    // Make sure the wallet has enough funds
    await addBalance(ctx, wallet, token, value);

    // // Cache quota data
    // const oldAvailableQuota = await ctx.quotaStore.availableQuota(wallet);
    // const oldSpentQuota = await ctx.quotaStore.spentQuota(wallet);
    // Cache balance data
    const oldBalanceWallet = await getBalance(ctx, token, wallet);
    const oldBalanceTo = await getBalance(ctx, token, to);
    // Cache test data
    const testValueBefore = (await targetContract.value()).toNumber();

    const opt = useMetaTx ? { wallet, owner } : { from: owner };

    // Call the contract
    if (approved) {
      await executeTransaction(
        ctx.finalTransferModule.contract.methods.callContract(
          wallet,
          to,
          value.toString(10),
          data
        ),
        ctx,
        useMetaTx,
        wallet,
        [],
        opt
      );
    } else {
      await executeTransaction(
        ctx.finalTransferModule.contract.methods.callContract(
          wallet,
          to,
          value.toString(10),
          data
        ),
        ctx,
        useMetaTx,
        wallet,
        [],
        opt
      );
    }

    await assertEventEmitted(
      approved ? ctx.finalTransferModule : ctx.finalTransferModule,
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

    // // Check quota
    // const newAvailableQuota = await ctx.quotaStore.availableQuota(wallet);
    // const newSpentQuota = await ctx.quotaStore.spentQuota(wallet);
    // const quotaDelta = isWhitelisted || approved ? new BN(0) : assetValue;
    // assert(
    //   oldAvailableQuota.eq(newAvailableQuota.add(quotaDelta)),
    //   "incorrect available quota"
    // );
    // assert(
    //   newSpentQuota.eq(oldSpentQuota.add(quotaDelta)),
    //   "incorrect available quota"
    // );

    // Check balances
    const newBalanceWallet = await getBalance(ctx, token, wallet);
    const newBalanceTo = await getBalance(ctx, token, to);
    const balalanceDelta = value;
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
    const expectedTestValueAfter = nonce;
    assert.equal(
      testValueAfter,
      expectedTestValueAfter,
      "unexpected test value"
    );
  };

  const callContractWAChecked = async (
    owner: string,
    wallet: string,
    to: string,
    value: BN,
    nonce: number,
    options: any = {}
  ) => {
    const token = await getTokenAddress(ctx, "ETH");
    const data = targetContract.contract.methods
      .functionPayable(nonce)
      .encodeABI();

    await setOraclePrice0(token, new BN(0), new BN(0));

    // Make sure the wallet has enough funds
    await addBalance(ctx, wallet, token, value);

    // // Cache quota data
    // const oldAvailableQuota = await ctx.quotaStore.availableQuota(wallet);
    // const oldSpentQuota = await ctx.quotaStore.spentQuota(wallet);
    // Cache balance data
    const oldBalanceWallet = await getBalance(ctx, token, wallet);
    const oldBalanceTo = await getBalance(ctx, token, to);
    // Cache test data
    const testValueBefore = (await targetContract.value()).toNumber();

    const request: SignedRequest = {
      signers: options.signers,
      signatures: [],
      validUntil: Math.floor(new Date().getTime()),
      wallet
    };

    signCallContractApproved(
      request,
      to,
      value,
      data,
      ctx.finalTransferModule.address
    );

    await executeTransaction(
      ctx.finalTransferModule.contract.methods.callContractWA(
        request,
        to,
        value.toString(10),
        data
      ),
      ctx,
      useMetaTx,
      wallet,
      [],
      { wallet, owner }
    );

    await assertEventEmitted(
      ctx.finalTransferModule,
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

    // Check balances
    const newBalanceWallet = await getBalance(ctx, token, wallet);
    const newBalanceTo = await getBalance(ctx, token, to);
    const balalanceDelta = value;
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
    const expectedTestValueAfter = nonce;
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
    let assetValue = options.assetValue ? options.assetValue : amount;
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

    const opt = useMetaTx ? { wallet, owner } : { from: owner };

    // Approve the tokens
    if (approved) {
      await executeTransaction(
        ctx.finalTransferModule.contract.methods.approveToken(
          wallet,
          token,
          to,
          amount.toString(10)
        ),
        ctx,
        useMetaTx,
        wallet,
        [],
        opt
      );
    } else {
      await executeTransaction(
        ctx.finalTransferModule.contract.methods.approveToken(
          wallet,
          token,
          to,
          amount.toString(10)
        ),
        ctx,
        useMetaTx,
        wallet,
        [],
        opt
      );
    }
    await assertEventEmitted(
      approved ? ctx.finalTransferModule : ctx.finalTransferModule,
      "Approved",
      (event: any) => {
        return (
          event.wallet === wallet &&
          event.token === token &&
          event.spender === to &&
          event.amount.eq(amount)
        );
      }
    );

    // Check quota
    const newAvailableQuota = await ctx.quotaStore.availableQuota(wallet);
    const newSpentQuota = await ctx.quotaStore.spentQuota(wallet);
    const quotaDelta = isWhitelisted || approved ? new BN(0) : assetValue;
    equalWithPrecision(
      oldAvailableQuota,
      newAvailableQuota.add(quotaDelta),
      15,
      "incorrect available quota"
    );

    equalWithPrecision(
      newSpentQuota,
      oldSpentQuota.add(quotaDelta),
      15,
      "incorrect spent quota"
    );

    // Check Allowance
    const newAllowanceTo = await getAllowance(ctx, token, wallet, to);
    assert(newAllowanceTo.eq(amount), "incorrect allowance");
  };

  const approveTokenWAChecked = async (
    owner: string,
    wallet: string,
    token: string,
    to: string,
    amount: BN,
    options: any = {}
  ) => {
    let isWhitelisted = options.isWhitelisted ? options.isWhitelisted : false;
    token = await getTokenAddress(ctx, token);

    await setOraclePrice0(token, new BN(0), new BN(0));
    // Cache balance data
    const oldAllowanceTo = await getAllowance(ctx, token, wallet, to);

    const request: SignedRequest = {
      signers: options.signers,
      signatures: [],
      validUntil: Math.floor(new Date().getTime()),
      wallet
    };

    signApproveTokenApproved(
      request,
      token,
      to,
      amount,
      ctx.finalTransferModule.address
    );

    // Approve the tokens
    await executeTransaction(
      ctx.finalTransferModule.contract.methods.approveTokenWA(
        request,
        token,
        to,
        amount.toString(10)
      ),
      ctx,
      useMetaTx,
      wallet,
      [],
      { wallet, owner }
    );

    await assertEventEmitted(
      ctx.finalTransferModule,
      "Approved",
      (event: any) => {
        return (
          event.wallet === wallet &&
          event.token === token &&
          event.spender === to &&
          event.amount.eq(amount)
        );
      }
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
    value: BN,
    nonce: number,
    options: any = {}
  ) => {
    let isWhitelisted = options.isWhitelisted ? options.isWhitelisted : false;
    let assetValue = options.assetValue ? options.assetValue : amount;
    let approved = options.signers ? true : false;

    token = await getTokenAddress(ctx, token);

    const data = targetContract.contract.methods
      .functionPayable(nonce)
      .encodeABI();

    // // Cache quota data
    // const oldAvailableQuota = await ctx.quotaStore.availableQuota(wallet);
    // const oldSpentQuota = await ctx.quotaStore.spentQuota(wallet);
    // Cache balance data
    const oldAllowanceTo = await getAllowance(ctx, token, wallet, to);

    // Set the value of the transfer on the price oracle
    await setOraclePrice0(token, amount, assetValue);
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

    const opt = useMetaTx ? { wallet, owner } : { from: owner };
    // Approve the tokens and call the contract
    if (approved) {
      await executeTransaction(
        ctx.finalTransferModule.contract.methods.approveThenCallContract(
          wallet,
          token,
          to,
          amount.toString(10),
          value.toString(10),
          data
        ),
        ctx,
        useMetaTx,
        wallet,
        [],
        opt
      );
    } else {
      await executeTransaction(
        ctx.finalTransferModule.contract.methods.approveThenCallContract(
          wallet,
          token,
          to,
          amount.toString(10),
          value.toString(10),
          data
        ),
        ctx,
        useMetaTx,
        wallet,
        [],
        opt
      );
    }
    await assertEventEmitted(
      approved ? ctx.finalTransferModule : ctx.finalTransferModule,
      "Approved",
      (event: any) => {
        return (
          event.wallet === wallet &&
          event.token === token &&
          event.spender === to &&
          event.amount.eq(amount)
        );
      }
    );
    await assertEventEmitted(
      approved ? ctx.finalTransferModule : ctx.finalTransferModule,
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

    // // Check quota
    // const newAvailableQuota = await ctx.quotaStore.availableQuota(wallet);
    // const newSpentQuota = await ctx.quotaStore.spentQuota(wallet);
    // const quotaDelta = isWhitelisted || approved ? new BN(0) : assetValue;
    // assert(
    //   oldAvailableQuota.eq(newAvailableQuota.add(quotaDelta)),
    //   "incorrect available quota"
    // );
    // assert(
    //   newSpentQuota.eq(oldSpentQuota.add(quotaDelta)),
    //   "incorrect available quota"
    // );
    // Check Allowance
    const newAllowanceTo = await getAllowance(ctx, token, wallet, to);
    assert(newAllowanceTo.eq(amount), "incorrect allowance");
    // Check test value
    const testValueAfter = (await targetContract.value()).toNumber();
    assert.equal(testValueAfter, nonce, "unexpected test value");
  };

  const approveThenCallContractWAChecked = async (
    owner: string,
    wallet: string,
    token: string,
    to: string,
    amount: BN,
    value: BN,
    nonce: number,
    options: any = {}
  ) => {
    token = await getTokenAddress(ctx, token);
    const data = targetContract.contract.methods
      .functionPayable(nonce)
      .encodeABI();

    await setOraclePrice0(token, value, new BN(0));
    // Cache balance data
    const oldAllowanceTo = await getAllowance(ctx, token, wallet, to);

    const request: SignedRequest = {
      signers: options.signers,
      signatures: [],
      validUntil: Math.floor(new Date().getTime()),
      wallet
    };

    signApproveThenCallContractApproved(
      request,
      token,
      to,
      amount,
      value,
      data,
      ctx.finalTransferModule.address
    );

    // Approve the tokens and call the contract
    await executeTransaction(
      ctx.finalTransferModule.contract.methods.approveThenCallContractWA(
        request,
        token,
        to,
        amount.toString(10),
        value.toString(10),
        data
      ),
      ctx,
      useMetaTx,
      wallet,
      [],
      { wallet, owner }
    );
    await assertEventEmitted(
      ctx.finalTransferModule,
      "Approved",
      (event: any) => {
        return (
          event.wallet === wallet &&
          event.token === token &&
          event.spender === to &&
          event.amount.eq(amount)
        );
      }
    );
    await assertEventEmitted(
      ctx.finalTransferModule,
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

    // Check Allowance
    const newAllowanceTo = await getAllowance(ctx, token, wallet, to);
    assert(newAllowanceTo.eq(amount), "incorrect allowance");
    // Check test value
    const testValueAfter = (await targetContract.value()).toNumber();
    assert.equal(testValueAfter, nonce, "unexpected test value");
  };

  before(async () => {
    defaultCtx = await getContext();
    priceOracleMock = await defaultCtx.contracts.MockContract.new();
  });

  beforeEach(async () => {
    ctx = await createContext(defaultCtx, {
      priceOracle: priceOracleMock.address
    });
    targetContract = await TestTargetContract.new();
    quotaPeriod = (
      await ctx.finalTransferModule.QUOTA_PENDING_PERIOD()
    ).toNumber();
    maxQuota = await ctx.quotaStore.MAX_QUOTA();
  });

  describe("Benchmark", () => {
    [false, true].forEach(function(withQuota) {
      it(
        "Token transfer " + (withQuota ? "(with quota)" : "(without quota)"),
        async () => {
          useMetaTx = true;
          const owner = ctx.owners[withQuota ? 0 : 1];
          const to = ctx.miscAddresses[withQuota ? 0 : 1];

          // Use a cached price oracle
          const TestPriceOracle = artifacts.require("TestPriceOracle");
          const testPriceOracle = await TestPriceOracle.new();
          const PriceCacheStore = artifacts.require("PriceCacheStore");
          const priceCacheStore = await PriceCacheStore.new(
            testPriceOracle.address
          );
          const lrcAddress = await getTokenAddress(ctx, "LRC");
          await priceCacheStore.updateTokenPrice(lrcAddress, toAmount("1"));

          ctx = await createContext(defaultCtx, {
            priceOracle: priceCacheStore.address
          });

          const { wallet } = await createWallet(ctx, owner);

          if (withQuota) {
            const targetQuota = toAmount("10");
            await ctx.finalTransferModule.changeDailyQuota(
              wallet,
              targetQuota.toString(10),
              { from: owner }
            );
            // Skip forward `quotaPeriod`
            await advanceTimeAndBlockAsync(quotaPeriod);
          }

          const quota = await ctx.quotaStore.currentQuota(wallet);

          // Use up the quota in multiple transfers
          const transferValue = withQuota
            ? quota.div(new BN(7))
            : toAmount("1");
          await transferTokenChecked(
            owner,
            wallet,
            "ETH",
            to,
            transferValue,
            "0x"
          );

          await transferTokenChecked(
            owner,
            wallet,
            "ETH",
            to,
            transferValue,
            "0x"
          );

          await transferTokenChecked(
            owner,
            wallet,
            "LRC",
            to,
            transferValue,
            "0x",
            { assetValue: transferValue }
          );

          await transferTokenChecked(
            owner,
            wallet,
            "LRC",
            to,
            transferValue,
            "0x",
            { assetValue: transferValue }
          );

          await transferTokenChecked(
            owner,
            wallet,
            "LRC",
            to,
            transferValue,
            "0x",
            {
              assetValue: transferValue,
              gasToken: "ETH",
              gasPrice: new BN(web3.utils.toWei("12", "gwei"))
            }
          );

          await transferTokenChecked(
            owner,
            wallet,
            "LRC",
            to,
            transferValue,
            "0x",
            {
              assetValue: transferValue,
              gasToken: "LRC",
              gasPrice: new BN(web3.utils.toWei("34", "gwei"))
            }
          );
        }
      );
    });
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

          if (!useMetaTx) {
            // Try to transfer more than the quota
            await expectThrow(
              transferTokenChecked(
                owner,
                wallet,
                "ETH",
                to,
                quota.add(new BN(1)),
                "0x"
              ),
              "QUOTA_EXCEEDED"
            );
          }

          // Transfer the complete quota
          await transferTokenChecked(owner, wallet, "ETH", to, quota, "0xa45d");

          if (!useMetaTx) {
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
          }

          // Skip forward `quotaPeriod` to revert used quota back to 0
          await advanceTimeAndBlockAsync(quotaPeriod);

          // Use up the quota in multiple transfers
          const transferValue = quota.div(new BN(3));
          await transferTokenChecked(
            owner,
            wallet,
            "ETH",
            to,
            transferValue,
            "0x1234"
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

          if (!useMetaTx) {
            // Try to transfer an additional amount
            await expectThrow(
              transferTokenChecked(
                owner,
                wallet,
                "ETH",
                to,
                transferValue,
                "0x"
              ),
              "QUOTA_EXCEEDED"
            );
          }

          // Skip forward `quotaPeriod/2`
          await advanceTimeAndBlockAsync(quotaPeriod / 2);

          // Transfer now successfully
          await transferTokenChecked(
            owner,
            wallet,
            "ETH",
            to,
            transferValue,
            "0x"
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
            transferValue,
            "0x1234"
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
            quota.add(new BN(1)),
            "0x",
            { isWhitelisted: true }
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

          // Transfer the complete quota
          await callContractChecked(owner, wallet, to, quota, ++nonce);

          // Skip forward `quotaPeriod` to revert used quota back to 0
          await advanceTimeAndBlockAsync(quotaPeriod);

          // Use up the quota in multiple transfers
          const transferValue = quota.div(new BN(3));
          await callContractChecked(owner, wallet, to, transferValue, ++nonce);
          await callContractChecked(owner, wallet, to, transferValue, ++nonce);
          await callContractChecked(owner, wallet, to, transferValue, ++nonce);

          // Skip forward `quotaPeriod/2`
          await advanceTimeAndBlockAsync(quotaPeriod / 2);

          // Transfer now successfully
          await callContractChecked(owner, wallet, to, transferValue, nonce);
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
          await callContractChecked(owner, wallet, to, transferValue, ++nonce);

          // Whitelist the destination
          await addToWhitelist(ctx, owner, wallet, to);

          // Shouldn't use the quota anymore
          await callContractChecked(owner, wallet, to, transferValue, ++nonce, {
            isWhitelisted: true
          });

          // Should be able to transfer more than the quota
          await callContractChecked(
            owner,
            wallet,
            to,
            quota.add(new BN(1)),
            ++nonce,
            { isWhitelisted: true }
          );
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

          if (!useMetaTx) {
            // Do a call to a token contract
            await expectThrow(
              callContractChecked(owner, wallet, to, new BN(1), 1),
              "CALL_DISALLOWED"
            );
          }
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

          if (!useMetaTx) {
            // Do a call to a token contract
            await expectThrow(
              callContractChecked(owner, wallet, wallet, new BN(0), 1),
              "CALL_DISALLOWED"
            );
          }
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

          if (!useMetaTx) {
            // Try to approve more than the quota
            await expectThrow(
              approveTokenChecked(owner, wallet, "WETH", to, toAmount("0.7"), {
                assetValue: quota.add(new BN(1))
              }),
              "QUOTA_EXCEEDED"
            );
          }

          // Transfer the complete quota
          await approveTokenChecked(
            owner,
            wallet,
            "WETH",
            to,
            toAmount("0.7"),
            { assetValue: quota }
          );

          if (!useMetaTx) {
            // Try to transfer an additional small amount
            await expectThrow(
              approveTokenChecked(owner, wallet, "REP", to, toAmount("100"), {
                assetValue: quota.div(new BN(100))
              }),
              "QUOTA_EXCEEDED"
            );
          }

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

          if (!useMetaTx) {
            // Try to approve an additional amount
            await expectThrow(
              approveTokenChecked(owner, wallet, "LRC", to, toAmount("4"), {
                assetValue: approveValue.mul(new BN(4))
              }),
              "QUOTA_EXCEEDED"
            );
          }

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

          if (!useMetaTx) {
            // Try to approve more than the quota
            await expectThrow(
              approveThenCallContractChecked(
                owner,
                wallet,
                "WETH",
                to,
                toAmount("0.7"),
                toAmount("0"),
                ++nonce,
                { assetValue: quota.add(new BN(1)) }
              ),
              "QUOTA_EXCEEDED"
            );
          }

          // Transfer the complete quota
          await approveThenCallContractChecked(
            owner,
            wallet,
            "WETH",
            to,
            toAmount("0.7"),
            toAmount("0"),
            ++nonce,
            { assetValue: quota }
          );

          if (!useMetaTx) {
            // Try to transfer an additional small amount
            await expectThrow(
              approveThenCallContractChecked(
                owner,
                wallet,
                "REP",
                to,
                toAmount("100"),
                toAmount("0"),
                ++nonce,
                { assetValue: quota.div(new BN(100)) }
              ),
              "QUOTA_EXCEEDED"
            );
          }

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
            toAmount("0"),
            ++nonce,
            { assetValue: approveValue }
          );
          await approveThenCallContractChecked(
            owner,
            wallet,
            "LRC",
            to,
            toAmount("2"),
            toAmount("0"),
            ++nonce,
            { assetValue: approveValue.mul(new BN(2)) }
          );

          if (!useMetaTx) {
            // Try to approve an additional amount
            await expectThrow(
              approveThenCallContractChecked(
                owner,
                wallet,
                "LRC",
                to,
                toAmount("4"),
                toAmount("0"),
                ++nonce,
                { assetValue: approveValue.mul(new BN(4)) }
              ),
              "QUOTA_EXCEEDED"
            );
          }

          // Skip forward `quotaPeriod/2`
          await advanceTimeAndBlockAsync(quotaPeriod);

          // Approve now successfully
          await approveThenCallContractChecked(
            owner,
            wallet,
            "LRC",
            to,
            toAmount("4"),
            toAmount("0"),
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
            toAmount("0"),
            ++nonce,
            { assetValue: approveValue.mul(new BN(2)) }
          );
          await approveThenCallContractChecked(
            owner,
            wallet,
            "LRC",
            to,
            toAmount("1"),
            toAmount("0"),
            ++nonce,
            { assetValue: approveValue.mul(new BN(1)) }
          );
          await approveThenCallContractChecked(
            owner,
            wallet,
            "LRC",
            to,
            toAmount("0"),
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
            toAmount("0"),
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
            toAmount("0"),
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
            toAmount("0"),
            ++nonce,
            { assetValue: quota.add(new BN(1)), isWhitelisted: true }
          );
        }
      );
    });
  });

  describe("ApprovedTransferModule", () => {
    it("owner should be able to transfer without limits with majority", async () => {
      useMetaTx = true;
      const owner = ctx.owners[0];
      const to = ctx.miscAddresses[0];
      const { wallet, guardians } = await createWallet(ctx, owner, 2);

      const quota = await ctx.quotaStore.currentQuota(wallet);
      const transferValue = quota.mul(new BN(2));

      // Transfer
      const numSignersRequired = Math.floor((1 + guardians.length) / 2) + 1;

      const signers = [owner, ...guardians.slice(0, numSignersRequired)].sort();
      await transferTokenWAChecked(
        owner,
        wallet,
        "ETH",
        to,
        transferValue,
        "0x1234",
        { signers }
      );
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
      const signers = [owner, ...guardians.slice(0, numSignersRequired)].sort();
      await approveTokenWAChecked(owner, wallet, "WETH", to, toAmount("0.7"), {
        assetValue: transferValue,
        signers
      });
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

      const signers = [owner, ...guardians.slice(0, numSignersRequired)].sort();
      await callContractWAChecked(owner, wallet, to, transferValue, ++nonce, {
        signers
      });
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
      const signers = [owner, ...guardians.slice(0, numSignersRequired)].sort();
      await approveThenCallContractWAChecked(
        owner,
        wallet,
        "REP",
        to,
        toAmount("0.35"),
        toAmount("0"),
        ++nonce,
        { assetValue: transferValue, signers }
      );
    });

    // it("owner should not be able to call the wallet itself", async () => {
    //   useMetaTx = true;
    //   const owner = ctx.owners[0];
    //   const { wallet, guardians } = await createWallet(ctx, owner, 2);
    //   const signers = [owner, ...guardians].sort();

    //   // Do a call to a token contract
    //   await expectThrow(
    //     callContractWAChecked(owner, wallet, wallet, new BN(0), 1, { signers }),
    //     "CALL_DISALLOWED"
    //   );
    // });
  });
});
