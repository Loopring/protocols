import { BigNumber } from "bignumber.js";
import { Bitstream, expectThrow } from "protocol2-js";
import { Artifacts } from "../util/Artifacts";

const {
  TradeHistory,
  TradeDelegate,
  DummyToken,
  DummyExchange,
  LRCToken,
  GTOToken,
  RDNToken,
  WETHToken,
  TESTToken,
} = new Artifacts(artifacts);

interface FilledUpdate {
  hash: string;
  amount: number;
}

interface Order {
  broker: string;
  owner: string;
  tradingPair: number;
  validSince: number;
  hash: number;
}

contract("TradeHistory", (accounts: string[]) => {
  const owner = accounts[0];
  const broker1 = accounts[1];
  const broker2 = accounts[2];
  const broker3 = accounts[3];
  const broker4 = accounts[4];
  const user1 = accounts[5];
  const user2 = accounts[6];
  const user3 = accounts[7];
  const user4 = accounts[8];
  const emptyAddr = "0x0000000000000000000000000000000000000000";

  let tradeHistory: any;
  let dummyExchange1: any;
  let dummyExchange2: any;
  let dummyExchange3: any;
  let token1: string;
  let token2: string;
  let token3: string;
  let token4: string;

  let TestToken: any;
  let testToken: string;

  const numberToBytesX = (value: number, numBytes: number) => {
    const bitstream = new Bitstream();
    bitstream.addNumber(value, numBytes);
    return bitstream.getData();
  };

  const addFilledUpdate = (updates: FilledUpdate[], hash: number,  amount: number) => {
    const update: FilledUpdate = {
      hash: numberToBytesX(hash, 32),
      amount,
    };
    updates.push(update);
  };

  const addOrder = (orders: Order[],
                    broker: string,
                    orderOwner: string,
                    tradingPair: number,
                    validSince: number,
                    hash: number) => {
    const order: Order = {
      broker,
      owner: orderOwner,
      tradingPair,
      validSince,
      hash,
    };
    orders.push(order);
  };

  const toFilledBatch = (updates: FilledUpdate[]) => {
    const bitstream = new Bitstream();
    for (const update of updates) {
      bitstream.addHex(update.hash);
      bitstream.addNumber(update.amount, 32);
    }
    return bitstream.getBytes32Array();
  };

  const toCutoffBatch = (orders: Order[]) => {
    const bitstream = new Bitstream();
    for (const order of orders) {
      bitstream.addAddress(order.broker, 32);
      bitstream.addAddress(order.owner, 32);
      bitstream.addNumber(order.hash, 32);
      bitstream.addNumber(order.validSince, 32);
      // Padding is done on the RIGHT for bytes20 for some reason.
      // But addresses are padded on the left (even though they are both 20 bytes)...
      bitstream.addNumber(order.tradingPair, 20);
      bitstream.addNumber(0, 12);
    }
    return bitstream.getBytes32Array();
  };

  const authorizeAddressChecked = async (address: string, transactionOrigin: string) => {
    await tradeHistory.authorizeAddress(address, {from: transactionOrigin});
    await assertAuthorized(address);
  };

  const deauthorizeAddressChecked = async (address: string, transactionOrigin: string) => {
    await tradeHistory.deauthorizeAddress(address, {from: transactionOrigin});
    await assertDeauthorized(address);
  };

  const assertAuthorized = async (address: string) => {
    const isAuthorizedInDelegate = await tradeHistory.isAddressAuthorized(address);
    assert.equal(isAuthorizedInDelegate, true, "should be able to authorize an address");
  };

  const assertDeauthorized = async (address: string) => {
    const isAuthorizedInDelegate = await tradeHistory.isAddressAuthorized(address);
    assert.equal(isAuthorizedInDelegate, false, "should be able to deauthorize an address");
  };

  const assertOrdersValid = (result: BigNumber[], expectedValues: boolean[]) => {
    const cancelledValue = new BigNumber("F".repeat(64), 16);
    for (const [i, order] of expectedValues.entries()) {
        assert.equal(!result[i].eq(cancelledValue), expectedValues[i],
                     "Order cancelled status incorrect for order " + i);
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
      const filled = (await tradeHistory.filled(update.hash)).toNumber();
      const expectedFilled = fills[update.hash];
      assert.equal(filled, expectedFilled, "Filled amount does not match expected value");
    }
  };

  before(async () => {
    token1 = LRCToken.address;
    token2 = WETHToken.address;
    token3 = RDNToken.address;
    token4 = GTOToken.address;
  });

  beforeEach(async () => {
    const tradeDelegate = await TradeDelegate.deployed();
    tradeHistory = await TradeHistory.new();
    dummyExchange1 = await DummyExchange.new(tradeDelegate.address, tradeHistory.address, "0x0", "0x0");
    dummyExchange2 = await DummyExchange.new(tradeDelegate.address, tradeHistory.address, "0x0", "0x0");
    dummyExchange3 = await DummyExchange.new(tradeDelegate.address, tradeHistory.address, "0x0", "0x0");
    TestToken = await TESTToken.new();
    testToken = TestToken.address;
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
      await expectThrow(authorizeAddressChecked(emptyAddr, owner), "ZERO_ADDRESS");
      await expectThrow(authorizeAddressChecked(user2, owner), "INVALID_ADDRESS");
    });

    it("should not be able to authorize an address twice", async () => {
      await authorizeAddressChecked(dummyExchange1.address, owner);
      await expectThrow(authorizeAddressChecked(dummyExchange1.address, owner), "ALREADY_EXIST");
    });

    it("should not be able to deauthorize an unathorized address", async () => {
      await authorizeAddressChecked(dummyExchange1.address, owner);
      await expectThrow(deauthorizeAddressChecked(emptyAddr, owner), "ZERO_ADDRESS");
      await expectThrow(deauthorizeAddressChecked(dummyExchange2.address, owner), "NOT_FOUND");
    });

    it("should be able to suspend and resume the contract", async () => {
      await tradeHistory.suspend({from: owner});
      // Try to do a filled update
      await authorizeAddressChecked(dummyExchange1.address, owner);
      const updates: FilledUpdate[] = [];
      addFilledUpdate(updates, 123, 1.5e18);
      await expectThrow(batchUpdateFilledChecked(updates), "INVALID_STATE");
      // Resume again
      await tradeHistory.resume({from: owner});
      // Try the update again
      await batchUpdateFilledChecked(updates);
    });

    it("should be able to kill the contract", async () => {
      await authorizeAddressChecked(dummyExchange1.address, owner);
      // Suspend is needed before kill
      await expectThrow(tradeHistory.kill({from: owner}), "INVALID_STATE");
      await tradeHistory.suspend({from: owner});
      await tradeHistory.kill({from: owner});
      // Try to resume again
      await expectThrow(tradeHistory.resume({from: owner}), "NOT_OWNER");
      // Try to do a filled update
      const updates: FilledUpdate[] = [];
      addFilledUpdate(updates, 123, 1.5e18);
      await expectThrow(batchUpdateFilledChecked(updates), "INVALID_STATE");
    });
  });

  describe("authorized address", () => {
    beforeEach(async () => {
      await authorizeAddressChecked(dummyExchange1.address, owner);
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

    it("should not be able to batch update filled with malformed data", async () => {
      const hash1 = 123;
      const hash2 = 456;
      const updates: FilledUpdate[] = [];
      addFilledUpdate(updates, hash1, 1e18);
      addFilledUpdate(updates, hash2, 2e18);
      const batch = toFilledBatch(updates);
      batch.pop();
      await expectThrow(dummyExchange1.batchUpdateFilled(batch), "INVALID_SIZE");
    });

    it("should not be able to authorize an address", async () => {
      await expectThrow(dummyExchange1.authorizeAddress(dummyExchange2.address), "NOT_OWNER");
    });

    it("should not be able to deauthorize an address", async () => {
      await expectThrow(dummyExchange1.authorizeAddress(dummyExchange1.address), "NOT_OWNER");
    });

    it("should not be able to suspend and resume the contract", async () => {
      await expectThrow(dummyExchange1.suspend(), "NOT_OWNER");
      await tradeHistory.suspend({from: owner});
      // Try to resume again
      await expectThrow(dummyExchange1.resume(), "NOT_OWNER");
      await tradeHistory.resume({from: owner});
    });

    describe("Cancelling", () => {
      describe("owner (broker == owner)", () => {
        it("should be able to cancel all orders up to a set time", async () => {
          const orders: Order[] = [];
          addOrder(orders, user1, user1, 123, 1000, 1);
          addOrder(orders, user1, user1, 456, 2500, 2);
          addOrder(orders, user1, user1, 789, 1500, 3);
          addOrder(orders, user2, user2, 123, 1500, 4);
          const data = toCutoffBatch(orders);
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [true, true, true, true]);
          }
          await dummyExchange1.setCutoffs(user1, 2000);
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [false, true, false, true]);
          }
        });

        it("should be able to cancel all trading pair orders up to a set time", async () => {
          const tradingPairToCancel = 666;
          const orders: Order[] = [];
          addOrder(orders, user1, user1, tradingPairToCancel, 3000, 1);
          addOrder(orders, user1, user1, tradingPairToCancel, 1000, 2);
          addOrder(orders, user1, user1,                 789, 1000, 3);
          addOrder(orders, user2, user2, tradingPairToCancel, 1000, 4);
          const data = toCutoffBatch(orders);
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [true, true, true, true]);
          }
          await dummyExchange1.setTradingPairCutoffs(user1, numberToBytesX(tradingPairToCancel, 20), 2000);
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [true, false, true, true]);
          }
        });

        it("should be able to cancel a single order", async () => {
          const orderHashOwner1ToCancel = 666;
          const orderHashOwner2ToCancel = 666;
          const orders: Order[] = [];
          addOrder(orders, user1, user1, 123, 3000, orderHashOwner1ToCancel);
          addOrder(orders, user1, user1, 456, 1000,                       2);
          addOrder(orders, user2, user2, 789, 1000, orderHashOwner1ToCancel);
          addOrder(orders, user2, user2, 123, 1000,                       4);
          const data = toCutoffBatch(orders);
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [true, true, true, true]);
          }
          await dummyExchange1.setCancelled(user2, numberToBytesX(orderHashOwner2ToCancel, 32));
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [true, true, false, true]);
          }
          await dummyExchange1.setCancelled(user1, numberToBytesX(orderHashOwner1ToCancel, 32));
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [false, true, false, true]);
          }
        });

        it("should not be able to uncancel orders by setting the cutoff earlier", async () => {
          await dummyExchange1.setCutoffs(user1, 10000);
          await dummyExchange1.setCutoffs(user1, 20000);
          await expectThrow(dummyExchange1.setCutoffs(user1, 19000), "INVALID_VALUE");
        });

        it("should not be able to uncancel orders by setting the trading pair cutoff earlier", async () => {
          const tradingPair = numberToBytesX(123, 20);
          dummyExchange1.setTradingPairCutoffs(user1, tradingPair, 2000);
          dummyExchange1.setTradingPairCutoffs(user1, tradingPair, 4000);
          await expectThrow(dummyExchange1.setTradingPairCutoffs(user1, tradingPair, 3000), "INVALID_VALUE");
        });
      });
      describe("broker (broker != owner)", () => {
        it("should be able to cancel all orders of a single owner", async () => {
          const orders: Order[] = [];
          addOrder(orders, broker1, user1, 123, 1000, 1);
          addOrder(orders, broker1, user2, 456, 1000, 2);
          addOrder(orders, broker1, user1, 789, 1000, 3);
          addOrder(orders, broker2, user1, 123, 1000, 4);
          const data = toCutoffBatch(orders);
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [true, true, true, true]);
          }
          await dummyExchange1.setCutoffsOfOwner(broker1, user1, 2000);
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [false, true, false, true]);
          }
        });

        it("should be able to cancel all orders of all owners for which he is the broker", async () => {
          const orders: Order[] = [];
          addOrder(orders, broker1,   user1, 123, 1000, 1);
          addOrder(orders, broker1,   user2, 456, 1000, 2);
          addOrder(orders, broker1, broker1, 789, 1000, 3);
          addOrder(orders, broker2,   user1, 123, 1000, 4);
          const data = toCutoffBatch(orders);
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [true, true, true, true]);
          }
          await dummyExchange1.setCutoffs(broker1, 2000);
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [false, false, false, true]);
          }
        });

        it("should be able to cancel all trading pair orders of a single owner up to a set time", async () => {
          const tradingPairToCancel = 666;
          const orders: Order[] = [];
          addOrder(orders, broker1, user1, tradingPairToCancel, 3000, 1);
          addOrder(orders, broker1, user1, tradingPairToCancel, 1000, 2);
          addOrder(orders, broker1, user1,                   1, 1000, 3);
          addOrder(orders, broker1, user2, tradingPairToCancel, 1000, 4);
          addOrder(orders, broker2, user1, tradingPairToCancel, 1000, 5);
          const data = toCutoffBatch(orders);
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [true, true, true, true, true]);
          }
          const tradingPairEncoded = numberToBytesX(tradingPairToCancel, 20);
          await dummyExchange1.setTradingPairCutoffsOfOwner(broker1, user1, tradingPairEncoded, 2000);
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [true, false, true, true, true]);
          }
        });

        it("should be able to cancel a single order of an owner", async () => {
          const orderHashOwner1ToCancel = 666;
          const orderHashOwner2ToCancel = 666;
          const orders: Order[] = [];
          addOrder(orders, broker1, user1, 123, 1000, orderHashOwner1ToCancel);
          addOrder(orders, broker1, user2, 456, 1000,                       2);
          addOrder(orders, broker2, user1, 789, 1000, orderHashOwner2ToCancel);
          addOrder(orders, broker2, user1, 123, 1000,                       4);
          const data = toCutoffBatch(orders);
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [true, true, true, true]);
          }
          await dummyExchange1.setCancelled(broker2, numberToBytesX(orderHashOwner2ToCancel, 32));
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [true, true, false, true]);
          }
          await dummyExchange1.setCancelled(broker1, numberToBytesX(orderHashOwner1ToCancel, 32));
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [false, true, false, true]);
          }
        });

        it("should not be able to uncancel orders by setting the cutoff earlier", async () => {
          await dummyExchange1.setCutoffsOfOwner(broker1, user1, 10000);
          await dummyExchange1.setCutoffsOfOwner(broker1, user1, 20000);
          await expectThrow(dummyExchange1.setCutoffsOfOwner(broker1, user1, 19000), "INVALID_VALUE");
          await dummyExchange1.setCutoffsOfOwner(broker2, user1, 19000);
          await dummyExchange1.setCutoffsOfOwner(broker1, user2, 19000);
        });

        it("should not be able to uncancel orders by setting the trading pair cutoff earlier", async () => {
          const tradingPair = numberToBytesX(123, 20);
          dummyExchange1.setTradingPairCutoffsOfOwner(broker1, user1, tradingPair, 2000);
          dummyExchange1.setTradingPairCutoffsOfOwner(broker1, user1, tradingPair, 4000);
          await expectThrow(dummyExchange1.setTradingPairCutoffsOfOwner(broker1, user1, tradingPair, 3000),
                            "INVALID_VALUE");
          await dummyExchange1.setTradingPairCutoffsOfOwner(broker1, user2, tradingPair, 3000);
          await dummyExchange1.setTradingPairCutoffsOfOwner(broker2, user1, tradingPair, 3000);
        });

        it("owner should not be able to cancel all orders created by its broker", async () => {
          const orders: Order[] = [];
          addOrder(orders,   user1, user1, 123, 1000, 1);
          addOrder(orders, broker1, user1, 456, 1000, 2);
          addOrder(orders, broker2, user1, 789, 1000, 3);
          const data = toCutoffBatch(orders);
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [true, true, true]);
          }
          await dummyExchange1.setCutoffs(user1, 2000);
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [false, true, true]);
          }
        });

        it("owner should not be able to cancel all trading pair orders created by its broker", async () => {
          const tradingPairToCancel = 666;
          const orders: Order[] = [];
          addOrder(orders,   user1, user1, tradingPairToCancel, 1000, 1);
          addOrder(orders, broker1, user1, tradingPairToCancel, 1000, 2);
          addOrder(orders, broker2, user1, tradingPairToCancel, 1000, 3);
          const data = toCutoffBatch(orders);
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [true, true, true]);
          }
          const tradingPairEncoded = numberToBytesX(tradingPairToCancel, 20);
          await dummyExchange1.setTradingPairCutoffs(user1, tradingPairEncoded, 2000);
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [false, true, true]);
          }
        });

        it("owner should not be able to cancel an order created by its broker", async () => {
          const orderHashOwnerToCancel = 123;
          const orders: Order[] = [];
          addOrder(orders, broker1, user1, 123, 1000, orderHashOwnerToCancel);
          const data = toCutoffBatch(orders);
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [true]);
          }
          await dummyExchange1.setCancelled(user1, numberToBytesX(orderHashOwnerToCancel, 32));
          {
            const result = await tradeHistory.batchGetFilledAndCheckCancelled(data, {from: owner});
            assertOrdersValid(result, [true]);
          }
        });

      });
    });

  });

  describe("anyone", () => {
    it("should be able to check if order cutoffs are valid", async () => {
      const orders: Order[] = [];
      addOrder(orders, broker1, user1, 123, 1000, 123);
      const data = toCutoffBatch(orders);
      const result = await tradeHistory.batchGetFilledAndCheckCancelled(data);
      assertOrdersValid(result, [true]);
    });

    it("should not be able to check if order cutoffs are valid with malformed data", async () => {
      const orders: Order[] = [];
      addOrder(orders, broker1, user1, 123, 1000, 123);
      const data = toCutoffBatch(orders);
      data.pop();
      await expectThrow(tradeHistory.batchGetFilledAndCheckCancelled(data), "INVALID_SIZE");
    });

    it("should not be able to batch update filled", async () => {
      const hash1 = 123;
      const updates: FilledUpdate[] = [];
      addFilledUpdate(updates, hash1, 1.5e18);
      await expectThrow(batchUpdateFilledChecked(updates), "UNAUTHORIZED");
    });
  });
});
