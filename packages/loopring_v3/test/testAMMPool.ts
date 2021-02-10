import BN = require("bn.js");
import { AmmPool, Permit, PermitUtils } from "./ammUtils";
import { expectThrow } from "./expectThrow";
import { Constants } from "loopringV3.js";
import { BalanceSnapshot, ExchangeTestUtil } from "./testExchangeUtil";
import { AuthMethod, SpotTrade } from "./types";
import { SignatureType, sign, verifySignature } from "../util/Signature";

const AgentRegistry = artifacts.require("AgentRegistry");

contract("LoopringAmmPool", (accounts: string[]) => {
  let ctx: ExchangeTestUtil;

  let sharedConfig: any;
  let agentRegistry: any;
  let registryOwner: string;

  let ownerA: string;
  let ownerB: string;
  let ownerC: string;

  let amountsA: BN[];
  let amountsB: BN[];

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
          new BN(web3.utils.toWei("10000000", "ether"))
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
    ownerC = ctx.testContext.orderOwners[12];

    amountsA = [
      new BN(web3.utils.toWei("10000.123456", "ether")),
      new BN(web3.utils.toWei("20000.654321", "ether"))
    ];
    amountsB = [
      new BN(web3.utils.toWei("1000", "ether")),
      new BN(web3.utils.toWei("2000", "ether"))
    ];

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

    it("Benchmark", async () => {
      const pool = await setupDefaultPool();
      await ctx.submitTransactions(16);
      await ctx.submitPendingBlocks();

      await pool.prePoolTransactions();
      for (let i = 0; i < 1; i++) {
        await pool.join(
          ownerA,
          pool.POOL_TOKEN_BASE,
          [
            new BN(web3.utils.toWei("1234567.89", "ether")),
            new BN(web3.utils.toWei("2345678.91", "ether"))
          ],
          { authMethod: AuthMethod.ECDSA }
        );
        await pool.join(
          ownerB,
          new BN(0),
          [
            new BN(web3.utils.toWei("123456.789", "ether")),
            new BN(web3.utils.toWei("234567.891", "ether"))
          ],
          { authMethod: AuthMethod.ECDSA }
        );
        await ctx.submitTransactions(16);
      }
      await ctx.submitPendingBlocks();
    });

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
        {
          authMethod: AuthMethod.ECDSA,
          fee: new BN(web3.utils.toWei("100.1234", "ether"))
        }
      );
      await pool.join(
        ownerB,
        pool.POOL_TOKEN_BASE.div(new BN(11)),
        [
          new BN(web3.utils.toWei("1000", "ether")),
          new BN(web3.utils.toWei("2000", "ether"))
        ],
        { authMethod: AuthMethod.APPROVE }
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
        {
          authMethod: AuthMethod.ECDSA,
          fee: new BN(web3.utils.toWei("100.1234", "ether"))
        }
      );
      await pool.exit(
        ownerB,
        pool.POOL_TOKEN_BASE.mul(new BN(6)).div(new BN(100)),
        [
          new BN(web3.utils.toWei("500", "ether")),
          new BN(web3.utils.toWei("1000", "ether"))
        ],
        { authMethod: AuthMethod.APPROVE }
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

    it("Successful swap (Large amounts)", async () => {
      const pool = await setupDefaultPool();

      await pool.prePoolTransactions();
      await pool.join(
        ownerA,
        pool.POOL_TOKEN_BASE,
        [
          new BN(web3.utils.toWei("1000000.123456", "ether")),
          new BN(web3.utils.toWei("2000000.654321", "ether"))
        ],
        { authMethod: AuthMethod.ECDSA }
      );
      await pool.join(
        ownerB,
        pool.POOL_TOKEN_BASE.div(new BN(11)),
        [
          new BN(web3.utils.toWei("100000", "ether")),
          new BN(web3.utils.toWei("200000", "ether"))
        ],
        {
          authMethod: AuthMethod.APPROVE,
          fee: new BN(web3.utils.toWei("123", "ether"))
        }
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
          new BN(web3.utils.toWei("500000", "ether")),
          new BN(web3.utils.toWei("1000000", "ether"))
        ],
        {
          authMethod: AuthMethod.ECDSA,
          fee: new BN(web3.utils.toWei("100.1234", "ether"))
        }
      );
      await pool.exit(
        ownerB,
        pool.POOL_TOKEN_BASE.mul(new BN(6)).div(new BN(100)),
        [
          new BN(web3.utils.toWei("50000", "ether")),
          new BN(web3.utils.toWei("100000", "ether"))
        ],
        { authMethod: AuthMethod.APPROVE }
      );
      await ctx.submitTransactions(16);
      await ctx.submitPendingBlocks();
      await pool.verifySupply();
    });

    it("Add/Remove liquidity using L2 signatures", async () => {
      const pool = await setupDefaultPool();

      await pool.prePoolTransactions();
      await pool.join(
        ownerA,
        pool.POOL_TOKEN_BASE,
        [
          new BN(web3.utils.toWei("10000", "ether")),
          new BN(web3.utils.toWei("20000", "ether"))
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
        {
          authMethod: AuthMethod.EDDSA,
          fee: new BN(web3.utils.toWei("100", "ether"))
        }
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
        {
          authMethod: AuthMethod.EDDSA,
          fee: new BN(web3.utils.toWei("100", "ether"))
        }
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
    });

    it("No join signature", async () => {
      const pool = await setupDefaultPool();
      await pool.prePoolTransactions();
      await pool.join(ownerA, pool.POOL_TOKEN_BASE, amountsA, {
        authMethod: AuthMethod.NONE
      });
      await ctx.submitTransactions();
      await expectThrow(ctx.submitPendingBlocks(), "INVALID_ONCHAIN_APPROVAL");
    });

    it("Invalid join signature (ECDSA)", async () => {
      const pool = await setupDefaultPool();
      await pool.prePoolTransactions();
      await pool.join(ownerA, pool.POOL_TOKEN_BASE, amountsA, {
        authMethod: AuthMethod.ECDSA,
        signer: ownerB
      });
      await ctx.submitTransactions();
      await expectThrow(
        ctx.submitPendingBlocks(),
        "INVALID_OFFCHAIN_L1_APPROVAL"
      );
    });

    it("Invalid join signature (EDDSA)", async () => {
      const pool = await setupDefaultPool();
      await pool.prePoolTransactions();
      await pool.join(ownerA, pool.POOL_TOKEN_BASE, amountsA, {
        authMethod: AuthMethod.EDDSA,
        invalidTxHash: true
      });
      await ctx.submitTransactions();
      await expectThrow(
        ctx.submitPendingBlocks(),
        "INVALID_OFFCHAIN_L2_APPROVAL"
      );
    });

    it("No exit signature", async () => {
      const pool = await setupDefaultPool();
      pool.totalSupply = pool.POOL_TOKEN_BASE;
      await pool.prePoolTransactions();
      await pool.exit(ownerA, pool.POOL_TOKEN_BASE, amountsB, {
        authMethod: AuthMethod.NONE
      });
      await ctx.submitTransactions();
      await expectThrow(ctx.submitPendingBlocks(), "INVALID_ONCHAIN_APPROVAL");
    });

    it("Invalid exit signature (ECDSA)", async () => {
      const pool = await setupDefaultPool();
      pool.totalSupply = pool.POOL_TOKEN_BASE;
      await pool.prePoolTransactions();
      await pool.exit(ownerA, pool.POOL_TOKEN_BASE, amountsA, {
        authMethod: AuthMethod.ECDSA,
        signer: ownerB
      });
      await ctx.submitTransactions();
      await expectThrow(ctx.submitPendingBlocks(), "INVALID_OFFCHAIN_APPROVAL");
    });

    it("Invalid exit signature (EDDSA)", async () => {
      const pool = await setupDefaultPool();
      pool.totalSupply = pool.POOL_TOKEN_BASE;
      await pool.prePoolTransactions();
      await pool.exit(ownerA, pool.POOL_TOKEN_BASE, amountsA, {
        authMethod: AuthMethod.EDDSA,
        invalidTxHash: true
      });
      await ctx.submitTransactions();
      await expectThrow(
        ctx.submitPendingBlocks(),
        "INVALID_OFFCHAIN_L2_APPROVAL"
      );
    });

    it("Invalid join slippage", async () => {
      const pool = await setupDefaultPool();

      await pool.prePoolTransactions();
      await pool.join(ownerA, pool.POOL_TOKEN_BASE, amountsA, {
        authMethod: AuthMethod.ECDSA
      });
      await pool.join(ownerB, pool.POOL_TOKEN_BASE.div(new BN(10)), amountsB, {
        authMethod: AuthMethod.ECDSA
      });
      await ctx.submitTransactions(16);
      await expectThrow(ctx.submitPendingBlocks(), "JOIN_SLIPPAGE_INVALID");
    });

    it("Invalid exit slippage", async () => {
      const pool = await setupDefaultPool();

      await pool.prePoolTransactions();
      await pool.join(ownerA, pool.POOL_TOKEN_BASE, amountsA, {
        authMethod: AuthMethod.ECDSA
      });
      await pool.join(ownerB, pool.POOL_TOKEN_BASE.div(new BN(11)), amountsA, {
        authMethod: AuthMethod.ECDSA
      });
      await ctx.submitTransactions(16);

      await pool.prePoolTransactions();
      await pool.exit(
        ownerA,
        pool.POOL_TOKEN_BASE.mul(new BN(6)).div(new BN(10)),
        amountsA,
        { authMethod: AuthMethod.ECDSA }
      );
      await pool.exit(
        ownerB,
        pool.POOL_TOKEN_BASE.mul(new BN(6)).div(new BN(100)),
        amountsB,
        { authMethod: AuthMethod.ECDSA }
      );
      await ctx.submitTransactions(16);
      await expectThrow(ctx.submitPendingBlocks(), "EXIT_SLIPPAGE_INVALID");
    });

    it("Unsatisfied forced exit", async () => {
      const pool = await setupDefaultPool();

      await pool.prePoolTransactions();
      await pool.join(ownerA, pool.POOL_TOKEN_BASE, amountsA, {
        authMethod: AuthMethod.ECDSA
      });
      await ctx.submitTransactions();

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

      await pool.prePoolTransactions();
      const exit = await pool.exit(
        ownerA,
        pool.POOL_TOKEN_BASE,
        [amountsA[0].mul(new BN(2)), amountsA[1].mul(new BN(2))],
        { authMethod: AuthMethod.FORCE }
      );

      // Simulate the transfer back of the pool token
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
      assert(event.burnAmount.eq(new BN(0)), "unexpected burn amount");
    });

    it("Expired join", async () => {
      const pool = await setupDefaultPool();

      await pool.prePoolTransactions();
      await pool.join(ownerA, pool.POOL_TOKEN_BASE, amountsA, {
        authMethod: AuthMethod.ECDSA
      });
      await pool.join(ownerB, pool.POOL_TOKEN_BASE.div(new BN(10)), amountsB, {
        authMethod: AuthMethod.ECDSA,
        validUntil: 123
      });
      await ctx.submitTransactions(16);
      await expectThrow(ctx.submitPendingBlocks(), "EXPIRED");
    });

    it("Expired exit", async () => {
      const pool = await setupDefaultPool();

      await pool.prePoolTransactions();
      await pool.join(ownerA, pool.POOL_TOKEN_BASE, amountsA, {
        authMethod: AuthMethod.ECDSA
      });
      await pool.join(ownerB, pool.POOL_TOKEN_BASE.div(new BN(11)), amountsB, {
        authMethod: AuthMethod.ECDSA
      });
      await ctx.submitTransactions(16);

      await pool.prePoolTransactions();
      await pool.exit(ownerA, pool.POOL_TOKEN_BASE, amountsA, {
        authMethod: AuthMethod.ECDSA,
        validUntil: 456
      });
      await pool.exit(ownerB, pool.POOL_TOKEN_BASE.div(new BN(11)), amountsB, {
        authMethod: AuthMethod.ECDSA
      });
      await ctx.submitTransactions(16);
      await expectThrow(ctx.submitPendingBlocks(), "EXPIRED");
    });

    [false, true].forEach(function(withForcedWithdrawals) {
      it(
        "Shutdown " +
          (withForcedWithdrawals ? "(forced withdrawal)" : "(withdrawal mode)"),
        async () => {
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

            { authMethod: AuthMethod.ECDSA }
          );
          const joinB = await pool.join(
            ownerB,
            pool.POOL_TOKEN_BASE.div(new BN(10)),
            amountsB,

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
          await expectThrow(
            pool.contract.shutdown(ownerA),
            "INVALID_CHALLENGE"
          );

          let forcedExitAmountA = new BN(0);
          if (withForcedWithdrawals) {
            // Force exit
            await pool.prePoolTransactions();
            const exitA = await pool.exit(
              ownerA,
              joinA.actualMintAmount.div(new BN(2)),
              amountsA,
              {
                authMethod: AuthMethod.FORCE,
                skip: true
              }
            );

            // Try to shutdown too soon
            await expectThrow(
              pool.contract.shutdown(ownerA),
              "INVALID_CHALLENGE"
            );

            const maxForcedExitAge = (
              await sharedConfig.maxForcedExitAge()
            ).toNumber();
            // Wait
            await ctx.advanceBlockTimestamp(maxForcedExitAge - 100);

            // Try to shutdown too soon
            await expectThrow(
              pool.contract.shutdown(ownerA),
              "INVALID_CHALLENGE"
            );

            // Wait some more
            await ctx.advanceBlockTimestamp(200);

            // Try to withdraw before the pool is shutdown
            await expectThrow(
              pool.contract.withdrawWhenOffline(),
              "NOT_OFFLINE"
            );

            // Shutdown
            await pool.contract.shutdown(ownerA, {
              value: new BN(web3.utils.toWei("1", "ether"))
            });
            await ctx.assertEventEmitted(pool.contract, "Shutdown");

            // Try to shutdown again
            await expectThrow(pool.contract.shutdown(ownerA), "NOT_ONLINE");

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
              "MORE_TO_WITHDRAW"
            );

            // Withdraw the approved withdrawals to the pool contract
            await ctx.exchange.withdrawFromApprovedWithdrawals(
              new Array(pool.tokens.length).fill(pool.contract.address),
              pool.tokens.map(token => ctx.getTokenAddress(token))
            );

            forcedExitAmountA = exitA.burnAmount;
          } else {
            // Force the exchange into withdrawal mode
            const withdrawal = await ctx.requestWithdrawal(
              ownerA,
              "ETH",
              new BN(1),
              "ETH",
              new BN(0),
              { authMethod: AuthMethod.FORCE }
            );

            // Wait
            await ctx.advanceBlockTimestamp(
              ctx.MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE + 100
            );

            // Activate withdrawal mode
            await ctx.exchange.notifyForcedRequestTooOld(
              withdrawal.accountID,
              Constants.zeroAddress
            );
            const inWithdrawalMode = await ctx.exchange.isInWithdrawalMode();
            assert(inWithdrawalMode, "exchange not in withdrawal mode");

            // Can immediately shutdown the pool
            await pool.contract.shutdown(Constants.zeroAddress);
            await ctx.assertEventEmitted(pool.contract, "Shutdown");

            // Try to withdraw before funds have been withdrawn to the pool contract
            await expectThrow(
              pool.contract.withdrawWhenOffline(),
              "PENDING_WITHDRAWAL"
            );

            // Withdraw from the Merkle tree
            for (const token of pool.tokens) {
              await ctx.withdrawFromMerkleTree(pool.accountID, token);
            }
          }

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
            await snapshot.transfer(
              ownerA,
              pool.contract.address,
              pool.contract.address,
              joinA.actualMintAmount.sub(forcedExitAmountA),
              "owner",
              "pool"
            );
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
          if (withForcedWithdrawals) {
            await ctx.requestWithdrawal(
              ownerB,
              pool.contract.address,
              joinB.actualMintAmount,
              "ETH",
              new BN(0)
            );
            await ctx.submitTransactions();
            await ctx.submitPendingBlocks();
          } else {
            await ctx.withdrawFromMerkleTree(
              ctx.getAccountID(ownerB),
              pool.contract.address
            );
          }
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
        }
      );
    });
  });

  describe("Pool ERC20", function() {
    this.timeout(0);

    let pool: AmmPool;

    beforeEach(async () => {
      pool = await setupDefaultPool();

      await pool.prePoolTransactions();
      await pool.join(ownerA, pool.POOL_TOKEN_BASE, amountsA, {
        authMethod: AuthMethod.ECDSA
      });

      // Withdraw some liquidity tokens
      await ctx.requestWithdrawal(
        ownerA,
        pool.contract.address,
        pool.POOL_TOKEN_BASE,
        "ETH",
        new BN(0)
      );
      await ctx.submitTransactions();
      await ctx.submitPendingBlocks();
    });

    it("approve", async () => {
      const spender = ctx.exchange.address;
      const value = new BN(web3.utils.toWei("123", "ether"));

      const allowanceBefore = await pool.contract.allowance(ownerA, spender);
      await pool.contract.approve(spender, value, { from: ownerA });
      const allowanceAfter = await pool.contract.allowance(ownerA, spender);
      assert(
        allowanceAfter.eq(allowanceBefore.add(value)),
        "allowance expected"
      );
    });

    it("transfer", async () => {
      const value = pool.POOL_TOKEN_BASE.div(new BN(2));
      const from = ownerA;
      const to = ownerB;

      const snapshot = new BalanceSnapshot(ctx);
      await snapshot.transfer(from, to, pool.contract.address, value);
      await pool.contract.transfer(to, value, { from: ownerA });
      await snapshot.verifyBalances();

      await expectThrow(
        pool.contract.transfer(to, pool.POOL_TOKEN_BASE, { from: ownerA }),
        "SUB_UNDERFLOW"
      );
    });

    it("transferFrom", async () => {
      const value = pool.POOL_TOKEN_BASE.div(new BN(2));
      const from = ownerA;
      const to = ownerB;
      const spender = ownerC;

      await pool.contract.approve(spender, value, { from: ownerA });

      // Use up allowance
      const snapshot = new BalanceSnapshot(ctx);
      await snapshot.transfer(from, to, pool.contract.address, value);
      await pool.contract.transferFrom(from, to, value, { from: spender });
      await snapshot.verifyBalances();

      const allowanceAfter = await pool.contract.allowance(ownerA, spender);
      assert(allowanceAfter.eq(new BN(0)), "allowance unexpected");

      // Try to spend more
      await expectThrow(
        pool.contract.transferFrom(from, to, value, { from: spender }),
        "SUB_UNDERFLOW"
      );
    });

    it("permit", async () => {
      const spender = ctx.exchange.address;
      const value = new BN(web3.utils.toWei("123", "ether"));

      const nonceBefore = await pool.contract.nonces(ownerA);
      const allowanceBefore = await pool.contract.allowance(ownerA, spender);

      const permit: Permit = {
        owner: ownerA,
        spender,
        value,
        nonce: await pool.contract.nonces(ownerA),
        deadline: new BN(0xffffffff)
      };
      const hash = PermitUtils.getHash(permit, pool.contract.address);
      const signature = await sign(ownerA, hash, SignatureType.EIP_712);
      await verifySignature(ownerA, hash, signature);
      await pool.contract.permit(
        permit.owner,
        permit.spender,
        permit.value,
        permit.deadline,
        signature
      );

      const nonceAfter = await pool.contract.nonces(ownerA);
      const allowanceAfter = await pool.contract.allowance(ownerA, spender);
      assert(nonceAfter.eq(nonceBefore.add(new BN(1))), "nonce expected");
      assert(
        allowanceAfter.eq(allowanceBefore.add(value)),
        "allowance expected"
      );

      // Try to use the permit again
      await expectThrow(
        pool.contract.permit(
          permit.owner,
          permit.spender,
          permit.value,
          permit.deadline,
          signature
        ),
        "INVALID_SIGNATURE"
      );

      // Try to use an expired permit
      permit.deadline = new BN(1);
      await expectThrow(
        pool.contract.permit(
          permit.owner,
          permit.spender,
          permit.value,
          permit.deadline,
          signature
        ),
        "EXPIRED"
      );
    });
  });
});
