import { BN } from "bn.js";
import abi = require("ethereumjs-abi");
import { expectThrow, OrderInfo, OrderUtil } from "protocol2-js";
import util = require("util");
import { Artifacts } from "../util/Artifacts";

const {
  OrderRegistry,
  LRCToken,
  GTOToken,
} = new Artifacts(artifacts);
contract("OrderRegistry", (accounts: string[]) => {
  const orderOwner = accounts[1];

  let orderRegistry: any;

  let lrcAddress: string;
  let gtoAddress: string;

  const createOrder = () => {
    const orderInfo: OrderInfo = {
      owner: orderOwner,
      tokenS: lrcAddress,
      tokenB: gtoAddress,
      broker: "0xdca66846a7123afe448f13f013ee83fbc33344e3",
      amountS: 1e+22,
      amountB: 3000000000000000000,
      feeAmount: 1000000000000000000,
      dualAuthSignAlgorithm: 0,
      allOrNone: false,
      validSince: 1669907153,
      validUntil: 1769907153,
      walletAddr: "0xdca66846a7123afe448f13f013ee83fbc33344e3",
      walletSplitPercentage: 10,
      tokenRecipient: "0xa826c89cb23f99d8e2a754d1a85c13b37309b722",
      feeToken: "0x40efda0416446e83cdc6ec3d143bec4f82827478",
      waiveFeePercentage: 0,
      tokenSFeePercentage: 0,
      tokenBFeePercentage: 0,
      onChain: true,
    };
    return orderInfo;
  };

  before(async () => {
    lrcAddress = LRCToken.address;
    gtoAddress = GTOToken.address;
  });

  beforeEach(async () => {
    // New OrderRegistry for each test
    orderRegistry = await OrderRegistry.new();
  });

  describe("any user", () => {
    it("should be able to register an order hash", async () => {
      const orderInfo = createOrder();

      // Calculate the order hash
      const orderUtil = new OrderUtil(undefined);
      const orderHash =  orderUtil.getOrderHash(orderInfo);
      const orderHashHex = "0x" + orderHash.toString("hex");

      // Register the order hash
      await orderRegistry.registerOrderHash(orderHashHex, {from: orderOwner});

      // Check if the order was successfully registered
      const registered = await orderRegistry.isOrderHashRegistered(orderOwner, orderHashHex);
      assert.equal(registered, true, "order hash should be registered");
    });

    it("should not be able to register an order hash twice", async () => {
      const orderInfo = createOrder();

      // Calculate the order hash
      const orderUtil = new OrderUtil(undefined);
      const orderHash =  orderUtil.getOrderHash(orderInfo);
      const orderHashHex = "0x" + orderHash.toString("hex");

      // Register the order hash
      await orderRegistry.registerOrderHash(orderHashHex, {from: orderOwner});

      // Check if the order was successfully registered
      const registered = await orderRegistry.isOrderHashRegistered(orderOwner, orderHashHex);
      assert.equal(registered, true, "order hash should be registered");

      // Try to register the order hash again
      await expectThrow(orderRegistry.registerOrderHash(orderHashHex, {from: orderOwner}));
    });
  });

});
