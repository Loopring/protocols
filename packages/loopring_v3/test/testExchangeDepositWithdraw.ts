import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;

  const zeroAddress = "0x" + "00".repeat(20);

  const createAccountAndDepositChecked = async (stateID: number, keyPair: any, walletID: number, tokenID: number,
                                                amount: BN, owner: string, depositFee: BN,
                                                token: string) => {
    const balanceOwnerBefore = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const numAvailableSlotsBefore = (await exchange.getNumAvailableDepositSlots(stateID)).toNumber();

    const ethValue = (token === "ETH") ? amount.add(depositFee) : depositFee;
    await exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
      walletID, tokenID, amount, {from: owner, value: ethValue, gasPrice: 0});

    const balanceOwnerAfter = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const numAvailableSlotsAfter = (await exchange.getNumAvailableDepositSlots(stateID)).toNumber();

    const expectedBalanceDelta = (token === "ETH") ? amount.add(depositFee) : amount;
    assert(balanceOwnerBefore.eq(balanceOwnerAfter.add(expectedBalanceDelta)),
           "Token balance of owner should be decreased by amount");
    assert(balanceContractAfter.eq(balanceContractBefore.add(expectedBalanceDelta)),
           "Token balance of contract should be increased by amount");

    assert.equal(numAvailableSlotsBefore, numAvailableSlotsAfter + 1,
           "Number of available deposit slots should have been decreased by 1");

    // Get the Deposit event
    const eventArr: any = await exchangeTestUtil.getEventsFromContract(exchange, "Deposit", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.accountID, eventObj.args.depositBlockIdx, eventObj.args.slotIdx];
    });
    assert.equal(items.length, 1, "A single Deposit event should have been emitted");
    const accountID = items[0][0].toNumber();
    return accountID;
  };

  const depositChecked = async (stateID: number, accountID: number, tokenID: number, amount: BN,
                                owner: string, depositFee: BN,
                                token: string) => {
    const balanceOwnerBefore = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const numAvailableSlotsBefore = (await exchange.getNumAvailableDepositSlots(stateID)).toNumber();

    const ethValue = (token === "ETH") ? amount.add(depositFee) : depositFee;
    await exchange.deposit(stateID, accountID, tokenID, amount, {from: owner, value: ethValue, gasPrice: 0});

    const balanceOwnerAfter = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const numAvailableSlotsAfter = (await exchange.getNumAvailableDepositSlots(stateID)).toNumber();

    const expectedBalanceDelta = (token === "ETH") ? amount.add(depositFee) : amount;
    assert(balanceOwnerBefore.eq(balanceOwnerAfter.add(expectedBalanceDelta)),
           "Token balance of owner should be decreased by amount");
    assert(balanceContractAfter.eq(balanceContractBefore.add(expectedBalanceDelta)),
           "Token balance of contract should be increased by amount");

    assert.equal(numAvailableSlotsBefore, numAvailableSlotsAfter + 1,
           "Number of available deposit slots should have been decreased by 1");

    // Get the Deposit event
    const eventArr: any = await exchangeTestUtil.getEventsFromContract(exchange, "Deposit", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.accountID, eventObj.args.depositBlockIdx, eventObj.args.slotIdx];
    });
    assert.equal(items.length, 1, "A single Deposit event should have been emitted");
    assert.equal(items[0][0].toNumber(), accountID, "Deposit accountID should match");
  };

  const depositAndUpdateAccountChecked = async (stateID: number, accountID: number, keyPair: any, walletID: number,
                                                tokenID: number, amount: BN,
                                                owner: string, depositFee: BN,
                                                token: string) => {
    const balanceOwnerBefore = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const numAvailableSlotsBefore = (await exchange.getNumAvailableDepositSlots(stateID)).toNumber();

    const ethValue = (token === "ETH") ? amount.add(depositFee) : depositFee;
    await exchange.depositAndUpdateAccount(stateID, accountID, keyPair.publicKeyX, keyPair.publicKeyY, walletID,
                                           tokenID, amount, {from: owner, value: ethValue, gasPrice: 0});

    const balanceOwnerAfter = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const numAvailableSlotsAfter = (await exchange.getNumAvailableDepositSlots(stateID)).toNumber();

    const expectedBalanceDelta = (token === "ETH") ? amount.add(depositFee) : amount;
    assert(balanceOwnerBefore.eq(balanceOwnerAfter.add(expectedBalanceDelta)),
           "Token balance of owner should be decreased by amount");
    assert(balanceContractAfter.eq(balanceContractBefore.add(expectedBalanceDelta)),
           "Token balance of contract should be increased by amount");

    assert.equal(numAvailableSlotsBefore, numAvailableSlotsAfter + 1,
           "Number of available deposit slots should have been decreased by 1");

    // Get the Deposit event
    const eventArr: any = await exchangeTestUtil.getEventsFromContract(exchange, "Deposit", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.accountID, eventObj.args.depositBlockIdx, eventObj.args.slotIdx];
    });
    assert.equal(items.length, 1, "A single Deposit event should have been emitted");
    assert.equal(items[0][0].toNumber(), accountID, "Deposit accountID should match");
  };

  const withdrawOnceChecked = async (stateID: number, blockIdx: number, slotIdx: number,
                                     accountID: number, tokenID: number,
                                     owner: string, token: string, expectedAmount: BN, bBurn: boolean = false) => {
    const balanceOwnerBefore = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    console.log(token);
    const burnBalanceBefore = await exchange.burnBalances(token);

    await exchange.withdraw(stateID, blockIdx, slotIdx);

    const balanceOwnerAfter = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const burnBalanceAfter = await exchange.burnBalances(token);

    let amountToOwner = expectedAmount;
    let amountToBurn = new BN(0);
    if (bBurn) {
      const burnRate = await exchangeTestUtil.tokenRegistry.getBurnRate(tokenID);
      amountToBurn = expectedAmount.mul(burnRate).div(new BN(1000));
      amountToOwner = expectedAmount.sub(amountToBurn);
    }

    assert(balanceOwnerAfter.eq(balanceOwnerBefore.add(amountToOwner)),
           "Token balance of owner should be increased by amountToOwner");
    assert(balanceContractBefore.eq(balanceContractAfter.add(amountToOwner)),
           "Token balance of contract should be decreased by amountToOwner");
    assert(burnBalanceAfter.eq(burnBalanceBefore.add(amountToBurn)),
           "burnBalance should be increased by amountToBurn");

    // Get the Withdraw event
    const eventArr: any = await exchangeTestUtil.getEventsFromContract(exchange, "Withdraw", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.accountID, eventObj.args.tokenID, eventObj.args.amount];
    });
    assert.equal(items.length, 1, "A single Withdraw event should have been emitted");
    assert.equal(items[0][0].toNumber(), accountID, "accountID should match");
    assert.equal(items[0][1].toNumber(), tokenID, "tokenID should match");
    assert(items[0][2].eq(expectedAmount), "amount should match");
  };

  const withdrawChecked = async (stateID: number, blockIdx: number, slotIdx: number,
                                 accountID: number, tokenID: number,
                                 owner: string, token: string, expectedAmount: BN, bBurn: boolean = false) => {
    // Withdraw
    await withdrawOnceChecked(stateID, blockIdx, slotIdx,
                              accountID, tokenID,
                              owner, token, expectedAmount, bBurn);
    // Withdraw again, no tokens should be transferred
    await withdrawOnceChecked(stateID, blockIdx, slotIdx,
                              accountID, tokenID,
                              owner, token, new BN(0), bBurn);
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    exchange = exchangeTestUtil.exchange;
  });

  describe("DepositWithdraw", function() {
    this.timeout(0);

    it("ERC20: Deposit", async () => {
      const stateID = await exchangeTestUtil.createNewState(exchangeTestUtil.testContext.stateOwners[0], false);
      let keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const walletA = await exchangeTestUtil.createWallet(stateID, exchangeTestUtil.testContext.wallets[0]);
      let amount = new BN(web3.utils.toWei("7", "ether"));
      let token = "LRC";
      let tokenID = exchangeTestUtil.getTokenIdFromNameOrAddress(token);

      // The correct deposit fee expected by the contract
      const depositFee = await exchange.getDepositFee(stateID);

      // No ETH sent
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          walletA.walletID, tokenID, amount, {from: owner, value: new BN(0)}),
        "INCORRECT_ETH_FEE",
      );
      // Not enough ETH
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          walletA.walletID, tokenID, amount, {from: owner, value: depositFee.sub(new BN(1))}),
        "INCORRECT_ETH_FEE",
      );
      // Too much ETH
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          walletA.walletID, tokenID, amount, {from: owner, value: depositFee.add(new BN(1))}),
        "INCORRECT_ETH_FEE",
      );

      // Insufficient funds
      await exchangeTestUtil.setBalanceAndApprove(owner, token, amount.sub(new BN(1)));
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          walletA.walletID, tokenID, amount, {from: owner, value: depositFee}),
        "INSUFFICIENT_FUNDS",
      );

      // Set the correct balance/approval
      await exchangeTestUtil.setBalanceAndApprove(owner, token, amount);

      // Invalid tokenID
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          walletA.walletID, 123, amount, {from: owner, value: depositFee}),
        "INVALID_TOKENID",
      );

      // Invalid walletID
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          789, tokenID, amount, {from: owner, value: depositFee}),
        "INVALID_WALLETID",
      );

      // Everything correct
      const accountID = await createAccountAndDepositChecked(stateID, keyPair, walletA.walletID, tokenID,
                                                             amount, owner, depositFee, token);

      // Do deposit to the same account with another token
      token = "WETH";
      tokenID = exchangeTestUtil.getTokenIdFromNameOrAddress(token);
      amount = new BN(web3.utils.toWei("4.5", "ether"));

      // New balance/approval for another deposit
      await exchangeTestUtil.setBalanceAndApprove(owner, token, amount);

      // Invalid msg.sender
      const wrongOwner = exchangeTestUtil.testContext.deployer;
      await expectThrow(
        exchange.deposit(stateID, accountID, tokenID, amount, {from: wrongOwner, value: depositFee}),
        "UNAUTHORIZED",
      );

      // Invalid accountID
      await expectThrow(
        exchange.deposit(stateID, 258, tokenID, amount, {from: owner, value: depositFee}),
        "INVALID_ACCOUNTID",
      );

      // Everything correct
      await depositChecked(stateID, accountID, tokenID, amount, owner, depositFee, token);

      // Change some account info
      amount = new BN(0);
      keyPair = exchangeTestUtil.getKeyPairEDDSA();

      // Change the publicKey
      await depositAndUpdateAccountChecked(stateID, accountID, keyPair, walletA.walletID,
        tokenID, amount, owner, depositFee, token);

      // Try to change the type of the account
      const invalidWalletID = walletA.walletID + exchangeTestUtil.MAX_MUM_WALLETS;
      await expectThrow(
        exchange.depositAndUpdateAccount(stateID, accountID, keyPair.publicKeyX, keyPair.publicKeyY, invalidWalletID,
                                         tokenID, amount, {from: owner, value: depositFee}),
        "INVALID_WALLETID_CHANGE",
      );

      // Change the walletID
      const walletB = await exchangeTestUtil.createWallet(stateID, exchangeTestUtil.testContext.wallets[1]);
      assert(walletA.walletID !== walletB.walletID);
      await depositAndUpdateAccountChecked(stateID, accountID, keyPair, walletB.walletID,
        tokenID, amount, owner, depositFee, token);
    });

    it("ETH: Deposit", async () => {
      const stateID = await exchangeTestUtil.createNewState(exchangeTestUtil.testContext.stateOwners[0], false);
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const walletA = await exchangeTestUtil.createWallet(stateID, exchangeTestUtil.testContext.wallets[0]);
      const amount = new BN(web3.utils.toWei("3", "ether"));
      const tokenID = exchangeTestUtil.getTokenIdFromNameOrAddress("ETH");

      // The correct deposit fee expected by the contract
      const depositFee = await exchange.getDepositFee(stateID);

      // No ETH sent
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          walletA.walletID, tokenID, amount, {from: owner, value: new BN(0)}),
        "INCORRECT_ETH_VALUE",
      );

      // Not enough ETH
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          walletA.walletID, tokenID, amount, {from: owner, value: amount}),
        "INCORRECT_ETH_VALUE",
      );

      // Too much ETH
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          walletA.walletID, tokenID, amount, {from: owner, value: amount.add(depositFee).add(new BN(1))}),
        "INCORRECT_ETH_VALUE",
      );

      // Everything correct
      await createAccountAndDepositChecked(stateID, keyPair,
        walletA.walletID, tokenID, amount, owner, depositFee, "ETH");
    });

    it("Dual-author/wallet account (walletID > 0)", async () => {
      const stateID = await exchangeTestUtil.createNewState(exchangeTestUtil.testContext.stateOwners[0], false);
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const walletA = await exchangeTestUtil.createWallet(stateID, exchangeTestUtil.testContext.wallets[0]);
      const walletB = await exchangeTestUtil.createWallet(stateID, exchangeTestUtil.testContext.wallets[1]);
      const walletC = await exchangeTestUtil.createWallet(stateID, walletA.owner);
      let amount = new BN(0);
      const token = "ETH";
      const tokenID = exchangeTestUtil.getTokenIdFromNameOrAddress(token);

      const depositFee = await exchange.getDepositFee(stateID);

      // The dual-author walletID
      let walletID = walletA.walletID + exchangeTestUtil.MAX_MUM_WALLETS;

      // Unauthorized msg.sender (not wallet owner)
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          walletID, tokenID, amount, {from: walletB.owner, value: depositFee}),
        "UNAUTHORIZED_FOR_DUAL_AUTHOR_ACCOUNT",
      );

      // Everything correct
      const accountID = await createAccountAndDepositChecked(stateID, keyPair, walletID, tokenID,
                                                             amount, walletA.owner, depositFee, token);

      // Try to change the type of the account
      let invalidWalletID = walletA.walletID;
      await expectThrow(
        exchange.depositAndUpdateAccount(stateID, accountID, keyPair.publicKeyX, keyPair.publicKeyY, invalidWalletID,
                                         tokenID, amount, {from: walletA.owner, value: depositFee}),
        "INVALID_WALLETID_CHANGE",
      );

      // Try to change to a wallet not owned by the current wallet owner
      invalidWalletID = walletB.walletID + exchangeTestUtil.MAX_MUM_WALLETS;
      await expectThrow(
        exchange.depositAndUpdateAccount(stateID, accountID, keyPair.publicKeyX, keyPair.publicKeyY, invalidWalletID,
                                         tokenID, amount, {from: walletA.owner, value: depositFee}),
        "UNAUTHORIZED_FOR_DUAL_AUTHOR_ACCOUNT",
      );

      // Change the walletID to a wallet also owned by the previous wallet owner
      walletID = walletC.walletID + exchangeTestUtil.MAX_MUM_WALLETS;
      await depositAndUpdateAccountChecked(stateID, accountID, keyPair, walletID,
        tokenID, amount, walletA.owner, depositFee, token);

      // Try to deposit
      amount = new BN(web3.utils.toWei("3", "ether"));
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          walletID, tokenID, amount, {from: walletA.owner, value: depositFee}),
        "CANNOT_DEPOSIT_TO_DUAL_AUTHOR_ACCOUNTS",
      );
    });

    it("Dual-author/wallet account (walletID == 0)", async () => {
      const stateID = await exchangeTestUtil.createNewState(exchangeTestUtil.testContext.stateOwners[0], false);
      const keyPairA = exchangeTestUtil.getKeyPairEDDSA();
      const keyPairB = exchangeTestUtil.getKeyPairEDDSA();
      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const ownerB = exchangeTestUtil.testContext.orderOwners[1];
      let amount = new BN(0);
      const token = "ETH";
      const tokenID = exchangeTestUtil.getTokenIdFromNameOrAddress(token);

      const depositFee = await exchange.getDepositFee(stateID);

      // The dual-author walletID for walletID 0
      const walletID = exchangeTestUtil.MAX_MUM_WALLETS;

      // Anyone can create these accounts
      const accountIDA = await createAccountAndDepositChecked(stateID, keyPairA, walletID, tokenID,
                                                              amount, ownerA, depositFee, token);

      const accountIDB = await createAccountAndDepositChecked(stateID, keyPairB, walletID, tokenID,
                                                              amount, ownerB, depositFee, token);

      // Try to deposit
      amount = new BN(web3.utils.toWei("3", "ether"));
      await expectThrow(
        exchange.deposit(stateID, accountIDA, tokenID, amount, {from: ownerA, value: depositFee}),
        "CANNOT_DEPOSIT_TO_DUAL_AUTHOR_ACCOUNTS",
      );
    });

    it("Onchain withdrawal request", async () => {
      const stateID = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const ownerB = exchangeTestUtil.testContext.orderOwners[1];
      const wallet = exchangeTestUtil.wallets[stateID][0];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const toWithdraw = new BN(web3.utils.toWei("4", "ether"));
      const token = "LRC";
      const tokenID = exchangeTestUtil.getTokenIdFromNameOrAddress(token);
      const one = new BN(1);

      const depositInfo = await exchangeTestUtil.deposit(stateID, ownerA,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         wallet.walletID, token, balance);
      const accountID = depositInfo.accountID;
      await exchangeTestUtil.commitDeposits(stateID);

      const withdrawFee = await exchange.getWithdrawFee(stateID);

      // No ETH sent
      await expectThrow(
        exchange.requestWithdraw(stateID, accountID, tokenID, toWithdraw, {from: ownerA, value: new BN(0)}),
        "WRONG_ETH_VALUE",
      );
      // Not enough ETH sent
      await expectThrow(
        exchange.requestWithdraw(stateID, accountID, tokenID, toWithdraw, {from: ownerA, value: withdrawFee.sub(one)}),
        "WRONG_ETH_VALUE",
      );
      // too much ETH sent
      await expectThrow(
        exchange.requestWithdraw(stateID, accountID, tokenID, toWithdraw, {from: ownerA, value: withdrawFee.add(one)}),
        "WRONG_ETH_VALUE",
      );

      // Only the account owner can request a withdrawal
      await expectThrow(
        exchange.requestWithdraw(stateID, accountID, tokenID, toWithdraw, {from: ownerB, value: withdrawFee}),
        "UNAUTHORIZED",
      );

      // Try to withdraw nothing
      await expectThrow(
        exchange.requestWithdraw(stateID, accountID, tokenID, new BN(0), {from: ownerB, value: withdrawFee}),
        "CANNOT_WITHDRAW_NOTHING",
      );

      // Do the request
      const witdrawalRequest = await exchangeTestUtil.requestWithdrawalOnchain(
        stateID, accountID, token, toWithdraw, ownerA,
      );

      // Commit the deposit
      await exchangeTestUtil.commitOnchainWithdrawalRequests(stateID);
      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(stateID);

      // Withdraw
      const blockIdx = (await exchange.getBlockIdx(web3.utils.toBN(stateID))).toNumber();
      await withdrawChecked(stateID, blockIdx, witdrawalRequest.slotIdx,
                            accountID, tokenID,
                            ownerA, token, toWithdraw);
    });

    it("Offchain withdrawal request", async () => {
      const stateID = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[stateID][0];
      const balance = new BN(web3.utils.toWei("4", "ether"));
      const toWithdraw = new BN(web3.utils.toWei("5", "ether"));
      const token = "ETH";
      const tokenID = exchangeTestUtil.getTokenIdFromNameOrAddress(token);
      const feeToken = "ETH";
      const fee = new BN(web3.utils.toWei("0.5", "ether"));

      const depositInfo = await exchangeTestUtil.deposit(stateID, owner,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         wallet.walletID, token, balance);
      const accountID = depositInfo.accountID;
      await exchangeTestUtil.commitDeposits(stateID);

      const witdrawalRequest = await exchangeTestUtil.requestWithdrawalOffchain(
        stateID, accountID, token, toWithdraw,
        feeToken, fee, 0, wallet.walletAccountID,
      );
      await exchangeTestUtil.commitOffchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyPendingBlocks(stateID);

      // Withdraw
      const blockIdx = (await exchange.getBlockIdx(web3.utils.toBN(stateID))).toNumber();
      await withdrawChecked(stateID, blockIdx, 0,
                            accountID, tokenID,
                            owner, token, balance.sub(fee));
    });

    it("Withdraw (normal account)", async () => {
      const stateID = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const ownerB = exchangeTestUtil.testContext.orderOwners[1];
      const wallet = exchangeTestUtil.wallets[stateID][0];

      const balanceA = new BN(web3.utils.toWei("7", "ether"));
      const toWithdrawA = new BN(web3.utils.toWei("4", "ether"));
      const tokenA = "LRC";
      const tokenIDA = exchangeTestUtil.getTokenIdFromNameOrAddress(tokenA);

      const balanceB = new BN(web3.utils.toWei("1", "ether"));
      const toWithdrawB = new BN(web3.utils.toWei("3", "ether"));
      const tokenB = "ETH";
      const tokenIDB = exchangeTestUtil.getTokenIdFromNameOrAddress(tokenB);

      const depositInfoA = await exchangeTestUtil.deposit(stateID, ownerA,
                                                          keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                          wallet.walletID, tokenA, balanceA);
      const depositInfoB = await exchangeTestUtil.deposit(stateID, ownerB,
                                                          keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                          wallet.walletID, tokenB, balanceB);
      await exchangeTestUtil.commitDeposits(stateID);

      // Do the request
      const witdrawalRequestA = await exchangeTestUtil.requestWithdrawalOnchain(
        stateID, depositInfoA.accountID, tokenA, toWithdrawA, ownerA,
      );
      const witdrawalRequestB = await exchangeTestUtil.requestWithdrawalOnchain(
        stateID, depositInfoB.accountID, tokenB, toWithdrawB, ownerB,
      );

      // Try to withdraw before the block is committed
      const nextBlockIdx = (await exchange.getBlockIdx(web3.utils.toBN(stateID))).toNumber() + 1;
      await expectThrow(
        exchange.withdraw(stateID, nextBlockIdx, witdrawalRequestA.slotIdx),
        "INVALID_BLOCKIDX",
      );

      // Commit the deposit
      await exchangeTestUtil.commitOnchainWithdrawalRequests(stateID);

      // Try to withdraw before the block is finalized
      await expectThrow(
        exchange.withdraw(stateID, nextBlockIdx, witdrawalRequestB.slotIdx),
        "BLOCK_NOT_FINALIZED",
      );

      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(stateID);

      // Withdraw
      await withdrawChecked(stateID, nextBlockIdx, witdrawalRequestB.slotIdx,
                            depositInfoB.accountID, tokenIDB,
                            ownerB, tokenB, balanceB);
      await withdrawChecked(stateID, nextBlockIdx, witdrawalRequestA.slotIdx,
                            depositInfoA.accountID, tokenIDA,
                            ownerA, tokenA, toWithdrawA);
    });

    it("Withdraw (wallet account)", async () => {
      const stateID = 0;
      const walletA = await exchangeTestUtil.createWallet(stateID, exchangeTestUtil.testContext.wallets[0]);
      const walletB = await exchangeTestUtil.createWallet(stateID, exchangeTestUtil.testContext.wallets[1]);
      const ring: RingInfo = {
        orderA:
          {
            stateID,
            tokenS: "WETH",
            tokenB: "GTO",
            tokenF: "ETH",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("1.5", "ether")),
            walletID: walletA.walletID,
            dualAuthAccountID: walletA.walletAccountID,
          },
        orderB:
          {
            stateID,
            tokenS: "GTO",
            tokenB: "WETH",
            tokenF: "LRC",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
            walletID: walletB.walletID,
            dualAuthAccountID: walletB.walletAccountID,
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      const witdrawalRequestA = await exchangeTestUtil.requestWithdrawalOnchain(
        stateID, ring.orderA.dualAuthAccountID,
        ring.orderA.tokenF, ring.orderA.amountF.mul(new BN(2)),
        ring.orderA.owner,
      );
      const witdrawalRequestB = await exchangeTestUtil.requestWithdrawalOnchain(
        stateID, ring.orderB.dualAuthAccountID,
        ring.orderB.tokenF, ring.orderB.amountF.mul(new BN(2)),
        ring.orderB.owner,
      );
      await exchangeTestUtil.commitOnchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyPendingBlocks(stateID);

      const walletFeeA = ring.orderA.amountF.mul(new BN(ring.orderA.walletSplitPercentage)).div(new BN(100));
      const walletFeeB = ring.orderB.amountF.mul(new BN(ring.orderB.walletSplitPercentage)).div(new BN(100));

      // Withdraw
      const blockIdx = (await exchange.getBlockIdx(web3.utils.toBN(stateID))).toNumber();
      await withdrawChecked(stateID, blockIdx, witdrawalRequestA.slotIdx,
                            ring.orderA.dualAuthAccountID, ring.orderA.tokenIdF,
                            walletA.owner, ring.orderA.tokenF, walletFeeA, true);
      await withdrawChecked(stateID, blockIdx, witdrawalRequestB.slotIdx,
                            ring.orderB.dualAuthAccountID, ring.orderB.tokenIdF,
                            walletB.owner, ring.orderB.tokenF, walletFeeB, true);
    });

  });
});
