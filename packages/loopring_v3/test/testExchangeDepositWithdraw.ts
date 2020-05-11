import BN = require("bn.js");
import { BlockType, Constants, roundToFloatValue } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { BalanceSnapshot, ExchangeTestUtil } from "./testExchangeUtil";
import { DepositInfo, RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
  let depositContract: any;
  let loopring: any;
  let exchangeID = 0;

  const getAccountChecked = async (
    owner: string,
    accountID: number,
    keyPair: any
  ) => {
    const accountsData = await exchange.getAccount(owner);
    assert.equal(
      accountsData.accountID.toNumber(),
      accountID,
      "AccountID needs to match"
    );
    assert.equal(
      accountsData.pubKeyX.toString(10),
      keyPair.publicKeyX,
      "pubKeyX needs to match"
    );
    assert.equal(
      accountsData.pubKeyY.toString(10),
      keyPair.publicKeyY,
      "pubKeyY needs to match"
    );
  };

  const createOrUpdateAccountChecked = async (
    keyPair: any,
    owner: string,
    fee: BN,
    isNew: boolean = true
  ) => {
    const numAvailableSlotsBefore = await exchange.getNumAvailableDepositSlots();
    const numAccountsBefore = await exchange.getNumAccounts();

    await exchange.createOrUpdateAccount(
      owner,
      keyPair.publicKeyX,
      keyPair.publicKeyY,
      Constants.emptyBytes,
      { from: owner, value: fee, gasPrice: 0 }
    );

    const numAvailableSlotsAfter = await exchange.getNumAvailableDepositSlots();
    const numAccountsAfter = await exchange.getNumAccounts();

    assert(
      numAvailableSlotsAfter.eq(numAvailableSlotsBefore.sub(new BN(1))),
      "Number of available deposit slots should de decreased by 1"
    );

    let accountID: number;
    if (isNew) {
      assert(
        numAccountsAfter.eq(numAccountsBefore.add(new BN(1))),
        "Number of accounts should be increased by 1"
      );
      // Get the AccountCreated event
      const event = await exchangeTestUtil.assertEventEmitted(
        exchange,
        "AccountCreated"
      );
      accountID = event.id.toNumber();
    } else {
      assert(
        numAccountsAfter.eq(numAccountsBefore),
        "Number of accounts should remain the same"
      );
      // Get the AccountUpdated event
      const event = await exchangeTestUtil.assertEventEmitted(
        exchange,
        "AccountUpdated"
      );
      accountID = event.id.toNumber();
    }

    // Check the account info onchain
    await getAccountChecked(owner, accountID, keyPair);

    return accountID;
  };

  const depositChecked = async (
    from: string,
    to: string,
    token: string,
    amount: BN,
    depositFee: BN
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
      depositFee,
      "from",
      "exchange"
    );

    const numAvailableSlotsBefore = (
      await exchange.getNumAvailableDepositSlots()
    ).toNumber();

    const ethAddress = exchangeTestUtil.getTokenAddress("ETH");
    const ethValue = token === ethAddress ? amount.add(depositFee) : depositFee;
    // Deposit
    await exchange.deposit(from, to, token, amount, {
      from: from,
      value: ethValue,
      gasPrice: 0
    });

    // Verify balances
    await snapshot.verifyBalances();

    const numAvailableSlotsAfter = (
      await exchange.getNumAvailableDepositSlots()
    ).toNumber();
    assert.equal(
      numAvailableSlotsBefore,
      numAvailableSlotsAfter + 1,
      "Number of available deposit slots should have been decreased by 1"
    );

    // Get the Deposit event
    const event = await exchangeTestUtil.assertEventEmitted(
      exchange,
      "DepositRequested"
    );
    const accountID = await exchangeTestUtil.getAccountID(to);
    const tokenID = await exchangeTestUtil.getTokenID(token);
    assert.equal(
      event.accountID,
      accountID,
      "DepositRequested accountID unexpected"
    );
    assert.equal(event.tokenID, tokenID, "DepositRequested tokenID unexpected");
    assert(event.amount.eq(amount), "DepositRequested amount unexpected");
  };

  const updateAccountChecked = async (
    owner: string,
    keyPair: any,
    token: string,
    amount: BN,
    depositFee: BN
  ) => {
    const snapshot = new BalanceSnapshot(exchangeTestUtil);
    await snapshot.transfer(
      owner,
      depositContract.address,
      token,
      amount,
      "owner",
      "depositContract"
    );
    await snapshot.transfer(
      owner,
      exchange.address,
      "ETH",
      depositFee,
      "owner",
      "exchange"
    );

    const numAvailableSlotsBefore = (
      await exchange.getNumAvailableDepositSlots()
    ).toNumber();

    const ethValue = token === "ETH" ? amount.add(depositFee) : depositFee;
    await exchange.updateAccountAndDeposit(
      owner,
      keyPair.publicKeyX,
      keyPair.publicKeyY,
      token,
      amount,
      Constants.emptyBytes,
      { from: owner, value: ethValue, gasPrice: 0 }
    );

    // Verify balances
    await snapshot.verifyBalances();

    const numAvailableSlotsAfter = (
      await exchange.getNumAvailableDepositSlots()
    ).toNumber();
    assert.equal(
      numAvailableSlotsBefore,
      numAvailableSlotsAfter + 1,
      "Number of available deposit slots should have been decreased by 1"
    );

    // Get the Deposit event
    const event = await exchangeTestUtil.assertEventEmitted(
      exchange,
      "DepositRequested"
    );
    const accountID = await exchangeTestUtil.getAccountID(owner);
    const tokenID = await exchangeTestUtil.getTokenID(token);
    assert.equal(
      event.accountID,
      accountID,
      "DepositRequested accountID unexpected"
    );
    assert.equal(event.tokenID, tokenID, "DepositRequested tokenID unexpected");
    assert(event.amount.eq(amount), "DepositRequested amount unexpected");

    // Check the account info onchain
    await getAccountChecked(owner, accountID, keyPair);
  };

  const submitDepositBlockChecked = async (
    deposits: DepositInfo[],
    blockFee?: BN,
    blockFeeRecieved?: BN,
    allowedDelta: BN = new BN(0)
  ) => {
    const numDeposits = deposits.length;
    assert.equal(
      exchangeTestUtil.pendingBlocks[exchangeID].length,
      1,
      "unexpected number of pending blocks"
    );
    const block = exchangeTestUtil.pendingBlocks[exchangeID][0];
    assert(block.blockType === BlockType.DEPOSIT, "unexptected blocktype");

    // Block fee
    const feeRecipient = exchangeTestUtil.exchangeOperator;
    const protocolFeeVault = await exchangeTestUtil.loopringV3.protocolFeeVault();
    const depositFee = (await exchange.getFees())._depositFeeETH;
    if (blockFee === undefined) {
      blockFee = depositFee.mul(new BN(numDeposits));
    }

    // Simulate all transfers
    const snapshot = new BalanceSnapshot(exchangeTestUtil);
    // Simulate block fee payment
    if (blockFeeRecieved === undefined) {
      blockFeeRecieved = blockFee;
    }
    const blockFeeFined = blockFee.sub(blockFeeRecieved);
    await snapshot.transfer(
      exchange.address,
      feeRecipient,
      "ETH",
      blockFeeRecieved,
      "exchange",
      "feeRecipient"
    );
    await snapshot.transfer(
      exchange.address,
      protocolFeeVault,
      "ETH",
      blockFeeFined,
      "exchange",
      "protocolFeeVault"
    );

    // Submit the block
    await exchangeTestUtil.submitPendingBlocks(exchangeID);

    // Verify balances
    await snapshot.verifyBalances(allowedDelta);

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
    deposits: DepositInfo[],
    expectedSuccess?: boolean[],
    blockFee?: BN,
    blockFeeRecieved?: BN,
    allowedDelta: BN = new BN(0)
  ) => {
    const numDeposits = deposits.length;
    assert.equal(
      exchangeTestUtil.pendingBlocks[exchangeID].length,
      1,
      "unexpected number of pending blocks"
    );
    const block = exchangeTestUtil.pendingBlocks[exchangeID][0];
    assert(
      block.blockType === BlockType.ONCHAIN_WITHDRAWAL ||
        block.blockType === BlockType.OFFCHAIN_WITHDRAWAL,
      "unexptected blocktype"
    );
    if (expectedSuccess === undefined) {
      expectedSuccess = new Array(block.blockSize).fill(true);
    }

    // Fill in deposits so the complete withdrawal block is constructed
    for (let i = deposits.length; i < block.blockSize; i++) {
      const dummyAccountOwner = await exchangeTestUtil.accounts[exchangeID][
        exchangeTestUtil.dummyAccountId
      ].owner;
      const deposit: DepositInfo = {
        owner:
          block.blockType === BlockType.OFFCHAIN_WITHDRAWAL
            ? dummyAccountOwner
            : await loopring.protocolFeeVault(),
        token: Constants.zeroAddress,
        amount: new BN(0),
        fee: new BN(0),
        timestamp: 0,
        accountID:
          block.blockType === BlockType.OFFCHAIN_WITHDRAWAL
            ? exchangeTestUtil.dummyAccountId
            : 0,
        depositIdx: 0
      };
      deposits.push(deposit);
    }

    // Block fee
    const feeRecipient = exchangeTestUtil.exchangeOperator;
    const protocolFeeVault = await exchangeTestUtil.loopringV3.protocolFeeVault();
    const withdrawalFee = (await exchange.getFees())._withdrawalFeeETH;
    if (blockFee === undefined) {
      blockFee =
        block.blockType === BlockType.ONCHAIN_WITHDRAWAL
          ? withdrawalFee.mul(new BN(numDeposits))
          : new BN(0);
    }

    // Simulate all transfers
    const snapshot = new BalanceSnapshot(exchangeTestUtil);
    // Simulate withdrawals
    for (const [i, deposit] of deposits.entries()) {
      let amountWithdrawn = roundToFloatValue(
        deposit.amount,
        Constants.Float24Encoding
      );
      if (!expectedSuccess[i]) {
        amountWithdrawn = new BN(0);
      }
      await snapshot.transfer(
        depositContract.address,
        deposit.owner,
        deposit.token,
        amountWithdrawn,
        "depositContract",
        "owner"
      );
    }
    // Simulate block fee payment
    if (blockFeeRecieved === undefined) {
      blockFeeRecieved = blockFee;
    }
    const blockFeeFined = blockFee.sub(blockFeeRecieved);
    await snapshot.transfer(
      exchange.address,
      feeRecipient,
      "ETH",
      blockFeeRecieved,
      "exchange",
      "feeRecipient"
    );
    await snapshot.transfer(
      exchange.address,
      protocolFeeVault,
      "ETH",
      blockFeeFined,
      "exchange",
      "protocolFeeVault"
    );

    // Submit the block
    await exchangeTestUtil.submitPendingBlocks(exchangeID);

    // Verify balances
    await snapshot.verifyBalances(allowedDelta);

    // Check events
    // WithdrawalCompleted events
    {
      const numEventsExpected = expectedSuccess.filter(x => x === true).length;
      const events = await exchangeTestUtil.assertEventsEmitted(
        exchange,
        "WithdrawalCompleted",
        numEventsExpected
      );
      let counter = 0;
      for (const [i, deposit] of deposits.entries()) {
        if (expectedSuccess[i]) {
          let amountWithdrawn = roundToFloatValue(
            deposit.amount,
            Constants.Float24Encoding
          );
          assert.equal(
            events[counter].accountID.toNumber(),
            deposit.accountID,
            "accountID should match"
          );
          assert.equal(
            events[counter].tokenID.toNumber(),
            await exchangeTestUtil.getTokenID(deposit.token),
            "tokenID should match"
          );
          assert.equal(events[counter].to, deposit.owner, "'to' should match");
          assert(
            events[counter].amount.eq(amountWithdrawn),
            "amount should match"
          );
          counter++;
        }
      }
      assert.equal(
        events.length,
        counter,
        "Unexpected number of WithdrawalCompleted events"
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
      let counter = 0;
      for (const [i, deposit] of deposits.entries()) {
        if (!expectedSuccess[i]) {
          let amountWithdrawn = roundToFloatValue(
            deposit.amount,
            Constants.Float24Encoding
          );
          assert.equal(
            events[counter].accountID.toNumber(),
            deposit.accountID,
            "accountID should match"
          );
          assert.equal(
            events[counter].tokenID.toNumber(),
            await exchangeTestUtil.getTokenID(deposit.token),
            "tokenID should match"
          );
          assert.equal(events[counter].to, deposit.owner, "'to' should match");
          assert(
            events[counter].amount.eq(amountWithdrawn),
            "amount should match"
          );
          counter++;
        }
      }
      assert.equal(
        events.length,
        counter,
        "Unexpected number of WithdrawalFailed events"
      );
    }
    // BlockFeeWithdrawn event
    if (block.blockType === BlockType.ONCHAIN_WITHDRAWAL) {
      // Check the event
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
    } else {
      // Offchain withdrawals don't have an onchain block fee
      exchangeTestUtil.assertNoEventEmitted(exchange, "BlockFeeWithdrawn");
    }
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

    it("Create account", async () => {
      await createExchange();

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];

      // The correct deposit fee expected by the contract
      const fees = await exchange.getFees();
      const accountCreationFee = fees._accountCreationFeeETH;
      const depositFee = fees._depositFeeETH;
      const totalFee = depositFee.add(accountCreationFee);

      // No ETH sent
      await expectThrow(
        exchange.createOrUpdateAccount(
          owner,
          keyPair.publicKeyX,
          keyPair.publicKeyY,
          Constants.emptyBytes,
          {
            from: owner,
            value: new BN(0)
          }
        ),
        "INSUFFICIENT_FEE"
      );
      // Not enough ETH
      await expectThrow(
        exchange.createOrUpdateAccount(
          owner,
          keyPair.publicKeyX,
          keyPair.publicKeyY,
          Constants.emptyBytes,
          {
            from: owner,
            value: totalFee.sub(new BN(1))
          }
        ),
        "INSUFFICIENT_FEE"
      );

      // Invalid public key (pubKey > scalarField)
      await expectThrow(
        exchange.createOrUpdateAccount(
          owner,
          Constants.scalarField,
          keyPair.publicKeyY,
          Constants.emptyBytes,
          { from: owner, value: totalFee }
        ),
        "INVALID_PUBKEY"
      );
      await expectThrow(
        exchange.createOrUpdateAccount(
          owner,
          keyPair.publicKeyY,
          Constants.scalarField,
          Constants.emptyBytes,
          { from: owner, value: totalFee }
        ),
        "INVALID_PUBKEY"
      );
      // Invalid public key (pubKey.X == 0)
      await expectThrow(
        exchange.createOrUpdateAccount(
          owner,
          "0",
          keyPair.publicKeyY,
          Constants.emptyBytes,
          {
            from: owner,
            value: totalFee
          }
        ),
        "INVALID_PUBKEY"
      );

      // Everything correct
      const accountID = await createOrUpdateAccountChecked(
        keyPair,
        owner,
        totalFee,
        true
      );
      assert(accountID > 0);
    });

    it("Update account", async () => {
      await createExchange();

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];

      // The correct deposit fee expected by the contract
      const fees = await exchange.getFees();
      const accountCreationFee = fees._accountCreationFeeETH;
      const accountUpdateFee = fees._accountUpdateFeeETH;
      const depositFee = fees._depositFeeETH;

      // Everything correct for account creation
      const totalCreationFee = depositFee.add(accountCreationFee);
      const accountID = await createOrUpdateAccountChecked(
        keyPair,
        owner,
        totalCreationFee,
        true
      );
      assert(accountID > 0);

      // Update the keys
      const totalUpdateFee = depositFee.add(accountUpdateFee);
      const newKeyPair = exchangeTestUtil.getKeyPairEDDSA();
      const newAccountID = await createOrUpdateAccountChecked(
        newKeyPair,
        owner,
        totalUpdateFee,
        false
      );
      assert(newAccountID === accountID, "Account ID needs to remain the same");
    });

    it("ERC20: Deposit", async () => {
      await createExchange();

      let keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      let amount = new BN(web3.utils.toWei("7", "ether"));
      let token = exchangeTestUtil.getTokenAddress("LRC");

      // The correct deposit fee expected by the contract
      const fees = await exchange.getFees();
      const accountCreationFee = fees._accountCreationFeeETH;
      const depositFee = fees._depositFeeETH;
      const updateFee = fees._accountUpdateFeeETH;

      // Create the account
      await createOrUpdateAccountChecked(
        keyPair,
        owner,
        depositFee.add(accountCreationFee)
      );

      // No ETH sent
      await expectThrow(
        exchange.deposit(owner, owner, token, amount, {
          from: owner,
          value: new BN(0)
        }),
        "INSUFFICIENT_FEE"
      );
      // Not enough ETH
      await expectThrow(
        exchange.deposit(owner, owner, token, amount, {
          from: owner,
          value: depositFee.sub(new BN(1))
        }),
        "INSUFFICIENT_FEE"
      );

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

      // Unknown owner
      const wrongOwner = exchangeTestUtil.testContext.orderOwners[8];
      await expectThrow(
        exchange.deposit(wrongOwner, wrongOwner, token, amount, {
          from: wrongOwner,
          value: depositFee
        }),
        "ADDRESS_HAS_NO_ACCOUNT"
      );

      // Everything correct
      await depositChecked(owner, owner, token, amount, depositFee);

      // Change some account info
      amount = new BN(0);
      keyPair = exchangeTestUtil.getKeyPairEDDSA();

      // Change the publicKey
      await updateAccountChecked(
        owner,
        keyPair,
        token,
        amount,
        depositFee.add(updateFee)
      );
    });

    it("ETH: Deposit", async () => {
      await createExchange(false);

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const amount = new BN(web3.utils.toWei("3", "ether"));
      const token = exchangeTestUtil.getTokenAddress("ETH");

      // The correct deposit fee expected by the contract
      const fees = await exchange.getFees();
      const accountCreationFee = fees._accountCreationFeeETH;
      const depositFee = fees._depositFeeETH;

      // Create the account
      await createOrUpdateAccountChecked(
        keyPair,
        owner,
        accountCreationFee.add(depositFee)
      );

      // No ETH sent
      await expectThrow(
        exchange.deposit(owner, owner, token, amount, {
          from: owner,
          value: new BN(0)
        }),
        "INSUFFICIENT_FEE"
      );

      // Not enough ETH
      await expectThrow(
        exchange.deposit(owner, owner, token, amount, {
          from: owner,
          value: amount
        }),
        "INSUFFICIENT_FEE"
      );

      // Everything correct
      await depositChecked(owner, owner, token, amount, depositFee);
    });

    it("ERC20: Deposit to a different account", async () => {
      await createExchange(false);

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const amount = new BN(web3.utils.toWei("3", "ether"));
      const token = exchangeTestUtil.getTokenAddress("LRC");

      // The correct deposit fee expected by the contract
      const fees = await exchange.getFees();
      const accountCreationFee = fees._accountCreationFeeETH;
      const depositFee = fees._depositFeeETH;

      // Account that will deposit the funds
      const from = exchangeTestUtil.testContext.orderOwners[1];

      // Create the account
      await createOrUpdateAccountChecked(
        keyPair,
        owner,
        accountCreationFee.add(depositFee)
      );

      // Provide enough balance for the 'from' account
      await exchangeTestUtil.setBalanceAndApprove(from, token, amount);

      // Deposit
      await depositChecked(from, owner, token, amount, depositFee);
    });

    it("ETH: Deposit to a different account", async () => {
      await createExchange(false);

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const amount = new BN(web3.utils.toWei("3", "ether"));
      const token = exchangeTestUtil.getTokenAddress("ETH");

      // The correct deposit fee expected by the contract
      const fees = await exchange.getFees();
      const accountCreationFee = fees._accountCreationFeeETH;
      const depositFee = fees._depositFeeETH;

      // Account that will deposit the funds
      const from = exchangeTestUtil.testContext.orderOwners[1];

      // Create the account
      await createOrUpdateAccountChecked(
        keyPair,
        owner,
        accountCreationFee.add(depositFee)
      );

      // Deposit
      await depositChecked(from, owner, token, amount, depositFee);
    });

    it.skip("Number of open deposits needs to be limited", async () => {
      await createExchange(false);
      await exchangeTestUtil.commitDeposits(exchangeID);

      exchangeTestUtil.autoCommit = false;

      // Do all deposits allowed
      const maxDeposists = exchangeTestUtil.MAX_OPEN_DEPOSIT_REQUESTS;
      for (let i = 0; i < maxDeposists; i++) {
        await exchangeTestUtil.doRandomDeposit(undefined, false);
      }

      // Do another one
      await expectThrow(
        exchangeTestUtil.doRandomDeposit(undefined, false),
        "TOO_MANY_REQUESTS_OPEN"
      );

      // Commit the deposits
      await exchangeTestUtil.commitDeposits(exchangeID);

      // Do another one
      await exchangeTestUtil.doRandomDeposit(undefined, false);

      exchangeTestUtil.autoCommit = true;
    });

    it("Wrong deposit ending hash", async () => {
      await createExchange();

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const token = exchangeTestUtil.getTokenAddress("LRC");

      await exchangeTestUtil.deposit(
        exchangeID,
        ownerA,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        token,
        balance
      );

      // Change the deposit info so double the amount is used to update the Merkle tree
      const pendingDeposits = exchangeTestUtil.getPendingDeposits(exchangeID);
      pendingDeposits[0].amount = pendingDeposits[0].amount.mul(new BN(2));

      await exchangeTestUtil.commitDeposits(exchangeID);

      await expectThrow(
        exchangeTestUtil.submitPendingBlocks(exchangeID),
        "INVALID_ENDING_HASH"
      );
    });

    it("Onchain withdrawal request", async () => {
      await createExchange();

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const toWithdraw = new BN(web3.utils.toWei("4", "ether"));
      const token = exchangeTestUtil.getTokenAddress("LRC");
      const one = new BN(1);

      const depositInfo = await exchangeTestUtil.deposit(
        exchangeID,
        ownerA,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        token,
        balance
      );
      const accountID = depositInfo.accountID;
      await exchangeTestUtil.commitDeposits(exchangeID);

      await exchangeTestUtil.submitPendingBlocks(exchangeID);

      const withdrawalFee = (await exchange.getFees())._withdrawalFeeETH;

      // No ETH sent
      await expectThrow(
        exchange.withdraw(ownerA, token, toWithdraw, {
          from: ownerA,
          value: new BN(0)
        }),
        "INSUFFICIENT_FEE"
      );
      // Not enough ETH sent
      await expectThrow(
        exchange.withdraw(ownerA, token, toWithdraw, {
          from: ownerA,
          value: withdrawalFee.sub(one)
        }),
        "INSUFFICIENT_FEE"
      );

      // Try to withdraw nothing
      await expectThrow(
        exchange.withdraw(ownerA, token, new BN(0), {
          from: ownerA,
          value: withdrawalFee
        }),
        "ZERO_VALUE"
      );

      // Do the request
      await exchangeTestUtil.requestWithdrawalOnchain(
        exchangeID,
        accountID,
        token,
        toWithdraw,
        ownerA
      );
      depositInfo.amount = toWithdraw;

      // Commit the withdrawal
      await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeID);

      // Submit the block
      await submitWithdrawalBlockChecked([depositInfo]);
    });

    it("Wrong onchain withdrawal ending hash", async () => {
      await createExchange();

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const toWithdraw = new BN(web3.utils.toWei("4", "ether"));
      const token = exchangeTestUtil.getTokenAddress("LRC");

      const depositInfo = await exchangeTestUtil.deposit(
        exchangeID,
        ownerA,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        token,
        balance
      );
      const accountID = depositInfo.accountID;
      await exchangeTestUtil.commitDeposits(exchangeID);

      // Do the request
      await exchangeTestUtil.requestWithdrawalOnchain(
        exchangeID,
        accountID,
        token,
        toWithdraw,
        ownerA
      );

      // Change the withdrawal info so half the amount is used to update the Merkle tree
      const pendingWithdrawals = exchangeTestUtil.getPendingOnchainWithdrawals(
        exchangeID
      );
      pendingWithdrawals[0].amount = pendingWithdrawals[0].amount.div(
        new BN(2)
      );

      await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeID);

      // Commit the withdrawal
      await expectThrow(
        exchangeTestUtil.submitPendingBlocks(exchangeID),
        "INVALID_ENDING_HASH"
      );
    });

    it.skip("Number of open onchain withdrawal requests needs to be limited", async () => {
      await createExchange(false);
      await exchangeTestUtil.commitDeposits(exchangeID);

      // Do a deposit
      const depositInfo = await exchangeTestUtil.doRandomDeposit(
        undefined,
        false
      );
      // Commit the deposits
      await exchangeTestUtil.commitDeposits(exchangeID);

      exchangeTestUtil.autoCommit = false;

      // Do all withdrawals allowed
      const maxWithdrawals = exchangeTestUtil.MAX_OPEN_WITHDRAWAL_REQUESTS;
      for (let i = 0; i < maxWithdrawals; i++) {
        await exchangeTestUtil.doRandomOnchainWithdrawal(depositInfo, false);
      }

      // Do another one
      await expectThrow(
        exchangeTestUtil.doRandomOnchainWithdrawal(depositInfo, false),
        "TOO_MANY_REQUESTS_OPEN"
      );

      // Commit the deposits
      await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeID);

      // Do another one
      await exchangeTestUtil.doRandomOnchainWithdrawal(depositInfo, false);

      exchangeTestUtil.autoCommit = true;
    });

    it("Offchain withdrawal request (token == feeToken)", async () => {
      await createExchange();

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("4", "ether"));
      const toWithdraw = new BN(web3.utils.toWei("5", "ether"));
      const token = "ETH";
      const feeToken = "ETH";
      const fee = new BN(web3.utils.toWei("0.5", "ether"));

      const depositInfo = await exchangeTestUtil.deposit(
        exchangeID,
        owner,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        token,
        balance
      );
      const accountID = depositInfo.accountID;
      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.submitPendingBlocks(exchangeID);

      await exchangeTestUtil.requestWithdrawalOffchain(
        exchangeID,
        accountID,
        token,
        toWithdraw,
        feeToken,
        fee
      );
      await exchangeTestUtil.commitOffchainWithdrawalRequests(exchangeID);

      // Submit the block
      depositInfo.amount = balance.sub(fee);
      await submitWithdrawalBlockChecked([depositInfo]);
    });

    it("Offchain withdrawal request (token != feeToken)", async () => {
      await createExchange();

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("4", "ether"));
      const toWithdraw = new BN(web3.utils.toWei("5", "ether"));
      const token = "ETH";
      const feeToken = "LRC";
      const fee = new BN(web3.utils.toWei("0.5", "ether"));

      // Deposit token
      const depositInfo = await exchangeTestUtil.deposit(
        exchangeID,
        owner,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        token,
        balance
      );
      // Deposit feeToken
      await exchangeTestUtil.deposit(
        exchangeID,
        owner,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        feeToken,
        fee
      );
      const accountID = depositInfo.accountID;
      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.submitPendingBlocks(exchangeID);

      await exchangeTestUtil.requestWithdrawalOffchain(
        exchangeID,
        accountID,
        token,
        toWithdraw,
        feeToken,
        fee
      );
      await exchangeTestUtil.commitOffchainWithdrawalRequests(exchangeID);

      // Submit the block
      await submitWithdrawalBlockChecked([depositInfo]);
    });

    it("Offchain withdrawal request (owner == operator)", async () => {
      await createExchange();

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("4", "ether"));
      const toWithdraw = new BN(web3.utils.toWei("5", "ether"));
      const token = "ETH";
      const feeToken = "ETH";
      const fee = new BN(web3.utils.toWei("0.5", "ether"));

      const depositInfo = await exchangeTestUtil.deposit(
        exchangeID,
        owner,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        token,
        balance
      );
      const accountID = depositInfo.accountID;
      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.submitPendingBlocks(exchangeID);

      await exchangeTestUtil.requestWithdrawalOffchain(
        exchangeID,
        accountID,
        token,
        toWithdraw,
        feeToken,
        fee
      );

      exchangeTestUtil.setActiveOperator(accountID);

      await exchangeTestUtil.commitOffchainWithdrawalRequests(exchangeID);

      // Submit the block
      depositInfo.amount = balance.sub(fee);
      await submitWithdrawalBlockChecked([depositInfo]);
    });

    it("Withdraw (normal account)", async () => {
      await createExchange();

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const ownerB = exchangeTestUtil.testContext.orderOwners[1];

      const balanceA = new BN(web3.utils.toWei("7", "ether"));
      const toWithdrawA = new BN(web3.utils.toWei("4", "ether"));
      const tokenA = exchangeTestUtil.getTokenAddress("ETH");

      const balanceB = new BN(web3.utils.toWei("1", "ether"));
      const toWithdrawB = new BN(web3.utils.toWei("3", "ether"));
      const tokenB = exchangeTestUtil.getTokenAddress("ETH");

      const depositInfoA = await exchangeTestUtil.deposit(
        exchangeID,
        ownerA,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        tokenA,
        balanceA
      );
      const depositInfoB = await exchangeTestUtil.deposit(
        exchangeID,
        ownerB,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        tokenB,
        balanceB
      );
      await exchangeTestUtil.commitDeposits(exchangeID);

      // Verify the deposits
      await exchangeTestUtil.submitPendingBlocks(exchangeID);

      // Do the request
      await exchangeTestUtil.requestWithdrawalOnchain(
        exchangeID,
        depositInfoA.accountID,
        tokenA,
        toWithdrawA,
        ownerA
      );

      // Commit the deposit
      await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeID);

      // Submit the block
      depositInfoA.amount = toWithdrawA;
      await submitWithdrawalBlockChecked([depositInfoA]);

      await exchangeTestUtil.requestWithdrawalOnchain(
        exchangeID,
        depositInfoB.accountID,
        tokenB,
        toWithdrawB,
        ownerB
      );

      // Commit the withdrawal
      await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeID);

      // Submit the block
      await submitWithdrawalBlockChecked([depositInfoB]);
    });

    it("Withdraw (protocol fee pool account)", async () => {
      await createExchange();

      const protocolFees = await exchange.getProtocolFeeValues();

      const ring: RingInfo = {
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

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      await exchangeTestUtil.submitPendingBlocks(exchangeID);

      const operatorAccountID = await exchangeTestUtil.getActiveOperator(
        exchangeID
      );
      await exchangeTestUtil.requestWithdrawalOnchain(
        exchangeID,
        0,
        ring.orderA.tokenB,
        ring.orderA.amountB,
        exchangeTestUtil.getAccount(operatorAccountID).owner
      );
      await exchangeTestUtil.requestWithdrawalOnchain(
        exchangeID,
        0,
        ring.orderB.tokenB,
        ring.orderB.amountB,
        exchangeTestUtil.getAccount(operatorAccountID).owner
      );
      await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeID);

      // Expected protocol fees earned
      const protocolFeeA = ring.orderA.amountB
        .mul(protocolFees.takerFeeBips)
        .div(new BN(100000));
      const protocolFeeB = ring.orderB.amountB
        .mul(protocolFees.makerFeeBips)
        .div(new BN(100000));

      const depositInfoA: DepositInfo = {
        owner: await loopring.protocolFeeVault(),
        token: ring.orderA.tokenB,
        amount: protocolFeeA,
        fee: new BN(0),
        timestamp: 0,
        accountID: 0,
        depositIdx: 0
      };

      const depositInfoB: DepositInfo = {
        owner: await loopring.protocolFeeVault(),
        token: ring.orderB.tokenB,
        amount: protocolFeeB,
        fee: new BN(0),
        timestamp: 0,
        accountID: 0,
        depositIdx: 0
      };

      // Submit the block
      await submitWithdrawalBlockChecked([depositInfoA, depositInfoB]);
    });

    it("Deposits should not total more than MAX_AMOUNT", async () => {
      await createExchange();

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const amount = Constants.MAX_AMOUNT.sub(new BN(97));
      const token = exchangeTestUtil.getTokenAddress("TEST");

      // Deposit
      const depositInfo = await exchangeTestUtil.deposit(
        exchangeID,
        owner,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        token,
        amount
      );
      // Deposit again. This time the amount will be capped to 2**96
      await expectThrow(
        exchangeTestUtil.deposit(
          exchangeID,
          owner,
          keyPair.secretKey,
          keyPair.publicKeyX,
          keyPair.publicKeyY,
          token,
          amount
        ),
        "MAX_AMOUNT_REACHED"
      );
    });

    it("Manual withdrawal", async () => {
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
      const blockSize = exchangeTestUtil.offchainWithdrawalBlockSizes[0];
      assert(blockSize >= 4);
      const deposits: DepositInfo[] = [];
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
          exchangeID,
          owner,
          keyPair.secretKey,
          keyPair.publicKeyX,
          keyPair.publicKeyY,
          token,
          amount,
          undefined,
          contract
        );
        deposits.push(deposit);
      }
      await exchangeTestUtil.commitDeposits(exchangeID);

      for (const deposit of deposits) {
        exchangeTestUtil.requestWithdrawalOffchain(
          exchangeID,
          deposit.accountID,
          deposit.token,
          deposit.amount,
          "LRC",
          new BN(0)
        );
      }

      // Submit deposits
      await exchangeTestUtil.submitPendingBlocks(exchangeID);

      // Commit the withdrawals
      await exchangeTestUtil.commitOffchainWithdrawalRequests(exchangeID);

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
        await exchangeTestUtil.commitDeposits(exchangeID);
        await exchangeTestUtil.submitPendingBlocks(exchangeID);

        const testCases: any[] = [
          // In time
          {
            waitTime: exchangeTestUtil.FEE_BLOCK_FINE_START_TIME - 100,
            blockFeeDiv: 1,
            blockFeeDeltaDiv: 10 ** 10
          },
          // Fined
          {
            waitTime:
              exchangeTestUtil.FEE_BLOCK_FINE_START_TIME +
              exchangeTestUtil.FEE_BLOCK_FINE_MAX_DURATION / 2,
            blockFeeDiv: 2,
            blockFeeDeltaDiv: 100
          },
          // Too late
          {
            waitTime:
              exchangeTestUtil.FEE_BLOCK_FINE_START_TIME +
              exchangeTestUtil.FEE_BLOCK_FINE_MAX_DURATION +
              100,
            blockFeeDiv: 10 ** 10,
            blockFeeDeltaDiv: 10 * 10
          }
        ];
        for (const testCase of testCases) {
          // Do some deposits
          const deposits: DepositInfo[] = [];
          const numWithdrawals =
            exchangeTestUtil.onchainWithdrawalBlockSizes[0];
          let blockFee = new BN(0);
          for (let i = 0; i < numWithdrawals; i++) {
            const deposit = await exchangeTestUtil.doRandomDeposit(i);
            deposits.push(deposit);
            blockFee = blockFee.add(deposit.fee);
          }

          // Wait a bit until a bit before the block fee is reduced
          await exchangeTestUtil.advanceBlockTimestamp(testCase.waitTime);

          // Submit deposits
          await exchangeTestUtil.commitDeposits(exchangeID);
          await submitDepositBlockChecked(
            deposits,
            blockFee,
            blockFee.div(new BN(testCase.blockFeeDiv)),
            blockFee.div(new BN(testCase.blockFeeDeltaDiv))
          );
        }
      });

      it("Withdrawal", async () => {
        await createExchange();
        await exchangeTestUtil.commitDeposits(exchangeID);
        await exchangeTestUtil.submitPendingBlocks(exchangeID);

        const testCases: any[] = [
          // In time
          {
            waitTime: exchangeTestUtil.FEE_BLOCK_FINE_START_TIME - 100,
            blockFeeDiv: 1,
            blockFeeDeltaDiv: 10 ** 10
          },
          // Fined
          {
            waitTime:
              exchangeTestUtil.FEE_BLOCK_FINE_START_TIME +
              exchangeTestUtil.FEE_BLOCK_FINE_MAX_DURATION / 2,
            blockFeeDiv: 2,
            blockFeeDeltaDiv: 100
          },
          // Too late
          {
            waitTime:
              exchangeTestUtil.FEE_BLOCK_FINE_START_TIME +
              exchangeTestUtil.FEE_BLOCK_FINE_MAX_DURATION +
              100,
            blockFeeDiv: 10 ** 10,
            blockFeeDeltaDiv: 10 * 10
          }
        ];
        for (const testCase of testCases) {
          // Do some withdrawals
          const deposits: DepositInfo[] = [];
          const numWithdrawals =
            exchangeTestUtil.onchainWithdrawalBlockSizes[0];
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

          // Wait a bit until a bit before the block fee is reduced
          await exchangeTestUtil.advanceBlockTimestamp(testCase.waitTime);

          // Submit deposits
          await exchangeTestUtil.commitDeposits(exchangeID);
          await exchangeTestUtil.submitPendingBlocks(exchangeID);

          // Submit withdrawals
          await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeID);
          await submitWithdrawalBlockChecked(
            deposits,
            undefined,
            blockFee,
            blockFee.div(new BN(testCase.blockFeeDiv)),
            blockFee.div(new BN(testCase.blockFeeDeltaDiv))
          );
        }
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

        // The correct deposit fee expected by the contract
        const fees = await exchange.getFees();
        const accountCreationFee = fees._accountCreationFeeETH;
        const depositFee = fees._depositFeeETH;

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
        await createOrUpdateAccountChecked(
          keyPair,
          owner,
          depositFee.add(accountCreationFee)
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
            value: fees._depositFeeETH
          }),
          "TOKEN_DEPOSIT_DISABLED"
        );

        // Deposit another token
        await exchange.deposit(owner, owner, tokenB, amount, {
          from: owner,
          value: fees._depositFeeETH
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
          value: fees._depositFeeETH
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
