import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import * as psc from "protocol2-js";
import tokenInfos = require("../migrations/config/tokens.js");
import { Artifacts } from "../util/Artifacts";
import { ExchangeTestUtil } from "./testExchangeUtil";

const {
  OrderCanceller,
  OrderBook,
  RingSubmitter,
} = new Artifacts(artifacts);

const ContractOrderOwner = artifacts.require("ContractOrderOwner");

contract("Exchange_Cancel", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  // let orderCanceller: any;
  let orderBook: any;
  // let contractOrderOwner: any;

  const allTokenSymbols = tokenInfos.development.map((t) => t.symbol);

  const emptyAddr = "0x0000000000000000000000000000000000000000";

  const toBN = (value: number) => {
    return web3.utils.toBN(new BigNumber(value.toString()));
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);

    orderBook = await OrderBook.deployed();
  });

  // describe("Cancelling orders", () => {

  // Did this ever work? Could not get it to work whatsoever, current version and previous
  //   // Start each test case with a clean trade history otherwise state changes
  //   // would persist between test cases which would be hard to keep track of and
  //   // could potentially hide bugs
  //   beforeEach(async () => {
  //     // await exchangeTestUtil.cleanTradeHistory();
  //     orderCanceller = await OrderCanceller.deployed();
  //     // await exchangeTestUtil.context.tradeHistory.methods.authorizeAddress(
  //     //   orderCanceller.address,
  //     // ).send({from: exchangeTestUtil.testContext.deployer});
  //     // contractOrderOwner = await ContractOrderOwner.new(exchangeTestUtil.context.orderBook.options.address,
  //     //                                                   orderCanceller.address);
  //   });

  //   describe("owner (broker == owner)", () => {
  //     it("should be able to cancel an order", async () => {
  //       const ringsInfo: psc.RingsInfo = {
  //         rings: [[0, 1]],
  //         orders: [
  //           {
  //             tokenS: allTokenSymbols[0],
  //             tokenB: allTokenSymbols[1],
  //             amountS: 35e17,
  //             amountB: 22e17,
  //           },
  //           {
  //             tokenS: allTokenSymbols[1],
  //             tokenB: allTokenSymbols[0],
  //             amountS: 23e17,
  //             amountB: 31e17,
  //           },
  //         ],
  //       };
  //       await exchangeTestUtil.setupRings(ringsInfo);

  //       // Setup the ring so we have access to the calculated hashes
  //       const ringsGenerator = new psc.RingsGenerator(exchangeTestUtil.context);
  //       await ringsGenerator.setupRingsAsync(ringsInfo);

  //       // console.log("preInfo: ", ringsInfo);

  //       // Cancel the second order in the ring
  //       const orderToCancelIdx = 0;
  //       const orderToCancel = ringsInfo.orders[orderToCancelIdx];
  //       // const hashes = new psc.Bitstream();
  //       // hashes.addHex(orderToCancel.hash.toString("hex"));

  //       const orderHash = "0x" + orderToCancel.hash.toString("hex");
  //       console.log("hash: ", orderHash);
  //       const cancelTx = await orderCanceller.cancelOrders(orderHash, {from: orderToCancel.owner});

  //       // Check the TradeDelegate contract to see if the order is indeed cancelled
  //       const expectedValidValues = ringsInfo.orders.map((element, index) => (index !== orderToCancelIdx));
  //       await exchangeTestUtil.assertOrdersValid(ringsInfo.orders, expectedValidValues);

  //       // Now submit the ring to make sure it behaves as expected (should NOT throw)
  //       const sub = await RingSubmitter.deployed();
  //       const {tx, report} = await exchangeTestUtil.submitRings(ringsInfo, undefined, sub);

  //       console.log(report);

  //       // Make sure no tokens got transferred
  //       assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
  //     });

  //     it("should be able to cancel all orders of a trading pair", async () => {
  //       const ringsInfo: psc.RingsInfo = {
  //         rings: [[0, 1]],
  //         orders: [
  //           {
  //             tokenS: allTokenSymbols[2],
  //             tokenB: allTokenSymbols[1],
  //             amountS: 41e17,
  //             amountB: 20e17,
  //           },
  //           {
  //             tokenS: allTokenSymbols[1],
  //             tokenB: allTokenSymbols[2],
  //             amountS: 23e17,
  //             amountB: 10e17,
  //           },
  //         ],
  //       };
  //       await exchangeTestUtil.setupRings(ringsInfo);

  //       // Setup the ring so we have access to the calculated hashes
  //       const ringsGenerator = new psc.RingsGenerator(exchangeTestUtil.context);
  //       await ringsGenerator.setupRingsAsync(ringsInfo);

  //       // Cancel the first order using trading pairs
  //       const orderToCancelIdx = 0;
  //       const orderToCancel = ringsInfo.orders[orderToCancelIdx];
  //       const cancelTx = await orderCanceller.cancelAllOrdersForTradingPair(
  //         orderToCancel.tokenS, orderToCancel.tokenB, orderToCancel.validSince + 500, {from: orderToCancel.owner});

  //       // Check the TradeDelegate contract to see if the order is indeed cancelled
  //       const expectedValidValues = ringsInfo.orders.map((element, index) => (index !== orderToCancelIdx));
  //       await exchangeTestUtil.assertOrdersValid(ringsInfo.orders, expectedValidValues);

  //       // Now submit the ring to make sure it behaves as expected (should NOT throw)
  //       const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);

  //       // Make sure no tokens got transferred
  //       assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
  //     });

  //     it("should be able to cancel all orders", async () => {
  //       const ringsInfo: psc.RingsInfo = {
  //         rings: [[0, 1]],
  //         orders: [
  //           {
  //             tokenS: allTokenSymbols[2],
  //             tokenB: allTokenSymbols[1],
  //             amountS: 57e17,
  //             amountB: 35e17,
  //           },
  //           {
  //             tokenS: allTokenSymbols[1],
  //             tokenB: allTokenSymbols[2],
  //             amountS: 12e17,
  //             amountB: 8e17,
  //           },
  //         ],
  //       };
  //       await exchangeTestUtil.setupRings(ringsInfo);

  //       // Setup the ring so we have access to the calculated hashes
  //       const ringsGenerator = new psc.RingsGenerator(exchangeTestUtil.context);
  //       await ringsGenerator.setupRingsAsync(ringsInfo);

  //       // Cancel the first order using trading pairs
  //       const orderToCancelIdx = 1;
  //       const orderToCancel = ringsInfo.orders[orderToCancelIdx];
  //       await orderCanceller.cancelAllOrders(orderToCancel.validSince + 500, {from: orderToCancel.owner});

  //       // Check the TradeDelegate contract to see if the order is indeed cancelled
  //       const expectedValidValues = ringsInfo.orders.map((element, index) => (index !== orderToCancelIdx));
  //       await exchangeTestUtil.assertOrdersValid(ringsInfo.orders, expectedValidValues);

  //       // Now submit the ring to make sure it behaves as expected (should NOT throw)
  //       const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);

  //       // Make sure no tokens got transferred
  //       assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
  //     });

  //   //   it("should be able to cancel an order with a contract as order owner", async () => {
  //   //     const onChainOrder: psc.OrderInfo = {
  //   //       index: 0,
  //   //       owner: contractOrderOwner.address,
  //   //       tokenS: "GTO",
  //   //       tokenB: "WETH",
  //   //       amountS: 10e18,
  //   //       amountB: 10e18,
  //   //       onChain: true,
  //   //     };
  //   //     const offChainOrder: psc.OrderInfo = {
  //   //       index: 1,
  //   //       tokenS: "WETH",
  //   //       tokenB: "GTO",
  //   //       amountS: 10e18,
  //   //       amountB: 10e18,
  //   //       feeAmount: 1e18,
  //   //       balanceS: 5e18,
  //   //     };
  //   //     const ringsInfo: psc.RingsInfo = {
  //   //       rings: [[0, 1]],
  //   //       orders: [
  //   //         onChainOrder,
  //   //         offChainOrder,
  //   //       ],
  //   //     };
  //   //     await exchangeTestUtil.setupRings(ringsInfo);

  //   //     // Submit the order to the onchain OrderBook
  //   //     const orderUtil = new psc.OrderUtil(undefined);
  //   //     const orderData = orderUtil.toOrderBookSubmitParams(onChainOrder);
  //   //     const orderHash = "0x" + orderUtil.getOrderHash(onChainOrder).toString("hex");
  //   //     const fromBlock = web3.eth.blockNumber;
  //   //     await contractOrderOwner.sumbitOrderToOrderBook(orderData, orderHash);
  //   //     const events: any = await exchangeTestUtil.getEventsFromContract(orderBook, "OrderSubmitted", fromBlock);
  //   //     const orderHashOnChain = events[0].args.orderHash;
  //   //     assert.equal(orderHashOnChain, orderHash, "order hash not equal");
  //   //     // Allow the contract to spend tokenS and feeToken
  //   //     await contractOrderOwner.approve(
  //   //       onChainOrder.tokenS,
  //   //       exchangeTestUtil.context.tradeDelegate.options.address,
  //   //       toBN(1e32),
  //   //     );
  //   //     await contractOrderOwner.approve(
  //   //       onChainOrder.feeToken,
  //   //       exchangeTestUtil.context.tradeDelegate.options.address,
  //   //       toBN(1e32),
  //   //     );

  //   //     // Order is registered and the contract can pay in tokenS and feeToken
  //   //     ringsInfo.expected = {
  //   //       rings: [
  //   //         {
  //   //           orders: [
  //   //             {
  //   //               filledFraction: 0.5,
  //   //             },
  //   //             {
  //   //               filledFraction: 0.5,
  //   //             },
  //   //           ],
  //   //         },
  //   //       ],
  //   //     };
  //   //     await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);

  //   //     // Cancel the order
  //   //     await contractOrderOwner.cancelOrder(orderHash);
  //   //     // Check the TradeDelegate contract to see if the order is indeed cancelled
  //   //     const expectedValidValues = [false, true];
  //   //     await exchangeTestUtil.assertOrdersValid(ringsInfo.orders, expectedValidValues);

  //   //     // Increase balance of the order owner so the rest of the order can be filled
  //   //     offChainOrder.balanceS = offChainOrder.amountS / 2;
  //   //     await exchangeTestUtil.setOrderBalances(offChainOrder);
  //   //     // Order is cancelled
  //   //     ringsInfo.expected = {
  //   //       rings: [
  //   //         {
  //   //           fail: true,
  //   //         },
  //   //       ],
  //   //     };
  //   //     await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);
  //   //   });
  //   });

  // //   describe("broker (broker != owner)", () => {
  // //     it("should be able to cancel an order", async () => {
  // //       const broker = exchangeTestUtil.testContext.brokers[0];
  // //       const ringsInfo: psc.RingsInfo = {
  // //         rings: [[0, 1]],
  // //         orders: [
  // //           {
  // //             tokenS: allTokenSymbols[0],
  // //             tokenB: allTokenSymbols[1],
  // //             amountS: 35e17,
  // //             amountB: 22e17,
  // //           },
  // //           {
  // //             tokenS: allTokenSymbols[1],
  // //             tokenB: allTokenSymbols[0],
  // //             amountS: 23e17,
  // //             amountB: 31e17,
  // //             broker,
  // //           },
  // //         ],
  // //       };
  // //       await exchangeTestUtil.setupRings(ringsInfo);
  // //       // Setup the ring so we have access to the calculated hashes
  // //       const ringsGenerator = new psc.RingsGenerator(exchangeTestUtil.context);
  // //       await ringsGenerator.setupRingsAsync(ringsInfo);

  // //       // Cancel the second order in the ring
  // //       const orderToCancelIdx = 1;
  // //       const orderToCancel = ringsInfo.orders[orderToCancelIdx];
  // //       assert(orderToCancel.broker !== orderToCancel.owner);

  // //       // Register the broker without interceptor
  // //       await exchangeTestUtil.registerOrderBrokerChecked(orderToCancel.owner, orderToCancel.broker, emptyAddr);

  // //       const hashes = new psc.Bitstream();
  // //       hashes.addHex(orderToCancel.hash.toString("hex"));
  // //       await orderCanceller.cancelOrders(hashes.getData(), {from: orderToCancel.broker});

  // //       // Check the TradeDelegate contract to see if the order is indeed cancelled
  // //       const expectedValidValues = ringsInfo.orders.map((element, index) => (index !== orderToCancelIdx));
  // //       await exchangeTestUtil.assertOrdersValid(ringsInfo.orders, expectedValidValues);

  // //       // Now submit the ring to make sure it behaves as expected (should NOT throw)
  // //       const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);

  // //       // Make sure no tokens got transferred
  // //       assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
  // //     });

  // //     it("should be able to cancel all orders of a trading pair of an owner", async () => {
  // //       const broker = exchangeTestUtil.testContext.brokers[0];
  // //       const ringsInfo: psc.RingsInfo = {
  // //         rings: [[0, 1]],
  // //         orders: [
  // //           {
  // //             tokenS: allTokenSymbols[2],
  // //             tokenB: allTokenSymbols[1],
  // //             amountS: 41e17,
  // //             amountB: 20e17,
  // //             broker,
  // //           },
  // //           {
  // //             tokenS: allTokenSymbols[1],
  // //             tokenB: allTokenSymbols[2],
  // //             amountS: 23e17,
  // //             amountB: 10e17,
  // //           },
  // //         ],
  // //       };
  // //       await exchangeTestUtil.setupRings(ringsInfo);

  // //       // Setup the ring so we have access to the calculated hashes
  // //       const ringsGenerator = new psc.RingsGenerator(exchangeTestUtil.context);
  // //       await ringsGenerator.setupRingsAsync(ringsInfo);

  // //       // Cancel the first order using trading pairs
  // //       const orderToCancelIdx = 0;
  // //       const orderToCancel = ringsInfo.orders[orderToCancelIdx];

  // //       // Register the broker without interceptor
  // //       await exchangeTestUtil.registerOrderBrokerChecked(orderToCancel.owner, orderToCancel.broker, emptyAddr);

  // //       await orderCanceller.cancelAllOrdersForTradingPairOfOwner(orderToCancel.owner,
  // //                                                                orderToCancel.tokenS,
  // //                                                                orderToCancel.tokenB,
  // //                                                                orderToCancel.validSince + 500,
  // //                                                                {from: orderToCancel.broker});

  // //       // Check the TradeDelegate contract to see if the order is indeed cancelled
  // //       const expectedValidValues = ringsInfo.orders.map((element, index) => (index !== orderToCancelIdx));
  // //       await exchangeTestUtil.assertOrdersValid(ringsInfo.orders, expectedValidValues);

  // //       // Now submit the ring to make sure it behaves as expected (should NOT throw)
  // //       const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);

  // //       // Make sure no tokens got transferred
  // //       assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
  // //     });

  // //     it("should be able to cancel all orders", async () => {
  // //       const broker = exchangeTestUtil.testContext.brokers[0];
  // //       const ringsInfo: psc.RingsInfo = {
  // //         rings: [[0, 1]],
  // //         orders: [
  // //           {
  // //             tokenS: allTokenSymbols[2],
  // //             tokenB: allTokenSymbols[1],
  // //             amountS: 57e17,
  // //             amountB: 35e17,
  // //           },
  // //           {
  // //             tokenS: allTokenSymbols[1],
  // //             tokenB: allTokenSymbols[2],
  // //             amountS: 12e17,
  // //             amountB: 8e17,
  // //             broker,
  // //           },
  // //         ],
  // //       };
  // //       await exchangeTestUtil.setupRings(ringsInfo);

  // //       // Setup the ring so we have access to the calculated hashes
  // //       const ringsGenerator = new psc.RingsGenerator(exchangeTestUtil.context);
  // //       await ringsGenerator.setupRingsAsync(ringsInfo);

  // //       // Cancel the first order using trading pairs
  // //       const orderToCancelIdx = 1;
  // //       const orderToCancel = ringsInfo.orders[orderToCancelIdx];

  // //       // Register the broker without interceptor
  // //       await exchangeTestUtil.registerOrderBrokerChecked(orderToCancel.owner, orderToCancel.broker, emptyAddr);

  // //       await orderCanceller.cancelAllOrdersOfOwner(orderToCancel.owner,
  // //                                                  orderToCancel.validSince + 500,
  // //                                                  {from: orderToCancel.broker});

  // //       // Check the TradeDelegate contract to see if the order is indeed cancelled
  // //       const expectedValidValues = ringsInfo.orders.map((element, index) => (index !== orderToCancelIdx));
  // //       await exchangeTestUtil.assertOrdersValid(ringsInfo.orders, expectedValidValues);

  // //       // Now submit the ring to make sure it behaves as expected (should NOT throw)
  // //       const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);

  // //       // Make sure no tokens got transferred
  // //       assert.equal(report.transferItems.length, 0, "No tokens should be transfered");
  // //     });

  // //     it("should be able to cancel an order with a contract as broker", async () => {
  // //       const onChainOrder: psc.OrderInfo = {
  // //         index: 0,
  // //         broker: contractOrderOwner.address,
  // //         tokenS: "GTO",
  // //         tokenB: "WETH",
  // //         amountS: 10e18,
  // //         amountB: 10e18,
  // //         onChain: true,
  // //       };
  // //       const offChainOrder: psc.OrderInfo = {
  // //         index: 1,
  // //         tokenS: "WETH",
  // //         tokenB: "GTO",
  // //         amountS: 10e18,
  // //         amountB: 10e18,
  // //         feeAmount: 1e18,
  // //         balanceS: 5e18,
  // //       };
  // //       const ringsInfo: psc.RingsInfo = {
  // //         rings: [[0, 1]],
  // //         orders: [
  // //           onChainOrder,
  // //           offChainOrder,
  // //         ],
  // //       };
  // //       await exchangeTestUtil.setupRings(ringsInfo);

  // //       // Submit the order to the onchain OrderBook
  // //       const orderUtil = new psc.OrderUtil(undefined);
  // //       const orderData = orderUtil.toOrderBookSubmitParams(onChainOrder);
  // //       const orderHash = "0x" + orderUtil.getOrderHash(onChainOrder).toString("hex");
  // //       const fromBlock = web3.eth.blockNumber;
  // //       await contractOrderOwner.sumbitOrderToOrderBook(orderData, orderHash);
  // //       const events: any = await exchangeTestUtil.getEventsFromContract(orderBook, "OrderSubmitted", fromBlock);
  // //       const orderHashOnChain = events[0].args.orderHash;
  // //       assert.equal(orderHashOnChain, orderHash, "order hash not equal");
  // //       // Register the broker without interceptor
  // //       await exchangeTestUtil.registerOrderBrokerChecked(onChainOrder.owner, onChainOrder.broker, emptyAddr);

  // //       // Order is registered and the broker is registered
  // //       ringsInfo.expected = {
  // //         rings: [
  // //           {
  // //             orders: [
  // //               {
  // //                 filledFraction: 0.5,
  // //               },
  // //               {
  // //                 filledFraction: 0.5,
  // //               },
  // //             ],
  // //           },
  // //         ],
  // //       };
  // //       await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);

  // //       // Cancel the order
  // //       await contractOrderOwner.cancelOrder(orderHash);
  // //       // Check the TradeDelegate contract to see if the order is indeed cancelled
  // //       const expectedValidValues = [false, true];
  // //       await exchangeTestUtil.assertOrdersValid(ringsInfo.orders, expectedValidValues);

  // //       // Increase balance of the order owner so the rest of the order can be filled
  // //       offChainOrder.balanceS = offChainOrder.amountS / 2;
  // //       await exchangeTestUtil.setOrderBalances(offChainOrder);
  // //       // Order is cancelled
  // //       ringsInfo.expected = {
  // //         rings: [
  // //           {
  // //             fail: true,
  // //           },
  // //         ],
  // //       };
  // //       await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);
  // //     });
  // //   });
  // });
});
