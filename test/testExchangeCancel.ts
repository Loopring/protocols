import BN = require("bn.js");
import * as psc from "protocol2-js";
import tokenInfos = require("../migrations/config/tokens.js");
import { Artifacts } from "../util/Artifacts";
import { ExchangeTestUtil } from "./testExchangeUtil";

const {
  OrderCanceller,
} = new Artifacts(artifacts);

contract("Exchange_Cancel", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  let orderCanceller: any;
  const allTokenSymbols = tokenInfos.development.map((t) => t.symbol);

  const emptyAddr = "0x0000000000000000000000000000000000000000";

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  describe("Cancelling orders", () => {

    // Start each test case with a clean trade history otherwise state changes
    // would persist between test cases which would be hard to keep track of and
    // could potentially hide bugs
    beforeEach(async () => {
      await exchangeTestUtil.cleanTradeHistory();
      orderCanceller = await OrderCanceller.new(exchangeTestUtil.context.tradeDelegate.address);
      await exchangeTestUtil.context.tradeDelegate.authorizeAddress(
        orderCanceller.address,
        {from: exchangeTestUtil.testContext.deployer},
      );
    });

    describe("owner (broker == owner)", () => {
      it("should be able to cancel an order", async () => {
        const ringsInfo: psc.RingsInfo = {
          rings: [[0, 1]],
          orders: [
            {
              tokenS: allTokenSymbols[0],
              tokenB: allTokenSymbols[1],
              amountS: 35e17,
              amountB: 22e17,
            },
            {
              tokenS: allTokenSymbols[1],
              tokenB: allTokenSymbols[0],
              amountS: 23e17,
              amountB: 31e17,
            },
          ],
        };
        await exchangeTestUtil.setupRings(ringsInfo);

        // Setup the ring so we have access to the calculated hashes
        const ringsGenerator = new psc.RingsGenerator(exchangeTestUtil.context);
        await ringsGenerator.setupRingsAsync(ringsInfo);

        // Cancel the second order in the ring
        const orderToCancelIdx = 1;
        const orderToCancel = ringsInfo.orders[orderToCancelIdx];
        const hashes = new psc.Bitstream();
        hashes.addHex(orderToCancel.hash.toString("hex"));
        const cancelTx = await orderCanceller.cancelOrders(hashes.getData(), {from: orderToCancel.owner});

        // Check the TradeDelegate contract to see if the order is indeed cancelled
        const expectedValidValues = ringsInfo.orders.map((element, index) => (index !== orderToCancelIdx));
        await exchangeTestUtil.assertOrdersValid(ringsInfo.orders, expectedValidValues);

        // Now submit the ring to make sure it behaves as expected (should NOT throw)
        const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);

        // Make sure no tokens got transferred
        assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
      });

      it("should be able to cancel all orders of a trading pair", async () => {
        const ringsInfo: psc.RingsInfo = {
          rings: [[0, 1]],
          orders: [
            {
              tokenS: allTokenSymbols[2],
              tokenB: allTokenSymbols[1],
              amountS: 41e17,
              amountB: 20e17,
            },
            {
              tokenS: allTokenSymbols[1],
              tokenB: allTokenSymbols[2],
              amountS: 23e17,
              amountB: 10e17,
            },
          ],
        };
        await exchangeTestUtil.setupRings(ringsInfo);

        // Setup the ring so we have access to the calculated hashes
        const ringsGenerator = new psc.RingsGenerator(exchangeTestUtil.context);
        await ringsGenerator.setupRingsAsync(ringsInfo);

        // Cancel the first order using trading pairs
        const orderToCancelIdx = 0;
        const orderToCancel = ringsInfo.orders[orderToCancelIdx];
        const cancelTx = await orderCanceller.cancelAllOrdersForTradingPair(
          orderToCancel.tokenS, orderToCancel.tokenB, orderToCancel.validSince + 500, {from: orderToCancel.owner});

        // Check the TradeDelegate contract to see if the order is indeed cancelled
        const expectedValidValues = ringsInfo.orders.map((element, index) => (index !== orderToCancelIdx));
        await exchangeTestUtil.assertOrdersValid(ringsInfo.orders, expectedValidValues);

        // Now submit the ring to make sure it behaves as expected (should NOT throw)
        const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);

        // Make sure no tokens got transferred
        assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
      });

      it("should be able to cancel all orders", async () => {
        const ringsInfo: psc.RingsInfo = {
          rings: [[0, 1]],
          orders: [
            {
              tokenS: allTokenSymbols[2],
              tokenB: allTokenSymbols[1],
              amountS: 57e17,
              amountB: 35e17,
            },
            {
              tokenS: allTokenSymbols[1],
              tokenB: allTokenSymbols[2],
              amountS: 12e17,
              amountB: 8e17,
            },
          ],
        };
        await exchangeTestUtil.setupRings(ringsInfo);

        // Setup the ring so we have access to the calculated hashes
        const ringsGenerator = new psc.RingsGenerator(exchangeTestUtil.context);
        await ringsGenerator.setupRingsAsync(ringsInfo);

        // Cancel the first order using trading pairs
        const orderToCancelIdx = 1;
        const orderToCancel = ringsInfo.orders[orderToCancelIdx];
        await orderCanceller.cancelAllOrders(orderToCancel.validSince + 500, {from: orderToCancel.owner});

        // Check the TradeDelegate contract to see if the order is indeed cancelled
        const expectedValidValues = ringsInfo.orders.map((element, index) => (index !== orderToCancelIdx));
        await exchangeTestUtil.assertOrdersValid(ringsInfo.orders, expectedValidValues);

        // Now submit the ring to make sure it behaves as expected (should NOT throw)
        const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);

        // Make sure no tokens got transferred
        assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
      });
    });

    describe("broker (broker != owner)", () => {
      it("should be able to cancel an order", async () => {
        const broker = exchangeTestUtil.testContext.brokers[0];
        const ringsInfo: psc.RingsInfo = {
          rings: [[0, 1]],
          orders: [
            {
              tokenS: allTokenSymbols[0],
              tokenB: allTokenSymbols[1],
              amountS: 35e17,
              amountB: 22e17,
            },
            {
              tokenS: allTokenSymbols[1],
              tokenB: allTokenSymbols[0],
              amountS: 23e17,
              amountB: 31e17,
              broker,
            },
          ],
        };
        await exchangeTestUtil.setupRings(ringsInfo);
        // Setup the ring so we have access to the calculated hashes
        const ringsGenerator = new psc.RingsGenerator(exchangeTestUtil.context);
        await ringsGenerator.setupRingsAsync(ringsInfo);

        // Cancel the second order in the ring
        const orderToCancelIdx = 1;
        const orderToCancel = ringsInfo.orders[orderToCancelIdx];
        assert(orderToCancel.broker !== orderToCancel.owner);

        // Register the broker without interceptor
        await exchangeTestUtil.registerOrderBrokerChecked(orderToCancel.owner, orderToCancel.broker, emptyAddr);

        const hashes = new psc.Bitstream();
        hashes.addHex(orderToCancel.hash.toString("hex"));
        await orderCanceller.cancelOrders(hashes.getData(), {from: orderToCancel.broker});

        // Check the TradeDelegate contract to see if the order is indeed cancelled
        const expectedValidValues = ringsInfo.orders.map((element, index) => (index !== orderToCancelIdx));
        await exchangeTestUtil.assertOrdersValid(ringsInfo.orders, expectedValidValues);

        // Now submit the ring to make sure it behaves as expected (should NOT throw)
        const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);

        // Make sure no tokens got transferred
        assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
      });

      it("should be able to cancel all orders of a trading pair of an owner", async () => {
        const broker = exchangeTestUtil.testContext.brokers[0];
        const ringsInfo: psc.RingsInfo = {
          rings: [[0, 1]],
          orders: [
            {
              tokenS: allTokenSymbols[2],
              tokenB: allTokenSymbols[1],
              amountS: 41e17,
              amountB: 20e17,
              broker,
            },
            {
              tokenS: allTokenSymbols[1],
              tokenB: allTokenSymbols[2],
              amountS: 23e17,
              amountB: 10e17,
            },
          ],
        };
        await exchangeTestUtil.setupRings(ringsInfo);

        // Setup the ring so we have access to the calculated hashes
        const ringsGenerator = new psc.RingsGenerator(exchangeTestUtil.context);
        await ringsGenerator.setupRingsAsync(ringsInfo);

        // Cancel the first order using trading pairs
        const orderToCancelIdx = 0;
        const orderToCancel = ringsInfo.orders[orderToCancelIdx];

        // Register the broker without interceptor
        await exchangeTestUtil.registerOrderBrokerChecked(orderToCancel.owner, orderToCancel.broker, emptyAddr);

        await orderCanceller.cancelAllOrdersForTradingPairOfOwner(orderToCancel.owner,
                                                                 orderToCancel.tokenS,
                                                                 orderToCancel.tokenB,
                                                                 orderToCancel.validSince + 500,
                                                                 {from: orderToCancel.broker});

        // Check the TradeDelegate contract to see if the order is indeed cancelled
        const expectedValidValues = ringsInfo.orders.map((element, index) => (index !== orderToCancelIdx));
        await exchangeTestUtil.assertOrdersValid(ringsInfo.orders, expectedValidValues);

        // Now submit the ring to make sure it behaves as expected (should NOT throw)
        const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);

        // Make sure no tokens got transferred
        assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
      });

      it("should be able to cancel all orders", async () => {
        const broker = exchangeTestUtil.testContext.brokers[0];
        const ringsInfo: psc.RingsInfo = {
          rings: [[0, 1]],
          orders: [
            {
              tokenS: allTokenSymbols[2],
              tokenB: allTokenSymbols[1],
              amountS: 57e17,
              amountB: 35e17,
            },
            {
              tokenS: allTokenSymbols[1],
              tokenB: allTokenSymbols[2],
              amountS: 12e17,
              amountB: 8e17,
              broker,
            },
          ],
        };
        await exchangeTestUtil.setupRings(ringsInfo);

        // Setup the ring so we have access to the calculated hashes
        const ringsGenerator = new psc.RingsGenerator(exchangeTestUtil.context);
        await ringsGenerator.setupRingsAsync(ringsInfo);

        // Cancel the first order using trading pairs
        const orderToCancelIdx = 1;
        const orderToCancel = ringsInfo.orders[orderToCancelIdx];

        // Register the broker without interceptor
        await exchangeTestUtil.registerOrderBrokerChecked(orderToCancel.owner, orderToCancel.broker, emptyAddr);

        await orderCanceller.cancelAllOrdersOfOwner(orderToCancel.owner,
                                                   orderToCancel.validSince + 500,
                                                   {from: orderToCancel.broker});

        // Check the TradeDelegate contract to see if the order is indeed cancelled
        const expectedValidValues = ringsInfo.orders.map((element, index) => (index !== orderToCancelIdx));
        await exchangeTestUtil.assertOrdersValid(ringsInfo.orders, expectedValidValues);

        // Now submit the ring to make sure it behaves as expected (should NOT throw)
        const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);

        // Make sure no tokens got transferred
        assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
      });
    });
  });

});
