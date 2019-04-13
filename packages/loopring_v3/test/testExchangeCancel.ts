import BN = require("bn.js");
import { Artifacts } from "../util/Artifacts";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { OrderInfo, RingInfo } from "./types";

const {
  TESTToken,
} = new Artifacts(artifacts);

contract("Exchange", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  let exchangeId = 0;

  const bVerify = true;

  const verify = async () => {
    if (bVerify) {
      await exchangeTestUtil.verifyPendingBlocks(exchangeId);
    }
  };

  const zeroAddress = "0x" + "00".repeat(20);

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  beforeEach(async () => {
    // Fresh Exchange for each test
    exchangeId = await exchangeTestUtil.createExchange(exchangeTestUtil.testContext.stateOwners[0], true);
  });

  describe("Cancel", function() {
    this.timeout(0);

    it("Cancel", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID: exchangeId,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
            orderID: 1,
          },
        orderB:
          {
            realmID: exchangeId,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
            orderID: 2,
          },
        expected: {
          orderA: { filledFraction: 0.0, margin: new BN(web3.utils.toWei("0", "ether")) },
          orderB: { filledFraction: 0.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeId, ring);

      await exchangeTestUtil.commitDeposits(exchangeId);

      await exchangeTestUtil.cancelOrder(ring.orderA, "WETH", new BN(web3.utils.toWei("1", "ether")));
      await exchangeTestUtil.commitCancels(exchangeId);

      await exchangeTestUtil.commitRings(exchangeId);

      await exchangeTestUtil.verifyPendingBlocks(exchangeId);
    });

    it("Reuse trade history slot that was cancelled", async () => {
      const orderID = 123;
      const ring: RingInfo = {
        orderA:
          {
            realmID: exchangeId,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
            orderID: 4,
          },
        orderB:
          {
            realmID: exchangeId,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
            orderID,
          },
        expected: {
          orderA: { filledFraction: 1.0, margin: new BN(web3.utils.toWei("0", "ether")) },
          orderB: { filledFraction: 1.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeId, ring);

      await exchangeTestUtil.commitDeposits(exchangeId);

      await exchangeTestUtil.commitCancels(exchangeId);

      ring.orderA.orderID += 2 ** exchangeTestUtil.TREE_DEPTH_TRADING_HISTORY;

      await exchangeTestUtil.commitRings(exchangeId);

      await exchangeTestUtil.verifyPendingBlocks(exchangeId);
    });

  });
});
