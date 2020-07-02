import BN = require("bn.js");
import { BlockType, Constants, roundToFloatValue } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { BalanceSnapshot, ExchangeTestUtil } from "./testExchangeUtil";
import { Deposit, SpotTrade } from "./types";

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
    amount: BN,
    fee: BN
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
    await snapshot.transfer(
      from,
      exchange.address,
      "ETH",
      fee,
      "from",
      "exchange"
    );

    const ethAddress = exchangeTestUtil.getTokenAddress("ETH");
    const ethValue = token === ethAddress ? amount.add(fee) : fee;
    // Deposit
    await exchange.deposit(from, to, token, amount, {
      from: from,
      value: ethValue,
      gasPrice: 0
    });

    // Verify balances
    await snapshot.verifyBalances();

    // Get the Deposit event
    const event = await exchangeTestUtil.assertEventEmitted(exchange, "DepositRequested");
    assert.equal(event.owner, to, "owner unexpected");
    assert.equal(event.token, exchangeTestUtil.getTokenAddress(token), "token unexpected");
    assert(event.amount.eq(amount), "amount unexpected");
    assert(event.fee.eq(fee), "amount unexpected");
  };

  const submitDepositBlockChecked = async (
    deposits: Deposit[],
    blockFee?: BN
  ) => {
    assert.equal(
      exchangeTestUtil.pendingBlocks[exchangeID].length,
      1,
      "unexpected number of pending blocks"
    );
    const block = exchangeTestUtil.pendingBlocks[exchangeID][0];
    assert(block.blockType === BlockType.DEPOSIT, "unexptected blocktype");

    // Block fee
    const feeRecipient = exchangeTestUtil.exchangeOperator;
    blockFee = new BN(0);
    for (const deposit of deposits) {
      blockFee.iadd(deposit.fee);
    }

    // Simulate all transfers
    const snapshot = new BalanceSnapshot(exchangeTestUtil);
    // Simulate block fee payment
    await snapshot.transfer(
      exchange.address,
      feeRecipient,
      "ETH",
      blockFee,
      "exchange",
      "feeRecipient"
    );

    // Submit the block
    await exchangeTestUtil.submitPendingBlocks();

    // Verify balances
    await snapshot.verifyBalances(new BN(0));

    // Check events
    // BlockFeeWithdrawn event
    const event = await exchangeTestUtil.assertEventEmitted(
      exchange,
      "BlockFeeWithdrawn"
    );
    assert.equal(
      event.blockIdx.toNumber(),
      block.blockIdx,
      "Unexpected block idx"
    );
    assert(
      event.amountRewarded.add(event.amountFined).eq(blockFee),
      "Unexpected block fee amount"
    );
  };

  const submitWithdrawalBlockChecked = async (
    deposits: Deposit[],
    expectedSuccess?: boolean[],
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
    console.log(block.internalBlock);
    let numWithdrawals = 0;
    for (const tx of block.internalBlock.transactions) {
      console.log(tx);
      if (tx.txType === "Withdraw") {
        console.log("Withdraw: " + tx.withdrawalFee.toString(10));
        if (tx.type >= 2) {
          blockFee.iadd(tx.withdrawalFee);
          numWithdrawals++;
        }
      }
    }
    console.log("Block fee expected: " + blockFee.toString(10));
    if (expectedSuccess === undefined) {
      expectedSuccess = new Array(numWithdrawals).fill(true);
    }

    // Simulate all transfers
    const snapshot = new BalanceSnapshot(exchangeTestUtil);
    // Simulate withdrawals
    for (const [i, deposit] of deposits.entries()) {
      await snapshot.transfer(
        depositContract.address,
        deposit.owner,
        deposit.token,
        expectedSuccess[i] ? deposit.amount : new BN(0),
        "depositContract",
        "owner"
      );
    }
    // Simulate block fee payment
    await snapshot.transfer(
      exchange.address,
      feeRecipient,
      "ETH",
      blockFee,
      "exchange",
      "feeRecipient"
    );

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
          let amountWithdrawn = roundToFloatValue(
            deposit.amount,
            Constants.Float24Encoding
          );
          assert.equal(events[c].from, deposit.owner, "from should match");
          assert.equal(events[c].to, deposit.owner, "to should match");
          assert.equal(events[c].token, deposit.token, "token should match");
          assert(events[c].amount.eq(amountWithdrawn), "amount should match");
          c++;
        }
      }
      assert.equal(events.length, c, "Unexpected num WithdrawalCompleted events");
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
          let amountWithdrawn = roundToFloatValue(
            deposit.amount,
            Constants.Float24Encoding
          );
          assert.equal(events[c].from, deposit.owner, "from should match");
          assert.equal(events[c].to, deposit.owner, "to should match");
          assert.equal(events[c].token, deposit.token, "token should match");
          assert(events[c].amount.eq(amountWithdrawn), "amount should match");
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
    assert(
      event.blockFee.eq(blockFee),
      "Unexpected block fee amount"
    );
  };

  const withdrawOnceChecked = async (
    owner: string,
    token: string,
    uExpectedAmount: BN
  ) => {
    const expectedAmount = roundToFloatValue(
      uExpectedAmount,
      Constants.Float24Encoding
    );

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

    await exchange.withdrawFromApprovedWithdrawal(owner, token, {
      from: exchangeTestUtil.testContext.feeRecipients[0]
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
    const accountID = await exchangeTestUtil.getAccountID(owner);
    const tokenID = await exchangeTestUtil.getTokenID(token);
    assert.equal(
      event.accountID,
      accountID,
      "DepositRequested accountID unexpected"
    );
    assert.equal(event.tokenID, tokenID, "DepositRequested tokenID unexpected");
    assert(
      event.amount.eq(expectedAmount),
      "DepositRequested amount unexpected"
    );
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

  const getDepositFee = () => {
    return new BN(web3.utils.toWei("0.0481", "ether"));
  };

  const createExchange = async (bSetupTestState: boolean = true) => {
    exchangeID = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      bSetupTestState
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
      const depositFee = getDepositFee();

      // Insufficient funds
      await exchangeTestUtil.setBalanceAndApprove(
        owner,
        token,
        amount.sub(new BN(1))
      );
      await expectThrow(
        exchange.deposit(owner, owner, token, amount, {
          from: owner,
          value: depositFee
        }),
        "TRANSFER_FAILURE"
      );

      // Set the correct balance/approval
      await exchangeTestUtil.setBalanceAndApprove(owner, token, amount);

      // Invalid token
      await expectThrow(
        exchange.deposit(owner, owner, owner, amount, {
          from: owner,
          value: depositFee
        }),
        "TOKEN_NOT_FOUND"
      );

      // Do deposit to the same account with another token
      token = exchangeTestUtil.getTokenAddress("WETH");
      amount = new BN(web3.utils.toWei("4.5", "ether"));

      // New balance/approval for another deposit
      await exchangeTestUtil.setBalanceAndApprove(owner, token, amount);

      // Everything correct
      await depositChecked(owner, owner, token, amount, depositFee);
    });

    it("ETH: Deposit", async () => {
      await createExchange(false);

      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const amount = new BN(web3.utils.toWei("3", "ether"));
      const token = exchangeTestUtil.getTokenAddress("ETH");
      const depositFee = getDepositFee();

      // Everything correct
      await depositChecked(owner, owner, token, amount, depositFee);
    });

    it("ERC20: Deposit to a different account", async () => {
      await createExchange(false);

      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const amount = new BN(web3.utils.toWei("3", "ether"));
      const token = exchangeTestUtil.getTokenAddress("LRC");
      const depositFee = getDepositFee();

      // Account that will deposit the funds
      const from = exchangeTestUtil.testContext.orderOwners[1];

      // Provide enough balance for the 'from' account
      await exchangeTestUtil.setBalanceAndApprove(from, token, amount);

      // Deposit
      await depositChecked(from, owner, token, amount, depositFee);
    });

    it("ETH: Deposit to a different account", async () => {
      await createExchange(false);

      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const amount = new BN(web3.utils.toWei("3", "ether"));
      const token = exchangeTestUtil.getTokenAddress("ETH");
      const depositFee = getDepositFee();

      // Account that will deposit the funds
      const from = exchangeTestUtil.testContext.orderOwners[1];

      // Deposit
      await depositChecked(from, owner, token, amount, depositFee);
    });

    it("Forced withdrawal request", async () => {
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
        2
      );

      // Commit the withdrawal
      await exchangeTestUtil.submitTransactions();

      // Submit the block
      const expectedResult = { ...deposit };
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
      const maxWithdrawals = exchangeTestUtil.MAX_OPEN_WITHDRAWAL_REQUESTS;
      for (let i = 0; i < maxWithdrawals; i++) {
        await exchangeTestUtil.doRandomOnchainWithdrawal(deposit, false);
      }

      // Do another one
      await expectThrow(
        exchangeTestUtil.doRandomOnchainWithdrawal(deposit, false),
        "TOO_MANY_REQUESTS_OPEN"
      );

      // Commit the deposits
      await exchangeTestUtil.submitTransactions();

      // Do another one
      await exchangeTestUtil.doRandomOnchainWithdrawal(deposit, false);

      exchangeTestUtil.autoCommit = true;
    });

    it("Offchain withdrawal request (token == feeToken)", async () => {
      await createExchange();

      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("4", "ether"));
      const toWithdraw = new BN(web3.utils.toWei("5", "ether"));
      const token = "ETH";
      const feeToken = "ETH";
      const fee = new BN(web3.utils.toWei("0.5", "ether"));

      const deposit = await exchangeTestUtil.deposit(
        owner,
        owner,
        token,
        balance
      );
      const accountID = deposit.accountID;
      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();

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
      expectedResult.amount = balance.sub(fee);
      await submitWithdrawalBlockChecked([expectedResult]);
    });

    it("Offchain withdrawal request (token != feeToken)", async () => {
      await createExchange();

      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("4", "ether"));
      const toWithdraw = new BN(web3.utils.toWei("5", "ether"));
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
      await exchangeTestUtil.deposit(
        owner,
        owner,
        feeToken,
        fee
      );
      const accountID = deposit.accountID;
      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();

      await exchangeTestUtil.requestWithdrawal(
        owner,
        token,
        toWithdraw,
        feeToken,
        fee
      );
      await exchangeTestUtil.submitTransactions();

      // Submit the block
      await submitWithdrawalBlockChecked([deposit]);
    });

    it("Offchain withdrawal request (owner == operator)", async () => {
      await createExchange();

      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("4", "ether"));
      const toWithdraw = new BN(web3.utils.toWei("5", "ether"));
      const token = "ETH";
      const feeToken = "ETH";
      const fee = new BN(web3.utils.toWei("0.5", "ether"));

      const deposit = await exchangeTestUtil.deposit(
        owner,
        owner,
        token,
        balance
      );
      const accountID = deposit.accountID;
      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();

      await exchangeTestUtil.requestWithdrawal(
        owner,
        token,
        toWithdraw,
        feeToken,
        fee
      );

      exchangeTestUtil.setActiveOperator(accountID);

      await exchangeTestUtil.submitTransactions();

      // Submit the block
      deposit.amount = balance.sub(fee);
      await submitWithdrawalBlockChecked([deposit]);
    });

    it("Onchain withdraw (normal account)", async () => {
      await createExchange();

      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const ownerB = exchangeTestUtil.testContext.orderOwners[1];

      const balanceA = new BN(web3.utils.toWei("7", "ether"));
      const toWithdrawA = new BN(web3.utils.toWei("4", "ether"));
      const tokenA = exchangeTestUtil.getTokenAddress("ETH");

      const balanceB = new BN(web3.utils.toWei("1", "ether"));
      const toWithdrawB = new BN(web3.utils.toWei("3", "ether"));
      const tokenB = exchangeTestUtil.getTokenAddress("ETH");

      const depositA = await exchangeTestUtil.deposit(
        ownerA,
        ownerA,
        tokenA,
        balanceA
      );
      const depositB = await exchangeTestUtil.deposit(
        ownerB,
        ownerB,
        tokenB,
        balanceB
      );
      await exchangeTestUtil.submitTransactions();

      // Verify the deposits
      await exchangeTestUtil.submitPendingBlocks();

      // Do the request
      await exchangeTestUtil.requestWithdrawal(
        ownerA,
        tokenA,
        toWithdrawA,
        "ETH",
        new BN(0),
        1
      );

      // Commit the deposit
      await exchangeTestUtil.submitTransactions();

      // Submit the block
      depositA.amount = toWithdrawA;
      await submitWithdrawalBlockChecked([depositA]);

      await exchangeTestUtil.requestWithdrawal(
        ownerB,
        tokenB,
        toWithdrawB,
        "ETH",
        new BN(0),
        1
      );

      // Commit the withdrawal
      await exchangeTestUtil.submitTransactions();

      // Submit the block
      await submitWithdrawalBlockChecked([depositB]);
    });

    it("Withdraw (protocol fee pool account)", async () => {
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
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();

      const operatorAccountID = await exchangeTestUtil.getActiveOperator(
        exchangeID
      );
      await exchangeTestUtil.requestWithdrawal(
        Constants.zeroAddress,
        ring.orderA.tokenB,
        ring.orderA.amountB,
        "ETH",
        new BN(0),
        2
      );
      await exchangeTestUtil.requestWithdrawal(
        Constants.zeroAddress,
        ring.orderB.tokenB,
        ring.orderB.amountB,
        "ETH",
        new BN(0),
        2
      );
      await exchangeTestUtil.submitTransactions();

      // Expected protocol fees earned
      const protocolFeeA = ring.orderA.amountB
        .mul(protocolFees.takerFeeBips)
        .div(new BN(100000));
      const protocolFeeB = ring.orderB.amountB
        .mul(protocolFees.makerFeeBips)
        .div(new BN(100000));

      const depositA: Deposit = {
        owner: await loopring.protocolFeeVault(),
        token: ring.orderA.tokenB,
        amount: protocolFeeA,
        fee: new BN(0),
        timestamp: 0,
        accountID: 0,
        tokenID: await exchangeTestUtil.getTokenID(ring.orderA.tokenB),
        index: Constants.INDEX_BASE
      };

      const depositB: Deposit = {
        owner: await loopring.protocolFeeVault(),
        token: ring.orderB.tokenB,
        amount: protocolFeeB,
        fee: new BN(0),
        timestamp: 0,
        accountID: 0,
        tokenID: await exchangeTestUtil.getTokenID(ring.orderB.tokenB),
        index: Constants.INDEX_BASE
      };

      // Submit the block
      await submitWithdrawalBlockChecked([depositA, depositB]);
    });

    it("Deposits should not total more than MAX_AMOUNT", async () => {
      await createExchange();

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const amount = Constants.MAX_AMOUNT.sub(new BN(97));
      const token = exchangeTestUtil.getTokenAddress("TEST");

      // Deposit
      const deposit = await exchangeTestUtil.deposit(
        owner,
        owner,
        token,
        amount
      );
      // Deposit again. This time the amount will be capped to 2**96
      await expectThrow(
        exchangeTestUtil.deposit(
          owner,
          owner,
          token,
          amount
        ),
        "MAX_AMOUNT_REACHED"
      );
    });

    it("Withdraw from approved withdrawal", async () => {
      await createExchange();

      const accountContract = await exchangeTestUtil.contracts.TestAccountContract.new(
        exchangeTestUtil.exchange.address
      );

      // Enable expensive token transfer testing on the TEST token
      const testTokenAddress = await exchangeTestUtil.getTokenAddress("TEST");
      const TestToken = await exchangeTestUtil.contracts.TESTToken.at(
        testTokenAddress
      );
      await TestToken.setTestCase(await TestToken.TEST_EXPENSIVE_TRANSFER());

      // Do deposits to fill a complete block
      const blockSize = exchangeTestUtil.blockSizes[0];
      assert(blockSize >= 4);
      const deposits: Deposit[] = [];
      for (let i = 0; i < blockSize; i++) {
        const orderOwners = exchangeTestUtil.testContext.orderOwners;
        const keyPair = exchangeTestUtil.getKeyPairEDDSA();
        let owner = orderOwners[i];
        let amount = exchangeTestUtil.getRandomAmount();
        let token = exchangeTestUtil.getTokenAddress("LRC");
        let contract;
        if (i === 1) {
          // Expensive ETH transfer
          owner = accountContract.address;
          contract = accountContract;
          token = exchangeTestUtil.getTokenAddress("ETH");
          amount = new BN(web3.utils.toWei("1.23", "ether"));
        } else if (i === 3) {
          // Expensive ERC20 transfer
          token = exchangeTestUtil.getTokenAddress("TEST");
          amount = new BN(web3.utils.toWei("4.56", "ether"));
        }
        const deposit = await exchangeTestUtil.deposit(
          owner,
          owner,
          token,
          amount,
          undefined,
          contract
        );
        deposits.push(deposit);
      }
      await exchangeTestUtil.submitTransactions();

      for (const deposit of deposits) {
        exchangeTestUtil.requestWithdrawal(
          deposit.owner,
          deposit.token,
          deposit.amount,
          "LRC",
          new BN(0)
        );
      }

      // Submit deposits
      await exchangeTestUtil.submitPendingBlocks();

      // Commit the withdrawals
      await exchangeTestUtil.submitTransactions();

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

    describe("Block fee", () => {
      it("Deposit", async () => {
        await createExchange();
        await exchangeTestUtil.submitTransactions();
        await exchangeTestUtil.submitPendingBlocks();

        // Do some deposits
        const deposits: Deposit[] = [];
        const numWithdrawals =
          exchangeTestUtil.blockSizes[0];
        let blockFee = new BN(0);
        for (let i = 0; i < numWithdrawals; i++) {
          const deposit = await exchangeTestUtil.doRandomDeposit(i);
          deposits.push(deposit);
          blockFee = blockFee.add(deposit.fee);
        }

        // Submit deposits
        await exchangeTestUtil.submitTransactions();
        await submitDepositBlockChecked(
          deposits,
          blockFee
        );
      });

      it("Withdrawal", async () => {
        await createExchange();
        await exchangeTestUtil.submitTransactions();
        await exchangeTestUtil.submitPendingBlocks();

        // Do some withdrawals
        const deposits: Deposit[] = [];
        const numWithdrawals =
          exchangeTestUtil.blockSizes[0];
        let blockFee = new BN(0);
        for (let i = 0; i < numWithdrawals; i++) {
          const deposit = await exchangeTestUtil.doRandomDeposit(i);
          const withdrawal = await exchangeTestUtil.doRandomOnchainWithdrawal(
            deposit
          );
          const availableBalance = deposit.amount.add(
            await exchangeTestUtil.getOffchainBalance(
              exchangeID,
              deposit.accountID,
              await exchangeTestUtil.getTokenID(deposit.token)
            )
          );
          deposit.amount = withdrawal.amount.lte(availableBalance)
            ? withdrawal.amount
            : availableBalance;
          deposits.push(deposit);
          blockFee = blockFee.add(withdrawal.withdrawalFee);
        }

        // Submit deposits
        await exchangeTestUtil.submitTransactions();
        await exchangeTestUtil.submitPendingBlocks();

        // Submit withdrawals
        await exchangeTestUtil.submitTransactions();
        await submitWithdrawalBlockChecked(
          deposits,
          undefined,
          blockFee
        );
      });
    });

    describe("exchange owner", () => {
      it("should be able to disable the depositing of a token", async () => {
        await createExchange();

        const keyPair = exchangeTestUtil.getKeyPairEDDSA();
        const owner = exchangeTestUtil.testContext.orderOwners[0];
        const tokenA = exchangeTestUtil.getTokenAddress("GTO");
        const tokenB = exchangeTestUtil.getTokenAddress("REP");
        const amount = new BN(web3.utils.toWei("321", "ether"));

        const withdrawalFee = await exchangeTestUtil.loopringV3.forcedWithdrawalFee();
        const depositFee = exchangeTestUtil.getRandomFee();

        // Make sure the owner has enough tokens
        await exchangeTestUtil.setBalanceAndApprove(
          owner,
          tokenA,
          amount.mul(new BN(10))
        );
        await exchangeTestUtil.setBalanceAndApprove(
          owner,
          tokenB,
          amount.mul(new BN(10))
        );

        // Everything correct
        await depositChecked(
          owner,
          owner,
          tokenA,
          amount,
          depositFee
        );

        // Disable token deposit for GTO
        await exchange.disableTokenDeposit(tokenA, {
          from: exchangeTestUtil.exchangeOwner
        });

        // Try to disable it again
        await expectThrow(
          exchange.disableTokenDeposit(tokenA, {
            from: exchangeTestUtil.exchangeOwner
          }),
          "TOKEN_DEPOSIT_ALREADY_DISABLED"
        );

        // Try to deposit
        await expectThrow(
          exchange.deposit(owner, owner, tokenA, amount, {
            from: owner,
            value: depositFee
          }),
          "TOKEN_DEPOSIT_DISABLED"
        );

        // Deposit another token
        await exchange.deposit(owner, owner, tokenB, amount, {
          from: owner,
          value: depositFee
        });

        // Enable it again
        await exchange.enableTokenDeposit(tokenA, {
          from: exchangeTestUtil.exchangeOwner
        });

        // Try to enable it again
        await expectThrow(
          exchange.enableTokenDeposit(tokenA, {
            from: exchangeTestUtil.exchangeOwner
          }),
          "TOKEN_DEPOSIT_ALREADY_ENABLED"
        );

        // Try the deposit again
        await exchange.deposit(owner, owner, tokenA, amount, {
          from: owner,
          value: depositFee
        });
      });

      it("should not be able to disable deposits for LRC/ETH/WETH", async () => {
        await createExchange();

        const owner = exchangeTestUtil.exchangeOwner;
        // Try to disable ETH
        await expectThrow(
          exchange.disableTokenDeposit(
            exchangeTestUtil.getTokenAddress("ETH"),
            { from: owner }
          ),
          "ETHER_CANNOT_BE_DISABLED"
        );
        // Try to disable WETH
        await expectThrow(
          exchange.disableTokenDeposit(
            exchangeTestUtil.getTokenAddress("WETH"),
            { from: owner }
          ),
          "WETH_CANNOT_BE_DISABLED"
        );
        // Try to disable LRC
        await expectThrow(
          exchange.disableTokenDeposit(
            exchangeTestUtil.getTokenAddress("LRC"),
            { from: owner }
          ),
          "LRC_CANNOT_BE_DISABLED"
        );
      });
    });

    describe("anyone", () => {
      it("should not be able to disable/enable the depositing of a token", async () => {
        await createExchange();

        const token = exchangeTestUtil.getTokenAddress("GTO");

        // Try to disable the token
        await expectThrow(exchange.disableTokenDeposit(token), "UNAUTHORIZED");

        // Disable token deposit for GTO
        await exchange.disableTokenDeposit(token, {
          from: exchangeTestUtil.exchangeOwner
        });

        // Try to enable it again
        await expectThrow(exchange.enableTokenDeposit(token), "UNAUTHORIZED");
      });
    });
  });
});
