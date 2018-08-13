import BN = require("bn.js");
import abi = require("ethereumjs-abi");
import util = require("util");
import { Artifacts } from "../util/artifacts";
import { expectThrow } from "../util/expectThrow";

const {
  OrderBook,
  SymbolRegistry,
} = new Artifacts(artifacts);
contract("OrderBook", (accounts: string[]) => {
  const emptyAddr = "0x0000000000000000000000000000000000000000";

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

  before(async () => {
    symbolRegistry = await SymbolRegistry.deployed();
    orderBook = await OrderBook.deployed();

    lrcAddress = await symbolRegistry.getAddressBySymbol("LRC");
    rdnAddress = await symbolRegistry.getAddressBySymbol("RDN");
    gtoAddress = await symbolRegistry.getAddressBySymbol("GTO");
  });

  describe("any user", () => {
    it("should be able to submit a order to order book", async () => {
      const addressArray = [lrcAddress, gtoAddress, emptyAddr];
      const validUntil = Math.floor(new Date().getTime() / 1000) + 3600 * 24 * 30;
      const uintArray = [100e18, 200e18, 0, validUntil, 1e18];
      const allOrNone = false;

      const tx = await orderBook.submitOrder(addressArray, uintArray, allOrNone);

      const events: any = await getEventsFromContract(orderBook, "OrderSubmitted", 0);
      // console.log("events:", events);
      const orderHash = events[0].args.orderHash;
      // // await watchAndPrintEvent(orderBook, "OrderSubmitted");

      const orderData = await orderBook.orders(orderHash);
      // console.log("orderData", orderData);

      const submitted = await orderBook.orderSubmitted(orderHash);
      assert.equal(submitted, true, "order should be submitted");
    });
  });
});
