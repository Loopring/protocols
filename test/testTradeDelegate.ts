import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import abi = require("ethereumjs-abi");
import { Artifacts, Bitstream, expectThrow } from "protocol2-js";

const {
  TradeDelegate,
  SymbolRegistry,
  DummyToken,
  DummyExchange,
} = new Artifacts(artifacts);

interface TokenTransfer {
  token: string;
  from: string;
  to: string;
  amount: number;
}

interface FilledUpdate {
  hash: string;
  amount: number;
}

contract("TradeDelegate", (accounts: string[]) => {
  const owner = accounts[0];
  const user1 = accounts[5];
  const user2 = accounts[6];
  const user3 = accounts[7];
  const user4 = accounts[8];
  const emptyAddr = "0x0000000000000000000000000000000000000000";

  let tradeDelegate: any;
  let symbolRegistry: any;
  let dummyExchange1: any;
  let dummyExchange2: any;
  let dummyExchange3: any;
  let token1: string;
  let token2: string;
  let token3: string;
  let token4: string;

  const addTokenTransfer = (transfers: TokenTransfer[], token: string, from: string, to: string, amount: number) => {
    const transfer: TokenTransfer = {
      token,
      from,
      to,
      amount,
    };
    transfers.push(transfer);
  };

  const addFilledUpdate = (updates: FilledUpdate[], hash: number,  amount: number) => {
    const bitstream = new Bitstream();
    bitstream.addNumber(hash, 32);
    const hashBytes32 = bitstream.getData();
    const update: FilledUpdate = {
      hash: hashBytes32,
      amount,
    };
    updates.push(update);
  };

  const toTransferBatch = (transfers: TokenTransfer[]) => {
    const bitstream = new Bitstream();
    for (const transfer of transfers) {
      bitstream.addAddress(transfer.token, 32);
      bitstream.addAddress(transfer.from, 32);
      bitstream.addAddress(transfer.to, 32);
      bitstream.addNumber(transfer.amount, 32);
    }
    return bitstream.getBytes32Array();
  };

  const toFilledBatch = (updates: FilledUpdate[]) => {
    const bitstream = new Bitstream();
    for (const update of updates) {
      bitstream.addHex(update.hash);
      bitstream.addNumber(update.amount, 32);
    }
    return bitstream.getBytes32Array();
  };

  const toCutoffBatch = (owners: string[],
                         tradingPairs: number[],
                         validSince: number[],
                         hashes: number[]) => {
    const bitstream = new Bitstream();
    for (let i = 0; i < owners.length; i++) {
      bitstream.addAddress(owners[i], 32);
      bitstream.addNumber(hashes[i], 32);
      bitstream.addNumber(validSince[i], 32);
      // Padding is done on the RIGHT for bytes20 for some reason.
      // But addresses are padded on the left (even though they are both 20 bytes)...
      bitstream.addNumber(tradingPairs[i], 20);
      bitstream.addNumber(0, 12);
    }
    return bitstream.getBytes32Array();
  };

  const setUserBalance = async (token: string, user: string, balance: number, approved?: number) => {
    const dummyToken = await DummyToken.at(token);
    await dummyToken.setBalance(user, balance);
    const approvedAmount = approved ? approved : balance;
    await dummyToken.approve(tradeDelegate.address, approvedAmount, {from: user});
  };

  const authorizeAddressChecked = async (address: string, transactionOrigin: string) => {
    await tradeDelegate.authorizeAddress(address, {from: transactionOrigin});
    await assertAuthorized(address);
  };

  const deauthorizeAddressChecked = async (address: string, transactionOrigin: string) => {
    await tradeDelegate.deauthorizeAddress(address, {from: transactionOrigin});
    await assertDeauthorized(address);
  };

  const assertAuthorized = async (address: string) => {
    const isAuthorizedInDelegate = await tradeDelegate.isAddressAuthorized(address);
    assert.equal(isAuthorizedInDelegate, true, "should be able to authorize an address");
  };

  const assertDeauthorized = async (address: string) => {
    const isAuthorizedInDelegate = await tradeDelegate.isAddressAuthorized(address);
    assert.equal(isAuthorizedInDelegate, false, "should be able to deauthorize an address");
  };

  const assertOrdersValid = (result: BigNumber, expectedValues: boolean[]) => {
    const bits = new BN(result.toString(16), 16);
    for (const [i, order] of expectedValues.entries()) {
        assert.equal(bits.testn(i), expectedValues[i], "Order cancelled status incorrect for order " + i);
    }
  };

  const batchTransferChecked = async (transfers: TokenTransfer[]) => {
    // Calculate expected balances
    const balances: { [id: string]: any; } = {};
    for (const transfer of transfers) {
      const dummyToken = await DummyToken.at(transfer.token);
      if (!balances[transfer.token]) {
        balances[transfer.token] = {};
      }
      if (!balances[transfer.token][transfer.from]) {
        balances[transfer.token][transfer.from] = (await dummyToken.balanceOf(transfer.from)).toNumber();
      }
      if (!balances[transfer.token][transfer.to]) {
        balances[transfer.token][transfer.to] = (await dummyToken.balanceOf(transfer.to)).toNumber();
      }
      balances[transfer.token][transfer.from] -= transfer.amount;
      balances[transfer.token][transfer.to] += transfer.amount;
    }
    // Update fee balances
    const batch = toTransferBatch(transfers);
    await dummyExchange1.batchTransfer(batch);
    // Check if we get the expected results
    for (const transfer of transfers) {
      const dummyToken = await DummyToken.at(transfer.token);
      const balanceFrom = (await dummyToken.balanceOf(transfer.from)).toNumber();
      const balanceTo = (await dummyToken.balanceOf(transfer.to)).toNumber();
      const expectedBalanceFrom = balances[transfer.token][transfer.from];
      const expectedBalanceTo = balances[transfer.token][transfer.to];
      assert.equal(balanceFrom, expectedBalanceFrom, "Token balance does not match expected value");
      assert.equal(balanceTo, expectedBalanceTo, "Token balance does not match expected value");
    }
  };

  const batchUpdateFilledChecked = async (updates: FilledUpdate[]) => {
    // Calculate expected filled
    const fills: { [id: string]: number; } = {};
    for (const update of updates) {
      fills[update.hash] = update.amount;
    }
    // Update filled amounts
    const batch = toFilledBatch(updates);
    await dummyExchange1.batchUpdateFilled(batch);
    // Check if we get the expected results
    for (const update of updates) {
      const filled = (await tradeDelegate.filled(update.hash)).toNumber();
      const expectedFilled = fills[update.hash];
      assert.equal(filled, expectedFilled, "Filled amount does not match expected value");
    }
  };

  before(async () => {
    symbolRegistry = await SymbolRegistry.deployed();
    token1 = await symbolRegistry.getAddressBySymbol("LRC");
    token2 = await symbolRegistry.getAddressBySymbol("EOS");
    token3 = await symbolRegistry.getAddressBySymbol("RDN");
    token4 = await symbolRegistry.getAddressBySymbol("GTO");
  });

  beforeEach(async () => {
    tradeDelegate = await TradeDelegate.new(20);
    dummyExchange1 = await DummyExchange.new(tradeDelegate.address, "0x0");
    dummyExchange2 = await DummyExchange.new(tradeDelegate.address, "0x0");
    dummyExchange3 = await DummyExchange.new(tradeDelegate.address, "0x0");
  });

  describe("contract owner", () => {
    it("should be able to authorize an address", async () => {
      await authorizeAddressChecked(dummyExchange1.address, owner);
      await authorizeAddressChecked(dummyExchange2.address, owner);
      await authorizeAddressChecked(dummyExchange3.address, owner);
    });

    it("should be able to deauthorize an address", async () => {
      await authorizeAddressChecked(dummyExchange1.address, owner);
      await authorizeAddressChecked(dummyExchange2.address, owner);
      await authorizeAddressChecked(dummyExchange3.address, owner);
      await deauthorizeAddressChecked(dummyExchange2.address, owner);
      await assertAuthorized(dummyExchange1.address);
      await assertAuthorized(dummyExchange3.address);
      await deauthorizeAddressChecked(dummyExchange1.address, owner);
      await assertAuthorized(dummyExchange3.address);
      await deauthorizeAddressChecked(dummyExchange3.address, owner);
    });

    it("should not be able to authorize a non-contract address", async () => {
      await expectThrow(authorizeAddressChecked(emptyAddr, owner));
      await expectThrow(authorizeAddressChecked(user2, owner));
    });

    it("should not be able to authorize an address twice", async () => {
      await authorizeAddressChecked(dummyExchange1.address, owner);
      await expectThrow(authorizeAddressChecked(dummyExchange1.address, owner));
    });

    it("should be able to suspend and resume the contract", async () => {
      await tradeDelegate.suspend({from: owner});
      // Try to do a transfer
      await authorizeAddressChecked(dummyExchange1.address, owner);
      await setUserBalance(token1, user1, 10e18);
      const transfers: TokenTransfer[] = [];
      addTokenTransfer(transfers, token1, user1, user2, 1e18);
      await expectThrow(batchTransferChecked(transfers));
      // Resume again
      await tradeDelegate.resume({from: owner});
      // Try the trade again
      await batchTransferChecked(transfers);
    });

    it("should be able to kill the contract", async () => {
      await authorizeAddressChecked(dummyExchange1.address, owner);
      // Suspend is needed before kill
      await expectThrow(tradeDelegate.kill({from: owner}));
      await tradeDelegate.suspend({from: owner});
      await tradeDelegate.kill({from: owner});
      // Try to resume again
      await expectThrow(tradeDelegate.resume({from: owner}));
      // Try to do a transfer
      await setUserBalance(token1, user1, 10e18);
      const transfers: TokenTransfer[] = [];
      addTokenTransfer(transfers, token1, user1, user2, 1e18);
      await expectThrow(batchTransferChecked(transfers));
    });
  });

  describe("authorized address", () => {
    beforeEach(async () => {
      await authorizeAddressChecked(dummyExchange1.address, owner);
    });

    it("should be able to batch transfer tokens", async () => {
      // Make sure everyone has enough funds
      await setUserBalance(token1, user1, 10e18);
      await setUserBalance(token2, user1, 10e18);
      await setUserBalance(token2, user2, 10e18);
      await setUserBalance(token3, user3, 10e18);
      {
        const transfers: TokenTransfer[] = [];
        addTokenTransfer(transfers, token1, user1, user2, 1.5e18);
        addTokenTransfer(transfers, token1, user1, user3, 2.5e18);
        addTokenTransfer(transfers, token2, user2, user3, 2.2e18);
        addTokenTransfer(transfers, token2, user2, user1, 0.3e18);
        addTokenTransfer(transfers, token2, user1, user3, 2.5e18);
        await batchTransferChecked(transfers);
      }
      {
        const transfers: TokenTransfer[] = [];
        addTokenTransfer(transfers, token1, user1, user3, 1.5e18);
        addTokenTransfer(transfers, token3, user3, user2, 2.5e18);
        addTokenTransfer(transfers, token3, user3, user1, 1.5e18);
        await batchTransferChecked(transfers);
      }
    });

    it("should be able to batch update filled", async () => {
      const hash1 = 123;
      const hash2 = 456;
      const hash3 = 789;
      const hash4 = 147;
      {
        const updates: FilledUpdate[] = [];
        addFilledUpdate(updates, hash1, 1.5e18);
        addFilledUpdate(updates, hash2, 1.1e18);
        addFilledUpdate(updates, hash2, 1.3e18);
        addFilledUpdate(updates, hash1, 2.3e18);
        await batchUpdateFilledChecked(updates);
      }
      {
        const updates: FilledUpdate[] = [];
        addFilledUpdate(updates, hash3, 1.5e18);
        addFilledUpdate(updates, hash3, 1.9e18);
        addFilledUpdate(updates, hash1, 3.3e18);
        addFilledUpdate(updates, hash4, 7.3e18);
        addFilledUpdate(updates, hash2, 2.3e18);
        await batchUpdateFilledChecked(updates);
      }
    });

    it("should be able to cancel all orders of an owner address up to a set time", async () => {
      const owners = [user1, user1, user1, user2];
      const tradingPairs = [123, 456, 789, 123];
      const validSince = [1000, 2500, 1500, 1500];
      const hashes = [1, 2, 3, 4];
      const data = toCutoffBatch(owners, tradingPairs, validSince, hashes);
      {
        const result = await tradeDelegate.batchCheckCutoffsAndCancelled(data, {from: owner});
        assertOrdersValid(result, [true, true, true, true]);
      }
      await dummyExchange1.setCutoffs(user1, 2000);
      {
        const result = await tradeDelegate.batchCheckCutoffsAndCancelled(data, {from: owner});
        assertOrdersValid(result, [false, true, false, true]);
      }
    });

    it("should be able to cancel all trading pair orders of an owner address up to a set time", async () => {
      const tradingPairToCancel = 666;
      const owners = [user1, user1, user1, user2];
      const tradingPairs = [tradingPairToCancel, tradingPairToCancel, 789, tradingPairToCancel];
      const validSince = [3000, 1000, 1000, 1000];
      const hashes = [1, 2, 3, 4];
      const data = toCutoffBatch(owners, tradingPairs, validSince, hashes);
      {
        const result = await tradeDelegate.batchCheckCutoffsAndCancelled(data, {from: owner});
        assertOrdersValid(result, [true, true, true, true]);
      }
      {
        const bitstream = new Bitstream();
        bitstream.addNumber(tradingPairToCancel, 20);
        await dummyExchange1.setTradingPairCutoffs(user1, bitstream.getData(), 2000);
      }
      {
        const result = await tradeDelegate.batchCheckCutoffsAndCancelled(data, {from: owner});
        assertOrdersValid(result, [true, false, true, true]);
      }
    });

    it("should be able to cancel a single order", async () => {
      const orderHashOwner1ToCancel = 666;
      const orderHashOwner2ToCancel = 666;
      const owners = [user1, user1, user2, user2];
      const tradingPairs = [123, 426, 789, 123];
      const validSince = [3000, 1000, 1000, 1000];
      const hashes = [orderHashOwner1ToCancel, 2, orderHashOwner2ToCancel, 4];
      const data = toCutoffBatch(owners, tradingPairs, validSince, hashes);
      {
        const result = await tradeDelegate.batchCheckCutoffsAndCancelled(data, {from: owner});
        assertOrdersValid(result, [true, true, true, true]);
      }
      {
        const bitstream = new Bitstream();
        bitstream.addNumber(orderHashOwner2ToCancel, 32);
        await dummyExchange1.setCancelled(user2, bitstream.getData());
      }
      {
        const result = await tradeDelegate.batchCheckCutoffsAndCancelled(data, {from: owner});
        assertOrdersValid(result, [true, true, false, true]);
      }
      {
        const bitstream = new Bitstream();
        bitstream.addNumber(orderHashOwner1ToCancel, 32);
        await dummyExchange1.setCancelled(user1, bitstream.getData());
      }
      {
        const result = await tradeDelegate.batchCheckCutoffsAndCancelled(data, {from: owner});
        assertOrdersValid(result, [false, true, false, true]);
      }
    });

    it("should not be able to authorize an address", async () => {
      await expectThrow(dummyExchange1.authorizeAddress(dummyExchange2.address));
    });

    it("should not be able to deauthorize an address", async () => {
      await expectThrow(dummyExchange1.authorizeAddress(dummyExchange1.address));
    });

    it("should not be able to suspend and resume the contract", async () => {
      await expectThrow(dummyExchange1.suspend());
      await tradeDelegate.suspend({from: owner});
      // Try to resume again
      await expectThrow(dummyExchange1.resume());
      await tradeDelegate.resume({from: owner});
    });
  });

  describe("anyone", () => {
    it("should be able to check if order cutoffs are valid", async () => {
      const owners = [user1];
      const tradingPairs = [456];
      const validSince = [1];
      const hashes = [123];
      const data = toCutoffBatch(owners, tradingPairs, validSince, hashes);
      const result = await tradeDelegate.batchCheckCutoffsAndCancelled(data);
      assertOrdersValid(result, [true]);
    });
  });
});
