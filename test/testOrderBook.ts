import { BN } from "bn.js";
import abi = require("ethereumjs-abi");
import util = require("util");
import { Artifacts } from "../util/artifacts";

const {
  OrderBook,
  SymbolRegistry,
} = new Artifacts(artifacts);
contract("OrderBook", (accounts: string[]) => {
  const emptyAddr = "0x0000000000000000000000000000000000000000";
  const orderSubmitter = accounts[1];

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

  // const padString = (x: string, targetLength: number) => {
  //   if (x.length > targetLength) {
  //     throw Error("0x" + x + " is too big to fit in the requested length (" + targetLength + ")");
  //   }
  //   while (x.length < targetLength) {
  //     x = "0" + x;
  //   }
  //   return x;
  // };

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
      const addressArray = [lrcAddress, gtoAddress, emptyAddr];
      const validUntil = Math.floor(new Date().getTime() / 1000) + 3600 * 24 * 30;
      const uintArray = [100e18, 200e18, 0, validUntil, 1e18];
      const allOrNone = false;
      const bytes32Array: string[] = [];
      bytes32Array.push(addressToBytes32Str(orderSubmitter));
      addressArray.forEach((addr) => bytes32Array.push(addressToBytes32Str(addr)));
      uintArray.forEach((value) => bytes32Array.push(numberToBytes32Str(value)));
      if (allOrNone) {
        bytes32Array.push(numberToBytes32Str(1));
      } else {
        bytes32Array.push(numberToBytes32Str(0));
      }

      // console.log("bytes32Array:", bytes32Array);

      const tx = await orderBook.submitOrder(bytes32Array, {from: orderSubmitter});

      const events: any = await getEventsFromContract(orderBook, "OrderSubmitted", 0);
      const orderHash = events[0].args.orderHash;
      // // await watchAndPrintEvent(orderBook, "OrderSubmitted");

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
