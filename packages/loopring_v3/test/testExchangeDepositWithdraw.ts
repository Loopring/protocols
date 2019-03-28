import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;

  const zeroAddress = "0x" + "00".repeat(20);

  const createAccountChecked = async (keyPair: any, token: string,
                                      amount: BN, owner: string, depositFee: BN) => {
    const balanceOwnerBefore = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const numAvailableSlotsBefore = (await exchange.getNumAvailableDepositSlots()).toNumber();

    const ethValue = (token === "ETH") ? amount.add(depositFee) : depositFee;
    await exchange.createAccount(keyPair.publicKeyX, keyPair.publicKeyY,
      token, amount, {from: owner, value: ethValue, gasPrice: 0});

    const balanceOwnerAfter = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const numAvailableSlotsAfter = (await exchange.getNumAvailableDepositSlots()).toNumber();

    const expectedBalanceDelta = (token === "ETH") ? amount.add(depositFee) : amount;
    assert(balanceOwnerBefore.eq(balanceOwnerAfter.add(expectedBalanceDelta)),
           "Token balance of owner should be decreased by amount");
    assert(balanceContractAfter.eq(balanceContractBefore.add(expectedBalanceDelta)),
           "Token balance of contract should be increased by amount");

    /*assert.equal(numAvailableSlotsBefore, numAvailableSlotsAfter + 1,
           "Number of available deposit slots should have been decreased by 1");*/

    // Get the Deposit event
    const eventArr: any = await exchangeTestUtil.getEventsFromContract(exchange, "Deposit", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.accountID, eventObj.args.depositBlockIdx, eventObj.args.slotIdx];
    });
    assert.equal(items.length, 1, "A single Deposit event should have been emitted");
    const accountID = items[0][0].toNumber();
    return accountID;
  };

  const depositChecked = async (accountID: number, token: string, amount: BN,
                                owner: string, depositFee: BN) => {
    const balanceOwnerBefore = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const numAvailableSlotsBefore = (await exchange.getNumAvailableDepositSlots()).toNumber();

    const ethValue = (token === "ETH") ? amount.add(depositFee) : depositFee;
    await exchange.deposit(token, amount, {from: owner, value: ethValue, gasPrice: 0});

    const balanceOwnerAfter = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const numAvailableSlotsAfter = (await exchange.getNumAvailableDepositSlots()).toNumber();

    const expectedBalanceDelta = (token === "ETH") ? amount.add(depositFee) : amount;
    assert(balanceOwnerBefore.eq(balanceOwnerAfter.add(expectedBalanceDelta)),
           "Token balance of owner should be decreased by amount");
    assert(balanceContractAfter.eq(balanceContractBefore.add(expectedBalanceDelta)),
           "Token balance of contract should be increased by amount");

    /*assert.equal(numAvailableSlotsBefore, numAvailableSlotsAfter + 1,
           "Number of available deposit slots should have been decreased by 1");*/

    // Get the Deposit event
    const eventArr: any = await exchangeTestUtil.getEventsFromContract(exchange, "Deposit", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.accountID, eventObj.args.depositBlockIdx, eventObj.args.slotIdx];
    });
    assert.equal(items.length, 1, "A single Deposit event should have been emitted");
    assert.equal(items[0][0].toNumber(), accountID, "Deposit accountID should match");
  };

  const updateAccountChecked = async (accountID: number, keyPair: any,
                                      token: string, amount: BN,
                                      owner: string, depositFee: BN) => {
    const balanceOwnerBefore = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const numAvailableSlotsBefore = (await exchange.getNumAvailableDepositSlots()).toNumber();

    const ethValue = (token === "ETH") ? amount.add(depositFee) : depositFee;
    await exchange.updateAccount(keyPair.publicKeyX, keyPair.publicKeyY,
                                 token, amount, {from: owner, value: ethValue, gasPrice: 0});

    const balanceOwnerAfter = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const numAvailableSlotsAfter = (await exchange.getNumAvailableDepositSlots()).toNumber();

    const expectedBalanceDelta = (token === "ETH") ? amount.add(depositFee) : amount;
    assert(balanceOwnerBefore.eq(balanceOwnerAfter.add(expectedBalanceDelta)),
           "Token balance of owner should be decreased by amount");
    assert(balanceContractAfter.eq(balanceContractBefore.add(expectedBalanceDelta)),
           "Token balance of contract should be increased by amount");

    /*assert.equal(numAvailableSlotsBefore, numAvailableSlotsAfter + 1,
           "Number of available deposit slots should have been decreased by 1");*/

    // Get the Deposit event
    const eventArr: any = await exchangeTestUtil.getEventsFromContract(exchange, "Deposit", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.accountID, eventObj.args.depositBlockIdx, eventObj.args.slotIdx];
    });
    assert.equal(items.length, 1, "A single Deposit event should have been emitted");
    assert.equal(items[0][0].toNumber(), accountID, "Deposit accountID should match");
  };

  const withdrawOnceChecked = async (blockIdx: number, slotIdx: number,
                                     accountID: number, token: string,
                                     owner: string, expectedAmount: BN, bBurn: boolean = false) => {
    const balanceOwnerBefore = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    // const burnBalanceBefore = await exchange.burnBalances(token);

    await exchange.withdrawFromApprovedWithdrawal(blockIdx, slotIdx);

    const balanceOwnerAfter = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    // const burnBalanceAfter = await exchange.burnBalances(token);

    let amountToOwner = expectedAmount;
    let amountToBurn = new BN(0);
    if (bBurn) {
      const burnRate = await exchangeTestUtil.loopringV3.getTokenBurnRate(token);
      amountToBurn = expectedAmount.mul(burnRate).div(new BN(1000));
      amountToOwner = expectedAmount.sub(amountToBurn);
    }

    assert(balanceOwnerAfter.eq(balanceOwnerBefore.add(amountToOwner)),
           "Token balance of owner should be increased by amountToOwner");
    assert(balanceContractBefore.eq(balanceContractAfter.add(amountToOwner)),
           "Token balance of contract should be decreased by amountToOwner");
    /*assert(burnBalanceAfter.eq(burnBalanceBefore.add(amountToBurn)),
           "burnBalance should be increased by amountToBurn");*/

    // Get the Withdraw event
    const eventArr: any = await exchangeTestUtil.getEventsFromContract(exchange, "Withdraw", web3.eth.blockNumber);
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.accountID, eventObj.args.tokenID, eventObj.args.amount];
    });
    assert.equal(items.length, 1, "A single Withdraw event should have been emitted");
    assert.equal(items[0][0].toNumber(), accountID, "accountID should match");
    // assert.equal(items[0][1].toNumber(), tokenID, "tokenID should match");
    assert(items[0][2].eq(expectedAmount), "amount should match");
  };

  const withdrawChecked = async (blockIdx: number, slotIdx: number,
                                 accountID: number, token: string,
                                 owner: string, expectedAmount: BN, bBurn: boolean = false) => {
    // Withdraw
    await withdrawOnceChecked(blockIdx, slotIdx,
                              accountID, token,
                              owner, expectedAmount, bBurn);
    // Withdraw again, no tokens should be transferred
    await withdrawOnceChecked(blockIdx, slotIdx,
                              accountID, token,
                              owner, new BN(0), bBurn);
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    exchange = exchangeTestUtil.exchange;
  });

  describe("DepositWithdraw", function() {
    this.timeout(0);

    it("ERC20: Deposit", async () => {
      // const realmID = await exchangeTestUtil.createExchange(exchangeTestUtil.testContext.stateOwners[0], false);
      const realmID = 1;
      let keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      let amount = new BN(web3.utils.toWei("7", "ether"));
      let token = exchangeTestUtil.getTokenAddress("LRC");

      // The correct deposit fee expected by the contract
      const depositFee = await exchange.getDepositFee();

      // No ETH sent
      await expectThrow(
        exchange.createAccount(keyPair.publicKeyX, keyPair.publicKeyY,
          token, amount, {from: owner, value: new BN(0)}),
        "INVALID_VALUE",
      );
      // Not enough ETH
      await expectThrow(
        exchange.createAccount(keyPair.publicKeyX, keyPair.publicKeyY,
          token, amount, {from: owner, value: depositFee.sub(new BN(1))}),
        "INVALID_VALUE",
      );

      // Insufficient funds
      await exchangeTestUtil.setBalanceAndApprove(owner, token, amount.sub(new BN(1)));
      await expectThrow(
        exchange.createAccount(keyPair.publicKeyX, keyPair.publicKeyY,
          token, amount, {from: owner, value: depositFee}),
        "INSUFFICIENT_FUND",
      );

      // Set the correct balance/approval
      await exchangeTestUtil.setBalanceAndApprove(owner, token, amount);

      // Invalid token
      /*await expectThrow(
        exchange.createAccount(keyPair.publicKeyX, keyPair.publicKeyY,
          123, amount, {from: owner, value: depositFee}),
        "INVALID_TOKEN_ID",
      );*/

      // Everything correct
      const accountID = await createAccountChecked(keyPair, token, amount, owner, depositFee);

      // Do deposit to the same account with another token
      token = exchangeTestUtil.getTokenAddress("WETH");
      amount = new BN(web3.utils.toWei("4.5", "ether"));

      // New balance/approval for another deposit
      await exchangeTestUtil.setBalanceAndApprove(owner, token, amount);

      // Unknown owner
      const wrongOwner = exchangeTestUtil.testContext.deployer;
      await expectThrow(
        exchange.deposit(token, amount, {from: wrongOwner, value: depositFee}),
        "SENDER_HAS_NO_ACCOUNT",
      );

      // Everything correct
      await depositChecked(accountID, token, amount, owner, depositFee);

      // Change some account info
      amount = new BN(0);
      keyPair = exchangeTestUtil.getKeyPairEDDSA();

      // Change the publicKey
      await updateAccountChecked(accountID, keyPair, token,  amount, owner, depositFee);
    });

    it("ETH: Deposit", async () => {
      const realmID = await exchangeTestUtil.createExchange(exchangeTestUtil.testContext.stateOwners[0], false);
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const amount = new BN(web3.utils.toWei("3", "ether"));
      const token = exchangeTestUtil.getTokenAddress("ETH");

      // The correct deposit fee expected by the contract
      const depositFee = await exchange.getDepositFee(realmID);

      // No ETH sent
      await expectThrow(
        exchange.createAccount(realmID, keyPair.publicKeyX, keyPair.publicKeyY,
          token, amount, {from: owner, value: new BN(0)}),
        "INCORRECT_ETH_VALUE",
      );

      // Not enough ETH
      await expectThrow(
        exchange.createAccount(realmID, keyPair.publicKeyX, keyPair.publicKeyY,
          token, amount, {from: owner, value: amount}),
        "INCORRECT_ETH_VALUE",
      );

      // Everything correct
      await createAccountChecked(keyPair, token, amount, owner, depositFee);
    });

    it("Fee recipient account", async () => {
      const realmID = await exchangeTestUtil.createExchange(exchangeTestUtil.testContext.stateOwners[0], false);
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const walletA = await exchangeTestUtil.createWallet(realmID, exchangeTestUtil.testContext.wallets[0]);
      const walletB = await exchangeTestUtil.createWallet(realmID, exchangeTestUtil.testContext.wallets[1]);
      const walletC = await exchangeTestUtil.createWallet(realmID, walletA.owner);
      let amount = new BN(0);
      const token = exchangeTestUtil.getTokenAddress("ETH");

      const depositFee = await exchange.getDepositFee(realmID);

      // Unauthorized msg.sender (not wallet owner)
      await expectThrow(
        exchange.createAccount(realmID, keyPair.publicKeyX, keyPair.publicKeyY,
          token, amount, {from: walletB.owner, value: depositFee}),
        "UNAUTHORIZED_FOR_DUAL_AUTHOR_ACCOUNT",
      );

      // Everything correct
      const accountID = await createAccountChecked(keyPair, token, amount, walletA.owner, depositFee);

      // Try to change the type of the account
      await expectThrow(
        exchange.updateAccount(realmID, accountID, keyPair.publicKeyX, keyPair.publicKeyY,
                                         token, amount, {from: walletA.owner, value: depositFee}),
        "INVALID_WALLET_ID_CHANGE",
      );

      // Try to deposit
      amount = new BN(web3.utils.toWei("3", "ether"));
      await expectThrow(
        exchange.createAccount(realmID, keyPair.publicKeyX, keyPair.publicKeyY,
          token, amount, {from: walletA.owner, value: depositFee}),
        "CANNOT_DEPOSIT_TO_DUAL_AUTHOR_ACCOUNTS",
      );
    });

    it("Onchain withdrawal request", async () => {
      const realmID = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const ownerB = exchangeTestUtil.testContext.orderOwners[1];
      const wallet = exchangeTestUtil.wallets[realmID][0];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const toWithdraw = new BN(web3.utils.toWei("4", "ether"));
      const token = exchangeTestUtil.getTokenAddress("LRC");
      const one = new BN(1);

      const depositInfo = await exchangeTestUtil.deposit(realmID, ownerA,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         token, balance);
      const accountID = depositInfo.accountID;
      await exchangeTestUtil.commitDeposits(realmID);

      const withdrawalFee = await exchange.getWithdrawalFee(realmID);

      // No ETH sent
      await expectThrow(
        exchange.withdraw(token, toWithdraw, {from: ownerA, value: new BN(0)}),
        "INVALID_VALUE",
      );
      // Not enough ETH sent
      await expectThrow(
        exchange.withdraw(token, toWithdraw, {from: ownerA, value: withdrawalFee.sub(one)}),
        "INVALID_VALUE",
      );

      // Only the account owner can request a withdrawal
      await expectThrow(
        exchange.withdraw(token, toWithdraw, {from: ownerB, value: withdrawalFee}),
        "UNAUTHORIZED",
      );

      // Try to withdraw nothing
      await expectThrow(
        exchange.withdraw(token, new BN(0), {from: ownerB, value: withdrawalFee}),
        "INVALID_VALUE",
      );

      // Do the request
      const witdrawalRequest = await exchangeTestUtil.requestWithdrawalOnchain(
        realmID, accountID, token, toWithdraw, ownerA,
      );

      // Commit the deposit
      await exchangeTestUtil.commitOnchainWithdrawalRequests(realmID);
      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(realmID);

      // Withdraw
      const blockIdx = (await exchange.getBlockHeight(web3.utils.toBN(realmID))).toNumber();
      await withdrawChecked(blockIdx, witdrawalRequest.slotIdx,
                            accountID, token,
                            ownerA, toWithdraw);
    });

    it("Offchain withdrawal request", async () => {
      const realmID = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[realmID][0];
      const balance = new BN(web3.utils.toWei("4", "ether"));
      const toWithdraw = new BN(web3.utils.toWei("5", "ether"));
      const token = "ETH";
      const tokenID = exchangeTestUtil.getTokenIdFromNameOrAddress(token);
      const feeToken = "ETH";
      const fee = new BN(web3.utils.toWei("0.5", "ether"));

      const depositInfo = await exchangeTestUtil.deposit(realmID, owner,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         token, balance);
      const accountID = depositInfo.accountID;
      await exchangeTestUtil.commitDeposits(realmID);

      const witdrawalRequest = await exchangeTestUtil.requestWithdrawalOffchain(
        realmID, accountID, token, toWithdraw,
        feeToken, fee, 0, wallet.walletAccountID,
      );
      await exchangeTestUtil.commitOffchainWithdrawalRequests(realmID);
      await exchangeTestUtil.verifyPendingBlocks(realmID);

      // Withdraw
      const blockIdx = (await exchange.getBlockHeight(web3.utils.toBN(realmID))).toNumber();
      await withdrawChecked(blockIdx, 0,
                            accountID, token,
                            owner, balance.sub(fee));
    });

    it("Withdraw (normal account)", async () => {
      const realmID = 1;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const ownerB = exchangeTestUtil.testContext.orderOwners[1];
      const wallet = exchangeTestUtil.wallets[realmID][0];

      const balanceA = new BN(web3.utils.toWei("7", "ether"));
      const toWithdrawA = new BN(web3.utils.toWei("4", "ether"));
      const tokenA = exchangeTestUtil.getTokenAddress("LRC");

      const balanceB = new BN(web3.utils.toWei("1", "ether"));
      const toWithdrawB = new BN(web3.utils.toWei("3", "ether"));
      const tokenB = exchangeTestUtil.getTokenAddress("ETH");

      const depositInfoA = await exchangeTestUtil.deposit(realmID, ownerA,
                                                          keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                          tokenA, balanceA);
      const depositInfoB = await exchangeTestUtil.deposit(realmID, ownerB,
                                                          keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                          tokenB, balanceB);
      await exchangeTestUtil.commitDeposits(realmID);

      // Do the request
      const witdrawalRequestA = await exchangeTestUtil.requestWithdrawalOnchain(
        realmID, depositInfoA.accountID, tokenA, toWithdrawA, ownerA,
      );
      /*const witdrawalRequestB = await exchangeTestUtil.requestWithdrawalOnchain(
        realmID, depositInfoB.accountID, tokenB, toWithdrawB, ownerB,
      );*/

      // Try to withdraw before the block is committed
      const nextBlockIdx1 = (await exchange.getBlockHeight()).toNumber() + 1;
      /*await expectThrow(
        exchange.withdrawFromApprovedWithdrawal(nextBlockIdx, witdrawalRequestA.slotIdx),
        "INVALID_BLOCKIDX",
      );*/

      // Commit the deposit
      await exchangeTestUtil.commitOnchainWithdrawalRequests(realmID);

      // Try to withdraw before the block is finalized
      await expectThrow(
        exchange.withdrawFromApprovedWithdrawal(nextBlockIdx1, 0),
        "BLOCK_NOT_FINALIZED",
      );

      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(realmID);

      // Withdraw
      await withdrawChecked(nextBlockIdx1, witdrawalRequestA.slotIdx,
                            depositInfoA.accountID, tokenA,
                            ownerA, toWithdrawA);

      const witdrawalRequestB = await exchangeTestUtil.requestWithdrawalOnchain(
        realmID, depositInfoB.accountID, tokenB, toWithdrawB, ownerB,
      );

      // Try to withdraw before the block is committed
      const nextBlockIdx2 = (await exchange.getBlockHeight()).toNumber() + 1;
      /*await expectThrow(
        exchange.withdrawFromApprovedWithdrawal(nextBlockIdx, witdrawalRequestA.slotIdx),
        "INVALID_BLOCKIDX",
      );*/

      // Commit the deposit
      await exchangeTestUtil.commitOnchainWithdrawalRequests(realmID);

      // Try to withdraw before the block is finalized
      await expectThrow(
        exchange.withdrawFromApprovedWithdrawal(nextBlockIdx2, 0),
        "BLOCK_NOT_FINALIZED",
      );

      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(realmID);

      // Withdraw
      await withdrawChecked(nextBlockIdx2, witdrawalRequestB.slotIdx,
                            depositInfoB.accountID, tokenB,
                            ownerB, balanceB);
    });

    it("Withdraw (wallet account)", async () => {
      const realmID = 0;
      const walletA = await exchangeTestUtil.createWallet(realmID, exchangeTestUtil.testContext.wallets[0]);
      const walletB = await exchangeTestUtil.createWallet(realmID, exchangeTestUtil.testContext.wallets[1]);
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "WETH",
            tokenB: "GTO",
            tokenF: "ETH",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("1.5", "ether")),
            walletAccountID: walletA.walletAccountID,
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "WETH",
            tokenF: "LRC",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
            walletAccountID: walletB.walletAccountID,
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      const witdrawalRequestA = await exchangeTestUtil.requestWithdrawalOnchain(
        realmID, ring.orderA.walletAccountID,
        ring.orderA.tokenF, ring.orderA.amountF.mul(new BN(2)),
        ring.orderA.owner,
      );
      const witdrawalRequestB = await exchangeTestUtil.requestWithdrawalOnchain(
        realmID, ring.orderB.walletAccountID,
        ring.orderB.tokenF, ring.orderB.amountF.mul(new BN(2)),
        ring.orderB.owner,
      );
      await exchangeTestUtil.commitOnchainWithdrawalRequests(realmID);
      await exchangeTestUtil.verifyPendingBlocks(realmID);

      const walletFeeA = ring.orderA.amountF.mul(new BN(ring.orderA.walletSplitPercentage)).div(new BN(100));
      const walletFeeB = ring.orderB.amountF.mul(new BN(ring.orderB.walletSplitPercentage)).div(new BN(100));

      // Withdraw
      const blockIdx = (await exchange.getBlockHeight(web3.utils.toBN(realmID))).toNumber();
      await withdrawChecked(blockIdx, witdrawalRequestA.slotIdx,
                            ring.orderA.walletAccountID, ring.orderA.tokenF,
                            walletA.owner, walletFeeA, true);
      await withdrawChecked(blockIdx, witdrawalRequestB.slotIdx,
                            ring.orderB.walletAccountID, ring.orderB.tokenF,
                            walletB.owner, walletFeeB, true);
    });

  });
});
