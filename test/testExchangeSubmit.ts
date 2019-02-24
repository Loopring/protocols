import BN = require("bn.js");
import { Artifacts } from "../util/Artifacts";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { OrderInfo, RingInfo } from "./types";

const {
  TESTToken,
} = new Artifacts(artifacts);

contract("Exchange_Submit", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  const zeroAddress = "0x" + "00".repeat(20);

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  describe("submitRing", function() {
    this.timeout(0);

    it("Perfect match", async () => {
      const stateID = 0;
      const ring: RingInfo = {
        orderA:
          {
            stateID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("1000", "ether")),
          },
        orderB:
          {
            stateID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("900", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      await exchangeTestUtil.verifyAllPendingBlocks();
    });

    it("Matchable", async () => {
      const stateID = 0;
      const ring: RingInfo = {
        orderA:
          {
            stateID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            stateID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      await exchangeTestUtil.verifyAllPendingBlocks();
    });

    it.only("Cancel", async () => {
      const stateID = 0;
      const ring: RingInfo = {
        orderA:
          {
            stateID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            stateID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);

      await exchangeTestUtil.cancelOrder(ring.orderA, "WETH", new BN(web3.utils.toWei("1", "ether")));
      await exchangeTestUtil.commitCancels(stateID);

      await exchangeTestUtil.commitRings(stateID);

      await exchangeTestUtil.verifyAllPendingBlocks();
    });

    it("Onchain withdrawal", async () => {
      const stateID = 0;
      const ring: RingInfo = {
        orderA:
          {
            stateID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            stateID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      await exchangeTestUtil.requestWithdrawalOnchain(stateID, ring.orderA.accountID,
                                                      ring.orderA.tokenIdB, ring.orderA.amountB.mul(new BN(2)),
                                                      ring.orderA.owner);
      await exchangeTestUtil.requestWithdrawalOnchain(stateID, ring.orderB.accountID,
                                                      ring.orderB.tokenIdB, ring.orderB.amountB.mul(new BN(2)),
                                                      ring.orderB.owner);
      await exchangeTestUtil.commitOnchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyAllPendingBlocks();
      await exchangeTestUtil.submitPendingWithdrawals(ring);

      await exchangeTestUtil.exchange.withdrawBlockFee(stateID, 4);
    });

    it("Offchain withdrawal", async () => {
      const stateID = 0;
      const ring: RingInfo = {
        orderA:
          {
            stateID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            stateID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      exchangeTestUtil.requestWithdrawalOffchain(stateID, ring.orderA.accountID,
                                                 ring.orderA.tokenIdB, ring.orderA.amountB.mul(new BN(2)));
      exchangeTestUtil.requestWithdrawalOffchain(stateID, ring.orderB.accountID,
                                                 ring.orderB.tokenIdB, ring.orderB.amountB.mul(new BN(2)));
      await exchangeTestUtil.commitOffchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyAllPendingBlocks();
      await exchangeTestUtil.submitPendingWithdrawals(ring);
    });

    it("Offchain wallet fee withdrawal (with burn)", async () => {
      const stateID = 0;
      const ring: RingInfo = {
        orderA:
          {
            stateID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            stateID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      exchangeTestUtil.requestWithdrawalOffchain(stateID, ring.orderA.dualAuthAccountID,
                                                 ring.orderA.tokenIdF, ring.orderA.amountF.mul(new BN(2)));
      exchangeTestUtil.requestWithdrawalOffchain(stateID, ring.orderB.dualAuthAccountID,
                                                 ring.orderB.tokenIdF, ring.orderB.amountF.mul(new BN(2)));
      await exchangeTestUtil.commitOffchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyAllPendingBlocks();
      await exchangeTestUtil.submitPendingWithdrawals(ring);
    });

    it("Separate state", async () => {
      const stateID = await exchangeTestUtil.createNewState(exchangeTestUtil.testContext.miner);
      const operatorAccountID = await exchangeTestUtil.createOperator(stateID);
      const minerAccountID = await exchangeTestUtil.createRingMatcher(stateID);
      const ring: RingInfo = {
        orderA:
          {
            stateID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            stateID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
          minerAccountID,
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID, operatorAccountID);

      await exchangeTestUtil.verifyAllPendingBlocks();
    });

    it("Unmatchable", async () => {
      const stateID = 0;
      const ring: RingInfo = {
        orderA:
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("90", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("1000", "ether")),
            allOrNone: true,
          },
        orderB:
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("1000", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      await exchangeTestUtil.verifyAllPendingBlocks();
    });

    it("Invalid validSince/validUntil", async () => {
      const stateID = 0;
      const ring: RingInfo = {
        orderA:
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("1000", "ether")),
            validSince: 1,
            validUntil: 2,
          },
        orderB:
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("900", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      await exchangeTestUtil.verifyAllPendingBlocks();
    });

    it("Valid allOrNone", async () => {
      const stateID = 0;
      const ring: RingInfo = {
        orderA:
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("1000", "ether")),
            allOrNone: true,
          },
        orderB:
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("400", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("900", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      await exchangeTestUtil.verifyAllPendingBlocks();
    });

    it("Invalid allOrNone", async () => {
      const stateID = 0;
      const ring: RingInfo = {
        orderA:
          {
            index: 0,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("400", "ether")),
            amountF: new BN(web3.utils.toWei("1000", "ether")),
            allOrNone: true,
          },
        orderB:
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("900", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      await exchangeTestUtil.verifyAllPendingBlocks();
    });

    it("ETH", async () => {
      const stateID = 0;
      const ring: RingInfo = {
        orderA:
          {
            index: 0,
            tokenS: "ETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("3", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
        orderB:
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "ETH",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("2", "ether")),
            amountF: new BN(web3.utils.toWei("20", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      exchangeTestUtil.requestWithdrawalOffchain(stateID, ring.orderA.accountID,
                                                 ring.orderA.tokenIdB, ring.orderA.amountB);
      exchangeTestUtil.requestWithdrawalOffchain(stateID, ring.orderB.accountID,
                                                 ring.orderB.tokenIdB, ring.orderB.amountB);
      await exchangeTestUtil.commitOffchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyAllPendingBlocks();
      await exchangeTestUtil.submitPendingWithdrawals(ring);
    });

    it("Multiple rings", async () => {
      const stateID = 0;
      const ringA: RingInfo = {
        orderA:
          {
            index: 0,
            tokenS: "ETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("3", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
        orderB:
          {
            index: 1,
            tokenS: "GTO",
            tokenB: "ETH",
            amountS: new BN(web3.utils.toWei("100", "ether")),
            amountB: new BN(web3.utils.toWei("2", "ether")),
            amountF: new BN(web3.utils.toWei("20", "ether")),
          },
      };
      const ringB: RingInfo = {
        orderA:
          {
            stateID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            stateID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ringA);
      await exchangeTestUtil.setupRing(ringB);
      await exchangeTestUtil.sendRing(stateID, ringA);
      await exchangeTestUtil.sendRing(stateID, ringB);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      await exchangeTestUtil.verifyAllPendingBlocks();
    });

  });
});
