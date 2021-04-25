import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { BalanceSnapshot, ExchangeTestUtil } from "./testExchangeUtil";
import { Constants } from "loopringV3.js";

const AgentRegistry = artifacts.require("AgentRegistry");

contract("Exchange", (accounts: string[]) => {
  let ctx: ExchangeTestUtil;
  let exchange: any;
  let exchangeOwner: string;

  let agentRegistry: any;
  let registryOwner: string;

  let ownerA: string;
  let ownerB: string;
  let ownerC: string;
  let ownerD: string;

  const createExchange = async (setupTestState: boolean = true) => {
    await ctx.createExchange(ctx.testContext.stateOwners[0], {
      setupTestState,
      useOwnerContract: false
    });
    exchange = ctx.exchange;
    exchangeOwner = ctx.exchangeOwner;

    // Create the agent registry
    registryOwner = accounts[7];
    agentRegistry = await AgentRegistry.new({ from: registryOwner });

    // Register it on the exchange contract
    await exchange.setAgentRegistry(agentRegistry.address, {
      from: exchangeOwner
    });
    // Check if it's set correctly
    const exchangeAgentRegistry = await exchange.getAgentRegistry();
    assert.equal(
      exchangeAgentRegistry,
      agentRegistry.address,
      "unexpected agent registry"
    );
  };

  const registerUserAgentChecked = async (
    agent: string,
    registered: boolean,
    from: string
  ) => {
    await agentRegistry.registerUserAgent(agent, registered, { from });
    const event = await ctx.assertEventEmitted(
      agentRegistry,
      "AgentRegistered"
    );
    assert.equal(event.user, from, "user unexpected");
    assert.equal(event.agent, agent, "agent unexpected");
    assert.equal(event.registered, registered, "registered unexpected");

    const isUserAgent = await agentRegistry.isUserAgent(from, agent);
    assert.equal(isUserAgent, registered, "isUserAgent unexpected");

    const isAgent = await agentRegistry.isAgent(from, agent);
    assert.equal(isAgent, registered, "isAgent unexpected");
  };

  const registerUniversalAgentChecked = async (
    agent: string,
    registered: boolean,
    from: string
  ) => {
    await agentRegistry.registerUniversalAgent(agent, registered, { from });
    const event = await ctx.assertEventEmitted(
      agentRegistry,
      "AgentRegistered"
    );
    assert.equal(event.user, Constants.zeroAddress, "user unexpected");
    assert.equal(event.agent, agent, "agent unexpected");
    assert.equal(event.registered, registered, "registered unexpected");

    const isUniversalAgent = await agentRegistry.isUniversalAgent(agent);
    assert.equal(isUniversalAgent, registered, "isUniversalAgent unexpected");

    for (const owner of [ownerA, ownerB, ownerC, ownerD]) {
      const isAgent = await agentRegistry.isAgent(owner, agent);
      assert.equal(isAgent, registered, "isAgent unexpected");
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
        registerUniversalAgentChecked(ownerA, true, ownerB),
        "UNAUTHORIZED"
      );

      // Whitelist an agent
      await registerUniversalAgentChecked(ownerA, true, registryOwner);

      // Whitelist new agent
      await registerUniversalAgentChecked(ownerD, true, registryOwner);

      // Dewhitelist agent
      await registerUniversalAgentChecked(ownerA, false, registryOwner);

      // User stops trusting universal agents
      // await agentRegistry.trustUniversalAgents(false, { from: ownerB });
      // const isAgent = await agentRegistry.isAgent(ownerB, ownerD);
      // assert.equal(isAgent, false, "isAgent unexpected");
    });

    it("should be able to authorize and deauthorize an agent", async () => {
      await createExchange();

      // Authorize an agent
      await registerUserAgentChecked(ownerB, true, ownerA);

      // Authorize another agent
      await registerUserAgentChecked(ownerC, true, ownerA);

      // Deauthorize an agent
      await registerUserAgentChecked(ownerB, false, ownerA);
    });

    it("should be able to call agent functions", async () => {
      await createExchange();

      const withdrawalFee = await ctx.loopringV3.forcedWithdrawalFee();

      const agent = ownerC;

      const token = ctx.getTokenAddress("LRC");

      await expectThrow(
        exchange.forceWithdraw(ownerA, token, 0, {
          from: agent,
          value: withdrawalFee
        }),
        "UNAUTHORIZED"
      );

      await expectThrow(
        exchange.approveTransaction(ownerA, Buffer.from("FF"), {
          from: agent
        }),
        "UNAUTHORIZED"
      );

      await expectThrow(
        exchange.setWithdrawalRecipient(
          ownerA,
          ownerB,
          token,
          new BN(0),
          0,
          ownerB,
          {
            from: agent
          }
        ),
        "UNAUTHORIZED"
      );

      // await expectThrow(
      //   exchange.onchainTransferFrom(ownerA, ownerB, token, new BN(0), {
      //     from: agent
      //   }),
      //   "UNAUTHORIZED"
      // );

      // Authorize the agent
      await registerUserAgentChecked(agent, true, ownerA);

      // Now call the functions successfull
      await exchange.forceWithdraw(ownerA, token, 0, {
        from: agent,
        value: withdrawalFee
      });

      await exchange.approveTransaction(ownerA, Buffer.from("FF"), {
        from: agent
      });

      await exchange.setWithdrawalRecipient(
        ownerA,
        ownerB,
        token,
        new BN(0),
        0,
        ownerB,
        {
          from: agent
        }
      );

      // await exchange.onchainTransferFrom(ownerA, ownerB, token, new BN(0), {
      //   from: agent
      // });
    });

    it.skip("agent should be able to transfer onchain funds", async () => {
      await createExchange();

      const amount = new BN(web3.utils.toWei("412.8", "ether"));

      // Authorize an agent
      await registerUserAgentChecked(ownerD, true, ownerA);

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
        "TRANSFER_FAILURE"
      );
    });
  });
});
