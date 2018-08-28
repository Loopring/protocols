import BN = require("bn.js");
import abi = require("ethereumjs-abi");
import { Artifacts, expectThrow } from "protocol2-js";

const {
  FeeHolder,
  SymbolRegistry,
  TradeDelegate,
  DummyExchange,
  DummyToken,
} = new Artifacts(artifacts);

interface FeePayment {
  owner: string;
  token: string;
  amount: number;
}

contract("FeeHolder", (accounts: string[]) => {
  const deployer = accounts[0];
  const mockedExchangeAddress = accounts[1];
  const user1 = accounts[2];
  const user2 = accounts[3];
  const user3 = accounts[4];
  const user4 = accounts[5];

  let symbolRegistry: any;
  let tradeDelegate: any;
  let feeHolder: any;
  let dummyExchange: any;
  let token1: string;
  let token2: string;
  let token3: string;
  let token4: string;

  const numberToBytes32Str = (n: number) => {
    const encoded = abi.rawEncode(["uint256"], [new BN(n.toString(10), 10)]);
    return "0x" + encoded.toString("hex");
  };

  const addressToBytes32Str = (addr: string) => {
    const encoded = abi.rawEncode(["address"], [addr]);
    return "0x" + encoded.toString("hex");
  };

  const addFeePayment = (feePayments: FeePayment[], owner: string, token: string, amount: number) => {
    const feePayment: FeePayment = {
      owner,
      token,
      amount,
    };
    feePayments.push(feePayment);
  };

  const toBatch = (feePayments: FeePayment[]) => {
    const batch: string[] = [];
    for (const feePayment of feePayments) {
      batch.push(addressToBytes32Str(feePayment.token));
      batch.push(addressToBytes32Str(feePayment.owner));
      batch.push(numberToBytes32Str(feePayment.amount));
    }
    return batch;
  };

  const authorizeAddressChecked = async (address: string, transcationOrigin: string) => {
    await tradeDelegate.authorizeAddress(address, {from: transcationOrigin});
    await assertAuthorized(address);
  };

  const assertAuthorized = async (address: string) => {
    const isAuthorizedInDelegate = await tradeDelegate.isAddressAuthorized(address);
    assert.equal(isAuthorizedInDelegate, true, "exchange not authorized.");
  };

  const batchAddFeeBalancesChecked = async (feePayments: FeePayment[]) => {
    // Calculate expected fee balances
    const feeBalances: { [id: string]: any; } = {};
    for (const feePayment of feePayments) {
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
    const batch = toBatch(feePayments);
    await dummyExchange.batchAddFeeBalances(batch);
    // Check if we get the expected results
    for (const feePayment of feePayments) {
      const balance = (await feeHolder.feeBalances(feePayment.token, feePayment.owner)).toNumber();
      const expectedBalance = feeBalances[feePayment.owner][feePayment.token];
      assert.equal(balance, expectedBalance, "Fee balance does not match expected value");
    }
  };

  const withdrawTokenChecked = async (owner: string, token: string, amount: number) => {
    const feeBalanceBefore = (await feeHolder.feeBalances(token, owner)).toNumber();
    const success = await feeHolder.withdrawToken(token, amount, {from: owner});
    const feeBalanceAfter = (await feeHolder.feeBalances(token, owner)).toNumber();
    if (success) {
      assert.equal(feeBalanceAfter, feeBalanceBefore - amount, "Withdrawal amount not correctly updated.");
    } else {
      // Caller needs to fail the transaction for now
      assert.equal(feeBalanceAfter, feeBalanceBefore - amount, "Withdrawal amount not correctly updated.");
    }
  };

  before(async () => {
    symbolRegistry = await SymbolRegistry.deployed();
    tradeDelegate = await TradeDelegate.deployed();

    token1 = await symbolRegistry.getAddressBySymbol("LRC");
    token2 = await symbolRegistry.getAddressBySymbol("WETH");
    token3 = await symbolRegistry.getAddressBySymbol("EOS");
    token4 = await symbolRegistry.getAddressBySymbol("GTO");
  });

  beforeEach(async () => {
    // Fresh FeeHolder for each test
    feeHolder = await FeeHolder.new(tradeDelegate.address);
    dummyExchange = await DummyExchange.new(feeHolder.address);
    await authorizeAddressChecked(dummyExchange.address, deployer);
  });

  describe("protocol", () => {
    it("should be able to add fee balances in batch", async () => {
      {
        const feePayments: FeePayment[] = [];
        addFeePayment(feePayments, user1, token1, 1.23 * 1e18);
        addFeePayment(feePayments, user2, token2, 3.21 * 1e19);
        addFeePayment(feePayments, user1, token2, 2.71 * 1e19);
        addFeePayment(feePayments, user3, token3, 4.91 * 1e19);
        addFeePayment(feePayments, user1, token1, 1.48 * 1e19);
        addFeePayment(feePayments, user3, token1, 2.61 * 1e19);
        await batchAddFeeBalancesChecked(feePayments);
      }
      {
        const feePayments: FeePayment[] = [];
        addFeePayment(feePayments, user3, token1, 1.23 * 1e18);
        addFeePayment(feePayments, user1, token3, 3.21 * 1e19);
        addFeePayment(feePayments, user2, token2, 2.71 * 1e19);
        addFeePayment(feePayments, user3, token3, 2.61 * 1e19);
        await batchAddFeeBalancesChecked(feePayments);
      }
    });

    it("should not accept data in incorrect format for batchAddFeeBalances", async () => {
      const feePayments: FeePayment[] = [];
      addFeePayment(feePayments, user1, token1, 1.23 * 1e18);
      addFeePayment(feePayments, user2, token2, 3.21 * 1e19);
      const batch = toBatch(feePayments);
      batch.pop();
      await expectThrow(dummyExchange.batchAddFeeBalances(batch));
    });
  });

  describe("other users", () => {
    it("should not be able to add fee balances", async () => {
      const feePayments: FeePayment[] = [];
      addFeePayment(feePayments, user1, token1, 1.23 * 1e18);
      addFeePayment(feePayments, user2, token2, 3.21 * 1e19);
      expectThrow(feeHolder.batchAddFeeBalances(toBatch(feePayments), {from: user1}));
    });

  });

  describe("any user", () => {
    it("can withdraw tokens of its own", async () => {
      const dummyToken1 = await DummyToken.at(token1);
      const dummyToken2 = await DummyToken.at(token2);
      const amount11 = 1.78e18;
      const amount12 = 2.18e18;
      const amount21 = 4.21e18;
      // Make sure the contract has enough funds
      await dummyToken1.setBalance(feeHolder.address, amount11 + amount12);
      await dummyToken2.setBalance(feeHolder.address, amount21);

      const feePayments: FeePayment[] = [];
      addFeePayment(feePayments, user1, token1, amount11);
      addFeePayment(feePayments, user2, token1, amount12);
      addFeePayment(feePayments, user1, token2, amount21);
      await batchAddFeeBalancesChecked(feePayments);

      await withdrawTokenChecked(user1, token1, amount11);
      await withdrawTokenChecked(user1, token2, amount21);
    });

    it("can withdraw tokens of its own in parts", async () => {
      const dummyToken1 = await DummyToken.at(token1);
      const amount = 1.78e18;
      // Make sure the contract has enough funds
      await dummyToken1.setBalance(feeHolder.address, amount);

      const feePayments: FeePayment[] = [];
      addFeePayment(feePayments, user1, token1, amount);
      await batchAddFeeBalancesChecked(feePayments);

      await withdrawTokenChecked(user1, token1, amount / 4);
      await withdrawTokenChecked(user1, token1, amount / 2);
      await withdrawTokenChecked(user1, token1, amount / 4);
    });

    it("can't withdraw more tokens than allowed", async () => {
      const dummyToken1 = await DummyToken.at(token1);
      const dummyToken2 = await DummyToken.at(token2);
      const amount = 2.4e18;
      // Make sure the contract has enough funds
      await dummyToken1.setBalance(feeHolder.address, amount);
      await dummyToken2.setBalance(feeHolder.address, amount);

      const feePayments: FeePayment[] = [];
      addFeePayment(feePayments, user1, token1, amount);
      addFeePayment(feePayments, user2, token2, amount);
      await batchAddFeeBalancesChecked(feePayments);

      await withdrawTokenChecked(user1, token1, amount / 2);
      await expectThrow(withdrawTokenChecked(user1, token1, amount));
      await expectThrow(withdrawTokenChecked(user2, token1, amount / 2));
      await expectThrow(withdrawTokenChecked(user1, token2, amount));
      await expectThrow(withdrawTokenChecked(user3, token1, amount));
    });
  });

});
