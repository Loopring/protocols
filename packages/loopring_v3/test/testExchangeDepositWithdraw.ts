import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;

  const zeroAddress = "0x" + "00".repeat(20);

  const createAccountAndDepositChecked = async (stateId: number, keyPair: any, walletId: number, tokenId: number,
                                                amount: BN, owner: string, depositFee: BN,
                                                token: string) => {
    const balanceOwnerBefore = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const numAvailableSlotsBefore = (await exchange.getNumAvailableDepositSlots(stateId)).toNumber();

    const ethValue = (token === "ETH") ? amount.add(depositFee) : depositFee;
    await exchange.createAccountAndDeposit(stateId, keyPair.publicKeyX, keyPair.publicKeyY,
      walletId, tokenId, amount, {from: owner, value: ethValue, gasPrice: 0});

    const balanceOwnerAfter = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const numAvailableSlotsAfter = (await exchange.getNumAvailableDepositSlots(stateId)).toNumber();

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
      return [eventObj.args.accountId, eventObj.args.depositBlockIdx, eventObj.args.slotIdx];
    });
    assert.equal(items.length, 1, "A single Deposit event should have been emitted");
    const accountId = items[0][0].toNumber();
    return accountId;
  };

  const depositChecked = async (stateId: number, accountId: number, tokenId: number, amount: BN,
                                owner: string, depositFee: BN,
                                token: string) => {
    const balanceOwnerBefore = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const numAvailableSlotsBefore = (await exchange.getNumAvailableDepositSlots(stateId)).toNumber();

    const ethValue = (token === "ETH") ? amount.add(depositFee) : depositFee;
    await exchange.deposit(stateId, accountId, tokenId, amount, {from: owner, value: ethValue, gasPrice: 0});

    const balanceOwnerAfter = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const numAvailableSlotsAfter = (await exchange.getNumAvailableDepositSlots(stateId)).toNumber();

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
      return [eventObj.args.accountId, eventObj.args.depositBlockIdx, eventObj.args.slotIdx];
    });
    assert.equal(items.length, 1, "A single Deposit event should have been emitted");
    assert.equal(items[0][0].toNumber(), accountId, "Deposit accountId should match");
  };

  const depositAndUpdateAccountChecked = async (stateId: number, accountId: number, keyPair: any, walletId: number,
                                                tokenId: number, amount: BN,
                                                owner: string, depositFee: BN,
                                                token: string) => {
    const balanceOwnerBefore = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const numAvailableSlotsBefore = (await exchange.getNumAvailableDepositSlots(stateId)).toNumber();

    const ethValue = (token === "ETH") ? amount.add(depositFee) : depositFee;
    await exchange.depositAndUpdateAccount(stateId, accountId, keyPair.publicKeyX, keyPair.publicKeyY, walletId,
                                           tokenId, amount, {from: owner, value: ethValue, gasPrice: 0});

    const balanceOwnerAfter = await exchangeTestUtil.getOnchainBalance(owner, token);
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const numAvailableSlotsAfter = (await exchange.getNumAvailableDepositSlots(stateId)).toNumber();

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
      return [eventObj.args.accountId, eventObj.args.depositBlockIdx, eventObj.args.slotIdx];
    });
    assert.equal(items.length, 1, "A single Deposit event should have been emitted");
    assert.equal(items[0][0].toNumber(), accountId, "Deposit accountId should match");
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    exchange = exchangeTestUtil.exchange;
  });

  describe("DepositWithdraw", function() {
    this.timeout(0);

    it("ERC20: Deposit", async () => {
      const stateId = 0;
      let keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      let wallet = exchangeTestUtil.wallets[stateId][0];
      let amount = new BN(web3.utils.toWei("7", "ether"));
      let token = "LRC";
      let tokenId = exchangeTestUtil.getTokenIdFromNameOrAddress(token);

      // The correct deposit fee expected by the contract
      const depositFee = await exchange.getDepositFee(stateId);

      // No ETH sent
      await expectThrow(
        exchange.createAccountAndDeposit(stateId, keyPair.publicKeyX, keyPair.publicKeyY,
          wallet.walletId, tokenId, amount, {from: owner, value: new BN(0)}),
        "INCORRECT_ETH_FEE",
      );

      // Not enough ETH
      await expectThrow(
        exchange.createAccountAndDeposit(stateId, keyPair.publicKeyX, keyPair.publicKeyY,
          wallet.walletId, tokenId, amount, {from: owner, value: depositFee.sub(new BN(1))}),
        "INCORRECT_ETH_FEE",
      );

      // Too much ETH
      await expectThrow(
        exchange.createAccountAndDeposit(stateId, keyPair.publicKeyX, keyPair.publicKeyY,
          wallet.walletId, tokenId, amount, {from: owner, value: depositFee.add(new BN(1))}),
        "INCORRECT_ETH_FEE",
      );

      // Insufficient funds
      await exchangeTestUtil.setBalanceAndApprove(owner, token, amount.sub(new BN(1)));
      await expectThrow(
        exchange.createAccountAndDeposit(stateId, keyPair.publicKeyX, keyPair.publicKeyY,
          wallet.walletId, tokenId, amount, {from: owner, value: depositFee}),
        "INSUFFICIENT_FUNDS",
      );

      // Set the correct balance/approval
      await exchangeTestUtil.setBalanceAndApprove(owner, token, amount);

      // Invalid tokenId
      await expectThrow(
        exchange.createAccountAndDeposit(stateId, keyPair.publicKeyX, keyPair.publicKeyY,
          wallet.walletId, 123, amount, {from: owner, value: depositFee}),
        "INVALID_TOKENID",
      );

      // Invalid walletId
      await expectThrow(
        exchange.createAccountAndDeposit(stateId, keyPair.publicKeyX, keyPair.publicKeyY,
          789, tokenId, amount, {from: owner, value: depositFee}),
        "INVALID_WALLETID",
      );

      // Everything correct
      const accountId = await createAccountAndDepositChecked(stateId, keyPair, wallet.walletId, tokenId,
                                                             amount, owner, depositFee, token);

      // Do deposit to the same account with another token
      token = "WETH";
      tokenId = exchangeTestUtil.getTokenIdFromNameOrAddress(token);
      amount = new BN(web3.utils.toWei("4.5", "ether"));

      // New balance/approval for another deposit
      await exchangeTestUtil.setBalanceAndApprove(owner, token, amount);

      // Invalid msg.sender
      const wrongOwner = exchangeTestUtil.testContext.deployer;
      await expectThrow(
        exchange.deposit(stateId, accountId, tokenId, amount, {from: wrongOwner, value: depositFee}),
        "UNAUTHORIZED",
      );

      // Invalid accountId
      await expectThrow(
        exchange.deposit(stateId, 258, tokenId, amount, {from: owner, value: depositFee}),
        "INVALID_ACCOUNTID",
      );

      // Everything correct
      await depositChecked(stateId, accountId, tokenId, amount, owner, depositFee, token);

      // Change some account info
      amount = new BN(0);
      keyPair = exchangeTestUtil.getKeyPairEDDSA();

      // Change the publicKey
      await depositAndUpdateAccountChecked(stateId, accountId, keyPair, wallet.walletId,
        tokenId, amount, owner, depositFee, token);

      // Try to change the type of the account
      const invalidWalletID = wallet.walletId + exchangeTestUtil.MAX_MUM_WALLETS;
      await expectThrow(
        exchange.depositAndUpdateAccount(stateId, accountId, keyPair.publicKeyX, keyPair.publicKeyY, invalidWalletID,
                                         tokenId, amount, {from: owner, value: depositFee}),
        "INVALID_WALLETID_CHANGE",
      );

      // Change the walletId
      wallet = exchangeTestUtil.wallets[stateId][1];
      await depositAndUpdateAccountChecked(stateId, accountId, keyPair, wallet.walletId,
        tokenId, amount, owner, depositFee, token);
    });

    it("ETH: Deposit", async () => {
      const stateId = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[stateId][0];
      const amount = new BN(web3.utils.toWei("3", "ether"));
      const tokenId = exchangeTestUtil.getTokenIdFromNameOrAddress("ETH");

      // The correct deposit fee expected by the contract
      const depositFee = await exchange.getDepositFee(stateId);

      // No ETH sent
      await expectThrow(
        exchange.createAccountAndDeposit(stateId, keyPair.publicKeyX, keyPair.publicKeyY,
          wallet.walletId, tokenId, amount, {from: owner, value: new BN(0)}),
        "INCORRECT_ETH_VALUE",
      );

      // Not enough ETH
      await expectThrow(
        exchange.createAccountAndDeposit(stateId, keyPair.publicKeyX, keyPair.publicKeyY,
          wallet.walletId, tokenId, amount, {from: owner, value: amount}),
        "INCORRECT_ETH_VALUE",
      );

      // Too much ETH
      await expectThrow(
        exchange.createAccountAndDeposit(stateId, keyPair.publicKeyX, keyPair.publicKeyY,
          wallet.walletId, tokenId, amount, {from: owner, value: amount.add(depositFee).add(new BN(1))}),
        "INCORRECT_ETH_VALUE",
      );

      // Everything correct
      await createAccountAndDepositChecked(stateId, keyPair,
        wallet.walletId, tokenId, amount, owner, depositFee, "ETH");
    });

    it("Dual-author/wallet account (walletId > 0)", async () => {
      const stateId = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const walletA = exchangeTestUtil.wallets[stateId][0];
      const walletB = exchangeTestUtil.wallets[stateId][1];
      const walletC = await exchangeTestUtil.createWallet(stateId, walletA.owner);
      let amount = new BN(0);
      const token = "ETH";
      const tokenId = exchangeTestUtil.getTokenIdFromNameOrAddress(token);

      const depositFee = await exchange.getDepositFee(stateId);

      // The dual-author walletId
      let walletId = walletA.walletId + exchangeTestUtil.MAX_MUM_WALLETS;

      // Unauthorized msg.sender (not wallet owner)
      await expectThrow(
        exchange.createAccountAndDeposit(stateId, keyPair.publicKeyX, keyPair.publicKeyY,
          walletId, tokenId, amount, {from: walletB.owner, value: depositFee}),
        "UNAUTHORIZED_FOR_DUAL_AUTHOR_ACCOUNT",
      );

      // Everything correct
      const accountId = await createAccountAndDepositChecked(stateId, keyPair, walletId, tokenId,
                                                             amount, walletA.owner, depositFee, token);

      // Try to change the type of the account
      let invalidWalletID = walletA.walletId;
      await expectThrow(
        exchange.depositAndUpdateAccount(stateId, accountId, keyPair.publicKeyX, keyPair.publicKeyY, invalidWalletID,
                                         tokenId, amount, {from: walletA.owner, value: depositFee}),
        "INVALID_WALLETID_CHANGE",
      );

      // Try to change to a wallet not owned by the current wallet owner
      invalidWalletID = walletB.walletId + exchangeTestUtil.MAX_MUM_WALLETS;
      await expectThrow(
        exchange.depositAndUpdateAccount(stateId, accountId, keyPair.publicKeyX, keyPair.publicKeyY, invalidWalletID,
                                         tokenId, amount, {from: walletA.owner, value: depositFee}),
        "UNAUTHORIZED_FOR_DUAL_AUTHOR_ACCOUNT",
      );

      // Change the walletId to a wallet also owned by the previous wallet owner
      walletId = walletC.walletId + exchangeTestUtil.MAX_MUM_WALLETS;
      await depositAndUpdateAccountChecked(stateId, accountId, keyPair, walletId,
        tokenId, amount, walletA.owner, depositFee, token);

      // Try to deposit
      amount = new BN(web3.utils.toWei("3", "ether"));
      await expectThrow(
        exchange.createAccountAndDeposit(stateId, keyPair.publicKeyX, keyPair.publicKeyY,
          walletId, tokenId, amount, {from: walletA.owner, value: depositFee}),
        "CANNOT_DEPOSIT_TO_DUAL_AUTHOR_ACCOUNTS",
      );
    });

    it("Dual-author/wallet account (walletId == 0)", async () => {
      const stateId = 0;
      const keyPairA = exchangeTestUtil.getKeyPairEDDSA();
      const keyPairB = exchangeTestUtil.getKeyPairEDDSA();
      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const ownerB = exchangeTestUtil.testContext.orderOwners[1];
      let amount = new BN(0);
      const token = "ETH";
      const tokenId = exchangeTestUtil.getTokenIdFromNameOrAddress(token);

      const depositFee = await exchange.getDepositFee(stateId);

      // The dual-author walletId for walletId 0
      const walletId = exchangeTestUtil.MAX_MUM_WALLETS;

      // Anyone can create these accounts
      const accountIdA = await createAccountAndDepositChecked(stateId, keyPairA, walletId, tokenId,
                                                              amount, ownerA, depositFee, token);

      const accountIdB = await createAccountAndDepositChecked(stateId, keyPairB, walletId, tokenId,
                                                              amount, ownerB, depositFee, token);

      // Try to deposit
      amount = new BN(web3.utils.toWei("3", "ether"));
      await expectThrow(
        exchange.deposit(stateId, accountIdA, tokenId, amount, {from: ownerA, value: depositFee}),
        "CANNOT_DEPOSIT_TO_DUAL_AUTHOR_ACCOUNTS",
      );
    });

    it("ERC20: deposit + onchain withdrawal", async () => {
      const stateId = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[stateId][0];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const token = "LRC";

      const depositInfo = await exchangeTestUtil.deposit(stateId, owner,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         wallet.walletId, token, balance);
      const accountId = depositInfo.accountId;
      await exchangeTestUtil.commitDeposits(stateId);

      await exchangeTestUtil.requestWithdrawalOnchain(stateId, accountId, token, balance.mul(new BN(2)), owner);
      await exchangeTestUtil.commitOnchainWithdrawalRequests(stateId);
      await exchangeTestUtil.verifyPendingBlocks(stateId);
      await exchangeTestUtil.submitPendingWithdrawals();
    });

    it("ERC20: deposit + offchain withdrawal", async () => {
      const stateId = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[stateId][0];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const token = "LRC";
      const feeToken = "LRC";
      const fee = new BN(web3.utils.toWei("1", "ether"));

      const depositInfo = await exchangeTestUtil.deposit(stateId, owner,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         wallet.walletId, token, balance);
      const accountId = depositInfo.accountId;
      await exchangeTestUtil.commitDeposits(stateId);

      await exchangeTestUtil.requestWithdrawalOffchain(stateId, accountId, token, balance.mul(new BN(2)),
                                                       feeToken, fee, 0, wallet.walletAccountId);
      await exchangeTestUtil.commitOffchainWithdrawalRequests(stateId);
      await exchangeTestUtil.verifyPendingBlocks(stateId);
      await exchangeTestUtil.submitPendingWithdrawals();
    });

    it("ETH: deposit + onchain withdrawal", async () => {
      const stateId = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[stateId][0];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const token = zeroAddress;

      const depositInfo = await exchangeTestUtil.deposit(stateId, owner,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         wallet.walletId, token, balance);
      const accountId = depositInfo.accountId;
      await exchangeTestUtil.commitDeposits(stateId);

      await exchangeTestUtil.requestWithdrawalOnchain(stateId, accountId, token, balance.mul(new BN(2)), owner);
      await exchangeTestUtil.commitOnchainWithdrawalRequests(stateId);
      await exchangeTestUtil.verifyPendingBlocks(stateId);
      await exchangeTestUtil.submitPendingWithdrawals();
    });

    it("ETH: deposit + offchain withdrawal", async () => {
      const stateId = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[stateId][0];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const token = zeroAddress;
      const feeToken = zeroAddress;
      const fee = new BN(web3.utils.toWei("1", "ether"));

      const depositInfo = await exchangeTestUtil.deposit(stateId, owner,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         wallet.walletId, token, balance);
      const accountId = depositInfo.accountId;
      await exchangeTestUtil.commitDeposits(stateId);

      await exchangeTestUtil.requestWithdrawalOffchain(stateId, accountId, token, balance.mul(new BN(2)),
                                                       feeToken, fee, 0, wallet.walletAccountId);
      await exchangeTestUtil.commitOffchainWithdrawalRequests(stateId);
      await exchangeTestUtil.verifyPendingBlocks(stateId);
      await exchangeTestUtil.submitPendingWithdrawals();
    });

    it("Onchain withdrawal", async () => {
      const stateId = 0;
      const ring: RingInfo = {
        orderA:
          {
            stateId,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            stateId,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateId, ring);

      await exchangeTestUtil.commitDeposits(stateId);
      await exchangeTestUtil.commitRings(stateId);

      await exchangeTestUtil.requestWithdrawalOnchain(stateId, ring.orderA.accountId,
                                                      "GTO", ring.orderA.amountB.mul(new BN(2)),
                                                      ring.orderA.owner);
      await exchangeTestUtil.requestWithdrawalOnchain(stateId, ring.orderB.accountId,
                                                      "WETH", ring.orderB.amountB.mul(new BN(2)),
                                                      ring.orderB.owner);
      await exchangeTestUtil.commitOnchainWithdrawalRequests(stateId);
      await exchangeTestUtil.verifyPendingBlocks(stateId);
      await exchangeTestUtil.submitPendingWithdrawals(exchangeTestUtil.getAddressBook(ring));

      // await exchangeTestUtil.exchange.withdrawBlockFee(stateId, 4);
    });

    it("Offchain withdrawal", async () => {
      const stateId = 0;
      const ring: RingInfo = {
        orderA:
          {
            stateId,
            tokenS: "ETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            stateId,
            tokenS: "GTO",
            tokenB: "ETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
      };
      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateId, ring);

      await exchangeTestUtil.commitDeposits(stateId);
      await exchangeTestUtil.commitRings(stateId);

      exchangeTestUtil.requestWithdrawalOffchain(stateId, ring.orderA.accountId,
                                                 "GTO", ring.orderA.amountB.mul(new BN(2)),
                                                 "GTO", new BN(web3.utils.toWei("1", "ether")), 50,
                                                 ring.orderA.dualAuthAccountId);
      exchangeTestUtil.requestWithdrawalOffchain(stateId, ring.orderB.accountId,
                                                 "ETH", ring.orderB.amountB.mul(new BN(2)),
                                                 "ETH", new BN(web3.utils.toWei("1", "ether")), 50,
                                                 ring.orderB.dualAuthAccountId);
      await exchangeTestUtil.commitOffchainWithdrawalRequests(stateId);
      await exchangeTestUtil.verifyPendingBlocks(stateId);
      await exchangeTestUtil.submitPendingWithdrawals(exchangeTestUtil.getAddressBook(ring));
    });

    it("Offchain wallet fee withdrawal (with burned fees)", async () => {
      const stateId = 0;
      const ring: RingInfo = {
        orderA:
          {
            stateId,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            stateId,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateId, ring);

      await exchangeTestUtil.commitDeposits(stateId);
      await exchangeTestUtil.commitRings(stateId);

      exchangeTestUtil.requestWithdrawalOffchain(stateId, ring.orderA.dualAuthAccountId,
                                                 "LRC", ring.orderA.amountF.mul(new BN(2)),
                                                 "LRC", new BN(web3.utils.toWei("1", "ether")), 20,
                                                 ring.orderA.dualAuthAccountId);
      exchangeTestUtil.requestWithdrawalOffchain(stateId, ring.orderB.dualAuthAccountId,
                                                 "LRC", ring.orderB.amountF.mul(new BN(2)),
                                                 "LRC", new BN(web3.utils.toWei("1", "ether")), 20,
                                                 ring.orderB.dualAuthAccountId);
      await exchangeTestUtil.commitOffchainWithdrawalRequests(stateId);
      await exchangeTestUtil.verifyPendingBlocks(stateId);
      await exchangeTestUtil.submitPendingWithdrawals(exchangeTestUtil.getAddressBook(ring));
    });

    it("Onchain wallet fee withdrawal (with burned fees)", async () => {
      const stateId = 0;
      const ring: RingInfo = {
        orderA:
          {
            stateId,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            stateId,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateId, ring);

      await exchangeTestUtil.commitDeposits(stateId);
      await exchangeTestUtil.commitRings(stateId);

      await exchangeTestUtil.requestWithdrawalOnchain(stateId, ring.orderA.dualAuthAccountId,
                                                      "LRC", ring.orderA.amountF.mul(new BN(2)),
                                                      ring.orderA.owner);
      await exchangeTestUtil.requestWithdrawalOnchain(stateId, ring.orderB.dualAuthAccountId,
                                                      "LRC", ring.orderB.amountF.mul(new BN(2)),
                                                      ring.orderB.owner);
      await exchangeTestUtil.commitOnchainWithdrawalRequests(stateId);
      await exchangeTestUtil.verifyPendingBlocks(stateId);
      await exchangeTestUtil.submitPendingWithdrawals(exchangeTestUtil.getAddressBook(ring));
    });

  });
});
