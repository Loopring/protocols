import BN = require("bn.js");
import * as constants from "./constants";
import { expectThrow } from "./expectThrow";
import { roundToFloatValue } from "./float";
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
      constants.emptyBytes,
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
    const numAvailableSlotsBefore = (await exchange.getNumAvailableDepositSlots()).toNumber();

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
    const numAvailableSlotsAfter = (await exchange.getNumAvailableDepositSlots()).toNumber();

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
    const numAvailableSlotsBefore = (await exchange.getNumAvailableDepositSlots()).toNumber();

    const ethValue = token === "ETH" ? amount.add(depositFee) : depositFee;
    await exchange.updateAccountAndDeposit(
      keyPair.publicKeyX,
      keyPair.publicKeyY,
      token,
      amount,
      constants.emptyBytes,
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
    const numAvailableSlotsAfter = (await exchange.getNumAvailableDepositSlots()).toNumber();

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
      constants.Float28Encoding
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
        constants.Float28Encoding
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
        constants.Float28Encoding
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
      assert(
        lrcSupplyAfter.eq(lrcSupplyBefore.sub(burned)),
        "half of fine should be burned"
      );
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
        "INSUFFICIENT_FUND"
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
  });
});
