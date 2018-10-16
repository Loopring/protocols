import * as pjs from "protocol2-js";
import tokenInfos = require("../migrations/config/tokens.js");
import { Artifacts } from "../util/Artifacts";
import { ExchangeTestUtil } from "./testExchangeUtil";

const {
  BrokerRegistry,
  DummyBrokerInterceptor,
} = new Artifacts(artifacts);

contract("Exchange_Broker", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  let dummyBrokerInterceptor: any;
  const allTokenSymbols = tokenInfos.development.map((t) => t.symbol);

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  describe("Broker", () => {

    // Start each test case with a clean trade history otherwise state changes
    // would persist between test cases which would be hard to keep track of and
    // could potentially hide bugs
    beforeEach(async () => {
      await exchangeTestUtil.cleanTradeHistory();
      dummyBrokerInterceptor = await DummyBrokerInterceptor.new(exchangeTestUtil.ringSubmitter.address);
    });

    it("should be able for an order to use a broker without an interceptor", async () => {
      const broker = exchangeTestUtil.testContext.brokers[0];
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: allTokenSymbols[0],
            tokenB: allTokenSymbols[1],
            amountS: 35e17,
            amountB: 22e17,
            broker,
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

      const owner = ringsInfo.orders[0].owner;
      const emptyAddr = "0x0000000000000000000000000000000000000000";

      // Broker not registered: submitRings should NOT throw, but no transactions should happen
      {
        const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);
        assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
      }

      // Register the broker without interceptor
      await exchangeTestUtil.registerOrderBrokerChecked(owner, broker, emptyAddr);

      // Broker registered: transactions should happen
      {
        const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);
        assert(report.transferItems.length > 0, "Tokens should be transfered");
      }
    });

    // it("should be able to for an order to use a broker with an interceptor", async () => {
    //   const broker = exchangeTestUtil.testContext.brokers[0];
    //   const ringsInfo: pjs.RingsInfo = {
    //     rings: [[0, 1]],
    //     orders: [
    //       {
    //         tokenS: allTokenSymbols[1],
    //         tokenB: allTokenSymbols[2],
    //         amountS: 35e17,
    //         amountB: 22e17,
    //       },
    //       {
    //         tokenS: allTokenSymbols[2],
    //         tokenB: allTokenSymbols[1],
    //         amountS: 23e17,
    //         amountB: 31e17,
    //         broker,
    //       },
    //     ],
    //   };
    //   await exchangeTestUtil.setupRings(ringsInfo);

    //   const orderIndex = 1;
    //   const order = ringsInfo.orders[orderIndex];
    //   const owner = order.owner;

    //   // Broker not registered: submitRings should NOT throw, but no transactions should happen
    //   {
    //     const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);
    //     assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
    //   }

    //   // Register the broker with interceptor
    //   await exchangeTestUtil.registerOrderBrokerChecked(owner, broker, dummyBrokerInterceptor.address);

    //   // Make sure allowance is set to 0
    //   await dummyBrokerInterceptor.setAllowance(broker, owner, order.tokenS, 0e17);
    //   await dummyBrokerInterceptor.setAllowance(broker, owner, order.feeToken, 0e17);

    //   // Broker registered, but allowance is set to 0 so no transactions should happen
    //   {
    //     const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);
    //     assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
    //   }

    //   // Set allowance to something less than amountS
    //   await dummyBrokerInterceptor.setAllowance(broker, owner, order.tokenS, order.amountS / 3);
    //   await dummyBrokerInterceptor.setAllowance(broker, owner, order.feeToken, order.feeAmount);

    //   // Broker registered, allowance is set to non-zero so transactions should happen
    //   {
    //     const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);
    //     assert(report.transferItems.length > 0, "Tokens should be transfered");
    //     // Check filled
    //     const filled = await exchangeTestUtil.getFilled(order.hash);
    //     exchangeTestUtil.assertNumberEqualsWithPrecision(filled, order.amountS / 3);
    //     // Check if onTokenSpent was correctly called for tokenS and feeToken
    //     const spendS = (await dummyBrokerInterceptor.spent(broker, owner, order.tokenS)).toNumber();
    //     const spendFee = (await dummyBrokerInterceptor.spent(broker, owner, order.feeToken)).toNumber();
    //     exchangeTestUtil.assertNumberEqualsWithPrecision(spendS, order.amountS / 3);
    //     exchangeTestUtil.assertNumberEqualsWithPrecision(spendFee, order.feeAmount / 3);
    //   }

    //   // Now set the allowance large enough so that the complete order can be fulfilled
    //   await dummyBrokerInterceptor.setAllowance(broker, owner, order.tokenS, order.amountS * 2);

    //   // Broker registered and allowance set to a high value: transactions should happen
    //   {
    //     const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);
    //     assert(report.transferItems.length > 0, "Tokens should be transfered");
    //     // Check filled
    //     const filled = await exchangeTestUtil.getFilled(order.hash);
    //     exchangeTestUtil.assertNumberEqualsWithPrecision(filled, order.amountS);
    //     // Check if onTokenSpent was correctly called for tokenS and feeToken
    //     const spendS = (await dummyBrokerInterceptor.spent(broker, owner, order.tokenS)).toNumber();
    //     const spendFee = (await dummyBrokerInterceptor.spent(broker, owner, order.feeToken)).toNumber();
    //     exchangeTestUtil.assertNumberEqualsWithPrecision(spendS, order.amountS);
    //     exchangeTestUtil.assertNumberEqualsWithPrecision(spendFee, order.feeAmount);
    //   }
    // });

    // it("should not be able spend more than allowance when tokenS == feeToken", async () => {
    //   const broker = exchangeTestUtil.testContext.brokers[0];
    //   const ringsInfo: pjs.RingsInfo = {
    //     rings: [[0, 1]],
    //     orders: [
    //       {
    //         owner: "0",
    //         tokenS: "LRC",
    //         tokenB: "WETH",
    //         feeToken: "LRC",
    //         amountS: 35e17,
    //         amountB: 22e17,
    //         feeAmount: 1e18,
    //         broker,
    //         balanceS: 10e18,
    //         balanceFee: 10e18,
    //       },
    //       {
    //         owner: "1",
    //         tokenS: "WETH",
    //         tokenB: "LRC",
    //         feeToken: "LRC",
    //         amountS: 23e17,
    //         amountB: 31e17,
    //       },
    //     ],
    //   };
    //   await exchangeTestUtil.setupRings(ringsInfo);

    //   const order = ringsInfo.orders[0];
    //   const owner = order.owner;
    //   assert(order.tokenS === order.feeToken);

    //   // Register the broker with interceptor
    //   await exchangeTestUtil.registerOrderBrokerChecked(owner, broker, dummyBrokerInterceptor.address);

    //   // Set allowance of tokenS == feeToken. Not enough allowance to also pay the fee.
    //   await dummyBrokerInterceptor.setAllowance(broker, owner, order.tokenS, order.amountS / 2);

    //   const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);
    //   assert(report.transferItems.length > 0, "Tokens should be transfered");

    //   // Check filled
    //   const filled = await exchangeTestUtil.getFilled(order.hash);
    //   exchangeTestUtil.assertNumberEqualsWithPrecision(filled, order.amountS / 2);
    //   // Check if onTokenSpent was correctly called for tokenS == feeToken
    //   const spendS = (await dummyBrokerInterceptor.spent(broker, owner, order.tokenS)).toNumber();
    //   exchangeTestUtil.assertNumberEqualsWithPrecision(spendS, order.amountS / 2);
    // });

    // it("should not be able spend more than allowance in multiple orders", async () => {
    //   const broker = exchangeTestUtil.testContext.brokers[0];
    //   const ringsInfo: pjs.RingsInfo = {
    //     rings: [[0, 1]],
    //     orders: [
    //       {
    //         owner: "0",
    //         tokenS: "WETH",
    //         tokenB: "GTO",
    //         feeToken: "LRC",
    //         amountS: 70e17,
    //         amountB: 44e17,
    //         feeAmount: 1e18,
    //         broker,
    //         balanceS: 10e18,
    //         balanceFee: 10e18,
    //       },
    //       {
    //         owner: "0",
    //         tokenS: "GTO",
    //         tokenB: "WETH",
    //         feeToken: "LRC",
    //         amountS: 46e17,
    //         amountB: 62e17,
    //         feeAmount: 1e18,
    //         broker,
    //         balanceS: 10e18,
    //         balanceFee: 10e18,
    //       },
    //     ],
    //   };
    //   await exchangeTestUtil.setupRings(ringsInfo);

    //   const order0 = ringsInfo.orders[0];
    //   const order1 = ringsInfo.orders[1];
    //   const owner = order0.owner;
    //   assert(order0.owner === order1.owner);
    //   assert(order0.broker === order1.broker);
    //   assert(order0.feeToken === order1.feeToken);

    //   // Register the broker with interceptor
    //   await exchangeTestUtil.registerOrderBrokerChecked(owner, broker, dummyBrokerInterceptor.address);

    //   // Set allowance of all tokenS tokens to sufficient for 100% filled
    //   await dummyBrokerInterceptor.setAllowance(broker, owner, order0.tokenS, order0.amountS);
    //   await dummyBrokerInterceptor.setAllowance(broker, owner, order1.tokenS, order1.amountS);
    //   // Set the allowance of feeToken so it can only be used once for fee payment
    //   // The second order will need to fallback to tokenB as feePayment
    //   await dummyBrokerInterceptor.setAllowance(broker, owner, order0.feeToken, order0.feeAmount);

    //   const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);

    //   // Check filled
    //   const filled0 = await exchangeTestUtil.getFilled(order0.hash);
    //   const filled1 = await exchangeTestUtil.getFilled(order1.hash);
    //   exchangeTestUtil.assertNumberEqualsWithPrecision(filled0, order0.amountS);
    //   exchangeTestUtil.assertNumberEqualsWithPrecision(filled1, order1.amountS);
    //   // Check if onTokenSpent was correctly called for tokenS and feeToken
    //   const spendS0 = (await dummyBrokerInterceptor.spent(broker, owner, order0.tokenS)).toNumber();
    //   const spendS1 = (await dummyBrokerInterceptor.spent(broker, owner, order1.tokenS)).toNumber();
    //   const spendFee = (await dummyBrokerInterceptor.spent(broker, owner, order0.feeToken)).toNumber();
    //   exchangeTestUtil.assertNumberEqualsWithPrecision(spendS0, order0.amountS);
    //   exchangeTestUtil.assertNumberEqualsWithPrecision(spendS1, order1.amountS);
    //   exchangeTestUtil.assertNumberEqualsWithPrecision(spendFee, order0.feeAmount);
    // });

    it("multiple orders with brokers", async () => {
      const broker0 = exchangeTestUtil.testContext.brokers[0];
      const broker1 = exchangeTestUtil.testContext.brokers[1];
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            owner: "0",
            tokenS: "WETH",
            tokenB: "GTO",
            feeToken: "LRC",
            amountS: 70e17,
            amountB: 44e17,
            feeAmount: 1e18,
            broker: broker0,
            balanceS: 10e18,
            balanceFee: 10e18,
          },
          {
            owner: "1",
            tokenS: "GTO",
            tokenB: "WETH",
            feeToken: "LRC",
            amountS: 46e17,
            amountB: 62e17,
            feeAmount: 1e18,
            broker: broker1,
            balanceS: 10e18,
            balanceFee: 10e18,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);

      const order0 = ringsInfo.orders[0];
      const order1 = ringsInfo.orders[1];
      const owner0 = order0.owner;
      const owner1 = order1.owner;

      // Register the broker with interceptor
      await exchangeTestUtil.registerOrderBrokerChecked(owner0, broker0, dummyBrokerInterceptor.address);
      await exchangeTestUtil.registerOrderBrokerChecked(owner1, broker1, dummyBrokerInterceptor.address);

      // Set allowance of tokenS and feeToken for the orders
      // Order0
      await dummyBrokerInterceptor.setAllowance(broker0, owner0, order0.tokenS, order0.amountS);
      await dummyBrokerInterceptor.setAllowance(broker0, owner0, order0.feeToken, order0.feeAmount);
      // Order1
      await dummyBrokerInterceptor.setAllowance(broker1, owner1, order1.tokenS, order1.amountS);
      await dummyBrokerInterceptor.setAllowance(broker1, owner1, order1.feeToken, order1.feeAmount);

      const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);

      // Check filled
      const filled0 = await exchangeTestUtil.getFilled(order0.hash);
      const filled1 = await exchangeTestUtil.getFilled(order1.hash);
      exchangeTestUtil.assertNumberEqualsWithPrecision(filled0, order0.amountS);
      exchangeTestUtil.assertNumberEqualsWithPrecision(filled1, order1.amountS);
      // Check if onTokenSpent was correctly called for tokenS and feeToken
      // const spendS0 = (await dummyBrokerInterceptor.spent(broker0, owner0, order0.tokenS)).toNumber();
      // const spendFee0 = (await dummyBrokerInterceptor.spent(broker0, owner0, order0.feeToken)).toNumber();
      // const spendS1 = (await dummyBrokerInterceptor.spent(broker1, owner1, order1.tokenS)).toNumber();
      // const spendFee1 = (await dummyBrokerInterceptor.spent(broker1, owner1, order1.feeToken)).toNumber();
      // exchangeTestUtil.assertNumberEqualsWithPrecision(spendS0, order0.amountS);
      // exchangeTestUtil.assertNumberEqualsWithPrecision(spendFee0, order0.feeAmount);
      // exchangeTestUtil.assertNumberEqualsWithPrecision(spendS1, order1.amountS);
      // exchangeTestUtil.assertNumberEqualsWithPrecision(spendFee1, order1.feeAmount);
    });

    it("an owner should be able to have two different brokers in different orders", async () => {
      const broker0 = exchangeTestUtil.testContext.brokers[0];
      const broker1 = exchangeTestUtil.testContext.brokers[1];
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            owner: "0",
            tokenS: "WETH",
            tokenB: "GTO",
            feeToken: "LRC",
            amountS: 70e17,
            amountB: 44e17,
            feeAmount: 1e18,
            broker: broker0,
            balanceS: 10e18,
            balanceFee: 10e18,
          },
          {
            owner: "0",
            tokenS: "GTO",
            tokenB: "WETH",
            feeToken: "LRC",
            amountS: 46e17,
            amountB: 62e17,
            feeAmount: 1e18,
            broker: broker1,
            balanceS: 10e18,
            balanceFee: 10e18,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);

      const order0 = ringsInfo.orders[0];
      const order1 = ringsInfo.orders[1];
      const owner = order0.owner;
      assert(order0.owner === order1.owner);
      assert(order0.feeToken === order1.feeToken);

      // Register the broker with interceptor
      await exchangeTestUtil.registerOrderBrokerChecked(owner, broker0, dummyBrokerInterceptor.address);
      await exchangeTestUtil.registerOrderBrokerChecked(owner, broker1, dummyBrokerInterceptor.address);

      // Set allowance of tokenS and feeToken for the orders
      // Order0
      await dummyBrokerInterceptor.setAllowance(broker0, owner, order0.tokenS, order0.amountS);
      await dummyBrokerInterceptor.setAllowance(broker0, owner, order0.feeToken, order0.feeAmount);
      // Order1
      await dummyBrokerInterceptor.setAllowance(broker1, owner, order1.tokenS, order1.amountS);
      await dummyBrokerInterceptor.setAllowance(broker1, owner, order1.feeToken, order1.feeAmount);

      const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);

      // Check filled
      const filled0 = await exchangeTestUtil.getFilled(order0.hash);
      const filled1 = await exchangeTestUtil.getFilled(order1.hash);
      exchangeTestUtil.assertNumberEqualsWithPrecision(filled0, order0.amountS);
      exchangeTestUtil.assertNumberEqualsWithPrecision(filled1, order1.amountS);
      // Check if onTokenSpent was correctly called for tokenS and feeToken
      // const spendS0 = (await dummyBrokerInterceptor.spent(broker0, owner, order0.tokenS)).toNumber();
      // const spendFee0 = (await dummyBrokerInterceptor.spent(broker0, owner, order0.feeToken)).toNumber();
      // const spendS1 = (await dummyBrokerInterceptor.spent(broker1, owner, order1.tokenS)).toNumber();
      // const spendFee1 = (await dummyBrokerInterceptor.spent(broker1, owner, order1.feeToken)).toNumber();
      // exchangeTestUtil.assertNumberEqualsWithPrecision(spendS0, order0.amountS);
      // exchangeTestUtil.assertNumberEqualsWithPrecision(spendFee0, order0.feeAmount);
      // exchangeTestUtil.assertNumberEqualsWithPrecision(spendS1, order1.amountS);
      // exchangeTestUtil.assertNumberEqualsWithPrecision(spendFee1, order1.feeAmount);
    });

    it("a broker can be the broker of multiple owners", async () => {
      const broker = exchangeTestUtil.testContext.brokers[0];
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            owner: "0",
            tokenS: "WETH",
            tokenB: "GTO",
            feeToken: "LRC",
            amountS: 70e17,
            amountB: 44e17,
            feeAmount: 1e18,
            broker,
            balanceS: 10e18,
            balanceFee: 10e18,
          },
          {
            owner: "1",
            tokenS: "GTO",
            tokenB: "WETH",
            feeToken: "LRC",
            amountS: 46e17,
            amountB: 62e17,
            feeAmount: 1e18,
            broker,
            balanceS: 10e18,
            balanceFee: 10e18,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);

      const order0 = ringsInfo.orders[0];
      const order1 = ringsInfo.orders[1];
      const owner0 = order0.owner;
      const owner1 = order1.owner;

      // Register the broker with interceptor
      await exchangeTestUtil.registerOrderBrokerChecked(owner0, broker, dummyBrokerInterceptor.address);
      await exchangeTestUtil.registerOrderBrokerChecked(owner1, broker, dummyBrokerInterceptor.address);

      // Set allowance of tokenS and feeToken for the orders
      // Order0
      await dummyBrokerInterceptor.setAllowance(broker, owner0, order0.tokenS, order0.amountS);
      await dummyBrokerInterceptor.setAllowance(broker, owner0, order0.feeToken, order0.feeAmount);
      // Order1
      await dummyBrokerInterceptor.setAllowance(broker, owner1, order1.tokenS, order1.amountS);
      await dummyBrokerInterceptor.setAllowance(broker, owner1, order1.feeToken, order1.feeAmount);

      const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);

      // Check filled
      const filled0 = await exchangeTestUtil.getFilled(order0.hash);
      const filled1 = await exchangeTestUtil.getFilled(order1.hash);
      exchangeTestUtil.assertNumberEqualsWithPrecision(filled0, order0.amountS);
      exchangeTestUtil.assertNumberEqualsWithPrecision(filled1, order1.amountS);
      // Check if onTokenSpent was correctly called for tokenS and feeToken
      // const spendS0 = (await dummyBrokerInterceptor.spent(broker, owner0, order0.tokenS)).toNumber();
      // const spendFee0 = (await dummyBrokerInterceptor.spent(broker, owner0, order0.feeToken)).toNumber();
      // const spendS1 = (await dummyBrokerInterceptor.spent(broker, owner1, order1.tokenS)).toNumber();
      // const spendFee1 = (await dummyBrokerInterceptor.spent(broker, owner1, order1.feeToken)).toNumber();
      // exchangeTestUtil.assertNumberEqualsWithPrecision(spendS0, order0.amountS);
      // exchangeTestUtil.assertNumberEqualsWithPrecision(spendFee0, order0.feeAmount);
      // exchangeTestUtil.assertNumberEqualsWithPrecision(spendS1, order1.amountS);
      // exchangeTestUtil.assertNumberEqualsWithPrecision(spendFee1, order1.feeAmount);
    });

    // it("an order using a broker with an invalid interceptor should not fail the transaction", async () => {
    //   const broker = exchangeTestUtil.testContext.brokers[0];
    //   const ringsInfo: pjs.RingsInfo = {
    //     rings: [[0, 1]],
    //     orders: [
    //       {
    //         tokenS: allTokenSymbols[0],
    //         tokenB: allTokenSymbols[1],
    //         amountS: 35e17,
    //         amountB: 22e17,
    //       },
    //       {
    //         tokenS: allTokenSymbols[1],
    //         tokenB: allTokenSymbols[0],
    //         amountS: 23e17,
    //         amountB: 31e17,
    //         broker,
    //       },
    //     ],
    //   };
    //   await exchangeTestUtil.setupRings(ringsInfo);

    //   const order = ringsInfo.orders[1];
    //   const owner = order.owner;
    //   const invalidInterceptorAddress = BrokerRegistry.address;

    //   // Register the broker with interceptor
    //   await exchangeTestUtil.registerOrderBrokerChecked(owner, broker, invalidInterceptorAddress);

    //   // Broker registered with invalid interceptor, should NOT throw but allowance will be set to 0
    //   // so no transactions should happen
    //   {
    //     const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);
    //     assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
    //   }

    //   // Unregister the broker
    //   await exchangeTestUtil.unregisterOrderBrokerChecked(owner, broker);

    //   // Register the broker with interceptor
    //   await exchangeTestUtil.registerOrderBrokerChecked(owner, broker, dummyBrokerInterceptor.address);

    //   // Now set the allowance to a large number
    //   await dummyBrokerInterceptor.setAllowance(broker, owner, order.tokenS, 1e32);
    //   await dummyBrokerInterceptor.setAllowance(broker, owner, order.feeToken, 1e32);

    //   // Let all functions fail
    //   await dummyBrokerInterceptor.setFailAllFunctions(true);

    //   // Broker registered with interceptor functions erroring out, should NOT throw but allowance will be set to 0
    //   // so no transactions should happen
    //   {
    //     const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);
    //     assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
    //   }
    // });

  });

});
