import BN = require("bn.js");
import abi = require("ethereumjs-abi");
import { expectThrow } from "protocol2-js";
import { Artifacts } from "../util/Artifacts";
import { FeePayments } from "./feePayments";

const {
  FeeHolder,
  TradeDelegate,
  DummyExchange,
  DummyBurnManager,
  DummyToken,
  LRCToken,
  GTOToken,
  RDNToken,
  REPToken,
  TESTToken,
} = new Artifacts(artifacts);

contract("FeeHolder", (accounts: string[]) => {
  const deployer = accounts[0];
  const mockedExchangeAddress = accounts[1];
  const user1 = accounts[2];
  const user2 = accounts[3];
  const user3 = accounts[4];
  const user4 = accounts[5];

  let tradeDelegate: any;
  let feeHolder: any;
  let dummyExchange: any;
  let dummyBurnManager: any;
  let token1: string;
  let token2: string;
  let token3: string;
  let token4: string;

  let TestToken: any;
  let testToken: string;

  const authorizeAddressChecked = async (address: string, transcationOrigin: string) => {
    await tradeDelegate.authorizeAddress(address, {from: transcationOrigin});
    await assertAuthorized(address);
  };

  const assertAuthorized = async (address: string) => {
    const isAuthorizedInDelegate = await tradeDelegate.isAddressAuthorized(address);
    assert.equal(isAuthorizedInDelegate, true, "exchange not authorized.");
  };

  const batchAddFeeBalancesChecked = async (feePayments: FeePayments) => {
    // Calculate expected fee balances
    const feeBalances: { [id: string]: any; } = {};
    for (const feePayment of feePayments.payments) {
      if (!feeBalances[feePayment.owner]) {
        feeBalances[feePayment.owner] = {};
      }
      if (!feeBalances[feePayment.owner][feePayment.token]) {
        feeBalances[feePayment.owner][feePayment.token] =
         (await feeHolder.feeBalances(feePayment.token, feePayment.owner)).toNumber();
      }
      feeBalances[feePayment.owner][feePayment.token] += feePayment.amount;
    }
    // Update fee balances
    const batch = feePayments.getData();
    await dummyExchange.batchAddFeeBalances(batch);
    // Check if we get the expected results
    for (const feePayment of feePayments.payments) {
      const balance = (await feeHolder.feeBalances(feePayment.token, feePayment.owner)).toNumber();
      const expectedBalance = feeBalances[feePayment.owner][feePayment.token];
      assert.equal(balance, expectedBalance, "Fee balance does not match expected value");
    }
  };

  const withdrawTokenChecked = async (owner: string, token: string, amount: number) => {
    const dummyToken = DummyToken.at(token);

    const balanceFeeHolderBefore = (await dummyToken.balanceOf(feeHolder.address)).toNumber();
    const balanceOwnerBefore = (await dummyToken.balanceOf(owner)).toNumber();
    const feeBalanceBefore = (await feeHolder.feeBalances(token, owner)).toNumber();

    const success = await feeHolder.withdrawToken(token, amount, {from: owner});
    assert(success, "Withdrawal needs to succeed");

    const balanceFeeHolderAfter = (await dummyToken.balanceOf(feeHolder.address)).toNumber();
    const balanceOwnerAfter = (await dummyToken.balanceOf(owner)).toNumber();
    const feeBalanceAfter = (await feeHolder.feeBalances(token, owner)).toNumber();
    assert.equal(balanceFeeHolderAfter, balanceFeeHolderBefore - amount, "Contract balance should be reduced.");
    assert.equal(balanceOwnerAfter, balanceOwnerBefore + amount, "Owner balance should have increased.");
    assert.equal(feeBalanceAfter, feeBalanceBefore - amount, "Withdrawal amount not correctly updated.");
  };

  const withdrawBurnedChecked = async (from: any, token: string, amount: number) => {
    const dummyToken = DummyToken.at(token);

    const balanceFeeHolderBefore = (await dummyToken.balanceOf(feeHolder.address)).toNumber();
    const balanceFromBefore = (await dummyToken.balanceOf(from.address)).toNumber();
    const burnBalanceBefore = (await feeHolder.feeBalances(token, feeHolder.address)).toNumber();

    const success = await from.withdrawBurned(token, amount);
    assert(success, "Withdrawal needs to succeed");

    const balanceFeeHolderAfter = (await dummyToken.balanceOf(feeHolder.address)).toNumber();
    const balanceOwnerAfter = (await dummyToken.balanceOf(from.address)).toNumber();
    const burnBalanceAfter = (await feeHolder.feeBalances(token, feeHolder.address)).toNumber();
    assert.equal(balanceFeeHolderAfter, balanceFeeHolderBefore - amount, "Contract balance should be reduced.");
    assert.equal(balanceOwnerAfter, balanceFromBefore + amount, "From balance should have increased.");
    assert.equal(burnBalanceAfter, burnBalanceBefore - amount, "Withdrawal amount not correctly updated.");
  };

  before(async () => {
    tradeDelegate = await TradeDelegate.deployed();

    token1 = LRCToken.address;
    token2 = REPToken.address;
    token3 = RDNToken.address;
    token4 = GTOToken.address;
  });

  beforeEach(async () => {
    // Fresh FeeHolder for each test
    feeHolder = await FeeHolder.new(tradeDelegate.address);
    dummyExchange = await DummyExchange.new(tradeDelegate.address, "0x0", feeHolder.address, "0x0");
    dummyBurnManager = await DummyBurnManager.new(feeHolder.address);
    await authorizeAddressChecked(dummyExchange.address, deployer);
    await authorizeAddressChecked(dummyBurnManager.address, deployer);

    TestToken = await TESTToken.new();
    testToken = TestToken.address;
  });

  describe("authorized address", () => {
    it("should be able to add fee balances in batch", async () => {
      {
        const feePayments = new FeePayments();
        feePayments.add(user1, token1, 1.23 * 1e18);
        feePayments.add(user2, token2, 3.21 * 1e19);
        feePayments.add(user1, token2, 2.71 * 1e19);
        feePayments.add(user3, token3, 4.91 * 1e19);
        feePayments.add(user1, token1, 1.48 * 1e19);
        feePayments.add(user3, token1, 2.61 * 1e19);
        await batchAddFeeBalancesChecked(feePayments);
      }
      {
        const feePayments = new FeePayments();
        feePayments.add(user3, token1, 1.23 * 1e18);
        feePayments.add(user1, token3, 3.21 * 1e19);
        feePayments.add(user2, token2, 2.71 * 1e19);
        feePayments.add(user3, token3, 2.61 * 1e19);
        await batchAddFeeBalancesChecked(feePayments);
      }
    });

    it("should be able to withdraw tokens to burn", async () => {
      const dummyToken1 = await DummyToken.at(token1);
      const amount = 2.4e18;
      // Make sure the contract has enough funds
      await dummyToken1.setBalance(feeHolder.address, amount);

      const feePayments = new FeePayments();
      feePayments.add(feeHolder.address, token1, amount);
      await batchAddFeeBalancesChecked(feePayments);

      // Withdraw the tokens that need to be burned
      await withdrawBurnedChecked(dummyBurnManager, token1, amount);
    });

    it("should not be able to send fee payments in an incorrect format", async () => {
      const feePayments = new FeePayments();
      feePayments.add(user1, token1, 1.23 * 1e18);
      feePayments.add(user2, token2, 3.21 * 1e19);
      const batch = feePayments.getData();
      batch.pop();
      await expectThrow(dummyExchange.batchAddFeeBalances(batch), "INVALID_SIZE");
    });
  });

  describe("anyone", () => {
    it("should be able to withdraw tokens of its own", async () => {
      const dummyToken1 = await DummyToken.at(token1);
      const dummyToken2 = await DummyToken.at(token2);
      const amount11 = 1.78e18;
      const amount12 = 2.18e18;
      const amount21 = 4.21e18;
      // Make sure the contract has enough funds
      await dummyToken1.setBalance(feeHolder.address, amount11 + amount12);
      await dummyToken2.setBalance(feeHolder.address, amount21);

      const feePayments = new FeePayments();
      feePayments.add(user1, token1, amount11);
      feePayments.add(user2, token1, amount12);
      feePayments.add(user1, token2, amount21);
      await batchAddFeeBalancesChecked(feePayments);

      await withdrawTokenChecked(user1, token1, amount11);
      await withdrawTokenChecked(user1, token2, amount21);
    });

    it("should be able to withdraw tokens of its own in parts", async () => {
      const dummyToken1 = await DummyToken.at(token1);
      const amount = 1.78e18;
      // Make sure the contract has enough funds
      await dummyToken1.setBalance(feeHolder.address, amount);

      const feePayments = new FeePayments();
      feePayments.add(user1, token1, amount);
      await batchAddFeeBalancesChecked(feePayments);

      await withdrawTokenChecked(user1, token1, amount / 4);
      await withdrawTokenChecked(user1, token1, amount / 2);
      await withdrawTokenChecked(user1, token1, amount / 4);
    });

    it("should not be able to withdraw more tokens than allowed", async () => {
      const dummyToken1 = await DummyToken.at(token1);
      const dummyToken2 = await DummyToken.at(token2);
      const amount = 2.4e18;
      // Make sure the contract has enough funds
      await dummyToken1.setBalance(feeHolder.address, amount);
      await dummyToken2.setBalance(feeHolder.address, amount);

      const feePayments = new FeePayments();
      feePayments.add(user1, token1, amount);
      feePayments.add(user2, token2, amount);
      await batchAddFeeBalancesChecked(feePayments);

      // Withdraw half the available balance
      await withdrawTokenChecked(user1, token1, amount / 2);
      // Amount is greater than what's available
      await expectThrow(withdrawTokenChecked(user1, token1, amount), "INVALID_VALUE");
      // Other user shouldn't be able to withdraw those funds
      await expectThrow(withdrawTokenChecked(user2, token1, amount / 2), "INVALID_VALUE");
      // User shouldn't be able to withdraw tokens it didn't get paid
      await expectThrow(withdrawTokenChecked(user1, token2, amount), "INVALID_VALUE");
    });

    it("should not be able to withdraw tokens to burn", async () => {
      const dummyToken1 = await DummyToken.at(token1);
      const amount = 2.4e18;
      // Make sure the contract has enough funds
      await dummyToken1.setBalance(feeHolder.address, amount);

      const feePayments = new FeePayments();
      feePayments.add(feeHolder.address, token1, amount);
      await batchAddFeeBalancesChecked(feePayments);

      // Try to withdraw the tokens to burn
      await expectThrow(feeHolder.withdrawBurned(token1, amount, {from: user1}), "UNAUTHORIZED");
    });

    it("should not be able to add fee balances", async () => {
      const feePayments = new FeePayments();
      feePayments.add(user1, token1, 1.23 * 1e18);
      feePayments.add(user2, token2, 3.21 * 1e19);
      await expectThrow(feeHolder.batchAddFeeBalances(feePayments.getData(), {from: user1}), "UNAUTHORIZED");
    });

    describe("Bad ERC20 tokens", () => {
      it("withdrawToken should succeed when a token transfer does not throw and returns nothing", async () => {
        const amount = 1e18;
        // Make sure the contract has enough funds
        await TestToken.setBalance(feeHolder.address, amount);

        const feePayments = new FeePayments();
        feePayments.add(user1, testToken, amount);
        await batchAddFeeBalancesChecked(feePayments);

        await TestToken.setTestCase(await TestToken.TEST_NO_RETURN_VALUE());
        await withdrawTokenChecked(user1, testToken, amount);
      });

      it("withdrawToken should fail when a token transfer 'require' fails", async () => {
        const amount = 1e18;
        // Make sure the contract has enough funds
        await TestToken.setBalance(feeHolder.address, amount);

        const feePayments = new FeePayments();
        feePayments.add(user1, testToken, amount);
        await batchAddFeeBalancesChecked(feePayments);

        await TestToken.setTestCase(await TestToken.TEST_REQUIRE_FAIL());
        await expectThrow(withdrawTokenChecked(user1, testToken, amount), "TRANSFER_FAILURE");
      });

      it("withdrawToken should fail when a token transfer returns false", async () => {
        const amount = 1e18;
        // Make sure the contract has enough funds
        await TestToken.setBalance(feeHolder.address, amount);

        const feePayments = new FeePayments();
        feePayments.add(user1, testToken, amount);
        await batchAddFeeBalancesChecked(feePayments);

        await TestToken.setTestCase(await TestToken.TEST_RETURN_FALSE());
        await expectThrow(withdrawTokenChecked(user1, testToken, amount), "TRANSFER_FAILURE");
      });

      it("withdrawToken should fail when a token transfer returns more than 32 bytes", async () => {
        const amount = 1e18;
        // Make sure the contract has enough funds
        await TestToken.setBalance(feeHolder.address, amount);

        const feePayments = new FeePayments();
        feePayments.add(user1, testToken, amount);
        await batchAddFeeBalancesChecked(feePayments);

        await TestToken.setTestCase(await TestToken.TEST_INVALID_RETURN_SIZE());
        await expectThrow(withdrawTokenChecked(user1, testToken, amount), "TRANSFER_FAILURE");
      });
    });

  });

});
