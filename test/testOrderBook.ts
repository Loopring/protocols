import { BN } from "bn.js";
import abi = require("ethereumjs-abi");
import { expectThrow, logDebug, OrderInfo, OrderUtil } from "protocol2-js";
import util = require("util");
import { Artifacts } from "../util/Artifacts";

const {
  OrderBook,
  LRCToken,
  GTOToken,
  RDNToken,
} = new Artifacts(artifacts);
contract("OrderBook", (accounts: string[]) => {
  const owner1 = accounts[1];
  const owner2 = accounts[2];
  const broker1 = accounts[3];
  const broker2 = accounts[4];
  const wallet = accounts[5];
  const tokenRecipient = accounts[6];

  let orderBook: any;

  let lrcAddress: string;
  let rdnAddress: string;
  let gtoAddress: string;

  const getEventsFromContract = async (contract: any, eventName: string, fromBlock: number) => {
    return new Promise((resolve, reject) => {
      if (!contract[eventName]) {
        throw Error("TypeError: contract[eventName] is not a function: " + eventName);
      }

      const events = contract[eventName]({}, { fromBlock, toBlock: "latest" });
      events.watch();
      events.get((error: any, event: any) => {
        if (!error) {
          resolve(event);
        } else {
          throw Error("Failed to find filtered event: " + error);
        }
      });
      events.stopWatching();
    });
  };

  const watchAndPrintEvent = async (contract: any, eventName: string) => {
    const events: any = await getEventsFromContract(contract, eventName, 0);

    events.forEach((e: any) => {
      logDebug("event:", util.inspect(e.args, false, null));
    });
  };

  const getTestOrder = (owner: string, broker: string) => {
    const validSince = web3.eth.getBlock(web3.eth.blockNumber).timestamp - 1000;
    const validUntil = web3.eth.getBlock(web3.eth.blockNumber).timestamp + 360000;
    const order: OrderInfo = {
      owner,
      tokenS: rdnAddress,
      tokenB: gtoAddress,
      broker,
      amountS: 1e22,
      amountB: 3e18,
      feeAmount: 15e17,
      dualAuthSignAlgorithm: 0,
      allOrNone: false,
      validSince,
      validUntil,
      walletAddr: wallet,
      walletSplitPercentage: 10,
      tokenRecipient,
      feeToken: lrcAddress,
      waiveFeePercentage: 20,
      tokenSFeePercentage: 30,
      tokenBFeePercentage: 40,
      onChain: true,
    };
    return order;
  };

  const submitOrderChecked = async (order: OrderInfo, transactionOrigin: string) => {
    // Store order data in a bytes array
    const orderUtil = new OrderUtil(undefined);
    const orderData = orderUtil.toOrderBookSubmitParams(order);

    // Calculate the order hash
    const orderHash = "0x" + orderUtil.getOrderHash(order).toString("hex");

    // Check if the order was successfully submitted
    const submittedBefore = await orderBook.orderSubmitted(orderHash);

    // Submit the order
    await orderBook.submitOrder(orderData, {from: transactionOrigin});

    // If the order was successfully submitted that means the order wasn't submitted before
    assert.equal(submittedBefore, false, "order should have not been registered as submitten before");

    // Catch the OrderSubmitted event
    const events: any = await getEventsFromContract(orderBook, "OrderSubmitted", web3.eth.blockNumber);
    const eventOrderHash = events[0].args.orderHash;
    const eventOrderData = events[0].args.orderData;

    // Check event data
    assert.equal(eventOrderHash, orderHash, "onchain order hash needs to match offchain order hash");
    assert.equal(eventOrderData, orderData, "event order data needs to match submitted order data");

    // Check if the order was successfully submitted
    const submittedAfter = await orderBook.orderSubmitted(orderHash);
    assert.equal(submittedAfter, true, "order should be submitted");
  };

  before(async () => {
    lrcAddress = LRCToken.address;
    rdnAddress = RDNToken.address;
    gtoAddress = GTOToken.address;
  });

  beforeEach(async () => {
    // New OrderBook for each test
    orderBook = await OrderBook.new();
  });

  describe("general", () => {
    it("should not be able to submit an order in an incorrect format", async () => {
      const order = getTestOrder(owner1, broker1);
      // Store order data in a bytes array
      const orderUtil = new OrderUtil(undefined);
      let orderData = orderUtil.toOrderBookSubmitParams(order);
      // Add a byte to the data
      orderData = orderData + "00";
      // Try to submit the order
      await expectThrow(orderBook.submitOrder(orderData, {from: order.owner}), "INVALID_SIZE");
    });

    it("orders should default to not submitted", async () => {
      // Check if the order was successfully submitted
      const orderHash = "0x" + "12".repeat(32);
      const submitted = await orderBook.orderSubmitted(orderHash);
      assert.equal(submitted, false, "order should default to not submitted");
    });
  });

  describe("order owner", () => {
    it("should be able to submit his order to order book", async () => {
      const order = getTestOrder(owner1, broker1);
      await submitOrderChecked(order, order.owner);
    });

    it("should not be able to submit the same order twice", async () => {
      const order = getTestOrder(owner2, broker1);
      await submitOrderChecked(order, order.owner);
      await expectThrow(submitOrderChecked(order, order.owner), "ALREADY_EXIST");
    });
  });

  describe("order broker", () => {
    it("should be able to submit an order he's the broker of to order book", async () => {
      const order = getTestOrder(owner1, broker1);
      await submitOrderChecked(order, order.broker);
    });

    it("should not be able to submit the same order twice", async () => {
      const order = getTestOrder(owner2, broker2);
      await submitOrderChecked(order, order.broker);
      await expectThrow(submitOrderChecked(order, order.broker), "ALREADY_EXIST");
    });
  });

  describe("anyone", () => {
    it("should not be able to submit an order he's not the owner/broker of", async () => {
      const order = getTestOrder(owner1, broker1);
      await expectThrow(submitOrderChecked(order, owner2), "UNAUTHORIZED_ONCHAIN_ORDER");
      await expectThrow(submitOrderChecked(order, broker2), "UNAUTHORIZED_ONCHAIN_ORDER");
    });
  });

});
