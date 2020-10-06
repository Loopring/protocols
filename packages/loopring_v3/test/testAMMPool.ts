import BN = require("bn.js");
import { AmmPool } from "./ammUtils";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { AuthMethod, SpotTrade } from "./types";

const AgentRegistry = artifacts.require("AgentRegistry");

contract("LoopringAmmPool", (accounts: string[]) => {
  let ctx: ExchangeTestUtil;

  let sharedConfig: any;
  let agentRegistry: any;
  let registryOwner: string;

  let ownerA: string;
  let ownerB: string;

  before(async () => {
    ctx = new ExchangeTestUtil();
    await ctx.initialize(accounts);

    ownerA = ctx.testContext.orderOwners[10];
    ownerB = ctx.testContext.orderOwners[11];

    const loopringAmmSharedConfig = artifacts.require(
      "LoopringAmmSharedConfig"
    );
    sharedConfig = await loopringAmmSharedConfig.new();

    await sharedConfig.setMaxForcedExitAge(3600 * 24 * 7);
    await sharedConfig.setMaxForcedExitCount(100);
    await sharedConfig.setForcedExitFee(web3.utils.toWei("0.001", "ether"));
  });

  after(async () => {
    await ctx.stop();
  });

  beforeEach(async () => {
    // Fresh Exchange for each test
    await ctx.createExchange(ctx.testContext.stateOwners[0], {
      setupTestState: true,
      deterministic: true
    });

    // Create the agent registry
    registryOwner = accounts[7];
    agentRegistry = await AgentRegistry.new({ from: registryOwner });

    // Register it on the exchange contract
    const wrapper = await ctx.contracts.ExchangeV3.at(ctx.operator.address);
    await wrapper.setAgentRegistry(agentRegistry.address, {
      from: ctx.exchangeOwner
    });
  });

  describe("AMM", function() {
    this.timeout(0);

    it("Successful swap (AMM maker)", async () => {
      const feeBipsAMM = 30;
      const tokens = ["WETH", "GTO"];
      const weights = [
        new BN(web3.utils.toWei("1", "ether")),
        new BN(web3.utils.toWei("1", "ether"))
      ];

      for (const owner of [ownerA, ownerB]) {
        for (const token of tokens) {
          await ctx.deposit(
            owner,
            owner,
            token,
            new BN(web3.utils.toWei("1000000", "ether"))
          );
        }
      }

      const pool = new AmmPool(ctx);
      await pool.setupPool(sharedConfig, tokens, weights, feeBipsAMM);

      await agentRegistry.registerUniversalAgent(pool.contract.address, true, {
        from: registryOwner
      });

      await pool.prePoolTransactions();
      await pool.join(
        ownerA,
        pool.POOL_TOKEN_BASE,
        [
          new BN(web3.utils.toWei("10000.123456", "ether")),
          new BN(web3.utils.toWei("20000.654321", "ether"))
        ],
        [
          new BN(web3.utils.toWei("123.456789", "ether")),
          new BN(web3.utils.toWei("456.789", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await pool.join(
        ownerB,
        pool.POOL_TOKEN_BASE.div(new BN(11)),
        [
          new BN(web3.utils.toWei("1000", "ether")),
          new BN(web3.utils.toWei("2000", "ether"))
        ],
        [
          new BN(web3.utils.toWei("0", "ether")),
          new BN(web3.utils.toWei("789", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await ctx.submitTransactions(16);

      const ring: SpotTrade = {
        orderA: {
          owner: pool.contract.address,
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("98", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
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
      await ctx.setupRing(ring, true, true, false, true);

      await ctx.deposit(
        ctx.exchangeOperator,
        ctx.exchangeOperator,
        ring.orderA.tokenB,
        ring.orderA.amountB
      );

      await ctx.sendRing(ring);

      await pool.prePoolTransactions();
      await pool.exit(
        ownerA,
        pool.POOL_TOKEN_BASE.mul(new BN(6)).div(new BN(10)),
        [
          new BN(web3.utils.toWei("5000", "ether")),
          new BN(web3.utils.toWei("10000", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await pool.exit(
        ownerB,
        pool.POOL_TOKEN_BASE.mul(new BN(6)).div(new BN(100)),
        [
          new BN(web3.utils.toWei("500", "ether")),
          new BN(web3.utils.toWei("1000", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await ctx.submitTransactions(16);
      await ctx.submitPendingBlocks();

      // Withdraw some liquidity tokens
      await ctx.requestWithdrawal(
        ownerA,
        pool.contract.address,
        pool.POOL_TOKEN_BASE.div(new BN(10)),
        "ETH",
        new BN(0)
      );
      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

      // Force exit
      await pool.prePoolTransactions();
      await pool.exit(
        ownerA,
        pool.POOL_TOKEN_BASE.div(new BN(10)),
        [
          new BN(web3.utils.toWei("100", "ether")),
          new BN(web3.utils.toWei("100", "ether"))
        ],
        { authMethod: AuthMethod.FORCE }
      );
      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();
    });

    it("Invalid join slippage", async () => {
      const feeBipsAMM = 30;
      const tokens = ["WETH", "GTO"];
      const weights = [
        new BN(web3.utils.toWei("1", "ether")),
        new BN(web3.utils.toWei("1", "ether"))
      ];

      for (const owner of [ownerA, ownerB]) {
        for (const token of tokens) {
          await ctx.deposit(
            owner,
            owner,
            token,
            new BN(web3.utils.toWei("1000000", "ether"))
          );
        }
      }

      const pool = new AmmPool(ctx);
      await pool.setupPool(sharedConfig, tokens, weights, feeBipsAMM);

      await agentRegistry.registerUniversalAgent(pool.contract.address, true, {
        from: registryOwner
      });

      await pool.prePoolTransactions();
      await pool.join(
        ownerA,
        pool.POOL_TOKEN_BASE,
        [
          new BN(web3.utils.toWei("10000.123456", "ether")),
          new BN(web3.utils.toWei("20000.654321", "ether"))
        ],
        [
          new BN(web3.utils.toWei("123.456789", "ether")),
          new BN(web3.utils.toWei("456.789", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await pool.join(
        ownerB,
        pool.POOL_TOKEN_BASE.div(new BN(10)),
        [
          new BN(web3.utils.toWei("1000", "ether")),
          new BN(web3.utils.toWei("2000", "ether"))
        ],
        [
          new BN(web3.utils.toWei("0", "ether")),
          new BN(web3.utils.toWei("789", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await ctx.submitTransactions(16);
      await expectThrow(ctx.submitPendingBlocks(), "JOIN_SLIPPAGE_INVALID");
    });

    it("Invalid exit slippage", async () => {
      const feeBipsAMM = 30;
      const tokens = ["WETH", "GTO"];
      const weights = [
        new BN(web3.utils.toWei("1", "ether")),
        new BN(web3.utils.toWei("1", "ether"))
      ];

      for (const owner of [ownerA, ownerB]) {
        for (const token of tokens) {
          await ctx.deposit(
            owner,
            owner,
            token,
            new BN(web3.utils.toWei("1000000", "ether"))
          );
        }
      }

      const pool = new AmmPool(ctx);
      await pool.setupPool(sharedConfig, tokens, weights, feeBipsAMM);

      await agentRegistry.registerUniversalAgent(pool.contract.address, true, {
        from: registryOwner
      });

      await pool.prePoolTransactions();
      await pool.join(
        ownerA,
        pool.POOL_TOKEN_BASE,
        [
          new BN(web3.utils.toWei("10000.123456", "ether")),
          new BN(web3.utils.toWei("20000.654321", "ether"))
        ],
        [
          new BN(web3.utils.toWei("123.456789", "ether")),
          new BN(web3.utils.toWei("456.789", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await pool.join(
        ownerB,
        pool.POOL_TOKEN_BASE.div(new BN(11)),
        [
          new BN(web3.utils.toWei("1000", "ether")),
          new BN(web3.utils.toWei("2000", "ether"))
        ],
        [
          new BN(web3.utils.toWei("0", "ether")),
          new BN(web3.utils.toWei("789", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await ctx.submitTransactions(16);

      await pool.prePoolTransactions();
      await pool.exit(
        ownerA,
        pool.POOL_TOKEN_BASE.mul(new BN(6)).div(new BN(10)),
        [
          new BN(web3.utils.toWei("5000", "ether")),
          new BN(web3.utils.toWei("10000", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await pool.exit(
        ownerB,
        pool.POOL_TOKEN_BASE.mul(new BN(6)).div(new BN(100)),
        [
          new BN(web3.utils.toWei("5000", "ether")),
          new BN(web3.utils.toWei("10000", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await ctx.submitTransactions(16);
      await expectThrow(ctx.submitPendingBlocks(), "EXIT_SLIPPAGE_INVALID");
    });
  });
});
