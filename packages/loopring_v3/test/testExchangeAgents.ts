import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { BalanceSnapshot, ExchangeTestUtil } from "./testExchangeUtil";

contract("Exchange", (accounts: string[]) => {
  let ctx: ExchangeTestUtil;
  let exchange: any;
  let exchangeOwner: string;

  let ownerA: string;
  let ownerB: string;
  let ownerC: string;
  let ownerD: string;

  const createExchange = async (bSetupTestState: boolean = true) => {
    await ctx.createExchange(ctx.testContext.stateOwners[0], bSetupTestState);
    exchange = ctx.exchange;
    exchangeOwner = ctx.exchangeOwner;
  };

  const authorizeAgentsChecked = async (
    owner: string,
    agents: string[],
    authorized: boolean[],
    from: string
  ) => {
    await exchange.authorizeAgents(owner, agents, authorized, { from });
    const events = await ctx.assertEventsEmitted(
      exchange,
      "AgentAuthorized",
      agents.length
    );
    for (const [i, event] of events.entries()) {
      assert.equal(event.owner, owner, "owner unexpected");
      assert.equal(event.agent, agents[i], "agent unexpected");
      assert.equal(event.authorized, authorized[i], "authorized unexpected");

      const isAgent = await exchange.isAgent(owner, agents[i]);
      assert.equal(isAgent, authorized[i], "isAgent unexpected");
    }
  };

  const whitelistAgentsChecked = async (
    agents: string[],
    authorized: boolean[],
    from: string
  ) => {
    await exchange.whitelistAgents(agents, authorized, { from });
    const events = await ctx.assertEventsEmitted(
      exchange,
      "AgentWhitelisted",
      agents.length
    );
    for (const [i, event] of events.entries()) {
      assert.equal(event.agent, agents[i], "agent unexpected");
      assert.equal(event.authorized, authorized[i], "authorized unexpected");

      for (const owner of [ownerA, ownerB, ownerC, ownerD]) {
        const isAgent = await exchange.isAgent(owner, agents[i]);
        assert.equal(
          isAgent,
          authorized[i] || owner === agents[i],
          "isAgent unexpected"
        );
      }
    }
  };

  const onchainTransferFromChecked = async (
    from: string,
    to: string,
    token: string,
    amount: BN,
    sender: string
  ) => {
    token = ctx.getTokenAddress(token);

    // Simulate all transfers
    const snapshot = new BalanceSnapshot(ctx);
    await snapshot.transfer(from, to, token, amount, "from", "to");

    // Do the transfer
    await exchange.onchainTransferFrom(from, to, token, amount, {
      from: sender
    });

    // Verify balances
    await snapshot.verifyBalances();
  };

  before(async () => {
    ctx = new ExchangeTestUtil();
    await ctx.initialize(accounts);

    ownerA = ctx.testContext.orderOwners[0];
    ownerB = ctx.testContext.orderOwners[1];
    ownerC = ctx.testContext.orderOwners[2];
    ownerD = ctx.testContext.orderOwners[3];
  });

  after(async () => {
    await ctx.stop();
  });

  describe("Agents", function() {
    this.timeout(0);

    it("should be able to whitelist and dewhitelist agents", async () => {
      await createExchange();

      // Only the exchange owner should be able to whitelist agents
      await expectThrow(
        whitelistAgentsChecked([ownerA], [true], ownerB),
        "UNAUTHORIZED"
      );

      // Authorize an agent
      await whitelistAgentsChecked([ownerA], [true], exchangeOwner);

      // Try to whitelist another agent using a non-agent address
      await expectThrow(
        whitelistAgentsChecked([ownerB], [true], ownerC),
        "UNAUTHORIZED"
      );

      // Whitelist new agents
      await whitelistAgentsChecked(
        [ownerB, ownerC],
        [true, true],
        exchangeOwner
      );

      // Whitelist/Dewhitelist agents
      await whitelistAgentsChecked(
        [ownerB, ownerD],
        [false, true],
        exchangeOwner
      );

      // Dewhitelist agents
      await whitelistAgentsChecked([ownerD], [false], exchangeOwner);
    });

    it("should be able to authorize and deauthorize an agent", async () => {
      await createExchange();

      // Only the owner should be able to authorize the first agent
      await expectThrow(
        authorizeAgentsChecked(ownerA, [ownerB], [true], ownerB),
        "UNAUTHORIZED"
      );

      // Authorize an agent
      await authorizeAgentsChecked(ownerA, [ownerB], [true], ownerA);

      // Try to authorize another agent using a non-agent address
      await expectThrow(
        authorizeAgentsChecked(ownerA, [ownerD], [true], ownerC),
        "UNAUTHORIZED"
      );

      // Authorize a new agent using an agent
      await authorizeAgentsChecked(ownerA, [ownerC], [true], ownerB);

      // Deauthorize the old agent with the new agent
      await authorizeAgentsChecked(ownerA, [ownerB], [false], ownerC);

      // Make sure the deauthorized agent isn't an agent anymore
      await expectThrow(
        authorizeAgentsChecked(ownerA, [ownerD], [true], ownerB),
        "UNAUTHORIZED"
      );
    });

    it("should be able to call agent functions", async () => {
      await createExchange();

      const withdrawalFee = await ctx.loopringV3.forcedWithdrawalFee();
      const depositFee = ctx.getRandomFee();

      const agent = ownerC;

      const token = ctx.getTokenAddress("LRC");

      await expectThrow(
        exchange.deposit(ownerA, ownerA, token, new BN(0), "0x", {
          from: agent,
          value: depositFee
        }),
        "UNAUTHORIZED"
      );

      await expectThrow(
        exchange.forceWithdraw(ownerA, 0, [token], {
          from: agent,
          value: withdrawalFee
        }),
        "UNAUTHORIZED"
      );

      await expectThrow(
        exchange.authorizeAgents(ownerA, [agent], [true], { from: agent }),
        "UNAUTHORIZED"
      );

      await expectThrow(
        exchange.approveTransaction(ownerA, Buffer.from("FF"), {
          from: agent
        }),
        "UNAUTHORIZED"
      );

      await expectThrow(
        exchange.approveOffchainTransfer(
          ownerA,
          ownerB,
          token,
          new BN(0),
          token,
          new BN(0),
          new BN(0),
          new BN(1),
          {
            from: agent
          }
        ),
        "UNAUTHORIZED"
      );

      await expectThrow(
        exchange.onchainTransferFrom(ownerA, ownerB, token, new BN(0), {
          from: agent
        }),
        "UNAUTHORIZED"
      );

      // Authorize the agent
      await authorizeAgentsChecked(ownerA, [agent], [true], ownerA);

      // Now call the functions successfully

      await exchange.deposit(ownerA, ownerA, token, new BN(0), "0x", {
        from: agent,
        value: depositFee
      });

      await exchange.forceWithdraw(ownerA, 0, [token], {
        from: agent,
        value: withdrawalFee
      });

      await exchange.authorizeAgents(ownerA, [agent], [true], { from: agent });

      await exchange.approveTransaction(ownerA, Buffer.from("FF"), {
        from: agent
      });

      await exchange.approveOffchainTransfer(
        ownerA,
        ownerB,
        token,
        new BN(0),
        token,
        new BN(0),
        new BN(0),
        new BN(1),
        {
          from: agent
        }
      );

      await exchange.onchainTransferFrom(ownerA, ownerB, token, new BN(0), {
        from: agent
      });
    });

    it("agent should be able to transfer onchain funds", async () => {
      await createExchange();

      const amount = new BN(web3.utils.toWei("412.8", "ether"));

      // Authorize an agent
      await authorizeAgentsChecked(ownerA, [ownerD], [true], ownerA);

      await ctx.setBalanceAndApprove(ownerA, "LRC", amount);
      // Transfer the tokens
      await onchainTransferFromChecked(
        ownerA,
        ownerB,
        "LRC",
        amount.div(new BN(2)),
        ownerA
      );
      await onchainTransferFromChecked(
        ownerA,
        ownerC,
        "LRC",
        amount.div(new BN(2)),
        ownerD
      );

      // Try to transfer again after all funds depleted
      await expectThrow(
        onchainTransferFromChecked(
          ownerA,
          ownerC,
          "LRC",
          amount.div(new BN(2)),
          ownerD
        ),
        "TRANSFER_FAILED"
      );
    });
  });
});
