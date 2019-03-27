import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { OrderInfo, RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  let realmID = 0;
  const zeroAddress = "0x" + "00".repeat(20);

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    realmID = 1;
  });

  describe("Trade", function() {
    this.timeout(0);

    it("Perfect match", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("1000", "ether")),
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("900", "ether")),
          },
        expected: {
          orderA: { filledFraction: 1.0, margin: new BN(0) },
          orderB: { filledFraction: 1.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("Matchable (orderA < orderB)", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            amountF: new BN(web3.utils.toWei("1", "ether")),
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("5", "ether")),
            amountB: new BN(web3.utils.toWei("45", "ether")),
            amountF: new BN(web3.utils.toWei("3", "ether")),
          },
        expected: {
          orderA: { filledFraction: 0.5, margin: new BN(web3.utils.toWei("5", "ether")) },
          orderB: { filledFraction: 1.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("Matchable (orderA > orderB)", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "LRC",
            tokenB: "GTO",
            tokenF: "ETH",
            amountS: new BN(web3.utils.toWei("101", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            amountF: new BN(web3.utils.toWei("1", "ether")),
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "LRC",
            tokenF: "ETH",
            amountS: new BN(web3.utils.toWei("20", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("1", "ether")),
          },
        expected: {
          orderA: { filledFraction: 1.0, margin: new BN(web3.utils.toWei("1", "ether")) },
          orderB: { filledFraction: 0.5 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);
    });

    it("No funds available", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "ETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "ETH",
            amountS: new BN(web3.utils.toWei("5", "ether")),
            amountB: new BN(web3.utils.toWei("45", "ether")),
            balanceS: new BN(0),
          },
        expected: {
          orderA: { filledFraction: 0.0, margin: new BN(0) },
          orderB: { filledFraction: 0.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("No fee funds available", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "ETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            balanceF: new BN(0),
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "ETH",
            amountS: new BN(web3.utils.toWei("5", "ether")),
            amountB: new BN(web3.utils.toWei("45", "ether")),
          },
        expected: {
          orderA: { filledFraction: 0.0, margin: new BN(0) },
          orderB: { filledFraction: 0.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("Insufficient fee funds available", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "ETH",
            tokenB: "GTO",
            tokenF: "LRC",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            amountF: new BN(web3.utils.toWei("1", "ether")),
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "ETH",
            tokenF: "LRC",
            amountS: new BN(web3.utils.toWei("5", "ether")),
            amountB: new BN(web3.utils.toWei("45", "ether")),
            amountF: new BN(web3.utils.toWei("10", "ether")),
            balanceF: new BN(web3.utils.toWei("2", "ether")),
          },
        expected: {
          orderA: { filledFraction: 0.1, margin: new BN(web3.utils.toWei("1", "ether")) },
          orderB: { filledFraction: 0.2 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("tokenF == tokenS (sufficient funds)", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "LRC",
            tokenB: "GTO",
            tokenF: "LRC",
            amountS: new BN(web3.utils.toWei("101", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            amountF: new BN(web3.utils.toWei("1", "ether")),
            balanceS: new BN(web3.utils.toWei("102", "ether")),
            balanceF: new BN(0),
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "LRC",
            tokenF: "ETH",
            amountS: new BN(web3.utils.toWei("20", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("1", "ether")),
          },
        expected: {
          orderA: { filledFraction: 1.0, margin: new BN(web3.utils.toWei("1", "ether")) },
          orderB: { filledFraction: 0.5 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);
    });

    it("tokenF == tokenS (insufficient funds)", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "LRC",
            tokenB: "GTO",
            tokenF: "LRC",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            amountF: new BN(web3.utils.toWei("1", "ether")),
            balanceS: new BN(web3.utils.toWei("55.5", "ether")),
            balanceF: new BN(0),
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "LRC",
            tokenF: "ETH",
            amountS: new BN(web3.utils.toWei("20", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("1", "ether")),
          },
        expected: {
          orderA: { filledFraction: 0.5, margin: new BN(web3.utils.toWei("5.0", "ether")) },
          orderB: { filledFraction: 0.25 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);
    });

    it("tokenF == tokenB (amountF <= amountB)", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "ETH",
            tokenB: "LRC",
            tokenF: "LRC",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            amountF: new BN(web3.utils.toWei("1", "ether")),
            balanceF: new BN(0),
          },
        orderB:
          {
            realmID,
            tokenS: "LRC",
            tokenB: "ETH",
            tokenF: "LRC",
            amountS: new BN(web3.utils.toWei("10", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("1", "ether")),
          },
        expected: {
          orderA: { filledFraction: 1.0, margin: new BN(0) },
          orderB: { filledFraction: 1.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);
    });

    it("tokenF == tokenB (amountF > amountB)", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "ETH",
            tokenB: "LRC",
            tokenF: "LRC",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            amountF: new BN(web3.utils.toWei("11", "ether")),
            balanceF: new BN(0),
          },
        orderB:
          {
            realmID,
            tokenS: "LRC",
            tokenB: "ETH",
            tokenF: "LRC",
            amountS: new BN(web3.utils.toWei("10", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("1", "ether")),
          },
        expected: {
          orderA: { filledFraction: 0.0, margin: new BN(0) },
          orderB: { filledFraction: 0.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);
    });

    it("orderA.wallet == orderB.wallet", async () => {
      const wallet = exchangeTestUtil.wallets[realmID][0];
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "ETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            walletAccountID: wallet.walletAccountID,
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "ETH",
            amountS: new BN(web3.utils.toWei("5", "ether")),
            amountB: new BN(web3.utils.toWei("45", "ether")),
            walletAccountID: wallet.walletAccountID,
          },
        expected: {
          orderA: { filledFraction: 0.5, margin: new BN(web3.utils.toWei("5", "ether")) },
          orderB: { filledFraction: 1.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("WalletSplitPercentage == 0", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "ETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            walletSplitPercentage: 0,
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "ETH",
            amountS: new BN(web3.utils.toWei("5", "ether")),
            amountB: new BN(web3.utils.toWei("45", "ether")),
            walletSplitPercentage: 0,
          },
        expected: {
          orderA: { filledFraction: 0.5, margin: new BN(web3.utils.toWei("5", "ether")) },
          orderB: { filledFraction: 1.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("WalletSplitPercentage == 100", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "ETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            walletSplitPercentage: 100,
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "ETH",
            amountS: new BN(web3.utils.toWei("5", "ether")),
            amountB: new BN(web3.utils.toWei("45", "ether")),
            walletSplitPercentage: 100,
          },
        expected: {
          orderA: { filledFraction: 0.5, margin: new BN(web3.utils.toWei("5", "ether")) },
          orderB: { filledFraction: 1.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("allOrNone (successful)", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "ETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            allOrNone: true,
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "ETH",
            amountS: new BN(web3.utils.toWei("20", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
          },
        expected: {
          orderA: { filledFraction: 1.0, margin: new BN(web3.utils.toWei("10", "ether")) },
          orderB: { filledFraction: 0.5 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("allOrNone (unsuccessful)", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "ETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            allOrNone: true,
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "ETH",
            amountS: new BN(web3.utils.toWei("20", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            balanceS: new BN(web3.utils.toWei("5", "ether")),
          },
        expected: {
          orderA: { filledFraction: 0.0, margin: new BN(0) },
          orderB: { filledFraction: 0.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("waiveFeePercentage == 100", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "ETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            waiveFeePercentage: 100,
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "ETH",
            amountS: new BN(web3.utils.toWei("5", "ether")),
            amountB: new BN(web3.utils.toWei("45", "ether")),
            waiveFeePercentage: 0,
          },
        expected: {
          orderA: { filledFraction: 0.5, margin: new BN(web3.utils.toWei("5", "ether")) },
          orderB: { filledFraction: 1.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("Self-trading (same tokenF, sufficient balance)", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("105", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            amountF: new BN(web3.utils.toWei("1", "ether")),
            balanceS: new BN(web3.utils.toWei("105", "ether")),
            balanceB: new BN(web3.utils.toWei("10", "ether")),
            balanceF: new BN(web3.utils.toWei("3", "ether")),
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("10", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("1", "ether")),
          },
        expected: {
          orderA: { filledFraction: 1.0, margin: new BN(web3.utils.toWei("5", "ether")) },
          orderB: { filledFraction: 1.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);

      ring.orderB.accountID = ring.orderA.accountID;
      ring.orderB.walletAccountID = ring.orderA.walletAccountID;

      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("Self-trading (same tokenF, insufficient balance)", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            amountF: new BN(web3.utils.toWei("1", "ether")),
            balanceS: new BN(web3.utils.toWei("100", "ether")),
            balanceB: new BN(web3.utils.toWei("10", "ether")),
            balanceF: new BN(web3.utils.toWei("1", "ether")),
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("10", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("1", "ether")),
          },
        expected: {
          orderA: { filledFraction: 0.0, margin: new BN(0) },
          orderB: { filledFraction: 0.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);

      ring.orderB.accountID = ring.orderA.accountID;
      ring.orderB.walletAccountID = ring.orderA.walletAccountID;

      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("selling token with decimals == 0", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "INDA",
            tokenB: "WETH",
            amountS: new BN(60),
            amountB: new BN(web3.utils.toWei("5", "ether")),
            amountF: new BN(web3.utils.toWei("1", "ether")),
          },
        orderB:
          {
            realmID,
            tokenS: "WETH",
            tokenB: "INDA",
            amountS: new BN(web3.utils.toWei("2.5", "ether")),
            amountB: new BN(25),
            amountF: new BN(web3.utils.toWei("3", "ether")),
          },
        expected: {
          orderA: { filledFraction: 0.5, margin: new BN(5) },
          orderB: { filledFraction: 1.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("fillAmountB rounding error > 1%", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "INDA",
            tokenB: "INDB",
            amountS: new BN(20),
            amountB: new BN(200),
            amountF: new BN(web3.utils.toWei("1", "ether")),
          },
        orderB:
          {
            realmID,
            tokenS: "INDB",
            tokenB: "INDA",
            amountS: new BN(200),
            amountB: new BN(20),
            amountF: new BN(web3.utils.toWei("3", "ether")),
            balanceS: new BN(199),
          },
        expected: {
          orderA: { filledFraction: 0.0, margin: new BN(0) },
          orderB: { filledFraction: 0.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("fillAmountB is 0 because of rounding error", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "INDA",
            tokenB: "INDB",
            amountS: new BN(1),
            amountB: new BN(10),
            amountF: new BN(web3.utils.toWei("1", "ether")),
          },
        orderB:
          {
            realmID,
            tokenS: "INDB",
            tokenB: "INDA",
            amountS: new BN(10),
            amountB: new BN(1),
            amountF: new BN(web3.utils.toWei("3", "ether")),
            balanceS: new BN(5),
          },
        expected: {
          orderA: { filledFraction: 0.0, margin: new BN(0) },
          orderB: { filledFraction: 0.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("Separate state", async () => {
      const differentRealmID = await exchangeTestUtil.createExchange(
        exchangeTestUtil.testContext.stateOwners[1],
        true,
        new BN(web3.utils.toWei("0.0001", "ether")),
        new BN(web3.utils.toWei("0.0001", "ether")),
      );
      const [minerAccountID, feeRecipientAccountID] = await exchangeTestUtil.createRingMatcher(
        differentRealmID,
        exchangeTestUtil.testContext.ringMatchers[1],
        exchangeTestUtil.testContext.feeRecipients[1],
      );
      const ring: RingInfo = {
        orderA:
          {
            differentRealmID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            differentRealmID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
          minerAccountID,
          feeRecipientAccountID,
        expected: {
          orderA: { filledFraction: 1.0, margin: new BN(web3.utils.toWei("10", "ether")) },
          orderB: { filledFraction: 1.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("tokenS/tokenB mismatch", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "ETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            waiveFeePercentage: 100,
          },
        orderB:
          {
            realmID,
            tokenS: "LRC",
            tokenB: "ETH",
            amountS: new BN(web3.utils.toWei("5", "ether")),
            amountB: new BN(web3.utils.toWei("45", "ether")),
            waiveFeePercentage: 0,
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      try {
        await exchangeTestUtil.commitRings(realmID);
        assert(false);
      } catch {
        exchangeTestUtil.cancelPendingRings(realmID);
      }
    });

    it("Unmatchable", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("90", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("1000", "ether")),
            allOrNone: true,
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("1000", "ether")),
          },
        expected: {
          orderA: { filledFraction: 0.0, margin: new BN(0) },
          orderB: { filledFraction: 0.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("validUntil < now", async () => {
      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("1000", "ether")),
            validUntil: 1,
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("900", "ether")),
          },
        expected: {
          orderA: { filledFraction: 0.0, margin: new BN(0) },
          orderB: { filledFraction: 0.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("validSince > now", async () => {

      const ring: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("1000", "ether")),
            validSince: 0xFFFFFFFF,
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("900", "ether")),
          },
        expected: {
          orderA: { filledFraction: 0.0, margin: new BN(0) },
          orderB: { filledFraction: 0.0 },
        },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(realmID, ring);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("Multiple rings", async () => {
      const ringA: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "ETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("3", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "ETH",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("2", "ether")),
            amountF: new BN(web3.utils.toWei("20", "ether")),
          },
        expected: {
          orderA: { filledFraction: 1.0, margin: new BN(web3.utils.toWei("1", "ether")) },
          orderB: { filledFraction: 1.0 },
        },
      };
      const ringB: RingInfo = {
        orderA:
          {
            realmID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
        expected: {
          orderA: { filledFraction: 1.0, margin: new BN(web3.utils.toWei("10", "ether")) },
          orderB: { filledFraction: 1.0 },
        },
      };

      await exchangeTestUtil.setupRing(ringA);
      await exchangeTestUtil.setupRing(ringB);
      await exchangeTestUtil.sendRing(realmID, ringA);
      await exchangeTestUtil.sendRing(realmID, ringB);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

    it("Order filled in multiple rings", async () => {
      const order: OrderInfo = {
        realmID,
        tokenS: "ETH",
        tokenB: "GTO",
        amountS: new BN(web3.utils.toWei("10", "ether")),
        amountB: new BN(web3.utils.toWei("100", "ether")),
        amountF: new BN(web3.utils.toWei("50", "ether")),
      };
      await exchangeTestUtil.setupOrder(order, 0);

      const ringA: RingInfo = {
        orderA: order,
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "ETH",
            amountS: new BN(web3.utils.toWei("60", "ether")),
            amountB: new BN(web3.utils.toWei("6", "ether")),
          },
        expected: {
          orderA: { filledFraction: 0.6, margin: new BN(web3.utils.toWei("0", "ether")) },
          orderB: { filledFraction: 1.0 },
        },
      };
      const ringB: RingInfo = {
        orderA: order,
        orderB:
          {
            realmID,
            tokenS: "GTO",
            tokenB: "ETH",
            amountS: new BN(web3.utils.toWei("120", "ether")),
            amountB: new BN(web3.utils.toWei("12", "ether")),
          },
        expected: {
          orderA: { filledFraction: 0.4, margin: new BN(web3.utils.toWei("0", "ether")) },
          orderB: { filledFraction: 0.33333 },
        },
      };

      await exchangeTestUtil.setupRing(ringA, false, true);
      await exchangeTestUtil.setupRing(ringB, false, true);
      await exchangeTestUtil.sendRing(realmID, ringA);
      await exchangeTestUtil.sendRing(realmID, ringB);

      await exchangeTestUtil.commitDeposits(realmID);
      await exchangeTestUtil.commitRings(realmID);

      // await exchangeTestUtil.verifyPendingBlocks(realmID);
    });

  });
});
