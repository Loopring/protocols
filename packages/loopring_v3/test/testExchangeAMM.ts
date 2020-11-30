import BN = require("bn.js");
import { Constants, Signature } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { AuthMethod, OrderInfo, SpotTrade } from "./types";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;

  let exchangeID = 0;
  let operatorAccountID: number;
  let operator: string;

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
      { setupTestState: true }
    );
    operatorAccountID = await exchangeTestUtil.getActiveOperator(exchangeID);
    operator = exchangeTestUtil.getAccount(operatorAccountID).owner;
  });

  describe("AMM", function() {
    this.timeout(0);

    it("Should be able to set AMM feeBips and token weights", async () => {
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const ammOwner = exchangeTestUtil.testContext.orderOwners[1];

      const tokenA = "LRC";
      const tokenB = "WETH";
      const tokenC = "GTO";

      const tokenWeightA = new BN(web3.utils.toWei("1", "ether"));
      const tokenWeightB = new BN(web3.utils.toWei("0.12", "ether"));
      const tokenWeightC = new BN(web3.utils.toWei("4.56", "ether"));

      const balance = new BN(web3.utils.toWei("5484.24", "ether"));
      const token = exchangeTestUtil.getTokenAddress("LRC");
      const fee = exchangeTestUtil.getRandomFee();

      // Create the AMM account
      await exchangeTestUtil.deposit(owner, owner, token, balance);

      // Send some funds over to the new account
      await exchangeTestUtil.transfer(
        owner,
        ammOwner,
        token,
        fee.mul(new BN(10)),
        token,
        fee,
        { transferToNew: true }
      );

      // Setup the AMM
      await exchangeTestUtil.requestAmmUpdate(
        ammOwner,
        tokenA,
        15,
        tokenWeightA
      );
      await exchangeTestUtil.requestAmmUpdate(
        ammOwner,
        tokenB,
        15,
        tokenWeightB,
        { authMethod: AuthMethod.ECDSA }
      );
      await exchangeTestUtil.requestAmmUpdate(
        ammOwner,
        tokenC,
        15,
        tokenWeightC,
        { authMethod: AuthMethod.APPROVE }
      );
      // Change some of the parameters
      await exchangeTestUtil.requestAmmUpdate(
        ammOwner,
        tokenA,
        20,
        tokenWeightC
      );
      await exchangeTestUtil.requestAmmUpdate(
        ammOwner,
        tokenC,
        25,
        tokenWeightA
      );

      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("Forced withdrawals should reset the AMM token weight", async () => {
      const owner = exchangeTestUtil.testContext.orderOwners[0];

      const token = "LRC";
      const tokenWeight = new BN(web3.utils.toWei("1", "ether"));
      const balance = new BN(web3.utils.toWei("5484.24", "ether"));

      // Create the AMM account
      await exchangeTestUtil.deposit(owner, owner, token, balance);

      // Setup the AMM
      await exchangeTestUtil.requestAmmUpdate(owner, token, 15, tokenWeight);

      // Request forced withdrawal
      await exchangeTestUtil.requestWithdrawal(
        Constants.zeroAddress,
        token,
        balance,
        token,
        new BN(0),
        { authMethod: AuthMethod.FORCE }
      );

      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("Successful swap (AMM maker)", async () => {
      const ring: SpotTrade = {
        orderA: {
          owner: exchangeTestUtil.testContext.orderOwners[0],
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("98", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          balanceS: new BN(web3.utils.toWei("10000", "ether")),
          balanceB: new BN(web3.utils.toWei("20000", "ether")),
          feeBips: 0,
          amm: true
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("98", "ether"))
        },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };
      await exchangeTestUtil.setupRing(ring);

      await exchangeTestUtil.deposit(
        exchangeTestUtil.exchangeOperator,
        exchangeTestUtil.exchangeOperator,
        ring.orderA.tokenB,
        ring.orderA.amountB
      );

      const feeBipsAMM = 30;
      const tokenWeightS = new BN(web3.utils.toWei("1", "ether"));
      const tokenWeightB = new BN(web3.utils.toWei("1", "ether"));
      await exchangeTestUtil.requestAmmUpdate(
        ring.orderA.owner,
        ring.orderA.tokenS,
        feeBipsAMM,
        tokenWeightS
      );
      await exchangeTestUtil.requestAmmUpdate(
        ring.orderA.owner,
        ring.orderA.tokenB,
        feeBipsAMM,
        tokenWeightB
      );

      await exchangeTestUtil.sendRing(ring);
      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("Successful swap (AMM taker)", async () => {
      const ring: SpotTrade = {
        orderB: {
          owner: exchangeTestUtil.testContext.orderOwners[0],
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("98", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          balanceS: new BN(web3.utils.toWei("10000", "ether")),
          balanceB: new BN(web3.utils.toWei("20000", "ether")),
          feeBips: 0,
          amm: true
        },
        orderA: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("98", "ether"))
        },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };
      await exchangeTestUtil.setupRing(ring);

      await exchangeTestUtil.deposit(
        exchangeTestUtil.exchangeOperator,
        exchangeTestUtil.exchangeOperator,
        ring.orderB.tokenB,
        ring.orderB.amountB
      );

      const feeBipsAMM = 30;
      const tokenWeightS = new BN(web3.utils.toWei("1", "ether"));
      const tokenWeightB = new BN(web3.utils.toWei("1", "ether"));
      await exchangeTestUtil.requestAmmUpdate(
        ring.orderB.owner,
        ring.orderB.tokenS,
        feeBipsAMM,
        tokenWeightS
      );
      await exchangeTestUtil.requestAmmUpdate(
        ring.orderB.owner,
        ring.orderB.tokenB,
        feeBipsAMM,
        tokenWeightB
      );

      await exchangeTestUtil.sendRing(ring);
      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("Successful swap (AMM maker and taker)", async () => {
      const ring: SpotTrade = {
        orderA: {
          owner: exchangeTestUtil.testContext.orderOwners[0],
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          balanceS: new BN(web3.utils.toWei("11000", "ether")),
          balanceB: new BN(web3.utils.toWei("20000", "ether")),
          feeBips: 0,
          amm: true
        },
        orderB: {
          owner: exchangeTestUtil.testContext.orderOwners[1],
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          balanceS: new BN(web3.utils.toWei("21000", "ether")),
          balanceB: new BN(web3.utils.toWei("10000", "ether")),
          feeBips: 0,
          amm: true
        },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };
      await exchangeTestUtil.setupRing(ring);

      await exchangeTestUtil.deposit(
        exchangeTestUtil.exchangeOperator,
        exchangeTestUtil.exchangeOperator,
        ring.orderA.tokenB,
        ring.orderA.amountB
      );
      await exchangeTestUtil.deposit(
        exchangeTestUtil.exchangeOperator,
        exchangeTestUtil.exchangeOperator,
        ring.orderB.tokenB,
        ring.orderB.amountB
      );

      const feeBipsAMM = 30;
      const tokenWeightS = new BN(web3.utils.toWei("1", "ether"));
      const tokenWeightB = new BN(web3.utils.toWei("1", "ether"));
      await exchangeTestUtil.requestAmmUpdate(
        ring.orderA.owner,
        ring.orderA.tokenS,
        feeBipsAMM,
        tokenWeightS
      );
      await exchangeTestUtil.requestAmmUpdate(
        ring.orderA.owner,
        ring.orderA.tokenB,
        feeBipsAMM,
        tokenWeightB
      );
      await exchangeTestUtil.requestAmmUpdate(
        ring.orderB.owner,
        ring.orderB.tokenS,
        feeBipsAMM,
        tokenWeightS
      );
      await exchangeTestUtil.requestAmmUpdate(
        ring.orderB.owner,
        ring.orderB.tokenB,
        feeBipsAMM,
        tokenWeightB
      );

      await exchangeTestUtil.sendRing(ring);
      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("Successful swap (small decimals out)", async () => {
      const ring: SpotTrade = {
        orderA: {
          owner: exchangeTestUtil.testContext.orderOwners[0],
          tokenS: "INDA",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("98", "mwei")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          balanceS: new BN(web3.utils.toWei("10000000", "mwei")),
          balanceB: new BN(web3.utils.toWei("20000000", "ether")),
          feeBips: 0,
          amm: true
        },
        orderB: {
          tokenS: "WETH",
          tokenB: "INDA",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("98", "mwei"))
        },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };
      await exchangeTestUtil.setupRing(ring);

      await exchangeTestUtil.deposit(
        exchangeTestUtil.exchangeOperator,
        exchangeTestUtil.exchangeOperator,
        ring.orderA.tokenB,
        ring.orderA.amountB
      );

      const feeBipsAMM = 30;
      const tokenWeightS = new BN(web3.utils.toWei("1", "ether"));
      const tokenWeightB = new BN(web3.utils.toWei("1", "ether"));
      await exchangeTestUtil.requestAmmUpdate(
        ring.orderA.owner,
        ring.orderA.tokenS,
        feeBipsAMM,
        tokenWeightS
      );
      await exchangeTestUtil.requestAmmUpdate(
        ring.orderA.owner,
        ring.orderA.tokenB,
        feeBipsAMM,
        tokenWeightB
      );

      await exchangeTestUtil.sendRing(ring);
      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("Successful swap (small decimals in)", async () => {
      const ring: SpotTrade = {
        orderA: {
          owner: exchangeTestUtil.testContext.orderOwners[0],
          tokenS: "WETH",
          tokenB: "INDA",
          amountS: new BN(web3.utils.toWei("98", "ether")),
          amountB: new BN(web3.utils.toWei("200", "mwei")),
          balanceS: new BN(web3.utils.toWei("10000000", "ether")),
          balanceB: new BN(web3.utils.toWei("20000000", "mwei")),
          feeBips: 0,
          amm: true
        },
        orderB: {
          tokenS: "INDA",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "mwei")),
          amountB: new BN(web3.utils.toWei("98", "ether"))
        },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };
      await exchangeTestUtil.setupRing(ring);

      await exchangeTestUtil.deposit(
        exchangeTestUtil.exchangeOperator,
        exchangeTestUtil.exchangeOperator,
        ring.orderA.tokenB,
        ring.orderA.amountB
      );

      const feeBipsAMM = 30;
      const tokenWeightS = new BN(web3.utils.toWei("1", "ether"));
      const tokenWeightB = new BN(web3.utils.toWei("1", "ether"));
      await exchangeTestUtil.requestAmmUpdate(
        ring.orderA.owner,
        ring.orderA.tokenS,
        feeBipsAMM,
        tokenWeightS
      );
      await exchangeTestUtil.requestAmmUpdate(
        ring.orderA.owner,
        ring.orderA.tokenB,
        feeBipsAMM,
        tokenWeightB
      );

      await exchangeTestUtil.sendRing(ring);
      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("Insufficient fills for AMM curve", async () => {
      // Use exactly the spot price at the current position on the curve
      const ring: SpotTrade = {
        orderA: {
          owner: exchangeTestUtil.testContext.orderOwners[0],
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          balanceS: new BN(web3.utils.toWei("10000", "ether")),
          balanceB: new BN(web3.utils.toWei("20000", "ether")),
          feeBips: 0,
          amm: true
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

      await exchangeTestUtil.deposit(
        exchangeTestUtil.exchangeOperator,
        exchangeTestUtil.exchangeOperator,
        ring.orderA.tokenB,
        ring.orderA.amountB
      );

      const feeBipsAMM = 30;
      const tokenWeightS = new BN(web3.utils.toWei("1", "ether"));
      const tokenWeightB = new BN(web3.utils.toWei("1", "ether"));
      await exchangeTestUtil.requestAmmUpdate(
        ring.orderA.owner,
        ring.orderA.tokenS,
        feeBipsAMM,
        tokenWeightS
      );
      await exchangeTestUtil.requestAmmUpdate(
        ring.orderA.owner,
        ring.orderA.tokenB,
        feeBipsAMM,
        tokenWeightB
      );

      await exchangeTestUtil.sendRing(ring);
      await expectThrow(exchangeTestUtil.submitTransactions(), "invalid block");
    });

    it("Weights not set", async () => {
      const ring: SpotTrade = {
        orderA: {
          owner: exchangeTestUtil.testContext.orderOwners[0],
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("99", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          balanceS: new BN(web3.utils.toWei("10000", "ether")),
          balanceB: new BN(web3.utils.toWei("20000", "ether")),
          feeBips: 0,
          amm: true
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("99", "ether"))
        },
        expected: {
          orderA: { filledFraction: 1.0, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };
      await exchangeTestUtil.setupRing(ring);

      await exchangeTestUtil.deposit(
        exchangeTestUtil.exchangeOperator,
        exchangeTestUtil.exchangeOperator,
        ring.orderA.tokenB,
        ring.orderA.amountB
      );

      // Only set the weight of a single token
      const feeBipsAMM = 0;
      const tokenWeightS = new BN(web3.utils.toWei("1", "ether"));
      await exchangeTestUtil.requestAmmUpdate(
        ring.orderA.owner,
        ring.orderA.tokenS,
        feeBipsAMM,
        tokenWeightS
      );

      await exchangeTestUtil.sendRing(ring);
      await expectThrow(exchangeTestUtil.submitTransactions(), "invalid block");
    });
  });
});
