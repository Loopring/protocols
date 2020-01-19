import BN = require("bn.js");
import { Constants, roundToFloatValue } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { DepositInfo, RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
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
      const eventArr: any = await exchangeTestUtil.getEventsFromContract(
        exchange,
        "AccountCreated",
        web3.eth.blockNumber
      );
      const items = eventArr.map((eventObj: any) => {
        return [eventObj.args.id];
      });
      assert.equal(
        items.length,
        1,
        "A single AccountCreated event should have been emitted"
      );
      accountID = items[0][0].toNumber();
    } else {
      assert(
        numAccountsAfter.eq(numAccountsBefore),
        "Number of accounts should remain the same"
      );

      // Get the AccountUpdated event
      const eventArr: any = await exchangeTestUtil.getEventsFromContract(
        exchange,
        "AccountUpdated",
        web3.eth.blockNumber
      );
      const items = eventArr.map((eventObj: any) => {
        return [eventObj.args.id];
      });
      assert.equal(
        items.length,
        1,
        "A single AccountUpdated event should have been emitted"
      );
      accountID = items[0][0].toNumber();
    }

    // Check the account info onchain
    await getAccountChecked(owner, accountID, keyPair);

    return accountID;
  };

  const depositChecked = async (
    accountID: number,
    token: string,
    amount: BN,
    owner: string,
    depositFee: BN
  ) => {
    const balanceOwnerBefore = await exchangeTestUtil.getOnchainBalance(
      owner,
      token
    );
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(
      exchange.address,
      token
    );
    const numAvailableSlotsBefore = (
      await exchange.getNumAvailableDepositSlots()
    ).toNumber();

    const ethAddress = exchangeTestUtil.getTokenAddress("ETH");
    const ethValue = token === ethAddress ? amount.add(depositFee) : depositFee;
    await exchange.deposit(token, amount, {
      from: owner,
      value: ethValue,
      gasPrice: 0
    });

    const balanceOwnerAfter = await exchangeTestUtil.getOnchainBalance(
      owner,
      token
    );
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(
      exchange.address,
      token
    );
    const numAvailableSlotsAfter = (
      await exchange.getNumAvailableDepositSlots()
    ).toNumber();

    const expectedBalanceDelta =
      token === ethAddress ? amount.add(depositFee) : amount;
    assert(
      balanceOwnerBefore.eq(balanceOwnerAfter.add(expectedBalanceDelta)),
      "Token balance of owner should be decreased by amount"
    );
    assert(
      balanceContractAfter.eq(balanceContractBefore.add(expectedBalanceDelta)),
      "Token balance of contract should be increased by amount"
    );

    assert.equal(
      numAvailableSlotsBefore,
      numAvailableSlotsAfter + 1,
      "Number of available deposit slots should have been decreased by 1"
    );

    // Get the Deposit event
    const eventArr: any = await exchangeTestUtil.getEventsFromContract(
      exchange,
      "DepositRequested",
      web3.eth.blockNumber
    );
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.accountID, eventObj.args.depositIdx];
    });
    assert.equal(
      items.length,
      1,
      "A single Deposit event should have been emitted"
    );
    assert.equal(
      items[0][0].toNumber(),
      accountID,
      "Deposit accountID should match"
    );
  };

  const updateAccountChecked = async (
    accountID: number,
    keyPair: any,
    token: string,
    amount: BN,
    owner: string,
    depositFee: BN
  ) => {
    const balanceOwnerBefore = await exchangeTestUtil.getOnchainBalance(
      owner,
      token
    );
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(
      exchange.address,
      token
    );
    const numAvailableSlotsBefore = (
      await exchange.getNumAvailableDepositSlots()
    ).toNumber();

    const ethValue = token === "ETH" ? amount.add(depositFee) : depositFee;
    await exchange.updateAccountAndDeposit(
      keyPair.publicKeyX,
      keyPair.publicKeyY,
      token,
      amount,
      Constants.emptyBytes,
      { from: owner, value: ethValue, gasPrice: 0 }
    );

    const balanceOwnerAfter = await exchangeTestUtil.getOnchainBalance(
      owner,
      token
    );
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(
      exchange.address,
      token
    );
    const numAvailableSlotsAfter = (
      await exchange.getNumAvailableDepositSlots()
    ).toNumber();

    const expectedBalanceDelta =
      token === "ETH" ? amount.add(depositFee) : amount;
    assert(
      balanceOwnerBefore.eq(balanceOwnerAfter.add(expectedBalanceDelta)),
      "Token balance of owner should be decreased by amount"
    );
    assert(
      balanceContractAfter.eq(balanceContractBefore.add(expectedBalanceDelta)),
      "Token balance of contract should be increased by amount"
    );
    assert.equal(
      numAvailableSlotsBefore,
      numAvailableSlotsAfter + 1,
      "Number of available deposit slots should have been decreased by 1"
    );

    // Get the Deposit event
    const eventArr: any = await exchangeTestUtil.getEventsFromContract(
      exchange,
      "DepositRequested",
      web3.eth.blockNumber
    );
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.accountID, eventObj.args.depositIdx];
    });
    assert.equal(
      items.length,
      1,
      "A single Deposit event should have been emitted"
    );
    assert.equal(
      items[0][0].toNumber(),
      accountID,
      "Deposit accountID should match"
    );

    // Check the account info onchain
    await getAccountChecked(owner, accountID, keyPair);
  };

  const withdrawOnceChecked = async (
    blockIdx: number,
    slotIdx: number,
    accountID: number,
    token: string,
    owner: string,
    uExpectedAmount: BN
  ) => {
    const expectedAmount = roundToFloatValue(
      uExpectedAmount,
      Constants.Float28Encoding
    );
    const recipient =
      accountID === 0 ? await loopring.protocolFeeVault() : owner;
    const balanceOwnerBefore = await exchangeTestUtil.getOnchainBalance(
      recipient,
      token
    );
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(
      exchange.address,
      token
    );

    await exchange.withdrawFromApprovedWithdrawal(blockIdx, slotIdx, {
      from: exchangeTestUtil.testContext.feeRecipients[0]
    });

    const balanceOwnerAfter = await exchangeTestUtil.getOnchainBalance(
      recipient,
      token
    );
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(
      exchange.address,
      token
    );

    // console.log("balanceOwnerBefore: " + balanceOwnerBefore.toString(10));
    // console.log("balanceOwnerAfter: " + balanceOwnerAfter.toString(10));
    // console.log("balanceContractBefore: " + balanceContractBefore.toString(10));
    // console.log("balanceContractAfter: " + balanceContractAfter.toString(10));
    // console.log("expectedAmount: " + expectedAmount.toString(10));

    assert(
      balanceOwnerAfter.eq(balanceOwnerBefore.add(expectedAmount)),
      "Token balance of owner should be increased by expectedAmount"
    );
    assert(
      balanceContractAfter.eq(balanceContractBefore.sub(expectedAmount)),
      "Token balance of contract should be decreased by expectedAmount"
    );

    // Get the Withdraw event
    const eventArr: any = await exchangeTestUtil.getEventsFromContract(
      exchange,
      "WithdrawalCompleted",
      web3.eth.blockNumber
    );
    const items = eventArr.map((eventObj: any) => {
      return [
        eventObj.args.accountID,
        eventObj.args.tokenID,
        eventObj.args.amount
      ];
    });

    if (expectedAmount.gt(new BN(0))) {
      assert.equal(
        items.length,
        1,
        "A single WithdrawalCompleted event should have been emitted"
      );
      assert.equal(items[0][0].toNumber(), accountID, "accountID should match");
      // assert.equal(items[0][1].toNumber(), tokenID, "tokenID should match");
      assert(items[0][2].eq(expectedAmount), "amount should match");
    } else {
      assert.equal(
        items.length,
        0,
        "No WithdrawalCompleted event should have been emitted"
      );
    }
  };

  const withdrawChecked = async (
    blockIdx: number,
    slotIdx: number,
    accountID: number,
    token: string,
    owner: string,
    expectedAmount: BN
  ) => {
    // Withdraw
    await withdrawOnceChecked(
      blockIdx,
      slotIdx,
      accountID,
      token,
      owner,
      expectedAmount
    );
    // Withdraw again, no tokens should be transferred
    await withdrawOnceChecked(
      blockIdx,
      slotIdx,
      accountID,
      token,
      owner,
      new BN(0)
    );
  };

  const distributeWithdrawalsChecked = async (
    blockIdx: number,
    numWithdrawals: number,
    deposits: DepositInfo[],
    from: string,
    tooLate: boolean = false,
    expectedSuccess?: boolean[]
  ) => {
    if (expectedSuccess) {
      assert.equal(
        expectedSuccess.length,
        deposits.length,
        "expectedSuccess wrong length"
      );
    } else {
      expectedSuccess = Array(deposits.length).fill(true);
    }

    const LRC = await exchangeTestUtil.getTokenContract("LRC");
    // Balances owners
    const balanceOwnerBefore: BN[] = [];
    for (const deposit of deposits) {
      balanceOwnerBefore.push(
        await exchangeTestUtil.getOnchainBalance(deposit.owner, deposit.token)
      );
    }
    // Balances contract
    const balancesContractBefore: BN[] = [];
    const balancesContractExpected: BN[] = [];
    for (let i = 0; i < exchangeTestUtil.MAX_NUM_TOKENS; i++) {
      balancesContractBefore.push(new BN(0));
      balancesContractExpected.push(new BN(0));
      const token = exchangeTestUtil.getTokenAddressFromID(i);
      if (token) {
        const balance = await exchangeTestUtil.getOnchainBalance(
          exchange.address,
          token
        );
        balancesContractBefore[i] = balance;
        balancesContractExpected[i] = balance;
      }
    }
    // Exchange stake
    const stakeBefore = await exchange.getExchangeStake();
    const totalStakeBefore = await loopring.totalStake();
    // LRC balance from
    const balanceFromBefore = await exchangeTestUtil.getOnchainBalance(
      from,
      "LRC"
    );
    // LRC supply
    const lrcSupplyBefore = await LRC.totalSupply();

    // Distribute the withdrawals
    const tx = await exchange.distributeWithdrawals(blockIdx, numWithdrawals, {
      from
    });
    // console.log("\x1b[46m%s\x1b[0m", "[DistributeWithdrawals] Gas used: " + tx.receipt.gasUsed);

    // Check balances owners
    const balanceOwnerAfter: BN[] = [];
    for (const [i, deposit] of deposits.entries()) {
      balanceOwnerAfter.push(
        await exchangeTestUtil.getOnchainBalance(deposit.owner, deposit.token)
      );
      const tokenID = await exchangeTestUtil.getTokenID(deposit.token);
      let amountWithdrawn = roundToFloatValue(
        deposit.amount,
        Constants.Float28Encoding
      );
      if (!expectedSuccess[i]) {
        amountWithdrawn = new BN(0);
      }
      balancesContractExpected[tokenID] = balancesContractExpected[tokenID].sub(
        amountWithdrawn
      );
    }
    for (let i = 0; i < deposits.length; i++) {
      let amountWithdrawn = roundToFloatValue(
        deposits[i].amount,
        Constants.Float28Encoding
      );
      if (!expectedSuccess[i]) {
        amountWithdrawn = new BN(0);
      }
      assert(
        balanceOwnerAfter[i].eq(balanceOwnerBefore[i].add(amountWithdrawn)),
        "Token balance of owner should be increased by amountToOwner"
      );
    }
    // Check balances contract
    for (let i = 0; i < exchangeTestUtil.MAX_NUM_TOKENS; i++) {
      const token = exchangeTestUtil.getTokenAddressFromID(i);
      if (token) {
        const balance = await exchangeTestUtil.getOnchainBalance(
          exchange.address,
          token
        );
        assert(
          balance.eq(balancesContractExpected[i]),
          "Token balance of contract incorrect"
        );
      }
    }
    // Check stake
    const stakeAfter = await exchange.getExchangeStake();
    const totalStakeAfter = await loopring.totalStake();
    // LRC balance from
    const balanceFromAfter = await exchangeTestUtil.getOnchainBalance(
      from,
      "LRC"
    );
    // LRC supply
    const lrcSupplyAfter = await LRC.totalSupply();
    if (tooLate) {
      // Stake reduced by withdrawalFineLRC * numWithdrawals
      const withdrawalFineLRC = await loopring.withdrawalFineLRC();
      const totalFine = withdrawalFineLRC.mul(new BN(deposits.length));
      assert(
        stakeAfter.eq(stakeBefore.sub(totalFine)),
        "Stake not reduced correctly by fine"
      );
      assert(
        totalStakeAfter.eq(totalStakeBefore.sub(totalFine)),
        "Total stake not reduced correctly by fine"
      );
      // Distributer gets paid half the fine
      const reward = totalFine.div(new BN(2));
      assert(
        balanceFromAfter.eq(balanceFromBefore.add(reward)),
        "distributer should be rewarded 50% of fine"
      );
      // Half is burned
      const burned = totalFine.sub(reward);
      // assert(
      //   lrcSupplyAfter.eq(lrcSupplyBefore.sub(burned)),
      //   "half of fine should be burned"
      // );
    } else {
      // Stake remains the same
      assert(stakeAfter.eq(stakeBefore), "Stake should remain the same");
      assert(
        totalStakeAfter.eq(totalStakeBefore),
        "Total stake should remain the same"
      );
      // Operator doesn't get paid
      assert(
        balanceFromAfter.eq(balanceFromBefore),
        "Operator doesn't get rewarded"
      );
      // Nothing is burned
      assert(lrcSupplyAfter.eq(lrcSupplyBefore), "No LRC burned");
    }
  };

  const createExchange = async (bSetupTestState: boolean = true) => {
    exchangeID = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      bSetupTestState
    );
    exchange = exchangeTestUtil.exchange;
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    exchange = exchangeTestUtil.exchange;
    loopring = exchangeTestUtil.loopringV3;
    exchangeID = 1;
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
          Constants.scalarField,
          keyPair.publicKeyY,
          Constants.emptyBytes,
          { from: owner, value: totalFee }
        ),
        "INVALID_PUBKEY"
      );
      await expectThrow(
        exchange.createOrUpdateAccount(
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
      const accountID = await createOrUpdateAccountChecked(
        keyPair,
        owner,
        depositFee.add(accountCreationFee)
      );

      // No ETH sent
      await expectThrow(
        exchange.deposit(token, amount, { from: owner, value: new BN(0) }),
        "INSUFFICIENT_FEE"
      );
      // Not enough ETH
      await expectThrow(
        exchange.deposit(token, amount, {
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
        exchange.deposit(token, amount, { from: owner, value: depositFee }),
        "TRANSFER_FAILURE"
      );

      // Set the correct balance/approval
      await exchangeTestUtil.setBalanceAndApprove(owner, token, amount);

      // Invalid token
      await expectThrow(
        exchange.deposit(owner, amount, { from: owner, value: depositFee }),
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
        exchange.deposit(token, amount, {
          from: wrongOwner,
          value: depositFee
        }),
        "ADDRESS_HAS_NO_ACCOUNT"
      );

      // Everything correct
      await depositChecked(accountID, token, amount, owner, depositFee);

      // Change some account info
      amount = new BN(0);
      keyPair = exchangeTestUtil.getKeyPairEDDSA();

      // Change the publicKey
      await updateAccountChecked(
        accountID,
        keyPair,
        token,
        amount,
        owner,
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
      const accountID = await createOrUpdateAccountChecked(
        keyPair,
        owner,
        accountCreationFee.add(depositFee)
      );

      // No ETH sent
      await expectThrow(
        exchange.deposit(token, amount, { from: owner, value: new BN(0) }),
        "INSUFFICIENT_FEE"
      );

      // Not enough ETH
      await expectThrow(
        exchange.deposit(token, amount, { from: owner, value: amount }),
        "INSUFFICIENT_FEE"
      );

      // Everything correct
      await depositChecked(accountID, token, amount, owner, depositFee);
    });

    it("Number of open deposits needs to be limited", async () => {
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

      await expectThrow(
        exchangeTestUtil.commitDeposits(exchangeID),
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

      const withdrawalFee = (await exchange.getFees())._withdrawalFeeETH;

      // No ETH sent
      await expectThrow(
        exchange.withdraw(token, toWithdraw, {
          from: ownerA,
          value: new BN(0)
        }),
        "INSUFFICIENT_FEE"
      );
      // Not enough ETH sent
      await expectThrow(
        exchange.withdraw(token, toWithdraw, {
          from: ownerA,
          value: withdrawalFee.sub(one)
        }),
        "INSUFFICIENT_FEE"
      );

      // Try to withdraw nothing
      await expectThrow(
        exchange.withdraw(token, new BN(0), {
          from: ownerA,
          value: withdrawalFee
        }),
        "ZERO_VALUE"
      );

      // Do the request
      const witdrawalRequest = await exchangeTestUtil.requestWithdrawalOnchain(
        exchangeID,
        accountID,
        token,
        toWithdraw,
        ownerA
      );

      // Commit the withdrawal
      await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeID);
      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);

      // Withdraw
      const blockIdx = (await exchangeTestUtil.getNumBlocksOnchain()) - 1;
      await withdrawChecked(
        blockIdx,
        witdrawalRequest.slotIdx,
        accountID,
        token,
        ownerA,
        toWithdraw
      );
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
      const witdrawalRequest = await exchangeTestUtil.requestWithdrawalOnchain(
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

      // Commit the withdrawal
      await expectThrow(
        exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeID),
        "INVALID_ENDING_HASH"
      );
    });

    it("Number of open onchain withdrawal requests needs to be limited", async () => {
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

      const witdrawalRequest = await exchangeTestUtil.requestWithdrawalOffchain(
        exchangeID,
        accountID,
        token,
        toWithdraw,
        feeToken,
        fee,
        20
      );
      await exchangeTestUtil.commitOffchainWithdrawalRequests(exchangeID);
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);

      // Withdraw
      const blockIdx = (await exchangeTestUtil.getNumBlocksOnchain()) - 1;
      await withdrawChecked(
        blockIdx,
        0,
        accountID,
        token,
        owner,
        balance.sub(fee)
      );
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

      await exchangeTestUtil.requestWithdrawalOffchain(
        exchangeID,
        accountID,
        token,
        toWithdraw,
        feeToken,
        fee,
        40
      );
      await exchangeTestUtil.commitOffchainWithdrawalRequests(exchangeID);
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);

      // Withdraw
      const blockIdx = (await exchangeTestUtil.getNumBlocksOnchain()) - 1;
      await withdrawChecked(blockIdx, 0, accountID, token, owner, balance);
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

      await exchangeTestUtil.requestWithdrawalOffchain(
        exchangeID,
        accountID,
        token,
        toWithdraw,
        feeToken,
        fee,
        20
      );

      exchangeTestUtil.setActiveOperator(accountID);

      await exchangeTestUtil.commitOffchainWithdrawalRequests(exchangeID);
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);

      // Withdraw
      const blockIdx = (await exchangeTestUtil.getNumBlocksOnchain()) - 1;
      await withdrawChecked(
        blockIdx,
        0,
        accountID,
        token,
        owner,
        balance.sub(fee)
      );
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

      // Do the request
      const witdrawalRequestA = await exchangeTestUtil.requestWithdrawalOnchain(
        exchangeID,
        depositInfoA.accountID,
        tokenA,
        toWithdrawA,
        ownerA
      );
      /*const witdrawalRequestB = await exchangeTestUtil.requestWithdrawalOnchain(
        exchangeID, depositInfoB.accountID, tokenB, toWithdrawB, ownerB,
      );*/

      // Try to withdraw before the block is committed
      const nextBlockIdx1 = await exchangeTestUtil.getNumBlocksOnchain();
      /*await expectThrow(
        exchange.withdrawFromApprovedWithdrawal(nextBlockIdx, witdrawalRequestA.slotIdx),
        "INVALID_BLOCKIDX",
      );*/

      // Commit the deposit
      await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeID);

      // Try to withdraw before the block is finalized
      await expectThrow(
        exchange.withdrawFromApprovedWithdrawal(nextBlockIdx1, 0),
        "BLOCK_NOT_FINALIZED"
      );

      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);

      // Withdraw
      await withdrawChecked(
        nextBlockIdx1,
        witdrawalRequestA.slotIdx,
        depositInfoA.accountID,
        tokenA,
        ownerA,
        toWithdrawA
      );

      const witdrawalRequestB = await exchangeTestUtil.requestWithdrawalOnchain(
        exchangeID,
        depositInfoB.accountID,
        tokenB,
        toWithdrawB,
        ownerB
      );

      // Try to withdraw before the block is committed
      const nextBlockIdx2 = await exchangeTestUtil.getNumBlocksOnchain();
      /*await expectThrow(
        exchange.withdrawFromApprovedWithdrawal(nextBlockIdx, witdrawalRequestA.slotIdx),
        "INVALID_BLOCKIDX",
      );*/

      // Commit the deposit
      await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeID);

      // Try to withdraw before the block is finalized
      await expectThrow(
        exchange.withdrawFromApprovedWithdrawal(nextBlockIdx2, 0),
        "BLOCK_NOT_FINALIZED"
      );

      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);

      // Withdraw
      await withdrawChecked(
        nextBlockIdx2,
        witdrawalRequestB.slotIdx,
        depositInfoB.accountID,
        tokenB,
        ownerB,
        balanceB
      );
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
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);

      // Expected protocol fees earned
      const protocolFeeA = ring.orderA.amountB
        .mul(protocolFees.takerFeeBips)
        .div(new BN(100000));
      const protocolFeeB = ring.orderB.amountB
        .mul(protocolFees.makerFeeBips)
        .div(new BN(100000));

      // Withdraw
      const blockIdx = (await exchangeTestUtil.getNumBlocksOnchain()) - 1;
      await withdrawChecked(
        blockIdx,
        0,
        0,
        ring.orderA.tokenB,
        Constants.zeroAddress,
        protocolFeeA
      );
      await withdrawChecked(
        blockIdx,
        1,
        0,
        ring.orderB.tokenB,
        Constants.zeroAddress,
        protocolFeeB
      );
    });

    it("Deposits totalling the balance more than MAX_AMOUNT should be capped to MAX_AMOUNT", async () => {
      await createExchange();

      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const amount = Constants.MAX_AMOUNT.sub(new BN(97));
      const token = exchangeTestUtil.getTokenAddress("TEST");

      // Deposit
      await exchangeTestUtil.deposit(
        exchangeID,
        owner,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        token,
        amount
      );
      // Deposit again. This time the amount will be capped to 2**96
      await exchangeTestUtil.deposit(
        exchangeID,
        owner,
        keyPair.secretKey,
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        token,
        amount
      );

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);

      const tokenID = exchangeTestUtil.getTokenIdFromNameOrAddress(token);
      const accountID = await exchangeTestUtil.getAccountID(owner);
      const account = (await exchangeTestUtil.loadExchangeState(exchangeID))
        .accounts[accountID];
      assert(
        account.balances[tokenID].balance.eq(Constants.MAX_AMOUNT),
        "Balance should be MAX_AMOUNT"
      );

      // Do a withdrawal request
      const witdrawalRequest = await exchangeTestUtil.requestWithdrawalOnchain(
        exchangeID,
        accountID,
        token,
        Constants.MAX_AMOUNT,
        owner
      );

      // Commit the withdrawal
      await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeID);
      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);

      // Withdraw
      const blockIdx = (await exchangeTestUtil.getNumBlocksOnchain()) - 1;
      await withdrawChecked(
        blockIdx,
        witdrawalRequest.slotIdx,
        accountID,
        token,
        owner,
        Constants.MAX_AMOUNT
      );
    });

    it("Distribute withdrawals (by operator)", async () => {
      await createExchange();

      const accountContract = await exchangeTestUtil.contracts.AccountContract.new(
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
          new BN(0),
          0
        );
      }
      const blockIdx = (await exchangeTestUtil.getNumBlocksOnchain()) - 1;
      await exchangeTestUtil.commitOffchainWithdrawalRequests(exchangeID);

      // Incorrect block index
      await expectThrow(
        exchange.distributeWithdrawals(123456, deposits.length, {
          from: exchangeTestUtil.exchangeOperator
        }),
        "INVALID_BLOCK_IDX"
      );

      // Block without any withdrawals
      await expectThrow(
        exchange.distributeWithdrawals(blockIdx, deposits.length, {
          from: exchangeTestUtil.exchangeOperator
        }),
        "INVALID_BLOCK_TYPE"
      );

      // Block not finalized yet
      await expectThrow(
        exchange.distributeWithdrawals(blockIdx + 1, deposits.length, {
          from: exchangeTestUtil.exchangeOperator
        }),
        "BLOCK_NOT_FINALIZED"
      );

      await exchangeTestUtil.verifyPendingBlocks(exchangeID);

      // Try to call from a non-operator address
      await expectThrow(
        exchange.distributeWithdrawals(blockIdx + 1, deposits.length, {
          from: exchangeTestUtil.testContext.deployer
        }),
        "UNAUTHORIZED"
      );

      // Try to do no withdrawals
      await expectThrow(
        exchange.distributeWithdrawals(blockIdx + 1, 0, {
          from: exchangeTestUtil.testContext.deployer
        }),
        "INVALID_MAX_NUM_WITHDRAWALS"
      );

      // Distribute the withdrawals
      const expectedSuccess = [true, false, true, false];
      await distributeWithdrawalsChecked(
        blockIdx + 1,
        deposits.length,
        deposits,
        exchangeTestUtil.exchangeOperator,
        false,
        expectedSuccess
      );

      // Try to distribute again
      await expectThrow(
        exchange.distributeWithdrawals(blockIdx + 1, deposits.length, {
          from: exchangeTestUtil.exchangeOperator
        }),
        "WITHDRAWALS_ALREADY_DISTRIBUTED"
      );

      // Do the withdrawals that cost too much gas manually
      for (const [i, deposit] of deposits.entries()) {
        if (!expectedSuccess[i]) {
          await withdrawChecked(
            blockIdx + 1,
            i,
            deposit.accountID,
            deposit.token,
            deposit.owner,
            deposit.amount
          );
        }
      }
    });

    it("Distribute withdrawals (not by operator)", async () => {
      await createExchange();

      // Deposit some LRC to stake for the exchange
      const depositer = exchangeTestUtil.testContext.operators[2];
      const stakeAmount = new BN(web3.utils.toWei("1234567", "ether"));
      await exchangeTestUtil.setBalanceAndApprove(
        depositer,
        "LRC",
        stakeAmount,
        loopring.address
      );

      await loopring.depositExchangeStake(exchangeID, stakeAmount, {
        from: depositer
      });

      // Do deposits to fill a complete block
      const blockSize = exchangeTestUtil.offchainWithdrawalBlockSizes[0];
      const deposits: DepositInfo[] = [];
      for (let i = 0; i < blockSize; i++) {
        const orderOwners = exchangeTestUtil.testContext.orderOwners;
        const keyPair = exchangeTestUtil.getKeyPairEDDSA();
        const owner = orderOwners[i];
        const amount = exchangeTestUtil.getRandomAmount();
        const token = exchangeTestUtil.getTokenAddress("LRC");
        const deposit = await exchangeTestUtil.deposit(
          exchangeID,
          owner,
          keyPair.secretKey,
          keyPair.publicKeyX,
          keyPair.publicKeyY,
          token,
          amount
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
          new BN(0),
          0
        );
      }
      const blockIdx = (await exchangeTestUtil.getNumBlocksOnchain()) - 1;
      await exchangeTestUtil.commitOffchainWithdrawalRequests(exchangeID);

      await exchangeTestUtil.verifyPendingBlocks(exchangeID);

      // Try to call from a non-operator address
      await expectThrow(
        exchange.distributeWithdrawals(blockIdx + 1, deposits.length, {
          from: exchangeTestUtil.testContext.deployer
        }),
        "UNAUTHORIZED"
      );

      // Wait the max time only the operator can do it
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS + 1
      );

      // Distribute the withdrawals
      await distributeWithdrawalsChecked(
        blockIdx + 1,
        deposits.length,
        deposits,
        exchangeTestUtil.testContext.deployer,
        true
      );

      // Try to distribute again
      await expectThrow(
        exchange.distributeWithdrawals(blockIdx + 1, deposits.length, {
          from: exchangeTestUtil.testContext.deployer
        }),
        "WITHDRAWALS_ALREADY_DISTRIBUTED"
      );
    });

    it("Distribute withdrawals in multiple parts", async () => {
      await createExchange();

      // Deposit some LRC to stake for the exchange
      const depositer = exchangeTestUtil.testContext.operators[2];
      const stakeAmount = new BN(web3.utils.toWei("1234567", "ether"));
      await exchangeTestUtil.setBalanceAndApprove(
        depositer,
        "LRC",
        stakeAmount,
        loopring.address
      );

      await loopring.depositExchangeStake(exchangeID, stakeAmount, {
        from: depositer
      });

      // Do deposits to fill a complete block
      const blockSize = exchangeTestUtil.offchainWithdrawalBlockSizes[1];
      const deposits: DepositInfo[] = [];
      for (let i = 0; i < blockSize; i++) {
        const orderOwners = exchangeTestUtil.testContext.orderOwners;
        const keyPair = exchangeTestUtil.getKeyPairEDDSA();
        const owner = orderOwners[i];
        const amount = exchangeTestUtil.getRandomAmount();
        const token = exchangeTestUtil.getTokenAddress("LRC");
        const deposit = await exchangeTestUtil.deposit(
          exchangeID,
          owner,
          keyPair.secretKey,
          keyPair.publicKeyX,
          keyPair.publicKeyY,
          token,
          amount
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
          new BN(0),
          0
        );
      }
      const blockIdx = (await exchangeTestUtil.getNumBlocksOnchain()) - 1;
      await exchangeTestUtil.commitOffchainWithdrawalRequests(exchangeID);
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);

      assert(blockSize === 8, "Unexpected blocksize");
      const slice1 = deposits.slice(0, 2);
      const slice2 = deposits.slice(2, 3);
      const slice3 = deposits.slice(3, 5);
      const slice4 = deposits.slice(5, 8);

      // Distribute the withdrawals in multiple parts
      await distributeWithdrawalsChecked(
        blockIdx + 1,
        slice1.length,
        slice1,
        exchangeTestUtil.exchangeOperator
      );
      await distributeWithdrawalsChecked(
        blockIdx + 1,
        slice2.length,
        slice2,
        exchangeTestUtil.exchangeOperator
      );

      // Wait the max time only the operator can do it
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_TIME_TO_DISTRIBUTE_WITHDRAWALS + 1
      );

      // Continue distributing the withdrawals in multiple parts
      const randomAddress = exchangeTestUtil.testContext.deployer;
      await distributeWithdrawalsChecked(
        blockIdx + 1,
        slice3.length,
        slice3,
        randomAddress,
        true
      );
      await distributeWithdrawalsChecked(
        blockIdx + 1,
        slice4.length + 8,
        slice4,
        randomAddress,
        true
      );

      // Try to distribute again
      await expectThrow(
        exchange.distributeWithdrawals(blockIdx + 1, 1, {
          from: randomAddress
        }),
        "WITHDRAWALS_ALREADY_DISTRIBUTED"
      );
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
          exchange.deposit(tokenA, amount, {
            from: owner,
            value: fees._depositFeeETH
          }),
          "TOKEN_DEPOSIT_DISABLED"
        );

        // Deposit another token
        await exchange.deposit(tokenB, amount, {
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
        await exchange.deposit(tokenA, amount, {
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
