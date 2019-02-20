import BN = require("bn.js");
import { Artifacts } from "../util/Artifacts";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { OrderInfo, RingInfo, RingsInfo } from "./types";

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
      const ringsInfo: RingsInfo = {
        rings : [
          {
            orderA:
              {
                index: 0,
                tokenS: "WETH",
                tokenB: "GTO",
                amountS: new BN(web3.utils.toWei("110", "ether")),
                amountB: new BN(web3.utils.toWei("200", "ether")),
                amountF: new BN(web3.utils.toWei("1000", "ether")),
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
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      await exchangeTestUtil.commitRings(ringsInfo);

      // Withdraw the tokens that were bought
      const orderA = ringsInfo.rings[0].orderA;
      const orderB = ringsInfo.rings[0].orderB;
      /*exchangeTestUtil.requestWithdrawalOffchain(ringsInfo.stateID, orderA.accountID,
                                                 orderA.tokenIdB, orderA.amountB.mul(new BN(2)));
      exchangeTestUtil.requestWithdrawalOffchain(ringsInfo.stateID, orderB.accountID,
                                                 orderB.tokenIdB, orderB.amountB.mul(new BN(2)));
      await exchangeTestUtil.commitOffchainWithdrawalRequests(ringsInfo.stateID);*/
      await exchangeTestUtil.requestWithdrawalOnchain(ringsInfo.stateID, orderA.accountID,
                                                      orderA.tokenIdB, orderA.amountB.mul(new BN(2)), orderA.owner);
      await exchangeTestUtil.requestWithdrawalOnchain(ringsInfo.stateID, orderB.accountID,
                                                      orderB.tokenIdB, orderB.amountB.mul(new BN(2)), orderB.owner);
      await exchangeTestUtil.commitOnchainWithdrawalRequests(ringsInfo.stateID);
      await exchangeTestUtil.verifyAllPendingBlocks();
      await exchangeTestUtil.submitPendingWithdrawals(ringsInfo);
    });

    it("Matchable", async () => {
      const ringsInfo: RingsInfo = {
        rings : [
          {
            orderA:
              {
                index: 0,
                tokenS: "WETH",
                tokenB: "GTO",
                amountS: new BN(web3.utils.toWei("110", "ether")),
                amountB: new BN(web3.utils.toWei("200", "ether")),
                amountF: new BN(web3.utils.toWei("100", "ether")),
              },
            orderB:
              {
                index: 1,
                tokenS: "GTO",
                tokenB: "WETH",
                amountS: new BN(web3.utils.toWei("200", "ether")),
                amountB: new BN(web3.utils.toWei("100", "ether")),
                amountF: new BN(web3.utils.toWei("90", "ether")),
              },
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      await exchangeTestUtil.commitRings(ringsInfo);

      await exchangeTestUtil.verifyAllPendingBlocks();
    });

    it.only("Cancel", async () => {
      const ringsInfo: RingsInfo = {
        rings : [
          {
            orderA:
              {
                index: 0,
                tokenS: "WETH",
                tokenB: "GTO",
                amountS: new BN(web3.utils.toWei("110", "ether")),
                amountB: new BN(web3.utils.toWei("200", "ether")),
                amountF: new BN(web3.utils.toWei("100", "ether")),
              },
            orderB:
              {
                index: 1,
                tokenS: "GTO",
                tokenB: "WETH",
                amountS: new BN(web3.utils.toWei("200", "ether")),
                amountB: new BN(web3.utils.toWei("100", "ether")),
                amountF: new BN(web3.utils.toWei("90", "ether")),
              },
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);

      await exchangeTestUtil.cancelOrder(ringsInfo.stateID, ringsInfo.rings[0].orderA);
      await exchangeTestUtil.commitCancels(ringsInfo.stateID);
      await exchangeTestUtil.commitRings(ringsInfo);

      await exchangeTestUtil.verifyAllPendingBlocks();
    });

    it("Separate state", async () => {
      // Create a new state
      const stateID = await exchangeTestUtil.createNewState(exchangeTestUtil.testContext.miner);

      const ringsInfo: RingsInfo = {
        stateID,
        rings : [
          {
            orderA:
              {
                stateID,
                index: 0,
                tokenS: "WETH",
                tokenB: "GTO",
                amountS: new BN(web3.utils.toWei("110", "ether")),
                amountB: new BN(web3.utils.toWei("200", "ether")),
                amountF: new BN(web3.utils.toWei("100", "ether")),
              },
            orderB:
              {
                stateID,
                index: 1,
                tokenS: "GTO",
                tokenB: "WETH",
                amountS: new BN(web3.utils.toWei("200", "ether")),
                amountB: new BN(web3.utils.toWei("100", "ether")),
                amountF: new BN(web3.utils.toWei("90", "ether")),
              },
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      await exchangeTestUtil.commitRings(ringsInfo);
    });

    it("Unmatchable", async () => {
      const ringsInfo: RingsInfo = {
        rings : [
          {
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
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      await exchangeTestUtil.commitRings(ringsInfo);
    });

    it("Invalid validSince/validUntil", async () => {
      const ringsInfo: RingsInfo = {
        rings : [
          {
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
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      await exchangeTestUtil.commitRings(ringsInfo);
    });

    it("Valid allOrNone", async () => {
      const ringsInfo: RingsInfo = {
        rings : [
          {
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
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      await exchangeTestUtil.commitRings(ringsInfo);
    });

    it("Invalid allOrNone", async () => {
      const ringsInfo: RingsInfo = {
        rings : [
          {
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
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      await exchangeTestUtil.commitRings(ringsInfo);
    });

    it("ETH", async () => {
      const ringsInfo: RingsInfo = {
        rings : [
          {
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
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      await exchangeTestUtil.commitRings(ringsInfo);

      // Withdraw the tokens that were bought
      const orderA = ringsInfo.rings[0].orderA;
      const orderB = ringsInfo.rings[0].orderB;
      exchangeTestUtil.requestWithdrawalOffchain(ringsInfo.stateID, orderA.accountID,
                                                 orderA.tokenIdB, orderA.amountB);
      exchangeTestUtil.requestWithdrawalOffchain(ringsInfo.stateID, orderB.accountID,
                                                 orderB.tokenIdB, orderB.amountB);
      await exchangeTestUtil.commitOffchainWithdrawalRequests(ringsInfo.stateID);
      await exchangeTestUtil.verifyAllPendingBlocks();
      await exchangeTestUtil.submitPendingWithdrawals(ringsInfo);
    });

    it("Multiple rings", async () => {
      const ringsInfo: RingsInfo = {
        rings : [
          {
            orderA:
              {
                index: 0,
                tokenS: "WETH",
                tokenB: "GTO",
                amountS: new BN(web3.utils.toWei("110", "ether")),
                amountB: new BN(web3.utils.toWei("200", "ether")),
                amountF: new BN(web3.utils.toWei("100", "ether")),
              },
            orderB:
              {
                index: 1,
                tokenS: "GTO",
                tokenB: "WETH",
                amountS: new BN(web3.utils.toWei("200", "ether")),
                amountB: new BN(web3.utils.toWei("100", "ether")),
                amountF: new BN(web3.utils.toWei("90", "ether")),
              },
          },
          {
            orderA:
              {
                index: 0,
                tokenS: "REP",
                tokenB: "RDN",
                amountS: new BN(web3.utils.toWei("50", "ether")),
                amountB: new BN(web3.utils.toWei("10", "ether")),
                amountF: new BN(web3.utils.toWei("1", "ether")),
              },
            orderB:
              {
                index: 1,
                tokenS: "RDN",
                tokenB: "REP",
                amountS: new BN(web3.utils.toWei("10", "ether")),
                amountB: new BN(web3.utils.toWei("50", "ether")),
                amountF: new BN(web3.utils.toWei("1", "ether")),
              },
          },
          {
            orderA:
              {
                index: 0,
                tokenS: "REP",
                tokenB: "RDN",
                amountS: new BN(web3.utils.toWei("50", "ether")),
                amountB: new BN(web3.utils.toWei("10", "ether")),
                amountF: new BN(web3.utils.toWei("1", "ether")),
              },
            orderB:
              {
                index: 1,
                tokenS: "RDN",
                tokenB: "REP",
                amountS: new BN(web3.utils.toWei("10", "ether")),
                amountB: new BN(web3.utils.toWei("50", "ether")),
                amountF: new BN(web3.utils.toWei("1", "ether")),
              },
          },
          {
            orderA:
              {
                index: 0,
                tokenS: "REP",
                tokenB: "RDN",
                amountS: new BN(web3.utils.toWei("50", "ether")),
                amountB: new BN(web3.utils.toWei("10", "ether")),
                amountF: new BN(web3.utils.toWei("1", "ether")),
              },
            orderB:
              {
                index: 1,
                tokenS: "RDN",
                tokenB: "REP",
                amountS: new BN(web3.utils.toWei("10", "ether")),
                amountB: new BN(web3.utils.toWei("50", "ether")),
                amountF: new BN(web3.utils.toWei("1", "ether")),
              },
          },
          {
            orderA:
              {
                index: 0,
                tokenS: "WETH",
                tokenB: "GTO",
                amountS: new BN(web3.utils.toWei("110", "ether")),
                amountB: new BN(web3.utils.toWei("200", "ether")),
                amountF: new BN(web3.utils.toWei("100", "ether")),
              },
            orderB:
              {
                index: 1,
                tokenS: "GTO",
                tokenB: "WETH",
                amountS: new BN(web3.utils.toWei("200", "ether")),
                amountB: new BN(web3.utils.toWei("100", "ether")),
                amountF: new BN(web3.utils.toWei("90", "ether")),
              },
          },
          {
            orderA:
              {
                index: 0,
                tokenS: "REP",
                tokenB: "RDN",
                amountS: new BN(web3.utils.toWei("50", "ether")),
                amountB: new BN(web3.utils.toWei("10", "ether")),
                amountF: new BN(web3.utils.toWei("1", "ether")),
              },
            orderB:
              {
                index: 1,
                tokenS: "RDN",
                tokenB: "REP",
                amountS: new BN(web3.utils.toWei("10", "ether")),
                amountB: new BN(web3.utils.toWei("50", "ether")),
                amountF: new BN(web3.utils.toWei("1", "ether")),
              },
          },
          {
            orderA:
              {
                index: 0,
                tokenS: "REP",
                tokenB: "RDN",
                amountS: new BN(web3.utils.toWei("50", "ether")),
                amountB: new BN(web3.utils.toWei("10", "ether")),
                amountF: new BN(web3.utils.toWei("1", "ether")),
              },
            orderB:
              {
                index: 1,
                tokenS: "RDN",
                tokenB: "REP",
                amountS: new BN(web3.utils.toWei("10", "ether")),
                amountB: new BN(web3.utils.toWei("50", "ether")),
                amountF: new BN(web3.utils.toWei("1", "ether")),
              },
          },
          {
            orderA:
              {
                index: 0,
                tokenS: "REP",
                tokenB: "RDN",
                amountS: new BN(web3.utils.toWei("50", "ether")),
                amountB: new BN(web3.utils.toWei("10", "ether")),
                amountF: new BN(web3.utils.toWei("1", "ether")),
              },
            orderB:
              {
                index: 1,
                tokenS: "RDN",
                tokenB: "REP",
                amountS: new BN(web3.utils.toWei("10", "ether")),
                amountB: new BN(web3.utils.toWei("50", "ether")),
                amountF: new BN(web3.utils.toWei("1", "ether")),
              },
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      await exchangeTestUtil.commitRings(ringsInfo);

      await exchangeTestUtil.verifyAllPendingBlocks();
    });

  });
});
