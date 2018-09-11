import { BN } from "bn.js";
import abi = require("ethereumjs-abi");
import { Artifacts, OrderInfo, OrderUtil } from "protocol2-js";
import util = require("util");

const {
  OrderBook,
  SymbolRegistry,
} = new Artifacts(artifacts);
contract("OrderBook", (accounts: string[]) => {
  const emptyAddr = "0x0000000000000000000000000000000000000000";
  const orderOwner = accounts[1];

  let symbolRegistry: any;
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
      console.log("event:", util.inspect(e.args, false, null));
    });
  };

  const numberToBytes32Str = (n: number) => {
    const encoded = abi.rawEncode(["uint256"], [new BN(n.toString(10), 10)]);
    return "0x" + encoded.toString("hex");
  };

  const addressToBytes32Str = (addr: string) => {
    const encoded = abi.rawEncode(["address"], [addr]);
    return "0x" + encoded.toString("hex");
  };

  before(async () => {
    symbolRegistry = await SymbolRegistry.deployed();
    orderBook = await OrderBook.deployed();

    lrcAddress = await symbolRegistry.getAddressBySymbol("LRC");
    rdnAddress = await symbolRegistry.getAddressBySymbol("RDN");
    gtoAddress = await symbolRegistry.getAddressBySymbol("GTO");
  });

  describe("any user", () => {
    it("should be able to submit a order to order book", async () => {
      const validSince = web3.eth.getBlock(web3.eth.blockNumber).timestamp - 1000;
      const validUntil = web3.eth.getBlock(web3.eth.blockNumber).timestamp + 360000;

      const orderInfo: OrderInfo = {
        owner: orderOwner,
        tokenS: lrcAddress,
        tokenB: gtoAddress,
        broker: "0x0",
        amountS: 100e18,
        amountB: 200e18,
        validSince,
        validUntil,
        feeAmount: 1e18,
        allOrNone: false,
      };

      const orderUtil = new OrderUtil(undefined);

      const bytes32Array = orderUtil.toOrderBookSubmitParams(orderInfo);

      const tx = await orderBook.submitOrder(bytes32Array);

      const events: any = await getEventsFromContract(orderBook, "OrderSubmitted", 0);
      const orderHash = events[0].args.orderHash;

      // console.log("orderHash:", orderHash);
      const orderData = await orderBook.getOrderData(orderHash);
      // console.log("orderData", orderData);
      for (let i = 0; i < orderData.length; i++) {
        assert.equal(orderData[i], bytes32Array[i], "order data changed");
      }

      const submitted = await orderBook.orderSubmitted(orderHash);
      assert.equal(submitted, true, "order should be submitted");
    });
  });

});
