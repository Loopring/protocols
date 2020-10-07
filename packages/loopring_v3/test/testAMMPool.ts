import BN = require("bn.js");
import { AmmPool } from "./ammUtils";
import { expectThrow } from "./expectThrow";
import { BalanceSnapshot, ExchangeTestUtil } from "./testExchangeUtil";
import { AuthMethod, SpotTrade } from "./types";

const AgentRegistry = artifacts.require("AgentRegistry");

contract("LoopringAmmPool", (accounts: string[]) => {
  let ctx: ExchangeTestUtil;

  let sharedConfig: any;
  let agentRegistry: any;
  let registryOwner: string;

  let ownerA: string;
  let ownerB: string;

  const setupDefaultPool = async () => {
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

    return pool;
  };

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
      const pool = await setupDefaultPool();

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
      await pool.verifySupply();

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
      await pool.verifySupply();

      // Force exit
      await pool.prePoolTransactions();
      // Try to send too low an exit fee
      const forcedExitFee = await sharedConfig.forcedExitFee();
      await expectThrow(
        pool.exit(
          ownerA,
          pool.POOL_TOKEN_BASE.div(new BN(10)),
          [
            new BN(web3.utils.toWei("100", "ether")),
            new BN(web3.utils.toWei("100", "ether"))
          ],
          { authMethod: AuthMethod.FORCE, forcedExitFee: new BN(0) }
        ),
        "INVALID_ETH_VALUE"
      );
      await expectThrow(
        pool.exit(
          ownerA,
          pool.POOL_TOKEN_BASE.div(new BN(10)),
          [
            new BN(web3.utils.toWei("100", "ether")),
            new BN(web3.utils.toWei("100", "ether"))
          ],
          {
            authMethod: AuthMethod.FORCE,
            forcedExitFee: forcedExitFee.sub(new BN(1))
          }
        ),
        "INVALID_ETH_VALUE"
      );
      // Try to burn more than the owner owns
      await expectThrow(
        pool.exit(
          ownerA,
          pool.POOL_TOKEN_BASE,
          [
            new BN(web3.utils.toWei("100", "ether")),
            new BN(web3.utils.toWei("100", "ether"))
          ],
          { authMethod: AuthMethod.FORCE }
        ),
        "TRANSFER_FAILURE"
      );
      // Everything Okay
      {
        // Simulate the fee transfer
        const snapshot = new BalanceSnapshot(ctx);
        await snapshot.transfer(
          ownerA,
          await ctx.exchange.owner(),
          "ETH",
          forcedExitFee,
          "owner",
          "operator"
        );
        const exit = await pool.exit(
          ownerA,
          pool.POOL_TOKEN_BASE.div(new BN(20)),
          [
            new BN(web3.utils.toWei("100", "ether")),
            new BN(web3.utils.toWei("100", "ether"))
          ],
          { authMethod: AuthMethod.FORCE }
        );
        // Verify balances
        await snapshot.verifyBalances();
        // Try do another forced withdrawal from the same owner
        await expectThrow(
          pool.exit(
            ownerA,
            pool.POOL_TOKEN_BASE.div(new BN(20)),
            [
              new BN(web3.utils.toWei("100", "ether")),
              new BN(web3.utils.toWei("100", "ether"))
            ],
            {
              authMethod: AuthMethod.FORCE,
              forcedExitFee: forcedExitFee.sub(new BN(1))
            }
          ),
          "DUPLICATE"
        );
        await ctx.submitTransactions();
        await ctx.submitPendingBlocks();
        // Check ForcedExitProcessed event
        const event = await ctx.assertEventEmitted(
          pool.contract,
          "ForcedExitProcessed"
        );
        assert.equal(event.owner, exit.owner, "unexpected exit owner");
        assert(
          event.burnAmount.eq(exit.burnAmount),
          "unexpected exit burn amount"
        );
        assert.equal(
          event.amounts.length,
          pool.tokens.length,
          "unexpected exit num amounts"
        );
        for (let i = 0; i < event.amounts.length; i++) {
          assert(
            new BN(event.burnAmount, 10).eq(exit.burnAmount),
            "unexpected exit amount"
          );
        }
      }
      await pool.verifySupply();

      // Do another forced exit with min amounts that are not achieved.
      // Exit should be processed, but the exit should not go through.
      {
        const exit = await pool.exit(
          ownerA,
          pool.POOL_TOKEN_BASE.div(new BN(20)),
          [
            new BN(web3.utils.toWei("10000", "ether")),
            new BN(web3.utils.toWei("10000", "ether"))
          ],
          { authMethod: AuthMethod.FORCE }
        );
        // The user should have received his liquidity tokens back
        const snapshot = new BalanceSnapshot(ctx);
        await snapshot.transfer(
          pool.contract.address,
          exit.owner,
          pool.contract.address,
          exit.burnAmount,
          "pool",
          "owner"
        );
        await ctx.submitTransactions();
        await ctx.submitPendingBlocks();
        // Verify balances
        await snapshot.verifyBalances();
        // Check ForcedExitProcessed event
        const event = await ctx.assertEventEmitted(
          pool.contract,
          "ForcedExitProcessed"
        );
        assert.equal(event.owner, exit.owner, "unexpected exit owner");
        assert(event.burnAmount.eq(new BN(0)), "unexpected exit burn amount");
        assert.equal(event.amounts.length, 0, "unexpected exit num amounts");
      }
      await pool.verifySupply();
    });

    it("No join signature", async () => {
      const pool = await setupDefaultPool();
      await pool.prePoolTransactions();
      await pool.join(
        ownerA,
        pool.POOL_TOKEN_BASE,
        [
          new BN(web3.utils.toWei("1000", "ether")),
          new BN(web3.utils.toWei("2000", "ether"))
        ],
        [
          new BN(web3.utils.toWei("0", "ether")),
          new BN(web3.utils.toWei("0", "ether"))
        ],
        { authMethod: AuthMethod.NONE }
      );
      await ctx.submitTransactions();
      await expectThrow(ctx.submitPendingBlocks(), "SUB_UNDERFLOW");
    });

    it("Invalid join signature", async () => {
      const pool = await setupDefaultPool();
      await pool.prePoolTransactions();
      await pool.join(
        ownerA,
        pool.POOL_TOKEN_BASE,
        [
          new BN(web3.utils.toWei("1000", "ether")),
          new BN(web3.utils.toWei("2000", "ether"))
        ],
        [
          new BN(web3.utils.toWei("0", "ether")),
          new BN(web3.utils.toWei("0", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA, signer: ownerB }
      );
      await ctx.submitTransactions();
      await expectThrow(ctx.submitPendingBlocks(), "INVALID_JOIN_APPROVAL");
    });

    it("No exit signature", async () => {
      const pool = await setupDefaultPool();
      pool.totalSupply = pool.POOL_TOKEN_BASE;
      await pool.prePoolTransactions();
      await pool.exit(
        ownerA,
        pool.POOL_TOKEN_BASE,
        [
          new BN(web3.utils.toWei("10000", "ether")),
          new BN(web3.utils.toWei("10000", "ether"))
        ],
        { authMethod: AuthMethod.NONE }
      );
      await ctx.submitTransactions();
      await expectThrow(ctx.submitPendingBlocks(), "FORCED_EXIT_NOT_FOUND");
    });

    it("Invalid exit signature", async () => {
      const pool = await setupDefaultPool();
      pool.totalSupply = pool.POOL_TOKEN_BASE;
      await pool.prePoolTransactions();
      await pool.exit(
        ownerA,
        pool.POOL_TOKEN_BASE,
        [
          new BN(web3.utils.toWei("10000", "ether")),
          new BN(web3.utils.toWei("10000", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA, signer: ownerB }
      );
      await ctx.submitTransactions();
      await expectThrow(ctx.submitPendingBlocks(), "INVALID_EXIT_APPROVAL");
    });

    it("Invalid join slippage", async () => {
      const pool = await setupDefaultPool();

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
      const pool = await setupDefaultPool();

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

    it("Shutdown", async () => {
      const pool = await setupDefaultPool();

      const amountsA = [
        new BN(web3.utils.toWei("10000", "ether")),
        new BN(web3.utils.toWei("20000", "ether"))
      ];
      const amountsB = [
        new BN(web3.utils.toWei("1000", "ether")),
        new BN(web3.utils.toWei("2000", "ether"))
      ];

      // Deposit to the pool
      await pool.prePoolTransactions();
      const joinA = await pool.join(
        ownerA,
        pool.POOL_TOKEN_BASE,
        amountsA,
        [
          new BN(web3.utils.toWei("123", "ether")),
          new BN(web3.utils.toWei("456", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      const joinB = await pool.join(
        ownerB,
        pool.POOL_TOKEN_BASE.div(new BN(10)),
        amountsB,
        [
          new BN(web3.utils.toWei("0", "ether")),
          new BN(web3.utils.toWei("789", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await ctx.submitTransactions(16);
      await ctx.submitPendingBlocks();
      await pool.verifySupply();

      // Withdraw ownerA's liquidity tokens
      await ctx.requestWithdrawal(
        ownerA,
        pool.contract.address,
        pool.POOL_TOKEN_BASE,
        "ETH",
        new BN(0)
      );
      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();
      await pool.verifySupply();

      // Try to shutdown without any pending forced exit
      await expectThrow(pool.contract.shutdown(ownerA), "INVALID_CHALLENGE");

      // Force exit
      await pool.prePoolTransactions();
      await pool.exit(ownerA, joinA.actualMintAmount.div(new BN(2)), amountsA, {
        authMethod: AuthMethod.FORCE,
        skip: true
      });

      // Try to shutdown too soon
      await expectThrow(pool.contract.shutdown(ownerA), "INVALID_CHALLENGE");

      const maxForcedExitAge = (
        await sharedConfig.maxForcedExitAge()
      ).toNumber();
      // Wait
      await ctx.advanceBlockTimestamp(maxForcedExitAge - 100);

      // Try to shutdown too soon
      await expectThrow(pool.contract.shutdown(ownerA), "INVALID_CHALLENGE");

      // Wait some more
      await ctx.advanceBlockTimestamp(200);

      // Try to withdraw before the pool is shutdown
      await expectThrow(pool.contract.withdrawWhenOffline(), "NOT_OFFLINE");

      // Shutdown
      await pool.contract.shutdown(ownerA, {
        value: new BN(web3.utils.toWei("1", "ether"))
      });
      await ctx.assertEventEmitted(pool.contract, "Shutdown");

      // Try to withdraw before the forced withdrawals are processed
      await expectThrow(
        pool.contract.withdrawWhenOffline(),
        "PENDING_WITHDRAWAL"
      );

      // Process the forced withdrawals
      for (const token of pool.tokens) {
        await ctx.requestWithdrawal(
          pool.contract.address,
          token,
          new BN(0),
          "ETH",
          new BN(0),
          {
            authMethod: AuthMethod.FORCE,
            skipForcedAuthentication: true,
            gas: 0
          }
        );
      }
      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();

      // Try to withdraw before the approved withdrawals have
      // actually been withdrawn to the pool contract.
      await expectThrow(
        pool.contract.withdrawWhenOffline(),
        "MORE_TO_WITHDRAWAL"
      );

      // Withdraw the approved withdrawals
      await pool.contract.withdrawFromApprovedWithdrawals();

      // Withdraw for ownerA
      {
        const snapshot = new BalanceSnapshot(ctx);
        for (const [i, token] of pool.tokens.entries()) {
          await snapshot.transfer(
            pool.contract.address,
            ownerA,
            token,
            amountsA[i],
            "pool",
            "owner"
          );
        }
        // Do the withdrawal
        await pool.contract.withdrawWhenOffline({ from: ownerA });
        // Verify balances
        await snapshot.verifyBalances();

        // Check if the expected amount was burned
        pool.totalSupply.isub(joinA.actualMintAmount);
        pool.verifySupply();

        // Try to withdraw again, nothing should be withdrawn
        await expectThrow(
          pool.contract.withdrawWhenOffline({ from: ownerA }),
          "ZERO_POOL_AMOUNT"
        );
      }

      // Withdraw ownerB's liquidity tokens
      await ctx.requestWithdrawal(
        ownerB,
        pool.contract.address,
        joinB.actualMintAmount,
        "ETH",
        new BN(0)
      );
      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();
      await pool.verifySupply();

      // Withdraw for ownerB
      {
        const snapshot = new BalanceSnapshot(ctx);
        for (const [i, token] of pool.tokens.entries()) {
          await snapshot.transfer(
            pool.contract.address,
            ownerB,
            token,
            amountsB[i],
            "pool",
            "owner"
          );
        }
        // Do the withdrawal
        await pool.contract.withdrawWhenOffline({ from: ownerB });
        // Verify balances
        await snapshot.verifyBalances();

        // Check if the expected amount was burned
        pool.totalSupply.isub(joinB.actualMintAmount);
        pool.verifySupply(new BN(0));
      }
    });
  });
});
