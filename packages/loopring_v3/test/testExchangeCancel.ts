import BN = require("bn.js");
import { Artifacts } from "../util/Artifacts";
import * as constants from "./constants";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { OrderInfo, RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  let exchangeId = 0;

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
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            orderID: 2 ** constants.TREE_DEPTH_TRADING_HISTORY - 1,
          },
        orderB:
          {
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            orderID: 2,
          },
        expected: {
          orderA: { filledFraction: 0.0, spread: new BN(web3.utils.toWei("0", "ether")) },
          orderB: { filledFraction: 0.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeId, ring);

      await exchangeTestUtil.commitDeposits(exchangeId);

      const walletAccountID = exchangeTestUtil.wallets[exchangeId][0].walletAccountID;
      await exchangeTestUtil.cancelOrder(ring.orderA, walletAccountID, "WETH", new BN(web3.utils.toWei("1", "ether")));
      await exchangeTestUtil.commitCancels(exchangeId);

      await exchangeTestUtil.commitRings(exchangeId);

      await exchangeTestUtil.verifyPendingBlocks(exchangeId);
    });

    it("Reuse trade history slot that was cancelled", async () => {
      const orderID = 123;
      const ring: RingInfo = {
        orderA:
          {
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            orderID: 4,
          },
        orderB:
          {
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            orderID,
          },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(web3.utils.toWei("0", "ether")) },
          orderB: { filledFraction: 1.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);

      await exchangeTestUtil.commitDeposits(exchangeId);

      const walletAccountID = exchangeTestUtil.wallets[exchangeId][0].walletAccountID;
      await exchangeTestUtil.cancelOrder(ring.orderA, walletAccountID, "WETH", new BN(web3.utils.toWei("0", "ether")));
      await exchangeTestUtil.commitCancels(exchangeId);

      ring.orderA.orderID += 2 ** constants.TREE_DEPTH_TRADING_HISTORY;
      exchangeTestUtil.signOrder(ring.orderA);

      await exchangeTestUtil.sendRing(exchangeId, ring);
      await exchangeTestUtil.commitRings(exchangeId);

      await exchangeTestUtil.verifyPendingBlocks(exchangeId);
    });

  });
});
