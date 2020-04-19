import BN = require("bn.js");
import { Constants, Signature } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { OrderInfo, RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;

  let exchangeID = 0;

  const bVerify = true;

  const verify = async () => {
    if (bVerify) {
      await exchangeTestUtil.submitPendingBlocks(exchangeID);
    }
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    exchangeID = 1;
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  beforeEach(async () => {
    // Fresh Exchange for each test
    exchangeID = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      true
    );
  });

  describe("Trade", function() {
    this.timeout(0);

    it("Perfect match", async () => {
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
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      await verify();
    });

    it("Matchable (orderA < orderB)", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("10", "ether"))
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("5", "ether")),
          amountB: new BN(web3.utils.toWei("45", "ether"))
        },
        expected: {
          orderA: {
            filledFraction: 0.5,
            spread: new BN(web3.utils.toWei("5", "ether"))
          },
          orderB: { filledFraction: 1.0 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      await verify();
    });

    it("Matchable (orderA > orderB)", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "LRC",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("101", "ether")),
          amountB: new BN(web3.utils.toWei("10", "ether"))
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "LRC",
          amountS: new BN(web3.utils.toWei("20", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether"))
        },
        expected: {
          orderA: {
            filledFraction: 1.0,
            spread: new BN(web3.utils.toWei("1", "ether"))
          },
          orderB: { filledFraction: 0.5 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      await verify();
    });

    it("Market buy (single ring)", async () => {
      const order: OrderInfo = {
        tokenS: "WETH",
        tokenB: "GTO",
        amountS: new BN(web3.utils.toWei("101", "ether")),
        amountB: new BN(web3.utils.toWei("100", "ether")),
        owner: exchangeTestUtil.testContext.orderOwners[0],
        maxFeeBips: 30,
        rebateBips: 0,
        buy: true
      };
      await exchangeTestUtil.setupOrder(order, 0);

      const spread = new BN(web3.utils.toWei("1", "ether"));
      const ringA: RingInfo = {
        orderA: order,
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[1],
          maxFeeBips: 0,
          rebateBips: 20,
          buy: false
        },
        expected: {
          orderA: { filledFraction: 1.0, spread },
          orderB: { filledFraction: 0.5 }
        }
      };

      await exchangeTestUtil.setupRing(ringA, false, true);
      await exchangeTestUtil.sendRing(exchangeID, ringA);

      const operatorAccountID = await exchangeTestUtil.getActiveOperator(
        exchangeID
      );
      await exchangeTestUtil.depositTo(
        operatorAccountID,
        ringA.orderB.tokenB,
        ringA.orderB.amountB
      );

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      // tokenS
      const exptectedBalanceS = spread;
      await exchangeTestUtil.checkOffchainBalance(
        order.accountID,
        order.tokenIdS,
        exptectedBalanceS,
        "BalanceS unexpected"
      );
      // tokenB
      const expectedFee = order.amountB
        .mul(new BN(order.maxFeeBips))
        .div(new BN(10000));
      const exptectedBalanceB = order.amountB.sub(expectedFee);
      await exchangeTestUtil.checkOffchainBalance(
        order.accountID,
        order.tokenIdB,
        exptectedBalanceB,
        "BalanceB unexpected"
      );

      await verify();
    });

    it("Market buy (multiple rings)", async () => {
      const order: OrderInfo = {
        tokenS: "WETH",
        tokenB: "GTO",
        amountS: new BN(web3.utils.toWei("110", "ether")),
        amountB: new BN(web3.utils.toWei("100", "ether")),
        owner: exchangeTestUtil.testContext.orderOwners[0],
        maxFeeBips: 25,
        rebateBips: 0,
        buy: true
      };
      await exchangeTestUtil.setupOrder(order, 0);

      const spread = new BN(web3.utils.toWei("5", "ether"));
      const ringA: RingInfo = {
        orderA: order,
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("50", "ether")),
          amountB: new BN(web3.utils.toWei("50", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[1],
          maxFeeBips: 0,
          rebateBips: 20,
          buy: false
        },
        expected: {
          orderA: { filledFraction: 0.5, spread },
          orderB: { filledFraction: 1.0 }
        }
      };
      const ringB: RingInfo = {
        orderA: order,
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("220", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[2],
          maxFeeBips: 0,
          rebateBips: 10,
          buy: false
        },
        expected: {
          orderA: {
            filledFraction: 0.5,
            spread: new BN(web3.utils.toWei("0", "ether"))
          },
          orderB: { filledFraction: 0.25 }
        }
      };

      await exchangeTestUtil.setupRing(ringA, false, true);
      await exchangeTestUtil.setupRing(ringB, false, true);
      await exchangeTestUtil.sendRing(exchangeID, ringA);
      await exchangeTestUtil.sendRing(exchangeID, ringB);

      const operatorAccountID = await exchangeTestUtil.getActiveOperator(
        exchangeID
      );
      await exchangeTestUtil.depositTo(
        operatorAccountID,
        ringA.orderB.tokenB,
        ringA.orderB.amountB
      );
      await exchangeTestUtil.depositTo(
        operatorAccountID,
        ringB.orderB.tokenB,
        ringB.orderB.amountB
      );

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      // tokenS
      const exptectedBalanceS = spread;
      await exchangeTestUtil.checkOffchainBalance(
        order.accountID,
        order.tokenIdS,
        exptectedBalanceS,
        "BalanceS unexpected"
      );
      // tokenB
      const expectedFee = order.amountB
        .mul(new BN(order.maxFeeBips))
        .div(new BN(10000));
      const exptectedBalance = order.amountB.sub(expectedFee);
      await exchangeTestUtil.checkOffchainBalance(
        order.accountID,
        order.tokenIdB,
        exptectedBalance,
        "BalanceB unexpected"
      );

      await verify();
    });

    it("Market sell (single ring)", async () => {
      const order: OrderInfo = {
        tokenS: "WETH",
        tokenB: "GTO",
        amountS: new BN(web3.utils.toWei("1000", "ether")),
        amountB: new BN(web3.utils.toWei("99", "ether")),
        owner: exchangeTestUtil.testContext.orderOwners[0],
        maxFeeBips: 30,
        rebateBips: 0,
        buy: false
      };
      await exchangeTestUtil.setupOrder(order, 0);

      const spread = new BN(web3.utils.toWei("1", "ether"));
      const ringA: RingInfo = {
        orderA: order,
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("2000", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[1],
          maxFeeBips: 0,
          rebateBips: 20,
          buy: false
        },
        expected: {
          orderA: { filledFraction: 1.0, spread },
          orderB: { filledFraction: 0.5 }
        }
      };

      await exchangeTestUtil.setupRing(ringA, false, true);
      await exchangeTestUtil.sendRing(exchangeID, ringA);

      const operatorAccountID = await exchangeTestUtil.getActiveOperator(
        exchangeID
      );
      await exchangeTestUtil.depositTo(
        operatorAccountID,
        ringA.orderB.tokenB,
        ringA.orderB.amountB
      );

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      // tokenS
      await exchangeTestUtil.checkOffchainBalance(
        order.accountID,
        order.tokenIdS,
        new BN(0),
        "BalanceS unexpected"
      );
      // tokenB
      const expectedFee = order.amountB
        .add(spread)
        .mul(new BN(order.maxFeeBips))
        .div(new BN(10000));
      const exptectedBalance = order.amountB.add(spread).sub(expectedFee);
      await exchangeTestUtil.checkOffchainBalance(
        order.accountID,
        order.tokenIdB,
        exptectedBalance,
        "BalanceB unexpected"
      );

      await verify();
    });

    it("Market sell (multiple rings)", async () => {
      const order: OrderInfo = {
        tokenS: "WETH",
        tokenB: "GTO",
        amountS: new BN(web3.utils.toWei("100", "ether")),
        amountB: new BN(web3.utils.toWei("900", "ether")),
        owner: exchangeTestUtil.testContext.orderOwners[0],
        maxFeeBips: 25,
        rebateBips: 0,
        buy: false
      };
      await exchangeTestUtil.setupOrder(order, 0);

      const spread = new BN(web3.utils.toWei("50", "ether"));
      const ringA: RingInfo = {
        orderA: order,
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("500", "ether")),
          amountB: new BN(web3.utils.toWei("50", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[1],
          maxFeeBips: 0,
          rebateBips: 20,
          buy: true
        },
        expected: {
          orderA: { filledFraction: 0.5, spread },
          orderB: { filledFraction: 1.0 }
        }
      };
      const ringB: RingInfo = {
        orderA: order,
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("900", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[2],
          maxFeeBips: 0,
          rebateBips: 10,
          buy: true
        },
        expected: {
          orderA: {
            filledFraction: 0.5,
            spread: new BN(web3.utils.toWei("0", "ether"))
          },
          orderB: { filledFraction: 0.5 }
        }
      };

      await exchangeTestUtil.setupRing(ringA, false, true);
      await exchangeTestUtil.setupRing(ringB, false, true);
      await exchangeTestUtil.sendRing(exchangeID, ringA);
      await exchangeTestUtil.sendRing(exchangeID, ringB);

      const operatorAccountID = await exchangeTestUtil.getActiveOperator(
        exchangeID
      );
      await exchangeTestUtil.depositTo(
        operatorAccountID,
        ringA.orderB.tokenB,
        ringA.orderB.amountB
      );
      await exchangeTestUtil.depositTo(
        operatorAccountID,
        ringB.orderB.tokenB,
        ringB.orderB.amountB
      );

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      // tokenS
      await exchangeTestUtil.checkOffchainBalance(
        order.accountID,
        order.tokenIdS,
        new BN(0),
        "BalanceS unexpected"
      );
      // tokenB
      const expectedFee = order.amountB
        .add(spread)
        .mul(new BN(order.maxFeeBips))
        .div(new BN(10000));
      const exptectedBalance = order.amountB.add(spread).sub(expectedFee);
      await exchangeTestUtil.checkOffchainBalance(
        order.accountID,
        order.tokenIdB,
        exptectedBalance,
        "BalanceB unexpected"
      );

      await verify();
    });

    it("Buy order used as taker and maker", async () => {
      const order: OrderInfo = {
        tokenS: "WETH",
        tokenB: "GTO",
        amountS: new BN(web3.utils.toWei("110", "ether")),
        amountB: new BN(web3.utils.toWei("100", "ether")),
        owner: exchangeTestUtil.testContext.orderOwners[0],
        maxFeeBips: 25,
        rebateBips: 0,
        buy: true
      };
      await exchangeTestUtil.setupOrder(order, 0);

      const spread = new BN(web3.utils.toWei("5", "ether"));
      const ringA: RingInfo = {
        orderA: order,
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("50", "ether")),
          amountB: new BN(web3.utils.toWei("50", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[1],
          maxFeeBips: 0,
          rebateBips: 20,
          buy: false
        },
        expected: {
          orderA: { filledFraction: 0.5, spread },
          orderB: { filledFraction: 1.0 }
        }
      };
      const ringB: RingInfo = {
        orderA: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("220", "ether")),
          amountB: new BN(web3.utils.toWei("220", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[2],
          maxFeeBips: 30,
          buy: false
        },
        orderB: order,
        expected: {
          orderA: {
            filledFraction: 50 / 220,
            spread: new BN(web3.utils.toWei("5", "ether"))
          },
          orderB: { filledFraction: 0.5 }
        }
      };

      await exchangeTestUtil.setupRing(ringA, false, true);
      await exchangeTestUtil.setupRing(ringB, true, false);
      await exchangeTestUtil.sendRing(exchangeID, ringA);
      await exchangeTestUtil.sendRing(exchangeID, ringB);

      const operatorAccountID = await exchangeTestUtil.getActiveOperator(
        exchangeID
      );
      await exchangeTestUtil.depositTo(
        operatorAccountID,
        ringA.orderB.tokenB,
        ringA.orderB.amountB
      );
      await exchangeTestUtil.depositTo(
        operatorAccountID,
        ringB.orderB.tokenB,
        ringB.orderB.amountB
      );

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      // tokenS
      const exptectedBalanceS = spread;
      await exchangeTestUtil.checkOffchainBalance(
        order.accountID,
        order.tokenIdS,
        exptectedBalanceS,
        "BalanceS unexpected"
      );
      // tokenB
      const expectedFee = order.amountB
        .mul(new BN(order.maxFeeBips))
        .div(new BN(10000));
      const exptectedBalance = order.amountB.sub(expectedFee);
      await exchangeTestUtil.checkOffchainBalance(
        order.accountID,
        order.tokenIdB,
        exptectedBalance,
        "Balance unexpected"
      );

      await verify();
    });

    it("Sell order used as taker and maker", async () => {
      const order: OrderInfo = {
        tokenS: "WETH",
        tokenB: "GTO",
        amountS: new BN(web3.utils.toWei("100", "ether")),
        amountB: new BN(web3.utils.toWei("90", "ether")),
        owner: exchangeTestUtil.testContext.orderOwners[0],
        maxFeeBips: 25,
        rebateBips: 0,
        buy: false
      };
      await exchangeTestUtil.setupOrder(order, 0);

      const spread = new BN(web3.utils.toWei("5", "ether"));
      const ringA: RingInfo = {
        orderA: order,
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("50", "ether")),
          amountB: new BN(web3.utils.toWei("50", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[1],
          maxFeeBips: 0,
          rebateBips: 20,
          buy: true
        },
        expected: {
          orderA: { filledFraction: 0.5, spread },
          orderB: { filledFraction: 1.0 }
        }
      };
      const ringB: RingInfo = {
        orderA: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("190", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[2],
          maxFeeBips: 15,
          buy: true
        },
        orderB: order,
        expected: {
          orderA: {
            filledFraction: 0.25,
            spread: new BN(web3.utils.toWei("2.5", "ether"))
          },
          orderB: { filledFraction: 0.5 }
        }
      };

      await exchangeTestUtil.setupRing(ringA, false, true);
      await exchangeTestUtil.setupRing(ringB, true, false);
      await exchangeTestUtil.sendRing(exchangeID, ringA);
      await exchangeTestUtil.sendRing(exchangeID, ringB);

      const operatorAccountID = await exchangeTestUtil.getActiveOperator(
        exchangeID
      );
      await exchangeTestUtil.depositTo(
        operatorAccountID,
        ringA.orderB.tokenB,
        ringA.orderB.amountB
      );

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      // tokenS
      await exchangeTestUtil.checkOffchainBalance(
        order.accountID,
        order.tokenIdS,
        new BN(0),
        "BalanceS unexpected"
      );
      // tokenB
      const expectedFee = order.amountB
        .add(spread)
        .mul(new BN(order.maxFeeBips))
        .div(new BN(10000));
      const exptectedBalance = order.amountB.add(spread).sub(expectedFee);
      await exchangeTestUtil.checkOffchainBalance(
        order.accountID,
        order.tokenIdB,
        exptectedBalance,
        "BalanceB unexpected"
      );

      await verify();
    });

    it("feeBips < maxFeeBips", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "LRC",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("101", "ether")),
          amountB: new BN(web3.utils.toWei("10", "ether")),
          maxFeeBips: 35,
          feeBips: 30
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "LRC",
          amountS: new BN(web3.utils.toWei("20", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          maxFeeBips: 40,
          feeBips: 25
        },
        expected: {
          orderA: {
            filledFraction: 1.0,
            spread: new BN(web3.utils.toWei("1", "ether"))
          },
          orderB: { filledFraction: 0.5 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      await verify();
    });

    it("Rebate (single order)", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "LRC",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("10", "ether"))
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "LRC",
          amountS: new BN(web3.utils.toWei("20", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          maxFeeBips: 0,
          rebateBips: 10
        },
        expected: {
          orderA: {
            filledFraction: 1.0,
            spread: new BN(web3.utils.toWei("0", "ether"))
          },
          orderB: { filledFraction: 0.5 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      const operatorAccountID = await exchangeTestUtil.getActiveOperator(
        exchangeID
      );
      await exchangeTestUtil.depositTo(
        operatorAccountID,
        ring.orderB.tokenB,
        ring.orderB.amountB
      );

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      await verify();
    });

    it("Rebate (both orders, rebate token == operator fee token)", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "LRC",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("10", "ether")),
          maxFeeBips: 0,
          rebateBips: 10
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "LRC",
          amountS: new BN(web3.utils.toWei("20", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          maxFeeBips: 0,
          rebateBips: 20
        },
        tokenID: await exchangeTestUtil.getTokenIdFromNameOrAddress("LRC"),
        expected: {
          orderA: {
            filledFraction: 1.0,
            spread: new BN(web3.utils.toWei("0", "ether"))
          },
          orderB: { filledFraction: 0.5 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      const operatorAccountID = await exchangeTestUtil.getActiveOperator(
        exchangeID
      );
      await exchangeTestUtil.depositTo(
        operatorAccountID,
        ring.orderA.tokenB,
        ring.orderA.amountB
      );
      await exchangeTestUtil.depositTo(
        operatorAccountID,
        ring.orderB.tokenB,
        ring.orderB.amountB
      );

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      await verify();
    });

    it("Unmatchable", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("90", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          allOrNone: true
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether"))
        },
        expected: {
          orderA: {
            filledFraction: 0.0,
            spread: new BN(web3.utils.toWei("10", "ether")).neg()
          },
          orderB: { filledFraction: 0.0 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await expectThrow(
        exchangeTestUtil.commitRings(exchangeID),
        "invalid block"
      );
    });

    it("No funds available", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "ETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("10", "ether"))
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "ETH",
          amountS: new BN(web3.utils.toWei("5", "ether")),
          amountB: new BN(web3.utils.toWei("45", "ether")),
          balanceS: new BN(0)
        },
        expected: {
          orderA: { filledFraction: 0.0, spread: new BN(0) },
          orderB: { filledFraction: 0.0 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      await verify();
    });

    it("Insufficient funds available (buy order)", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "ETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("10", "ether")),
          balanceS: new BN(web3.utils.toWei("40", "ether")),
          buy: true
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "ETH",
          amountS: new BN(web3.utils.toWei("20", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether"))
        },
        expected: {
          orderA: { filledFraction: 0.4, spread: new BN(0) },
          orderB: { filledFraction: 0.2 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      await verify();
    });

    it("Insufficient funds available (sell order)", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "ETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("10", "ether")),
          balanceS: new BN(web3.utils.toWei("40", "ether")),
          buy: false
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "ETH",
          amountS: new BN(web3.utils.toWei("20", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether"))
        },
        expected: {
          orderA: { filledFraction: 0.4, spread: new BN(0) },
          orderB: { filledFraction: 0.2 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      await verify();
    });

    it("allOrNone (Buy, successful)", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "ETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("110", "ether")),
          amountB: new BN(web3.utils.toWei("10", "ether")),
          allOrNone: true
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "ETH",
          amountS: new BN(web3.utils.toWei("20", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether"))
        },
        expected: {
          orderA: {
            filledFraction: 1.0,
            spread: new BN(web3.utils.toWei("10", "ether"))
          },
          orderB: { filledFraction: 0.5 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      await verify();
    });

    it("allOrNone (Sell, successful)", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "ETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("110", "ether")),
          amountB: new BN(web3.utils.toWei("10", "ether")),
          allOrNone: true,
          buy: false
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "ETH",
          amountS: new BN(web3.utils.toWei("20", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether"))
        },
        expected: {
          orderA: {
            filledFraction: 1.0,
            spread: new BN(web3.utils.toWei("1", "ether"))
          },
          orderB: { filledFraction: 0.55 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      await verify();
    });

    it("allOrNone (Buy, unsuccessful)", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("110", "ether")),
          amountB: new BN(web3.utils.toWei("10", "ether")),
          allOrNone: true
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("20", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          balanceS: new BN(web3.utils.toWei("5", "ether"))
        },
        expected: {
          orderA: {
            filledFraction: 0.0,
            spread: new BN(web3.utils.toWei("5", "ether"))
          },
          orderB: { filledFraction: 0.0 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await expectThrow(
        exchangeTestUtil.commitRings(exchangeID),
        "invalid block"
      );
    });

    it("allOrNone (Sell, unsuccessful)", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "ETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("110", "ether")),
          amountB: new BN(web3.utils.toWei("10", "ether")),
          allOrNone: true,
          buy: false
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "ETH",
          amountS: new BN(web3.utils.toWei("20", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          balanceS: new BN(web3.utils.toWei("5", "ether"))
        },
        expected: {
          orderA: { filledFraction: 0.0 },
          orderB: { filledFraction: 0.0 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await expectThrow(
        exchangeTestUtil.commitRings(exchangeID),
        "invalid block"
      );
    });

    it("Self-trading", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("105", "ether")),
          amountB: new BN(web3.utils.toWei("10", "ether")),
          balanceS: new BN(web3.utils.toWei("105", "ether")),
          balanceB: new BN(web3.utils.toWei("10", "ether"))
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("10", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether"))
        },
        expected: {
          orderA: {
            filledFraction: 1.0,
            spread: new BN(web3.utils.toWei("5", "ether"))
          },
          orderB: { filledFraction: 1.0 }
        }
      };

      await exchangeTestUtil.setupRing(ring);

      ring.orderB.accountID = ring.orderA.accountID;
      ring.orderB.signature = undefined;
      exchangeTestUtil.signOrder(ring.orderB);

      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      await verify();
    });

    it("selling token with decimals == 0", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "INDA",
          tokenB: "WETH",
          amountS: new BN(60),
          amountB: new BN(web3.utils.toWei("5", "ether"))
        },
        orderB: {
          tokenS: "WETH",
          tokenB: "INDA",
          amountS: new BN(web3.utils.toWei("2.5", "ether")),
          amountB: new BN(25)
        },
        expected: {
          orderA: { filledFraction: 0.5, spread: new BN(5) },
          orderB: { filledFraction: 1.0 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      await verify();
    });

    it("fillAmountB rounding error > 0.1%", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "INDA",
          tokenB: "INDB",
          amountS: new BN(200),
          amountB: new BN(2000),
          buy: true
        },
        orderB: {
          tokenS: "INDB",
          tokenB: "INDA",
          amountS: new BN(2000),
          amountB: new BN(200),
          balanceS: new BN(1999),
          buy: false
        },
        expected: {
          orderA: { filledFraction: 0.0 },
          orderB: { filledFraction: 0.0 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await expectThrow(
        exchangeTestUtil.commitRings(exchangeID),
        "invalid block"
      );
    });

    it("fillAmountB is 0 because of rounding error", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "INDA",
          tokenB: "INDB",
          amountS: new BN(1),
          amountB: new BN(10)
        },
        orderB: {
          tokenS: "INDB",
          tokenB: "INDA",
          amountS: new BN(10),
          amountB: new BN(1),
          balanceS: new BN(5)
        },
        expected: {
          orderA: { filledFraction: 0.0, spread: new BN(0) },
          orderB: { filledFraction: 0.0 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await expectThrow(
        exchangeTestUtil.commitRings(exchangeID),
        "invalid block"
      );
    });

    it("operator == order owner", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "LRC",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether"))
        },
        orderB: {
          tokenS: "LRC",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether"))
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      exchangeTestUtil.setActiveOperator(ring.orderB.accountID);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      await verify();
    });

    it("orderA.owner == orderB.owner == operator", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("105", "ether")),
          amountB: new BN(web3.utils.toWei("10", "ether")),
          balanceS: new BN(web3.utils.toWei("105", "ether")),
          balanceB: new BN(web3.utils.toWei("10", "ether"))
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("10", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether"))
        },
        tokenID: await exchangeTestUtil.getTokenIdFromNameOrAddress("WETH"),
        expected: {
          orderA: {
            filledFraction: 1.0,
            spread: new BN(web3.utils.toWei("5", "ether"))
          },
          orderB: { filledFraction: 1.0 }
        }
      };

      await exchangeTestUtil.setupRing(ring);

      ring.orderB.accountID = ring.orderA.accountID;
      ring.orderB.signature = undefined;
      exchangeTestUtil.signOrder(ring.orderB);

      await exchangeTestUtil.sendRing(exchangeID, ring);

      exchangeTestUtil.setActiveOperator(ring.orderA.accountID);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      await verify();
    });

    it("tokenS/tokenB mismatch", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "ETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether"))
        },
        orderB: {
          tokenS: "LRC",
          tokenB: "ETH",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether"))
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await expectThrow(
        exchangeTestUtil.commitRings(exchangeID),
        "invalid block"
      );
    });

    it("tokenS == tokenB", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether"))
        },
        orderB: {
          tokenS: "WETH",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether"))
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await expectThrow(
        exchangeTestUtil.commitRings(exchangeID),
        "invalid block"
      );
    });

    it("Wrong order signature", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "LRC",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          signature: { Rx: "4564565564545", Ry: "456445648974", s: "445644894" }
        },
        orderB: {
          tokenS: "LRC",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether"))
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await expectThrow(
        exchangeTestUtil.commitRings(exchangeID),
        "invalid block"
      );
    });

    it("should not be able to increase a balance to > MAX_AMOUNT", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "GTO",
          tokenB: "TEST",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether"))
        },
        orderB: {
          tokenS: "TEST",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether"))
        },
        expected: {
          orderA: { filledFraction: 0.0, spread: new BN(0) },
          orderB: { filledFraction: 0.0 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      // Set the balance or orderA.owner already at almost MAX_AMOUNT so that
      // the balance after the trade would be > MAX_AMOUNT
      await exchangeTestUtil.depositTo(
        ring.orderA.accountID,
        "TEST",
        Constants.MAX_AMOUNT.sub(ring.orderA.amountB).add(new BN(1))
      );

      await exchangeTestUtil.commitDeposits(exchangeID);
      await expectThrow(
        exchangeTestUtil.commitRings(exchangeID),
        "invalid block"
      );
    });

    it("validUntil < now", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          validUntil: 1
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether"))
        },
        expected: {
          orderA: { filledFraction: 0.0, spread: new BN(0) },
          orderB: { filledFraction: 0.0 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await expectThrow(
        exchangeTestUtil.commitRings(exchangeID),
        "invalid block"
      );
    });

    it("validSince > now", async () => {
      const ring: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          validSince: 0xffffffff
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether"))
        },
        expected: {
          orderA: { filledFraction: 0.0, spread: new BN(0) },
          orderB: { filledFraction: 0.0 }
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(exchangeID, ring);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await expectThrow(
        exchangeTestUtil.commitRings(exchangeID),
        "invalid block"
      );
    });

    it("Multiple rings", async () => {
      const ringA: RingInfo = {
        orderA: {
          tokenS: "ETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("3", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[0]
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "ETH",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("2", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[1]
        },
        expected: {
          orderA: {
            filledFraction: 1.0,
            spread: new BN(web3.utils.toWei("1", "ether"))
          },
          orderB: { filledFraction: 1.0 }
        }
      };
      const ringB: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("110", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[2]
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[3]
        },
        expected: {
          orderA: {
            filledFraction: 1.0,
            spread: new BN(web3.utils.toWei("10", "ether"))
          },
          orderB: { filledFraction: 1.0 }
        }
      };

      await exchangeTestUtil.setupRing(ringA);
      await exchangeTestUtil.setupRing(ringB);
      await exchangeTestUtil.sendRing(exchangeID, ringA);
      await exchangeTestUtil.sendRing(exchangeID, ringB);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      await verify();
    });

    it("Order filled in multiple rings (order.orderID == tradeHistory.orderID)", async () => {
      const order: OrderInfo = {
        tokenS: "ETH",
        tokenB: "GTO",
        amountS: new BN(web3.utils.toWei("10", "ether")),
        amountB: new BN(web3.utils.toWei("100", "ether")),
        owner: exchangeTestUtil.testContext.orderOwners[0]
      };
      await exchangeTestUtil.setupOrder(order, 0);

      const ringA: RingInfo = {
        orderA: order,
        orderB: {
          tokenS: "GTO",
          tokenB: "ETH",
          amountS: new BN(web3.utils.toWei("60", "ether")),
          amountB: new BN(web3.utils.toWei("6", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[1]
        },
        expected: {
          orderA: {
            filledFraction: 0.6,
            spread: new BN(web3.utils.toWei("0", "ether"))
          },
          orderB: { filledFraction: 1.0 }
        }
      };
      const ringB: RingInfo = {
        orderA: order,
        orderB: {
          tokenS: "GTO",
          tokenB: "ETH",
          amountS: new BN(web3.utils.toWei("120", "ether")),
          amountB: new BN(web3.utils.toWei("12", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[2]
        },
        expected: {
          orderA: {
            filledFraction: 0.4,
            spread: new BN(web3.utils.toWei("0", "ether"))
          },
          orderB: { filledFraction: 0.33333 }
        }
      };

      await exchangeTestUtil.setupRing(ringA, false, true);
      await exchangeTestUtil.setupRing(ringB, false, true);
      await exchangeTestUtil.sendRing(exchangeID, ringA);
      await exchangeTestUtil.sendRing(exchangeID, ringB);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      await verify();
    });

    it("Reused OrderID (tradeHistory.filled > order.amount)", async () => {
      const orderID = 79;
      const ringA: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("1000", "ether")),
          amountB: new BN(web3.utils.toWei("2000", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[0],
          orderID
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("2000", "ether")),
          amountB: new BN(web3.utils.toWei("1000", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[1]
        },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };
      const ringB: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[0],
          orderID: orderID
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[3]
        },
        expected: {
          orderA: { filledFraction: 0.0, spread: new BN(0) },
          orderB: { filledFraction: 0.0 }
        }
      };

      await exchangeTestUtil.setupRing(ringA);
      await exchangeTestUtil.sendRing(exchangeID, ringA);
      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);
      await verify();

      await exchangeTestUtil.setupRing(ringB);
      await exchangeTestUtil.sendRing(exchangeID, ringB);
      await exchangeTestUtil.commitDeposits(exchangeID);
      await expectThrow(
        exchangeTestUtil.commitRings(exchangeID),
        "invalid block"
      );
    });

    it("Trimmed OrderID (order.orderID > tradeHistory.orderID)", async () => {
      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const ownerB = exchangeTestUtil.testContext.orderOwners[1];
      const orderIDA = 8;
      const orderIDB = 0;
      const ringA: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          owner: ownerA,
          orderID: orderIDA
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          owner: ownerB,
          orderID: orderIDB
        },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };
      const ringB: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          owner: ownerA,
          orderID: orderIDA + 2 ** Constants.TREE_DEPTH_TRADING_HISTORY
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          owner: ownerB,
          orderID: orderIDB
        },
        expected: {
          orderA: { filledFraction: 0.0, spread: new BN(0) },
          orderB: { filledFraction: 0.0 }
        }
      };
      const ringC: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          owner: ownerA,
          orderID: orderIDA + 2 ** Constants.TREE_DEPTH_TRADING_HISTORY
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          owner: ownerB,
          orderID: orderIDB + 2 ** Constants.TREE_DEPTH_TRADING_HISTORY
        },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };
      const ringD: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          owner: ownerA,
          orderID: orderIDA + 2 ** Constants.TREE_DEPTH_TRADING_HISTORY
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          owner: ownerB,
          orderID: orderIDB + 2 * 2 ** Constants.TREE_DEPTH_TRADING_HISTORY
        },
        expected: {
          orderA: { filledFraction: 0.0, spread: new BN(0) },
          orderB: { filledFraction: 0.0 }
        }
      };
      const ringE: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          owner: ownerA,
          orderID: orderIDA + 2 * 2 ** Constants.TREE_DEPTH_TRADING_HISTORY
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          owner: ownerB,
          orderID: orderIDB + 3 * 2 ** Constants.TREE_DEPTH_TRADING_HISTORY
        },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };

      await exchangeTestUtil.setupRing(ringA);
      await exchangeTestUtil.setupRing(ringB);
      await exchangeTestUtil.setupRing(ringC);
      await exchangeTestUtil.setupRing(ringD);
      await exchangeTestUtil.setupRing(ringE);
      await exchangeTestUtil.sendRing(exchangeID, ringA);
      await exchangeTestUtil.sendRing(exchangeID, ringB);
      await exchangeTestUtil.sendRing(exchangeID, ringC);
      await exchangeTestUtil.sendRing(exchangeID, ringD);
      await exchangeTestUtil.sendRing(exchangeID, ringE);

      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);

      await verify();
    });

    it("Invalid OrderID (order.orderID > tradeHistory.orderID)", async () => {
      const orderID = 8;
      const ringA: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[0],
          orderID
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[1]
        },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };
      const ringB: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[0],
          orderID: orderID + 2 * 2 ** Constants.TREE_DEPTH_TRADING_HISTORY
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[3]
        },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };

      await exchangeTestUtil.setupRing(ringA);
      await exchangeTestUtil.sendRing(exchangeID, ringA);
      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);
      await verify();

      await exchangeTestUtil.setupRing(ringB);
      await exchangeTestUtil.sendRing(exchangeID, ringB);
      await exchangeTestUtil.commitDeposits(exchangeID);
      await expectThrow(
        exchangeTestUtil.commitRings(exchangeID),
        "invalid block"
      );
    });

    it("Cancelled OrderID (order.orderID < tradeHistory.orderID)", async () => {
      const orderID = 8;
      const ringA: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[0],
          orderID: orderID + 2 ** Constants.TREE_DEPTH_TRADING_HISTORY
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[1]
        },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };
      const ringB: RingInfo = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[0],
          orderID
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          owner: exchangeTestUtil.testContext.orderOwners[3]
        },
        expected: {
          orderA: { filledFraction: 0.0, spread: new BN(0) },
          orderB: { filledFraction: 0.0 }
        }
      };

      await exchangeTestUtil.setupRing(ringA);
      await exchangeTestUtil.sendRing(exchangeID, ringA);
      await exchangeTestUtil.commitDeposits(exchangeID);
      await exchangeTestUtil.commitRings(exchangeID);
      await verify();

      await exchangeTestUtil.setupRing(ringB);
      await exchangeTestUtil.sendRing(exchangeID, ringB);
      await exchangeTestUtil.commitDeposits(exchangeID);
      await expectThrow(
        exchangeTestUtil.commitRings(exchangeID),
        "invalid block"
      );
    });
  });
});
