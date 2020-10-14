import BN = require("bn.js");
import { Constants, roundToFloatValue } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { BalanceSnapshot, ExchangeTestUtil } from "./testExchangeUtil";
import { AuthMethod, Deposit, SpotTrade } from "./types";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
  let depositContract: any;
  let loopring: any;
  let exchangeID = 0;

  const depositChecked = async (
    from: string,
    to: string,
    token: string,
    amount: BN
  ) => {
    const snapshot = new BalanceSnapshot(exchangeTestUtil);
    await snapshot.watchBalance(to, token, "recipient");
    await snapshot.transfer(
      from,
      depositContract.address,
      token,
      amount,
      "from",
      "depositContract"
    );

    const ethAddress = exchangeTestUtil.getTokenAddress("ETH");
    const ethValue = token === ethAddress ? amount : 0;
    // Deposit
    await exchange.deposit(from, to, token, amount, "0x", {
      from: from,
      value: ethValue,
      gasPrice: 0
    });

    // Verify balances
    await snapshot.verifyBalances();

    // Get the Deposit event
    const event = await exchangeTestUtil.assertEventEmitted(
      exchange,
      "DepositRequested"
    );
    assert.equal(event.to, to, "owner unexpected");
    assert.equal(
      event.token,
      exchangeTestUtil.getTokenAddress(token),
      "token unexpected"
    );
    assert(event.amount.eq(amount), "amount unexpected");
  };

  const submitWithdrawalBlockChecked = async (
    deposits: Deposit[],
    expectedSuccess?: boolean[],
    expectedTo?: string[],
    blockFee?: BN
  ) => {
    assert.equal(
      exchangeTestUtil.pendingBlocks[exchangeID].length,
      1,
      "unexpected number of pending blocks"
    );
    const block = exchangeTestUtil.pendingBlocks[exchangeID][0];

    // Block fee
    const feeRecipient = exchangeTestUtil.exchangeOperator;
    blockFee = new BN(0);
    let numWithdrawals = 0;
    for (const tx of block.internalBlock.transactions) {
      if (tx.txType === "Withdraw") {
        numWithdrawals++;
        if (tx.type >= 2) {
          blockFee.iadd(tx.withdrawalFee);
        }
      } else if (tx.txType === "Deposit") {
      }
    }

    if (expectedSuccess === undefined) {
      expectedSuccess = new Array(numWithdrawals).fill(true);
    }

    if (expectedTo === undefined) {
      expectedTo = new Array(deposits.length).fill(Constants.zeroAddress);
      for (const [i, deposit] of deposits.entries()) {
        expectedTo[i] =
          deposit.owner === Constants.zeroAddress
            ? await loopring.protocolFeeVault()
            : deposit.owner;
      }
    }

    // Simulate all transfers
    const snapshot = new BalanceSnapshot(exchangeTestUtil);
    // Simulate withdrawals
    for (const [i, deposit] of deposits.entries()) {
      await snapshot.transfer(
        depositContract.address,
        expectedTo[i],
        deposit.token,
        expectedSuccess[i] ? deposit.amount : new BN(0),
        "depositContract",
        "to"
      );
    }
    // Simulate block fee payment
    // await snapshot.transfer(
    //   exchange.address,
    //   feeRecipient,
    //   "ETH",
    //   blockFee,
    //   "exchange",
    //   "feeRecipient"
    // );

    // Submit the block
    await exchangeTestUtil.submitPendingBlocks();

    // Verify balances
    await snapshot.verifyBalances();

    // Check events
    // WithdrawalCompleted events
    {
      const numEventsExpected = expectedSuccess.filter(x => x === true).length;
      const events = await exchangeTestUtil.assertEventsEmitted(
        exchange,
        "WithdrawalCompleted",
        numEventsExpected
      );
      let c = 0;
      for (const [i, deposit] of deposits.entries()) {
        if (expectedSuccess[i]) {
          assert.equal(events[c].from, deposit.owner, "from should match");
          assert.equal(events[c].to, expectedTo[i], "to should match");
          assert.equal(events[c].token, deposit.token, "token should match");
          assert(events[c].amount.eq(deposit.amount), "amount should match");
          c++;
        }
      }
      assert.equal(
        events.length,
        c,
        "Unexpected num WithdrawalCompleted events"
      );
    }
    // WithdrawalFailed events
    {
      const numEventsExpected = expectedSuccess.filter(x => x === false).length;
      const events = await exchangeTestUtil.assertEventsEmitted(
        exchange,
        "WithdrawalFailed",
        numEventsExpected
      );
      let c = 0;
      for (const [i, deposit] of deposits.entries()) {
        if (!expectedSuccess[i]) {
          assert.equal(events[c].from, deposit.owner, "from should match");
          assert.equal(events[c].to, expectedTo[i], "to should match");
          assert.equal(events[c].token, deposit.token, "token should match");
          assert(events[c].amount.eq(deposit.amount), "amount should match");
          c++;
        }
      }
      assert.equal(events.length, c, "Unexpected num WithdrawalFailed events");
    }

    // Check the BlockSubmitted event
    const event = await exchangeTestUtil.assertEventEmitted(
      exchange,
      "BlockSubmitted"
    );
    assert.equal(
      event.blockIdx.toNumber(),
      block.blockIdx,
      "Unexpected block idx"
    );
  };

  const withdrawOnceChecked = async (
    owner: string,
    token: string,
    expectedAmount: BN
  ) => {
    const snapshot = new BalanceSnapshot(exchangeTestUtil);
    await snapshot.transfer(
      depositContract.address,
      owner,
      token,
      expectedAmount,
      "depositContract",
      "owner"
    );

    // Check how much will be withdrawn
    const onchainAmountWithdrawableBefore = await exchange.getAmountWithdrawable(
      owner,
      token
    );
    assert(
      onchainAmountWithdrawableBefore.eq(expectedAmount),
      "unexpected withdrawable amount"
    );

    await exchange.withdrawFromApprovedWithdrawals([owner], [token], {
      from: exchangeTestUtil.testContext.orderOwners[10]
    });

    // Complete amount needs to be withdrawn
    const onchainAmountWithdrawableAfter = await exchange.getAmountWithdrawable(
      owner,
      token
    );
    assert(
      onchainAmountWithdrawableAfter.eq(new BN(0)),
      "unexpected withdrawable amount"
    );

    // Verify balances
    await snapshot.verifyBalances();

    // Get the WithdrawalCompleted event
    const event = await exchangeTestUtil.assertEventEmitted(
      exchange,
      "WithdrawalCompleted"
    );
    assert.equal(event.from, owner, "from unexpected");
    assert.equal(event.to, owner, "to unexpected");
    assert.equal(event.token, token, "token unexpected");
    assert(event.amount.eq(expectedAmount), "amount unexpected");
  };

  const withdrawChecked = async (
    owner: string,
    token: string,
    expectedAmount: BN
  ) => {
    // Withdraw
    await withdrawOnceChecked(owner, token, expectedAmount);
    // Withdraw again, no tokens should be transferred
    await withdrawOnceChecked(owner, token, new BN(0));
  };

  const createExchange = async (setupTestState: boolean = true) => {
    exchangeID = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      { setupTestState }
    );
    exchange = exchangeTestUtil.exchange;
    depositContract = exchangeTestUtil.depositContract;
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    exchange = exchangeTestUtil.exchange;
    loopring = exchangeTestUtil.loopringV3;
    depositContract = exchangeTestUtil.depositContract;
    exchangeID = 1;
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  describe("DepositWithdraw", function() {
    this.timeout(0);

    it("ERC20: Deposit", async () => {
      await createExchange();

      const owner = exchangeTestUtil.testContext.orderOwners[0];
      let amount = new BN(web3.utils.toWei("7", "ether"));
      let token = exchangeTestUtil.getTokenAddress("LRC");

      // Insufficient funds
      await exchangeTestUtil.setBalanceAndApprove(
        owner,
        token,
        amount.sub(new BN(1))
      );

      // Set the correct balance/approval
      await exchangeTestUtil.setBalanceAndApprove(owner, token, amount);

      // Do deposit to the same account with another token
      token = exchangeTestUtil.getTokenAddress("WETH");
      amount = new BN(web3.utils.toWei("4.5", "ether"));

      // New balance/approval for another deposit
      await exchangeTestUtil.setBalanceAndApprove(owner, token, amount);

      // Everything correct
      await depositChecked(owner, owner, token, amount);
    });

    it("ETH: Deposit", async () => {
      await createExchange(false);

      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const amount = new BN(web3.utils.toWei("3", "ether"));
      const token = exchangeTestUtil.getTokenAddress("ETH");

      // Everything correct
      await depositChecked(owner, owner, token, amount);
    });

    it("ERC20: Deposit to a different account", async () => {
      await createExchange(false);

      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const amount = new BN(web3.utils.toWei("3", "ether"));
      const token = exchangeTestUtil.getTokenAddress("LRC");

      // Account that will deposit the funds
      const from = exchangeTestUtil.testContext.orderOwners[1];

      // Provide enough balance for the 'from' account
      await exchangeTestUtil.setBalanceAndApprove(from, token, amount);

      // Deposit
      await depositChecked(from, owner, token, amount);
    });

    it("ETH: Deposit to a different account", async () => {
      await createExchange(false);

      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const amount = new BN(web3.utils.toWei("3", "ether"));
      const token = exchangeTestUtil.getTokenAddress("ETH");

      // Account that will deposit the funds
      const from = exchangeTestUtil.testContext.orderOwners[1];

      // Deposit
      await depositChecked(from, owner, token, amount);
    });

    it.only("Withdrawal (multiple authentication methods)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const authMethods = [
        AuthMethod.EDDSA,
        AuthMethod.ECDSA,
        AuthMethod.APPROVE
      ];

      // Do deposits
      const deposits: Deposit[] = [];
      const feeDeposits: Deposit[] = [];
      for (let i = 0; i < authMethods.length; i++) {
        let owner = exchangeTestUtil.testContext.orderOwners[i];
        const deposit = await exchangeTestUtil.deposit(
          owner,
          owner,
          token,
          exchangeTestUtil.getRandomSmallAmount()
        );
        deposits.push(deposit);
        // Fee
        const feeDeposit = await exchangeTestUtil.deposit(
          owner,
          owner,
          feeToken,
          exchangeTestUtil.getRandomSmallAmount()
        );
        feeDeposits.push(feeDeposit);
      }

      for (const [i, deposit] of deposits.entries()) {
        await exchangeTestUtil.requestWithdrawal(
          deposit.owner,
          deposit.token,
          deposit.amount,
          feeToken,
          feeDeposits[i].amount,
          {
            authMethod: authMethods[i],
            maxFee: feeDeposits[i].amount.mul(new BN(2))
          }
        );
      }

      await exchangeTestUtil.submitTransactions(16);
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("Withdrawal to different address (multiple authentication methods)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const authMethods = [
        AuthMethod.EDDSA,
        AuthMethod.ECDSA,
        AuthMethod.APPROVE
      ];

      // Do deposits
      const deposits: Deposit[] = [];
      const feeDeposits: Deposit[] = [];
      for (let i = 0; i < authMethods.length; i++) {
        let owner = exchangeTestUtil.testContext.orderOwners[i];
        const deposit = await exchangeTestUtil.deposit(
          owner,
          owner,
          token,
          exchangeTestUtil.getRandomSmallAmount()
        );
        deposits.push(deposit);
        // Fee
        const feeDeposit = await exchangeTestUtil.deposit(
          owner,
          owner,
          feeToken,
          exchangeTestUtil.getRandomSmallAmount()
        );
        feeDeposits.push(feeDeposit);
      }

      for (const [i, deposit] of deposits.entries()) {
        let to = exchangeTestUtil.testContext.orderOwners[deposits.length + i];
        await exchangeTestUtil.requestWithdrawal(
          deposit.owner,
          deposit.token,
          deposit.amount,
          feeToken,
          feeDeposits[i].amount,
          { authMethod: authMethods[i], to }
        );
      }

      await exchangeTestUtil.submitTransactions(16);
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("Withdrawal redirected to a different recipient (setWithdrawalRecipient)", async () => {
      await createExchange();

      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const ownerB = exchangeTestUtil.testContext.orderOwners[1];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const token = exchangeTestUtil.getTokenAddress("LRC");
      const recipient = ownerB;

      const deposit = await exchangeTestUtil.deposit(
        ownerA,
        ownerA,
        token,
        balance
      );
      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();

      // Do the withdrawal request
      const request = await exchangeTestUtil.requestWithdrawal(
        ownerA,
        token,
        balance,
        "ETH",
        new BN(0),
        { authMethod: AuthMethod.EDDSA, storeRecipient: true }
      );

      // Set a new recipient address
      await exchange.setWithdrawalRecipient(
        ownerA,
        ownerA,
        token,
        balance,
        request.storageID,
        recipient,
        { from: ownerA }
      );
      // Try to set it again
      await expectThrow(
        exchange.setWithdrawalRecipient(
          ownerA,
          ownerA,
          token,
          balance,
          request.storageID,
          recipient,
          { from: ownerA }
        ),
        "CANNOT_OVERRIDE_RECIPIENT_ADDRESS"
      );
      {
        const onchainRecipient = await exchange.getWithdrawalRecipient(
          ownerA,
          ownerA,
          token,
          balance,
          request.storageID
        );
        assert.equal(onchainRecipient, recipient, "unexpected recipient");
      }

      // Commit the withdrawal
      await exchangeTestUtil.submitTransactions();

      // Submit the block
      const expectedResult = { ...deposit };
      await submitWithdrawalBlockChecked([expectedResult], undefined, [
        recipient
      ]);

      // Try to set it again even after the block has been submitted
      await expectThrow(
        exchange.setWithdrawalRecipient(
          ownerA,
          ownerA,
          token,
          balance,
          request.storageID,
          ownerA,
          { from: ownerA }
        ),
        "CANNOT_OVERRIDE_RECIPIENT_ADDRESS"
      );

      {
        const onchainRecipient = await exchange.getWithdrawalRecipient(
          ownerA,
          ownerA,
          token,
          balance,
          request.storageID
        );
        assert.equal(onchainRecipient, recipient, "unexpected recipient");
      }
    });

    it("Forced withdrawal (correct owner)", async () => {
      await createExchange();

      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const token = exchangeTestUtil.getTokenAddress("LRC");
      const one = new BN(1);

      const deposit = await exchangeTestUtil.deposit(
        ownerA,
        ownerA,
        token,
        balance
      );
      const accountID = deposit.accountID;
      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();

      const withdrawalFee = await exchangeTestUtil.loopringV3.forcedWithdrawalFee();

      // No ETH sent
      await expectThrow(
        exchange.forceWithdraw(ownerA, token, accountID, {
          from: ownerA,
          value: new BN(0)
        }),
        "INSUFFICIENT_FEE"
      );
      // Not enough ETH sent
      await expectThrow(
        exchange.forceWithdraw(ownerA, token, accountID, {
          from: ownerA,
          value: withdrawalFee.sub(one)
        }),
        "INSUFFICIENT_FEE"
      );

      // Do the request
      await exchangeTestUtil.requestWithdrawal(
        ownerA,
        token,
        balance,
        "ETH",
        new BN(0),
        { authMethod: AuthMethod.FORCE }
      );

      // Commit the withdrawal
      await exchangeTestUtil.submitTransactions();

      // Submit the block
      const expectedResult = { ...deposit };
      await submitWithdrawalBlockChecked([expectedResult]);
    });

    it("Forced withdrawal (incorrect owner)", async () => {
      await createExchange();

      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const ownerB = exchangeTestUtil.testContext.orderOwners[1];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const token = exchangeTestUtil.getTokenAddress("LRC");

      const deposit = await exchangeTestUtil.deposit(
        ownerA,
        ownerA,
        token,
        balance
      );
      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();

      // Do the request
      await exchangeTestUtil.requestWithdrawal(
        ownerA,
        token,
        balance,
        "ETH",
        new BN(0),
        { authMethod: AuthMethod.FORCE, signer: ownerB }
      );

      // Commit the withdrawal
      await exchangeTestUtil.submitTransactions();

      // Submit the block
      const expectedResult = { ...deposit };
      expectedResult.amount = new BN(0);
      await submitWithdrawalBlockChecked([expectedResult]);
    });

    it.skip("Number of open onchain withdrawal requests needs to be limited", async () => {
      await createExchange(false);
      await exchangeTestUtil.submitTransactions();

      // Do a deposit
      const deposit = await exchangeTestUtil.doRandomDeposit();
      // Commit the deposits
      await exchangeTestUtil.submitTransactions();

      exchangeTestUtil.autoCommit = false;

      // Do all withdrawals allowed
      const maxWithdrawals = exchangeTestUtil.MAX_OPEN_FORCED_REQUESTS;
      for (let i = 0; i < maxWithdrawals; i++) {
        await exchangeTestUtil.doRandomOnchainWithdrawal(deposit);
      }

      // Do another one
      await expectThrow(
        exchangeTestUtil.doRandomOnchainWithdrawal(deposit),
        "TOO_MANY_REQUESTS_OPEN"
      );

      // Commit the deposits
      await exchangeTestUtil.submitTransactions();

      // Do another one
      await exchangeTestUtil.doRandomOnchainWithdrawal(deposit);

      exchangeTestUtil.autoCommit = true;
    });

    it("Withdrawal (token == feeToken)", async () => {
      await createExchange();

      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("4", "ether"));
      const toWithdraw = new BN(web3.utils.toWei("3", "ether"));
      const token = "ETH";
      const feeToken = "ETH";
      const fee = new BN(web3.utils.toWei("0.5", "ether"));

      const deposit = await exchangeTestUtil.deposit(
        owner,
        owner,
        token,
        balance
      );
      await exchangeTestUtil.requestWithdrawal(
        owner,
        token,
        toWithdraw,
        feeToken,
        fee,
        { maxFee: fee.mul(new BN(4)) }
      );

      await exchangeTestUtil.submitTransactions();

      // Submit the block
      const expectedResult = { ...deposit };
      expectedResult.amount = toWithdraw;
      await submitWithdrawalBlockChecked([expectedResult]);
    });

    it("Withdrawal (token != feeToken)", async () => {
      await createExchange();

      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("4", "ether"));
      const toWithdraw = new BN(web3.utils.toWei("3.5", "ether"));
      const token = "ETH";
      const feeToken = "LRC";
      const fee = new BN(web3.utils.toWei("0.5", "ether"));

      // Deposit token
      const deposit = await exchangeTestUtil.deposit(
        owner,
        owner,
        token,
        balance
      );
      // Deposit feeToken
      await exchangeTestUtil.deposit(owner, owner, feeToken, fee);

      await exchangeTestUtil.requestWithdrawal(
        owner,
        token,
        toWithdraw,
        feeToken,
        fee
      );
      await exchangeTestUtil.submitTransactions();

      // Submit the block
      const expectedResult = { ...deposit };
      expectedResult.amount = toWithdraw;
      await submitWithdrawalBlockChecked([expectedResult]);
    });

    it("Withdrawal (owner == operator)", async () => {
      await createExchange();

      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("4", "ether"));
      const toWithdraw = new BN(web3.utils.toWei("2", "ether"));
      const token = "ETH";
      const feeToken = "ETH";
      const fee = new BN(web3.utils.toWei("1.5", "ether"));

      const deposit = await exchangeTestUtil.deposit(
        owner,
        owner,
        token,
        balance
      );
      const accountID = deposit.accountID;

      await exchangeTestUtil.requestWithdrawal(
        owner,
        token,
        toWithdraw,
        feeToken,
        fee
      );

      // Set the operator
      exchangeTestUtil.setActiveOperator(accountID);

      await exchangeTestUtil.submitTransactions();

      // Submit the block
      const expectedResult = { ...deposit };
      expectedResult.amount = toWithdraw;
      await submitWithdrawalBlockChecked([expectedResult]);
    });

    [AuthMethod.EDDSA, AuthMethod.ECDSA].forEach(function(authMethod) {
      it("Withdrawal (fee > maxFee) (" + authMethod + ")", async () => {
        await createExchange();

        const owner = exchangeTestUtil.testContext.orderOwners[0];
        const balance = new BN(web3.utils.toWei("4", "ether"));
        const toWithdraw = new BN(web3.utils.toWei("2", "ether"));
        const token = "ETH";
        const feeToken = "ETH";
        const fee = new BN(web3.utils.toWei("1.5", "ether"));

        await exchangeTestUtil.deposit(owner, owner, token, balance);
        await exchangeTestUtil.requestWithdrawal(
          owner,
          token,
          toWithdraw,
          feeToken,
          fee,
          { maxFee: fee.div(new BN(3)), authMethod }
        );

        // Commit the transfers
        if (authMethod === AuthMethod.EDDSA) {
          await expectThrow(
            exchangeTestUtil.submitTransactions(),
            "invalid block"
          );
        } else {
          await exchangeTestUtil.submitTransactions();
          await expectThrow(
            exchangeTestUtil.submitPendingBlocks(),
            "WITHDRAWAL_FEE_TOO_HIGH"
          );
        }
      });
    });

    it("Withdraw (protocol fees)", async () => {
      await createExchange();

      const protocolFees = await exchange.getProtocolFeeValues();

      const ring: SpotTrade = {
        orderA: {
          tokenS: "ETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("1", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether"))
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "ETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("1", "ether"))
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(ring);

      const feeBipsAMM = 30;
      const tokenWeightS = new BN(web3.utils.toWei("1", "ether"));
      await exchangeTestUtil.requestAmmUpdate(
        exchangeTestUtil.exchangeOperator,
        ring.orderA.tokenS,
        feeBipsAMM,
        tokenWeightS
      );

      await exchangeTestUtil.requestWithdrawal(
        Constants.zeroAddress,
        ring.orderA.tokenB,
        ring.orderA.amountB,
        "ETH",
        new BN(0),
        { authMethod: AuthMethod.FORCE }
      );
      await exchangeTestUtil.requestWithdrawal(
        Constants.zeroAddress,
        ring.orderB.tokenB,
        ring.orderB.amountB,
        "ETH",
        new BN(0),
        { authMethod: AuthMethod.FORCE }
      );
      await exchangeTestUtil.submitTransactions(16);

      // Expected protocol fees earned
      const protocolFeeA = ring.orderA.amountB
        .mul(protocolFees.takerFeeBips)
        .div(new BN(100000));
      const protocolFeeB = ring.orderB.amountB
        .mul(protocolFees.makerFeeBips)
        .div(new BN(100000));

      const depositA: Deposit = {
        owner: Constants.zeroAddress,
        token: ring.orderA.tokenB,
        amount: protocolFeeA,
        timestamp: 0,
        accountID: 0,
        tokenID: await exchangeTestUtil.getTokenID(ring.orderA.tokenB)
      };
      const depositB: Deposit = {
        owner: Constants.zeroAddress,
        token: ring.orderB.tokenB,
        amount: protocolFeeB,
        timestamp: 0,
        accountID: 0,
        tokenID: await exchangeTestUtil.getTokenID(ring.orderB.tokenB)
      };

      const tokenA = exchangeTestUtil.getTokenAddress(ring.orderA.tokenB);
      const tokenB = exchangeTestUtil.getTokenAddress(ring.orderB.tokenB);

      // Get the time the protocol fees were withdrawn before
      const timestampBeforeA = await exchange.getProtocolFeeLastWithdrawnTime(
        tokenA
      );
      const timestampBeforeB = await exchange.getProtocolFeeLastWithdrawnTime(
        tokenB
      );

      // Submit the block
      await submitWithdrawalBlockChecked([depositA, depositB]);

      // Get the time the protocol fees were withdrawn after
      const timestampAfterA = await exchange.getProtocolFeeLastWithdrawnTime(
        tokenA
      );
      const timestampAfterB = await exchange.getProtocolFeeLastWithdrawnTime(
        tokenB
      );

      // Check that they were updated
      assert(
        timestampAfterA.gt(timestampBeforeA),
        "protocol fees withdrawal time unexpected"
      );
      assert(
        timestampAfterB.gt(timestampBeforeB),
        "protocol fees withdrawal time unexpected"
      );
    });

    it("Withdrawal (nonces)", async () => {
      await createExchange();

      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("4", "ether"));
      const toWithdraw = new BN(web3.utils.toWei("0.123", "ether"));
      const token = "ETH";
      const feeToken = "ETH";
      const fee = new BN(web3.utils.toWei("0.0456", "ether"));

      await exchangeTestUtil.deposit(owner, owner, token, balance);

      let storageID = 123;
      await exchangeTestUtil.requestWithdrawal(
        owner,
        token,
        toWithdraw,
        feeToken,
        fee,
        { storageID }
      );
      storageID++;
      await exchangeTestUtil.requestWithdrawal(
        owner,
        token,
        toWithdraw,
        feeToken,
        fee,
        { storageID }
      );
      storageID++;
      await exchangeTestUtil.requestWithdrawal(
        owner,
        token,
        toWithdraw,
        feeToken,
        fee,
        { storageID }
      );
      storageID += Constants.NUM_STORAGE_SLOTS;
      await exchangeTestUtil.requestWithdrawal(
        owner,
        token,
        toWithdraw,
        feeToken,
        fee,
        { storageID }
      );

      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();

      // Try to use the same slot again
      await exchangeTestUtil.requestWithdrawal(
        owner,
        token,
        toWithdraw,
        feeToken,
        fee,
        { storageID }
      );

      // Commit the withdrawals
      await expectThrow(exchangeTestUtil.submitTransactions(), "invalid block");
    });

    it("Deposits should not total more than MAX_AMOUNT", async () => {
      await createExchange();

      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const amount = Constants.MAX_AMOUNT.sub(new BN(97));
      const token = exchangeTestUtil.getTokenAddress("TEST");

      // Deposit
      await exchangeTestUtil.deposit(owner, owner, token, amount);
      // Deposit again. This time the amount will be capped to 2**96
      await expectThrow(
        exchangeTestUtil.deposit(owner, owner, token, amount),
        "ADD_OVERFLOW"
      );
    });

    it("Withdraw from approved withdrawal", async () => {
      await createExchange();

      const blockSize = 4;
      const tokens = ["LRC", "ETH", "ETH", "LRC"];
      const gasAmounts = [100000, 0, 50000, 100];

      // Do deposits
      const deposits: Deposit[] = [];
      for (let i = 0; i < blockSize; i++) {
        const owners = exchangeTestUtil.testContext.orderOwners;
        let owner = owners[i];
        let amount = exchangeTestUtil.getRandomSmallAmount();
        const deposit = await exchangeTestUtil.deposit(
          owner,
          owner,
          tokens[i],
          amount
        );
        deposits.push(deposit);
      }

      for (const [i, deposit] of deposits.entries()) {
        await exchangeTestUtil.requestWithdrawal(
          deposit.owner,
          deposit.token,
          deposit.amount,
          "LRC",
          new BN(0),
          { gas: gasAmounts[i] }
        );
      }

      // Commit the withdrawals
      await exchangeTestUtil.submitTransactions(16);

      // Submit the withdrawals
      const expectedSuccess = [true, false, true, false];
      await submitWithdrawalBlockChecked(deposits, expectedSuccess);

      // Do the withdrawals that cost too much gas manually
      for (const [i, deposit] of deposits.entries()) {
        if (!expectedSuccess[i]) {
          await withdrawChecked(deposit.owner, deposit.token, deposit.amount);
        }
      }
    });

    it("Block fee", async () => {
      await createExchange();

      const owners = exchangeTestUtil.testContext.orderOwners;

      const tokens = ["LRC", "ETH", "LRC", "ETH"];
      const deposits: Deposit[] = [];
      const numWithdrawals = 4;

      // Do some initial deposits so the deposit contract has some extra funds
      await exchangeTestUtil.deposit(
        owners[numWithdrawals],
        owners[numWithdrawals],
        "ETH",
        new BN(web3.utils.toWei("10"))
      );
      await exchangeTestUtil.deposit(
        owners[numWithdrawals],
        owners[numWithdrawals],
        "LRC",
        new BN(web3.utils.toWei("10"))
      );

      // Do deposits
      for (let i = 0; i < numWithdrawals; i++) {
        let owner = owners[i];
        let amount = exchangeTestUtil.getRandomSmallAmount();
        const deposit = await exchangeTestUtil.deposit(
          owner,
          owner,
          tokens[i],
          amount
        );
        deposits.push(deposit);
      }

      const expectedResults: Deposit[] = [];
      for (const [i, deposit] of deposits.entries()) {
        await exchangeTestUtil.randomizeWithdrawalFee();
        await exchangeTestUtil.requestWithdrawal(
          deposit.owner,
          deposit.token,
          deposit.amount,
          deposit.token,
          new BN(0),
          { authMethod: AuthMethod.FORCE }
        );
        const expectedResult = { ...deposit };
        expectedResult.amount = deposit.amount;
        expectedResults.push(expectedResult);
      }

      // Submit withdrawals
      await exchangeTestUtil.submitTransactions(24);
      await submitWithdrawalBlockChecked(expectedResults);
    });
  });
});
