import BN = require("bn.js");
import { Constants } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { OrderInfo, RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;

  let exchangeId = 0;

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  beforeEach(async () => {
    // Fresh Exchange for each test
    exchangeId = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      true
    );
  });

  describe("Cancel", function() {
    this.timeout(0);

    it("Cancel (orderToken != feeToken)", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("110", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          orderID: 2 ** Constants.TREE_DEPTH_TRADING_HISTORY - 1
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          orderID: 2
        },
        expected: {
          orderA: {
            filledFraction: 0.0,
            spread: new BN(web3.utils.toWei("0", "ether"))
          },
          orderB: { filledFraction: 0.0 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeId, ring);

      const feeToken = "LRC";
      const feeAmount = new BN(web3.utils.toWei("1.5", "ether"));
      await exchangeTestUtil.depositTo(
        ring.orderB.accountID,
        feeToken,
        feeAmount
      );

      await exchangeTestUtil.commitDeposits(exchangeId);

      await exchangeTestUtil.cancelOrder(ring.orderB, feeToken, feeAmount);
      await exchangeTestUtil.commitCancels(exchangeId);

      await exchangeTestUtil.verifyPendingBlocks(exchangeId);

      await expectThrow(
        exchangeTestUtil.commitRings(exchangeId),
        "invalid block"
      );
    });

    it("Cancel (orderToken == feeToken)", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("110", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          orderID: 2 ** Constants.TREE_DEPTH_TRADING_HISTORY - 1
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          orderID: 2
        },
        expected: {
          orderA: {
            filledFraction: 0.0,
            spread: new BN(web3.utils.toWei("0", "ether"))
          },
          orderB: { filledFraction: 0.0 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeId, ring);

      await exchangeTestUtil.commitDeposits(exchangeId);

      await exchangeTestUtil.cancelOrder(
        ring.orderA,
        "WETH",
        new BN(web3.utils.toWei("1", "ether"))
      );
      await exchangeTestUtil.commitCancels(exchangeId);

      await exchangeTestUtil.verifyPendingBlocks(exchangeId);

      await expectThrow(
        exchangeTestUtil.commitRings(exchangeId),
        "invalid block"
      );
    });

    it("Cancel (owner == operator)", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("110", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          orderID: 2 ** Constants.TREE_DEPTH_TRADING_HISTORY - 1
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          orderID: 2
        },
        expected: {
          orderA: {
            filledFraction: 0.0,
            spread: new BN(web3.utils.toWei("0", "ether"))
          },
          orderB: { filledFraction: 0.0 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeId, ring);

      await exchangeTestUtil.commitDeposits(exchangeId);

      exchangeTestUtil.setActiveOperator(ring.orderA.accountID);

      await exchangeTestUtil.cancelOrder(
        ring.orderA,
        "WETH",
        new BN(web3.utils.toWei("1", "ether"))
      );
      await exchangeTestUtil.commitCancels(exchangeId);

      await exchangeTestUtil.verifyPendingBlocks(exchangeId);

      await expectThrow(
        exchangeTestUtil.commitRings(exchangeId),
        "invalid block"
      );
    });

    it("Reuse trade history slot that was cancelled", async () => {
      const orderID = 123;
      const ring: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          orderID: 4
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          orderID
        },
        expected: {
          orderA: {
            filledFraction: 1.0,
            spread: new BN(web3.utils.toWei("0", "ether"))
          },
          orderB: { filledFraction: 1.0 }
        }
      };

      await exchangeTestUtil.setupRing(ring);

      await exchangeTestUtil.commitDeposits(exchangeId);

      await exchangeTestUtil.cancelOrder(
        ring.orderA,
        "WETH",
        new BN(web3.utils.toWei("0", "ether"))
      );
      await exchangeTestUtil.commitCancels(exchangeId);

      ring.orderA.orderID += 2 ** Constants.TREE_DEPTH_TRADING_HISTORY;
      ring.orderA.signature = undefined;
      exchangeTestUtil.signOrder(ring.orderA);

      await exchangeTestUtil.sendRing(exchangeId, ring);
      await exchangeTestUtil.commitRings(exchangeId);

      await exchangeTestUtil.verifyPendingBlocks(exchangeId);
    });

    it("Cancel an order with orderID > tradeHistory.orderID", async () => {
      const orderID = 1987;
      const ringA: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          orderID: 4
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          orderID
        },
        expected: {
          orderA: {
            filledFraction: 1.0,
            spread: new BN(web3.utils.toWei("0", "ether"))
          },
          orderB: { filledFraction: 1.0 }
        }
      };
      await exchangeTestUtil.setupRing(ringA);

      const ringB: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          orderID: 5
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("400", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          orderID: orderID + 2 ** Constants.TREE_DEPTH_TRADING_HISTORY,
          accountID: ringA.orderB.accountID,
          owner: ringA.orderB.owner
        },
        expected: {
          orderA: {
            filledFraction: 0.0,
            spread: new BN(web3.utils.toWei("0", "ether"))
          },
          orderB: { filledFraction: 0.0 }
        }
      };
      await exchangeTestUtil.setupRing(ringB);

      await exchangeTestUtil.commitDeposits(exchangeId);
      await exchangeTestUtil.sendRing(exchangeId, ringA);
      await exchangeTestUtil.commitRings(exchangeId);

      await exchangeTestUtil.cancelOrder(
        ringB.orderB,
        "WETH",
        new BN(web3.utils.toWei("0", "ether"))
      );
      await exchangeTestUtil.commitCancels(exchangeId);

      await exchangeTestUtil.sendRing(exchangeId, ringB);

      await exchangeTestUtil.verifyPendingBlocks(exchangeId);

      await expectThrow(
        exchangeTestUtil.commitRings(exchangeId),
        "invalid block"
      );
    });

    it("Cancel all orders from an account by changing the account's public key", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether"))
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether"))
        },
        expected: {
          orderA: {
            filledFraction: 0.0,
            spread: new BN(web3.utils.toWei("0", "ether"))
          },
          orderB: { filledFraction: 0.0 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.commitDeposits(exchangeId);

      await exchangeTestUtil.sendRing(exchangeId, ring);

      // Change the account's public key
      await exchangeTestUtil.deposit(
        exchangeId,
        ring.orderB.owner,
        "0",
        "1",
        "0",
        Constants.zeroAddress,
        new BN(0)
      );
      await exchangeTestUtil.commitDeposits(exchangeId);

      // Try to use the ring
      await expectThrow(
        exchangeTestUtil.commitRings(exchangeId),
        "invalid block"
      );
    });
  });
});
