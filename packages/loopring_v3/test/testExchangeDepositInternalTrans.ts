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

    it("Internal transfer (normal account)", async () => {
      await createExchange();

      const keyPairA = exchangeTestUtil.getKeyPairEDDSA();
      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const ownerB = exchangeTestUtil.testContext.orderOwners[1];

      const balanceA = new BN(web3.utils.toWei("7", "ether"));
      const token = exchangeTestUtil.getTokenAddress("ETH");
      const transToB = new BN(web3.utils.toWei("4", "ether"));
      const feeToken = exchangeTestUtil.getTokenAddress("ETH");
      const feeToO = new BN(web3.utils.toWei("1", "ether"));

      // const balanceB = new BN(web3.utils.toWei("1", "ether"));
      // const tokenB = exchangeTestUtil.getTokenAddress("ETH");

      const depositInfoA = await exchangeTestUtil.deposit(
        exchangeID,
        ownerA,
        keyPairA.secretKey,
        keyPairA.publicKeyX,
        keyPairA.publicKeyY,
        token,
        balanceA
      );
      // init B by 0
      const keyPairB = exchangeTestUtil.getKeyPairEDDSA();
      const depositInfoB = await exchangeTestUtil.deposit(
        exchangeID,
        ownerB,
        keyPairB.secretKey,
        keyPairB.publicKeyX,
        keyPairB.publicKeyY,
        token,
        new BN(0)
      );

      await exchangeTestUtil.commitDeposits(exchangeID);

      // Do the request
      await exchangeTestUtil.requestInternalTransfer(
        exchangeID,
        depositInfoA.accountID,
        depositInfoB.accountID,
        token,
        transToB,
        feeToken,
        feeToO,
        0
      );

      // Commit the deposit
      await exchangeTestUtil.commitInternalTransferRequests(exchangeID);

      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);
    });

    /*
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
    */
  });
});
