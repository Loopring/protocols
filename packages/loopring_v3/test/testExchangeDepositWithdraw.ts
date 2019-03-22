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

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    exchange = exchangeTestUtil.exchange;
  });

  describe("DepositWithdraw", function() {
    this.timeout(0);

    it("ERC20: Deposit", async () => {
      const stateID = 0;
      let keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      let wallet = exchangeTestUtil.wallets[stateID][0];
      let amount = new BN(web3.utils.toWei("7", "ether"));
      let token = "LRC";
      let tokenID = exchangeTestUtil.getTokenIdFromNameOrAddress(token);

      // The correct deposit fee expected by the contract
      const depositFee = await exchange.getDepositFee(stateID);

      // No ETH sent
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          wallet.walletID, tokenID, amount, {from: owner, value: new BN(0)}),
        INVALID_VALUE,
      );

      // Not enough ETH
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          wallet.walletID, tokenID, amount, {from: owner, value: depositFee.sub(new BN(1))}),
        INVALID_VALUE,
      );

      // Too much ETH
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          wallet.walletID, tokenID, amount, {from: owner, value: depositFee.add(new BN(1))}),
        INVALID_VALUE,
      );

      // Insufficient funds
      await exchangeTestUtil.setBalanceAndApprove(owner, token, amount.sub(new BN(1)));
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          wallet.walletID, tokenID, amount, {from: owner, value: depositFee}),
        "INSUFFICIENT_FUND",
      );

      // Set the correct balance/approval
      await exchangeTestUtil.setBalanceAndApprove(owner, token, amount);

      // Invalid tokenID
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          wallet.walletID, 123, amount, {from: owner, value: depositFee}),
        "INVALID_TOKENID",
      );

      // Invalid walletID
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          789, tokenID, amount, {from: owner, value: depositFee}),
        "INVALID_WALLETID",
      );

      // Everything correct
      const accountID = await createAccountAndDepositChecked(stateID, keyPair, wallet.walletID, tokenID,
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
      await depositAndUpdateAccountChecked(stateID, accountID, keyPair, wallet.walletID,
        tokenID, amount, owner, depositFee, token);

      // Try to change the type of the account
      const invalidWalletID = wallet.walletID + exchangeTestUtil.MAX_MUM_WALLETS;
      await expectThrow(
        exchange.depositAndUpdateAccount(stateID, accountID, keyPair.publicKeyX, keyPair.publicKeyY, invalidWalletID,
                                         tokenID, amount, {from: owner, value: depositFee}),
        "INVALID_WALLET_ID_CHANGE",
      );

      // Change the walletID
      wallet = exchangeTestUtil.wallets[stateID][1];
      await depositAndUpdateAccountChecked(stateID, accountID, keyPair, wallet.walletID,
        tokenID, amount, owner, depositFee, token);
    });

    it("ETH: Deposit", async () => {
      const stateID = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[stateID][0];
      const amount = new BN(web3.utils.toWei("3", "ether"));
      const tokenID = exchangeTestUtil.getTokenIdFromNameOrAddress("ETH");

      // The correct deposit fee expected by the contract
      const depositFee = await exchange.getDepositFee(stateID);

      // No ETH sent
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          wallet.walletID, tokenID, amount, {from: owner, value: new BN(0)}),
        "INCORRECT_ETH_VALUE",
      );

      // Not enough ETH
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          wallet.walletID, tokenID, amount, {from: owner, value: amount}),
        "INCORRECT_ETH_VALUE",
      );

      // Too much ETH
      await expectThrow(
        exchange.createAccountAndDeposit(stateID, keyPair.publicKeyX, keyPair.publicKeyY,
          wallet.walletID, tokenID, amount, {from: owner, value: amount.add(depositFee).add(new BN(1))}),
        "INCORRECT_ETH_VALUE",
      );

      // Everything correct
      await createAccountAndDepositChecked(stateID, keyPair,
        wallet.walletID, tokenID, amount, owner, depositFee, "ETH");
    });

    it("Dual-author/wallet account (walletID > 0)", async () => {
      const stateID = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const walletA = exchangeTestUtil.wallets[stateID][0];
      const walletB = exchangeTestUtil.wallets[stateID][1];
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
        "INVALID_WALLET_ID_CHANGE",
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
      const stateID = 0;
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

    it("ERC20: deposit + onchain withdrawal", async () => {
      const stateID = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[stateID][0];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const token = "LRC";

      const depositInfo = await exchangeTestUtil.deposit(stateID, owner,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         wallet.walletID, token, balance);
      const accountID = depositInfo.accountID;
      await exchangeTestUtil.commitDeposits(stateID);

      await exchangeTestUtil.requestWithdrawalOnchain(stateID, accountID, token, balance.mul(new BN(2)), owner);
      await exchangeTestUtil.commitOnchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyPendingBlocks(stateID);
      await exchangeTestUtil.submitPendingWithdrawals();
    });

    it("ERC20: deposit + offchain withdrawal", async () => {
      const stateID = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[stateID][0];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const token = "LRC";
      const feeToken = "LRC";
      const fee = new BN(web3.utils.toWei("1", "ether"));

      const depositInfo = await exchangeTestUtil.deposit(stateID, owner,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         wallet.walletID, token, balance);
      const accountID = depositInfo.accountID;
      await exchangeTestUtil.commitDeposits(stateID);

      await exchangeTestUtil.requestWithdrawalOffchain(stateID, accountID, token, balance.mul(new BN(2)),
                                                       feeToken, fee, 0, wallet.walletAccountID);
      await exchangeTestUtil.commitOffchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyPendingBlocks(stateID);
      await exchangeTestUtil.submitPendingWithdrawals();
    });

    it("ETH: deposit + onchain withdrawal", async () => {
      const stateID = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[stateID][0];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const token = zeroAddress;

      const depositInfo = await exchangeTestUtil.deposit(stateID, owner,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         wallet.walletID, token, balance);
      const accountID = depositInfo.accountID;
      await exchangeTestUtil.commitDeposits(stateID);

      await exchangeTestUtil.requestWithdrawalOnchain(stateID, accountID, token, balance.mul(new BN(2)), owner);
      await exchangeTestUtil.commitOnchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyPendingBlocks(stateID);
      await exchangeTestUtil.submitPendingWithdrawals();
    });

    it("ETH: deposit + offchain withdrawal", async () => {
      const stateID = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[stateID][0];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const token = zeroAddress;
      const feeToken = zeroAddress;
      const fee = new BN(web3.utils.toWei("1", "ether"));

      const depositInfo = await exchangeTestUtil.deposit(stateID, owner,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         wallet.walletID, token, balance);
      const accountID = depositInfo.accountID;
      await exchangeTestUtil.commitDeposits(stateID);

      await exchangeTestUtil.requestWithdrawalOffchain(stateID, accountID, token, balance.mul(new BN(2)),
                                                       feeToken, fee, 0, wallet.walletAccountID);
      await exchangeTestUtil.commitOffchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyPendingBlocks(stateID);
      await exchangeTestUtil.submitPendingWithdrawals();
    });

    it("Onchain withdrawal", async () => {
      const stateID = 0;
      const ring: RingInfo = {
        orderA:
          {
            stateID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            stateID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      await exchangeTestUtil.requestWithdrawalOnchain(stateID, ring.orderA.accountID,
                                                      "GTO", ring.orderA.amountB.mul(new BN(2)),
                                                      ring.orderA.owner);
      await exchangeTestUtil.requestWithdrawalOnchain(stateID, ring.orderB.accountID,
                                                      "WETH", ring.orderB.amountB.mul(new BN(2)),
                                                      ring.orderB.owner);
      await exchangeTestUtil.commitOnchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyPendingBlocks(stateID);
      await exchangeTestUtil.submitPendingWithdrawals(exchangeTestUtil.getAddressBook(ring));

      // await exchangeTestUtil.exchange.withdrawBlockFee(stateID, 4);
    });

    it("Offchain withdrawal", async () => {
      const stateID = 0;
      const ring: RingInfo = {
        orderA:
          {
            stateID,
            tokenS: "ETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            stateID,
            tokenS: "GTO",
            tokenB: "ETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
      };
      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      exchangeTestUtil.requestWithdrawalOffchain(stateID, ring.orderA.accountID,
                                                 "GTO", ring.orderA.amountB.mul(new BN(2)),
                                                 "GTO", new BN(web3.utils.toWei("1", "ether")), 50,
                                                 ring.orderA.dualAuthAccountID);
      exchangeTestUtil.requestWithdrawalOffchain(stateID, ring.orderB.accountID,
                                                 "ETH", ring.orderB.amountB.mul(new BN(2)),
                                                 "ETH", new BN(web3.utils.toWei("1", "ether")), 50,
                                                 ring.orderB.dualAuthAccountID);
      await exchangeTestUtil.commitOffchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyPendingBlocks(stateID);
      await exchangeTestUtil.submitPendingWithdrawals(exchangeTestUtil.getAddressBook(ring));
    });

    it("Offchain wallet fee withdrawal (with burned fees)", async () => {
      const stateID = 0;
      const ring: RingInfo = {
        orderA:
          {
            stateID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            stateID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      exchangeTestUtil.requestWithdrawalOffchain(stateID, ring.orderA.dualAuthAccountID,
                                                 "LRC", ring.orderA.amountF.mul(new BN(2)),
                                                 "LRC", new BN(web3.utils.toWei("1", "ether")), 20,
                                                 ring.orderA.dualAuthAccountID);
      exchangeTestUtil.requestWithdrawalOffchain(stateID, ring.orderB.dualAuthAccountID,
                                                 "LRC", ring.orderB.amountF.mul(new BN(2)),
                                                 "LRC", new BN(web3.utils.toWei("1", "ether")), 20,
                                                 ring.orderB.dualAuthAccountID);
      await exchangeTestUtil.commitOffchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyPendingBlocks(stateID);
      await exchangeTestUtil.submitPendingWithdrawals(exchangeTestUtil.getAddressBook(ring));
    });

    it("Onchain wallet fee withdrawal (with burned fees)", async () => {
      const stateID = 0;
      const ring: RingInfo = {
        orderA:
          {
            stateID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            stateID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      await exchangeTestUtil.requestWithdrawalOnchain(stateID, ring.orderA.dualAuthAccountID,
                                                      "LRC", ring.orderA.amountF.mul(new BN(2)),
                                                      ring.orderA.owner);
      await exchangeTestUtil.requestWithdrawalOnchain(stateID, ring.orderB.dualAuthAccountID,
                                                      "LRC", ring.orderB.amountF.mul(new BN(2)),
                                                      ring.orderB.owner);
      await exchangeTestUtil.commitOnchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyPendingBlocks(stateID);
      await exchangeTestUtil.submitPendingWithdrawals(exchangeTestUtil.getAddressBook(ring));
    });

  });
});
